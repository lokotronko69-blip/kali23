import { DeviceTelemetry, EncryptedPacket } from '../types';

/**
 * Utility functions for hex / base64 conversions
 */
export function bufToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBuf(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function bufToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuf(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives a 256-bit Key Encryption Key (KEK) using PBKDF2-HMAC-SHA256
 */
export async function deriveKekWeb(
  masterPassword: string,
  salt: Uint8Array,
  iterations = 600000
): Promise<{ key: CryptoKey; rawHex: string; durationMs: number }> {
  const t0 = performance.now();
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const rawKeyBits = await crypto.subtle.exportKey('raw', derivedKey);
  const t1 = performance.now();

  return {
    key: derivedKey,
    rawHex: bufToHex(rawKeyBits),
    durationMs: Math.round(t1 - t0),
  };
}

/**
 * Encrypts a device telemetry object with AES-256-GCM using Web Crypto API.
 */
export async function encryptTelemetryPayload(
  keyHex: string,
  telemetry: DeviceTelemetry
): Promise<EncryptedPacket> {
  const keyBytes = hexToBuf(keyHex);
  const enc = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode(JSON.stringify(telemetry));
  const aad = enc.encode(telemetry.device_id);

  // Web Crypto encrypt with AES-GCM returns ciphertext with 16-byte tag appended
  const cipherAndTagBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: aad,
      tagLength: 128,
    },
    cryptoKey,
    plaintext
  );

  const fullBytes = new Uint8Array(cipherAndTagBuffer);
  const ciphertextBytes = fullBytes.slice(0, fullBytes.length - 16);
  const tagBytes = fullBytes.slice(fullBytes.length - 16);

  return {
    device_id: telemetry.device_id,
    nonce: bufToBase64(nonce),
    ciphertext: bufToBase64(ciphertextBytes),
    tag: bufToBase64(tagBytes),
    timestamp: telemetry.timestamp,
  };
}

/**
 * Decrypts an encrypted packet with AES-256-GCM.
 * Rejects with Error if authentication tag fails (tampered packet).
 */
export async function decryptTelemetryPayload(
  keyHex: string,
  packet: EncryptedPacket
): Promise<DeviceTelemetry> {
  const keyBytes = hexToBuf(keyHex);
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const nonce = base64ToBuf(packet.nonce);
  const ciphertext = base64ToBuf(packet.ciphertext);
  const tag = base64ToBuf(packet.tag);

  // Recombine ciphertext + 16-byte tag for Web Crypto Subtle
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  const aad = enc.encode(packet.device_id);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonce as unknown as ArrayBuffer,
      additionalData: aad,
      tagLength: 128,
    },
    cryptoKey,
    combined as unknown as ArrayBuffer
  );

  return JSON.parse(dec.decode(decryptedBuffer)) as DeviceTelemetry;
}
