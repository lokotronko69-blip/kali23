import React, { useState } from 'react';
import { TacticalDevice, DeviceTelemetry, UnitStatus } from '../types';
import { Radio, Send, ShieldCheck, MapPin, Gauge, Battery, Compass, AlertTriangle, Code2 } from 'lucide-react';
import { encryptTelemetryPayload } from '../services/cryptoSimulation';

interface FieldTransmitterProps {
  devices: TacticalDevice[];
  onInjectTelemetry: (telemetry: DeviceTelemetry, source: string) => void;
}

export const FieldTransmitter: React.FC<FieldTransmitterProps> = ({
  devices,
  onInjectTelemetry,
}) => {
  const [selectedId, setSelectedId] = useState<string>(devices[0]?.id || 'ALPHA-01');
  const [lat, setLat] = useState<number>(40.4168);
  const [lon, setLon] = useState<number>(-3.7038);
  const [alt, setAlt] = useState<number>(650);
  const [speed, setSpeed] = useState<number>(24.5);
  const [heading, setHeading] = useState<number>(120);
  const [battery, setBattery] = useState<number>(92);
  const [satellites, setSatellites] = useState<number>(14);
  const [status, setStatus] = useState<UnitStatus>('NORMAL');
  const [lastPacket, setLastPacket] = useState<any>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const selectedDevice = devices.find((d) => d.id === selectedId) || devices[0];

  // Presets
  const applyPreset = (presetName: string) => {
    if (presetName === 'patrol') {
      setLat(40.4215);
      setLon(-3.6980);
      setSpeed(45.0);
      setHeading(45);
      setStatus('NORMAL');
    } else if (presetName === 'orbit') {
      setLat(40.4080);
      setLon(-3.7120);
      setSpeed(110.0);
      setAlt(1800);
      setHeading(270);
      setStatus('NORMAL');
    } else if (presetName === 'evac') {
      setLat(40.4300);
      setLon(-3.6850);
      setSpeed(75.0);
      setStatus('ALERT');
    } else if (presetName === 'jam') {
      setStatus('JAMMING');
    }
  };

  const handleTransmit = async () => {
    if (!selectedDevice) return;
    setIsTransmitting(true);

    const telemetry: DeviceTelemetry = {
      device_id: selectedDevice.id,
      timestamp: Date.now() / 1000,
      lat,
      lon,
      alt,
      speed,
      heading,
      battery,
      satellites,
      status,
      _callsign: selectedDevice.callsign,
      _unit_name: selectedDevice.name,
      _unit_type: selectedDevice.type,
      _source: 'TRANSMITTER:SIMULATED_WIRE',
    };

    try {
      const encrypted = await encryptTelemetryPayload(selectedDevice.key_hex, telemetry);
      setLastPacket(encrypted);
      onInjectTelemetry(telemetry, 'WIRE:TCP_TLS13');
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsTransmitting(false), 300);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#080c14] font-mono-code text-slate-200 select-none space-y-6">
      {/* Title */}
      <div className="border-b border-slate-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-emerald-400 flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400" />
            <span>TRANSMISOR DE CAMPO TÁCTICO (GENERADOR E2EE EN VIVO)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Genera y cifra tramas GPS reales mediante la clave simétrica AES-256 de cada unidad e inyéctalas directamente en el Centro de Operaciones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-emerald-400">
            CLAVE ACTIVA: {selectedDevice ? selectedDevice.key_hex.substring(0, 16) + '...' : '--'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-2 bg-[#0b111e] border border-slate-800 rounded-lg p-4 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h2 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>CONFIGURACIÓN DE TELEMETRÍA DE LA UNIDAD</span>
            </h2>

            {/* Presets */}
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-slate-500 mr-1">RUTAS:</span>
              <button
                onClick={() => applyPreset('patrol')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                PATRULLA
              </button>
              <button
                onClick={() => applyPreset('orbit')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300"
              >
                ÓRBITA UAV
              </button>
              <button
                onClick={() => applyPreset('evac')}
                className="px-2 py-0.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800"
              >
                EVAC LZ
              </button>
              <button
                onClick={() => applyPreset('jam')}
                className="px-2 py-0.5 rounded bg-red-950 hover:bg-red-900 text-red-300 border border-red-800"
              >
                JAMMING
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Device Selector */}
            <div>
              <label className="text-slate-400 block mb-1">Unidad Transmisora:</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.callsign} ({d.id}) - {d.type.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Selector */}
            <div>
              <label className="text-slate-400 block mb-1">Estado Operativo:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UnitStatus)}
                className="w-full px-3 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200 font-bold"
              >
                <option value="NORMAL">NORMAL (Seguro)</option>
                <option value="ALERT">ALERT (Contacto Hostil)</option>
                <option value="JAMMING">JAMMING (Interferencia GNSS)</option>
                <option value="SOS">SOS (Evacuación Inmediata)</option>
              </select>
            </div>

            {/* Lat / Lon */}
            <div>
              <label className="text-slate-400 block mb-1">Latitud (WGS-84):</label>
              <input
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Longitud (WGS-84):</label>
              <input
                type="number"
                step="0.0001"
                value={lon}
                onChange={(e) => setLon(parseFloat(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200"
              />
            </div>

            {/* Speed & Heading */}
            <div>
              <label className="text-slate-400 flex items-center justify-between mb-1">
                <span>Velocidad:</span>
                <span className="text-sky-400 font-bold">{speed} km/h</span>
              </label>
              <input
                type="range"
                min="0"
                max="250"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-400 flex items-center justify-between mb-1">
                <span>Rumbo Azimutal:</span>
                <span className="text-sky-400 font-bold">{heading}°</span>
              </label>
              <input
                type="range"
                min="0"
                max="359"
                value={heading}
                onChange={(e) => setHeading(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            {/* Altitude & Battery */}
            <div>
              <label className="text-slate-400 block mb-1">Altitud (Metros MSL):</label>
              <input
                type="number"
                value={alt}
                onChange={(e) => setAlt(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-400 flex items-center justify-between mb-1">
                <span>Batería:</span>
                <span className="text-emerald-400 font-bold">{battery}%</span>
              </label>
              <input
                type="range"
                min="5"
                max="100"
                value={battery}
                onChange={(e) => setBattery(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>

          {/* Transmit Button */}
          <div className="pt-2">
            <button
              onClick={handleTransmit}
              disabled={isTransmitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-slate-950 font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              <Send className="w-4 h-4 text-slate-950" />
              <span>{isTransmitting ? 'ENCRIPTANDO Y TRANSMITIENDO...' : 'TRANSMITIR TRAMA CIFRADA (AES-256-GCM)'}</span>
            </button>
          </div>
        </div>

        {/* Encrypted Wire Payload Preview */}
        <div className="bg-[#0b111e] border border-slate-800 rounded-lg p-4 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <h2 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>PAQUETE CIFRADO GENERADO</span>
              </h2>
              <span className="text-[10px] text-emerald-400 font-bold">WIRE PROTOCOL</span>
            </div>

            {lastPacket ? (
              <div className="space-y-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px]">ID DISPOSITIVO:</span>
                  <span className="text-emerald-400 font-bold">{lastPacket.device_id}</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">NONCE (12 BYTES BASE64):</span>
                  <span className="text-amber-400 break-all">{lastPacket.nonce}</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">CIPHERTEXT (BASE64):</span>
                  <span className="text-slate-300 break-all">{lastPacket.ciphertext}</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">TAG DE AUTENTICACIÓN (16 BYTES):</span>
                  <span className="text-sky-400 font-bold break-all">{lastPacket.tag}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-600 text-xs italic">
                Presiona "TRANSMITIR TRAMA CIFRADA" para observar la estructura encriptada transmitida sobre TLS 1.3 / TCP.
              </div>
            )}
          </div>

          {/* Linux Terminal One-Liner */}
          <div className="p-2.5 rounded bg-[#070b13] border border-slate-800 text-[10px] space-y-1">
            <div className="flex items-center gap-1 text-slate-400">
              <Code2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Prueba de terminal en Kali Linux:</span>
            </div>
            <code className="text-emerald-400 block break-all font-mono-code">
              /opt/kali-gps/venv/bin/python3 /opt/kali-gps/device_simulator.py --port 8443
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
