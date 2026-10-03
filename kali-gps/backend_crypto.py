#!/usr/bin/env python3
"""
================================================================================
KALI-ARES // MILITARY-GRADE E2EE CRYPTOGRAPHIC MODULE
================================================================================
PBKDF2-HMAC-SHA256 (600,000 iterations) + AES-256-GCM Keystore & Wire Decryption
Designed for Kali Linux Hardened Tactical GPS Operations
================================================================================
"""

import os
import json
import base64
import struct
import tempfile
from typing import Dict, Any, Tuple, Optional
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

# Security Parameters
PBKDF2_ITERATIONS = 600_000
SALT_SIZE = 16          # 128-bit Salt
NONCE_SIZE = 12         # 96-bit Standard GCM Nonce
KEY_SIZE = 32           # 256-bit AES Key
MAGIC_HEADER = b"KGPS"  # File Identifier
VERSION = 1             # Format version byte

DEFAULT_KEYSTORE_PATH = os.path.expanduser("/opt/kali-gps/data/vault.enc")
FALLBACK_KEYSTORE_PATH = os.path.expanduser("~/.kali-gps/vault.enc")


def get_active_keystore_path() -> str:
    """Returns the writable keystore path depending on system permissions."""
    if os.path.exists(os.path.dirname(DEFAULT_KEYSTORE_PATH)) and os.access(os.path.dirname(DEFAULT_KEYSTORE_PATH), os.W_OK):
        return DEFAULT_KEYSTORE_PATH
    os.makedirs(os.path.dirname(FALLBACK_KEYSTORE_PATH), exist_ok=True)
    return FALLBACK_KEYSTORE_PATH


def derive_kek(master_password: str, salt: bytes) -> bytes:
    """
    Derives a 256-bit Key Encryption Key (KEK) using PBKDF2-HMAC-SHA256
    with 600,000 iterations to withstand offline brute-force attacks.
    """
    if not master_password or not isinstance(master_password, str):
        raise ValueError("La contraseña maestra debe ser una cadena no vacía.")
    if len(salt) != SALT_SIZE:
        raise ValueError(f"El tamaño del salt debe ser exactamente {SALT_SIZE} bytes.")

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=KEY_SIZE,
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
    )
    return kdf.derive(master_password.encode("utf-8"))


def keystore_exists(filepath: Optional[str] = None) -> bool:
    """Checks if the encrypted vault exists on disk."""
    path = filepath or get_active_keystore_path()
    return os.path.isfile(path) and os.path.getsize(path) > (len(MAGIC_HEADER) + 1 + SALT_SIZE + NONCE_SIZE + 16)


def init_keystore(master_password: str, filepath: Optional[str] = None) -> Dict[str, Any]:
    """
    Initializes a new encrypted keystore on first run.
    Generates default operational unit keys with pre-shared keys.
    """
    path = filepath or get_active_keystore_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)

    # Initial Tactical Fleet Pre-Shared Keys
    initial_devices = {
        "ALPHA-01": {
            "name": "Ghost Recon Scout 1",
            "type": "operative",
            "key_hex": os.urandom(32).hex(),
            "paired_at": 1700000000,
            "callsign": "SPECTRE-1"
        },
        "BRAVO-02": {
            "name": "Armored Patrol JLTV",
            "type": "vehicle",
            "key_hex": os.urandom(32).hex(),
            "paired_at": 1700000000,
            "callsign": "TITAN-2"
        },
        "DRONE-VIPER": {
            "name": "MQ-9 Recon Drone",
            "type": "drone",
            "key_hex": os.urandom(32).hex(),
            "paired_at": 1700000000,
            "callsign": "VIPER-EYE"
        },
        "REAP-07": {
            "name": "High-Altitude Tactical UAV",
            "type": "drone",
            "key_hex": os.urandom(32).hex(),
            "paired_at": 1700000000,
            "callsign": "REAPER-7"
        }
    }

    keystore_data = {
        "created_at": 1700000000,
        "version": 1,
        "devices": initial_devices,
        "security_policy": {
            "enforce_e2ee": True,
            "max_clock_skew_sec": 30,
            "anti_replay_cache_size": 1000
        }
    }

    save_keystore(master_password, keystore_data, path)
    return keystore_data


def save_keystore(master_password: str, keystore_data: Dict[str, Any], filepath: Optional[str] = None) -> None:
    """
    Encrypts the entire keystore using fresh Salt and Nonce with AES-256-GCM.
    Writes atomically via a temporary file with restricted permissions (0600).
    """
    path = filepath or get_active_keystore_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)

    salt = os.urandom(SALT_SIZE)
    nonce = os.urandom(NONCE_SIZE)
    kek = derive_kek(master_password, salt)

    aesgcm = AESGCM(kek)
    serialized_payload = json.dumps(keystore_data, separators=(",", ":")).encode("utf-8")
    
    # Associated Data includes Magic Header and Version for tamper protection
    aad = MAGIC_HEADER + struct.pack("!B", VERSION)
    ciphertext_with_tag = aesgcm.encrypt(nonce, serialized_payload, aad)

    header = aad + salt + nonce
    file_bytes = header + ciphertext_with_tag

    dir_name = os.path.dirname(path)
    with tempfile.NamedTemporaryFile("wb", dir=dir_name, delete=False) as tf:
        tf.write(file_bytes)
        temp_path = tf.name

    os.chmod(temp_path, 0o600)
    os.replace(temp_path, path)


def unlock_keystore(master_password: str, filepath: Optional[str] = None) -> Dict[str, Any]:
    """
    Unlocks and decrypts the keystore file.
    Raises ValueError on incorrect master password or authentication tag failure.
    """
    path = filepath or get_active_keystore_path()
    if not os.path.isfile(path):
        raise FileNotFoundError(f"El almacén de claves no existe en: {path}")

    with open(path, "rb") as f:
        file_bytes = f.read()

    min_len = len(MAGIC_HEADER) + 1 + SALT_SIZE + NONCE_SIZE + 16
    if len(file_bytes) < min_len:
        raise ValueError("El archivo del almacén está corrupto o truncado.")

    magic = file_bytes[:4]
    version = file_bytes[4]

    if magic != MAGIC_HEADER:
        raise ValueError("Formato de almacén inválido (Identificador KGPS no coincide).")

    offset = 5
    salt = file_bytes[offset:offset + SALT_SIZE]
    offset += SALT_SIZE
    nonce = file_bytes[offset:offset + NONCE_SIZE]
    offset += NONCE_SIZE
    ciphertext_with_tag = file_bytes[offset:]

    aad = magic + struct.pack("!B", version)
    kek = derive_kek(master_password, salt)

    try:
        aesgcm = AESGCM(kek)
        plaintext = aesgcm.decrypt(nonce, ciphertext_with_tag, aad)
        return json.loads(plaintext.decode("utf-8"))
    except InvalidTag:
        raise ValueError("Autenticación fallida: Contraseña maestra incorrecta o almacén manipulado (GCM Tag Mismatch).")
    except Exception as e:
        raise ValueError(f"Fallo al descifrar el almacén: {str(e)}")


def encrypt_device_payload(device_key_bytes: bytes, telemetry: Dict[str, Any]) -> Dict[str, Any]:
    """
    Encrypts a device telemetry frame with AES-256-GCM.
    Returns a wire dictionary ready to be transmitted over TCP or MQTT.
    """
    if len(device_key_bytes) != 32:
        raise ValueError("La clave del dispositivo debe ser de 32 bytes (AES-256).")

    nonce = os.urandom(NONCE_SIZE)
    aesgcm = AESGCM(device_key_bytes)

    plaintext = json.dumps(telemetry, separators=(",", ":")).encode("utf-8")
    aad = telemetry.get("device_id", "").encode("utf-8")
    
    # AESGCM encrypt outputs ciphertext + 16-byte tag
    raw_cipher_tag = aesgcm.encrypt(nonce, plaintext, aad)
    ciphertext = raw_cipher_tag[:-16]
    tag = raw_cipher_tag[-16:]

    return {
        "device_id": telemetry.get("device_id"),
        "nonce": base64.b64encode(nonce).decode("ascii"),
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
        "tag": base64.b64encode(tag).decode("ascii"),
        "timestamp": telemetry.get("timestamp", 0)
    }


def decrypt_device_payload(device_key_bytes: bytes, packet: Dict[str, Any]) -> Dict[str, Any]:
    """
    Decrypts an encrypted telemetry packet using the device's symmetric key.
    Raises InvalidTag if tampered or corrupt.
    """
    if len(device_key_bytes) != 32:
        raise ValueError("Clave de dispositivo inválida (debe ser de 32 bytes).")

    try:
        device_id = packet["device_id"]
        nonce = base64.b64decode(packet["nonce"])
        ciphertext = base64.b64decode(packet["ciphertext"])
        tag = base64.b64decode(packet["tag"])
        aad = device_id.encode("utf-8")
    except KeyError as e:
        raise ValueError(f"Trama de telemetría incompleta, falta el campo: {e}")
    except Exception as e:
        raise ValueError(f"Codificación de trama corrupta: {e}")

    cipher_with_tag = ciphertext + tag
    aesgcm = AESGCM(device_key_bytes)

    # Validates GCM auth tag
    plaintext_bytes = aesgcm.decrypt(nonce, cipher_with_tag, aad)
    return json.loads(plaintext_bytes.decode("utf-8"))


if __name__ == "__main__":
    print("[*] Verificando módulo criptográfico Kali-ARES...")
    pwd = "KaliMasterPassword#2026"
    test_path = "/tmp/test_vault.enc"
    
    vault = init_keystore(pwd, test_path)
    print(f"[+] Almacén inicializado con {len(vault['devices'])} dispositivos.")
    
    unlocked = unlock_keystore(pwd, test_path)
    print(f"[+] Almacén descifrado con éxito. Tag verificado.")
    
    # Test frame encryption/decryption
    dev_key = bytes.fromhex(unlocked["devices"]["ALPHA-01"]["key_hex"])
    sample_telemetry = {
        "device_id": "ALPHA-01",
        "timestamp": 1775170000.5,
        "lat": 40.4168,
        "lon": -3.7038,
        "alt": 667.2,
        "speed": 18.5,
        "heading": 135.0,
        "battery": 94,
        "satellites": 12,
        "status": "NORMAL"
    }
    
    encrypted = encrypt_device_payload(dev_key, sample_telemetry)
    print(f"[+] Trama cifrada (AES-256-GCM): {encrypted['ciphertext'][:24]}...")
    
    decrypted = decrypt_device_payload(dev_key, encrypted)
    assert decrypted["lat"] == sample_telemetry["lat"]
    print(f"[+] Trama descifrada y validada: {decrypted}")
    
    os.remove(test_path)
    print("[✓] Todas las pruebas criptográficas de grado militar PASARON.")
EOF
