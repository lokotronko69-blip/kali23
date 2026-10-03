export type UnitType = 'drone' | 'operative' | 'vehicle' | 'asset';
export type UnitStatus = 'NORMAL' | 'ALERT' | 'JAMMING' | 'SOS' | 'OFFLINE';

export interface DeviceTelemetry {
  device_id: string;
  timestamp: number;
  lat: number;
  lon: number;
  alt: number;
  speed: number;
  heading: number;
  battery: number;
  satellites: number;
  status: UnitStatus;
  _callsign?: string;
  _unit_name?: string;
  _unit_type?: UnitType;
  _source?: string;
  _received_at?: number;
}

export interface EncryptedPacket {
  device_id: string;
  nonce: string; // Base64
  ciphertext: string; // Base64
  tag: string; // Base64
  timestamp: number;
}

export interface TacticalDevice {
  id: string;
  name: string;
  callsign: string;
  type: UnitType;
  key_hex: string;
  paired_at: number;
  lastTelemetry?: DeviceTelemetry;
}

export interface DecryptorLogEntry {
  id: string;
  timestamp: number;
  device_id: string;
  source: string;
  nonce_hex: string;
  tag_hex: string;
  ciphertext_preview: string;
  is_valid: boolean;
  error?: string;
  telemetry?: DeviceTelemetry;
}
