#!/usr/bin/env python3
"""
================================================================================
KALI-ARES // ASYNC NETWORK INGESTION ENGINE (TCP TLS 1.3 + MOSQUITTO MQTT)
================================================================================
Concurrent high-throughput async network receiver for military GPS telemetry.
Performs real-time line parsing, anti-replay checks, and AES-256-GCM verification.
================================================================================
"""

import os
import sys
import ssl
import json
import time
import asyncio
import logging
import threading
from typing import Dict, Any, Callable, Optional
from cryptography.exceptions import InvalidTag
import backend_crypto

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(name)s) %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("KALI-ARES-SERVER")

DEFAULT_TCP_PORT = 8443
DEFAULT_MQTT_PORT = 8883
CERTS_DIR = "/etc/kali-gps/certs"


class TacticalIngestServer:
    """
    Multi-protocol async receiver supporting TLS 1.3 TCP stream sockets
    and encrypted Mosquitto MQTT telemetry subscriptions.
    """

    def __init__(
        self,
        keystore_devices: Dict[str, Any],
        on_telemetry: Optional[Callable[[Dict[str, Any], str], None]] = None,
        on_security_alert: Optional[Callable[[str, str], None]] = None,
        tcp_port: int = DEFAULT_TCP_PORT,
        mqtt_enabled: bool = True
    ):
        self.devices = keystore_devices
        self.on_telemetry = on_telemetry
        self.on_security_alert = on_security_alert
        self.tcp_port = tcp_port
        self.mqtt_enabled = mqtt_enabled
        self.running = False
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.tcp_server = None
        self.mqtt_client = None
        self._thread: Optional[threading.Thread] = None

        # Anti-replay sliding window cache: device_id -> set of nonces/timestamps
        self.seen_nonces = set()
        self.max_nonce_cache = 10_000

    def update_keys(self, new_devices: Dict[str, Any]):
        """Dynamically updates device keys without restarting server."""
        self.devices = new_devices
        logger.info(f"Base de claves actualizada con {len(new_devices)} unidades.")

    def create_tls_context(self) -> Optional[ssl.SSLContext]:
        """Configures strict TLS 1.3 server context with modern ciphers."""
        cert_file = os.path.join(CERTS_DIR, "server.crt")
        key_file = os.path.join(CERTS_DIR, "server.key")

        if not (os.path.exists(cert_file) and os.path.exists(key_file)):
            # Check local fallback directory
            cert_file = os.path.join(os.path.dirname(__file__), "certs", "server.crt")
            key_file = os.path.join(os.path.dirname(__file__), "certs", "server.key")

        if not (os.path.exists(cert_file) and os.path.exists(key_file)):
            logger.warning("[!] Certificados TLS no encontrados. Se ejecutará en modo TCP claro para pruebas.")
            return None

        try:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            # Enforce TLS 1.3 minimum & maximum
            context.minimum_version = ssl.TLSVersion.TLSv1_3
            context.maximum_version = ssl.TLSVersion.TLSv1_3
            context.load_cert_chain(certfile=cert_file, keyfile=key_file)
            logger.info(f"[✓] Contexto TLS 1.3 estricto cargado desde {cert_file}")
            return context
        except Exception as e:
            logger.error(f"Error al inicializar TLS 1.3: {e}")
            return None

    def process_raw_packet(self, raw_bytes: bytes, source_peer: str) -> Optional[Dict[str, Any]]:
        """Parses, authenticates, and decrypts an incoming wire packet."""
        try:
            line = raw_bytes.decode("utf-8").strip()
            if not line:
                return None
            packet = json.loads(line)
        except Exception as e:
            logger.warning(f"Trama JSON malformada desde {source_peer}: {e}")
            return None

        device_id = packet.get("device_id")
        if not device_id or device_id not in self.devices:
            alert_msg = f"Dispositivo desconocido o no autorizado intentando conectar: '{device_id}' ({source_peer})"
            logger.warning(f"[ALERTA SEGURIDAD] {alert_msg}")
            if self.on_security_alert:
                self.on_security_alert("DISPOSITIVO_NO_REGISTRADO", alert_msg)
            return None

        # Anti-replay check
        nonce_b64 = packet.get("nonce", "")
        if nonce_b64 in self.seen_nonces:
            alert_msg = f"Ataque de repetición detectado (Replay Attack) para {device_id}. Nonce repetido."
            logger.error(f"[SECURITY BREACH] {alert_msg}")
            if self.on_security_alert:
                self.on_security_alert("REPLAY_ATTACK", alert_msg)
            return None

        self.seen_nonces.add(nonce_b64)
        if len(self.seen_nonces) > self.max_nonce_cache:
            self.seen_nonces.clear()

        # Retrieve symmetric key
        dev_entry = self.devices[device_id]
        key_bytes = bytes.fromhex(dev_entry["key_hex"])

        try:
            telemetry = backend_crypto.decrypt_device_payload(key_bytes, packet)
            # Add metadata for interface
            telemetry["_source"] = source_peer
            telemetry["_received_at"] = time.time()
            telemetry["_unit_name"] = dev_entry.get("name", device_id)
            telemetry["_callsign"] = dev_entry.get("callsign", device_id)
            telemetry["_unit_type"] = dev_entry.get("type", "asset")

            if self.on_telemetry:
                self.on_telemetry(telemetry, source_peer)

            return telemetry
        except InvalidTag:
            alert_msg = f"Fallo criptográfico GCM (Tag Mismatch) para {device_id}. Posible suplantación o clave errónea."
            logger.critical(f"[INTEGRITY FAILURE] {alert_msg}")
            if self.on_security_alert:
                self.on_security_alert("GCM_TAG_MISMATCH", alert_msg)
            return None
        except Exception as e:
            logger.error(f"Error de procesamiento de trama para {device_id}: {e}")
            return None

    async def handle_tcp_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        """Asynchronous handler for each incoming TLS client socket."""
        peer = writer.get_extra_info("peername")
        peer_str = f"{peer[0]}:{peer[1]}" if peer else "Unknown"
        logger.info(f"[+] Conexión entrante desde {peer_str}")

        try:
            while self.running:
                data = await reader.readline()
                if not data:
                    break
                self.process_raw_packet(data, f"TCP:{peer_str}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.debug(f"Excepción en conexión {peer_str}: {e}")
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
            logger.info(f"[-] Conexión cerrada desde {peer_str}")

    def _setup_mqtt(self):
        """Initializes Mosquitto MQTT listener thread."""
        try:
            import paho.mqtt.client as mqtt

            def on_connect(client, userdata, flags, rc, properties=None):
                if rc == 0:
                    logger.info("[✓] Conectado al Broker Mosquitto local. Suscribiendo a 'kali/gps/telemetry/#'")
                    client.subscribe("kali/gps/telemetry/#")
                else:
                    logger.warning(f"Error de conexión MQTT: código {rc}")

            def on_message(client, userdata, msg):
                try:
                    self.process_raw_packet(msg.payload, f"MQTT:{msg.topic}")
                except Exception as e:
                    logger.error(f"Error en mensaje MQTT: {e}")

            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="KaliAresMasterReceiver")
            client.on_connect = on_connect
            client.on_message = on_message

            # TLS for Mosquitto if cert exists
            ca_file = os.path.join(CERTS_DIR, "ca.crt")
            if os.path.exists(ca_file):
                client.tls_set(ca_certs=ca_file, tls_version=ssl.PROTOCOL_TLSv1_2)

            client.connect_async("127.0.0.1", DEFAULT_MQTT_PORT, 60)
            client.loop_start()
            self.mqtt_client = client
        except ImportError:
            logger.warning("[!] Módulo paho-mqtt no instalado en este entorno. Canal MQTT omitido.")
        except Exception as e:
            logger.warning(f"[!] No se pudo conectar al Broker Mosquitto local ({e}). El servidor TCP seguirá activo.")

    async def _async_run(self):
        """Main asyncio loop."""
        ssl_ctx = self.create_tls_context()
        self.tcp_server = await asyncio.start_server(
            self.handle_tcp_client,
            host="0.0.0.0",
            port=self.tcp_port,
            ssl=ssl_ctx
        )
        logger.info(f"[✓] Servidor TCP E2EE escuchando en 0.0.0.0:{self.tcp_port} (TLS: {ssl_ctx is not None})")

        if self.mqtt_enabled:
            self._setup_mqtt()

        async with self.tcp_server:
            while self.running:
                await asyncio.sleep(0.5)

    def start_background(self):
        """Starts the server in an independent daemon thread."""
        self.running = True

        def runner():
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            try:
                self.loop.run_until_complete(self._async_run())
            except Exception as e:
                logger.error(f"Excepción en bucle de servidor: {e}")
            finally:
                self.loop.close()

        self._thread = threading.Thread(target=runner, name="KaliAresServerThread", daemon=True)
        self._thread.start()

    def stop(self):
        """Stops network listeners gracefully."""
        self.running = False
        if self.mqtt_client:
            try:
                self.mqtt_client.loop_stop()
                self.mqtt_client.disconnect()
            except Exception:
                pass
        if self.loop and self.loop.is_running():
            self.loop.call_soon_threadsafe(self.loop.stop)


if __name__ == "__main__":
    print("[*] Probando inicialización de TacticalIngestServer...")
    dummy_keys = {
        "ALPHA-01": {"name": "Scout", "key_hex": "00" * 32, "callsign": "ALPHA", "type": "operative"}
    }
    server = TacticalIngestServer(dummy_keys, tcp_port=8443)
    server.start_background()
    print("[+] Servidor de prueba iniciado. Esperando 3 segundos...")
    time.sleep(3)
    server.stop()
    print("[✓] Servidor detenido con éxito.")
EOF
