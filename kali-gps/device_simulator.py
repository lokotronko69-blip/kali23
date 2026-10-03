#!/usr/bin/env python3
"""
================================================================================
KALI-ARES // TACTICAL FIELD DEVICE SIMULATOR (CLI PENTEST & AUDIT TOOL)
================================================================================
Emulates military GPS nodes encrypting and transmitting telemetry frames
using pre-shared AES-256-GCM symmetric keys over TLS 1.3 TCP or MQTT.
================================================================================
"""

import sys
import os
import time
import math
import ssl
import json
import socket
import random
import argparse
from typing import Dict, Any

# Ensure backend_crypto can be imported
sys.path.insert(0, os.path.dirname(__file__))
import backend_crypto


# Pre-configured tactical scenarios with realistic coordinates
SCENARIOS = {
    "ALPHA-01": {
        "callsign": "SPECTRE-1",
        "type": "operative",
        "base_lat": 40.4168,
        "base_lon": -3.7038,
        "radius": 0.008,
        "speed": 8.5,
        "alt": 660.0
    },
    "BRAVO-02": {
        "callsign": "TITAN-2",
        "type": "vehicle",
        "base_lat": 40.4200,
        "base_lon": -3.6950,
        "radius": 0.025,
        "speed": 65.0,
        "alt": 645.0
    },
    "DRONE-VIPER": {
        "callsign": "VIPER-EYE",
        "type": "drone",
        "base_lat": 40.4100,
        "base_lon": -3.7150,
        "radius": 0.035,
        "speed": 120.0,
        "alt": 1850.0
    },
    "REAP-07": {
        "callsign": "REAPER-7",
        "type": "drone",
        "base_lat": 40.4350,
        "base_lon": -3.6800,
        "radius": 0.045,
        "speed": 140.0,
        "alt": 2400.0
    }
}


def send_packet_tcp(host: str, port: int, packet_dict: Dict[str, Any], use_tls: bool = True):
    """Sends a single JSON line over TCP (with optional TLS 1.3)."""
    raw_payload = (json.dumps(packet_dict) + "\n").encode("utf-8")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5.0)

    try:
        if use_tls:
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE  # Self-signed local cert
            secure_sock = context.wrap_socket(sock, server_hostname="kali-gps.local")
            secure_sock.connect((host, port))
            secure_sock.sendall(raw_payload)
            secure_sock.close()
        else:
            sock.connect((host, port))
            sock.sendall(raw_payload)
            sock.close()
        return True
    except Exception as e:
        print(f"[!] Error de envío a {host}:{port} -> {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="KALI-ARES // Simulador de Telemetría Táctica")
    parser.add_argument("--host", default="127.0.0.1", help="Dirección IP del servidor KALI-ARES")
    parser.add_argument("--port", type=int, default=8443, help="Puerto TCP (por defecto 8443)")
    parser.add_argument("--password", default=None, help="Contraseña maestra de la bóveda para extraer claves")
    parser.add_argument("--interval", type=float, default=2.0, help="Intervalo en segundos entre tramas")
    parser.add_argument("--no-tls", action="store_true", help="Desactivar TLS y transmitir en TCP claro")
    args = parser.parse_args()

    print("[*] Iniciando Simulador de Campo Táctico KALI-ARES...")

    # Load vault to get real matching symmetric keys
    keys = {}
    if args.password:
        try:
            vault = backend_crypto.unlock_keystore(args.password)
            for dev_id, dev_data in vault.get("devices", {}).items():
                keys[dev_id] = bytes.fromhex(dev_data["key_hex"])
            print(f"[✓] Bóveda desbloqueada. {len(keys)} claves cargadas.")
        except Exception as e:
            print(f"[!] No se pudo desbloquear la bóveda: {e}. Usando claves de prueba.")

    # Fallback keys for default demo
    for dev_id in SCENARIOS:
        if dev_id not in keys:
            # Deterministic test key
            keys[dev_id] = (dev_id.encode("utf-8") * 4)[:32]

    angle = 0.0
    print(f"[+] Transmitiendo telemetría cifrada AES-256-GCM a {args.host}:{args.port} cada {args.interval}s...")

    try:
        while True:
            angle += 0.08
            for dev_id, sc in SCENARIOS.items():
                lat = sc["base_lat"] + math.sin(angle + hash(dev_id) % 10) * sc["radius"]
                lon = sc["base_lon"] + math.cos(angle + hash(dev_id) % 10) * sc["radius"]
                heading = int((math.degrees(angle) + 90) % 360)
                speed = sc["speed"] + random.uniform(-2.0, 2.0)
                alt = sc["alt"] + random.uniform(-5.0, 5.0)

                # Random tactical events
                status = "NORMAL"
                if random.random() < 0.03:
                    status = "ALERT"

                telemetry = {
                    "device_id": dev_id,
                    "timestamp": time.time(),
                    "lat": round(lat, 6),
                    "lon": round(lon, 6),
                    "alt": round(alt, 1),
                    "speed": round(speed, 1),
                    "heading": heading,
                    "battery": max(10, 100 - int((time.time() % 3600) / 40)),
                    "satellites": random.randint(10, 18),
                    "status": status
                }

                # Encrypt with AES-256-GCM
                dev_key = keys[dev_id]
                encrypted_packet = backend_crypto.encrypt_device_payload(dev_key, telemetry)

                # Send
                success = send_packet_tcp(args.host, args.port, encrypted_packet, use_tls=not args.no_tls)
                stat_symbol = "✓" if success else "✗"
                print(f"[{stat_symbol}] [{dev_id}] POS:({lat:.4f},{lon:.4f}) SPD:{speed:.1f}km/h | NONCE:{encrypted_packet['nonce'][:8]}.. | STATUS:{status}")

            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n[+] Simulador detenido por el usuario.")


if __name__ == "__main__":
    main()
EOF
