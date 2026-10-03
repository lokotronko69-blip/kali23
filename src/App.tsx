import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { TacticalMap } from './components/TacticalMap';
import { DeviceRoster } from './components/DeviceRoster';
import { WireConsole } from './components/WireConsole';
import { VaultCryptoInspector } from './components/VaultCryptoInspector';
import { CodeDeliverables } from './components/CodeDeliverables';
import { FieldTransmitter } from './components/FieldTransmitter';
import { TacticalDevice, DeviceTelemetry, DecryptorLogEntry, UnitStatus } from './types';
import { encryptTelemetryPayload, decryptTelemetryPayload, bufToHex, base64ToBuf } from './services/cryptoSimulation';
import { DELIVERABLES } from './data/deliverables';
import JSZip from 'jszip';
import { ShieldCheck, Plus, X } from 'lucide-react';

const INITIAL_DEVICES: TacticalDevice[] = [
  {
    id: 'ALPHA-01',
    name: 'Ghost Recon Scout 1',
    callsign: 'SPECTRE-1',
    type: 'operative',
    key_hex: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    paired_at: Date.now() - 3600000,
  },
  {
    id: 'BRAVO-02',
    name: 'Armored Patrol JLTV',
    callsign: 'TITAN-2',
    type: 'vehicle',
    key_hex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    paired_at: Date.now() - 7200000,
  },
  {
    id: 'DRONE-VIPER',
    name: 'MQ-9 Recon Drone',
    callsign: 'VIPER-EYE',
    type: 'drone',
    key_hex: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    paired_at: Date.now() - 10800000,
  },
  {
    id: 'REAP-07',
    name: 'High-Altitude Tactical UAV',
    callsign: 'REAPER-7',
    type: 'drone',
    key_hex: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
    paired_at: Date.now() - 14400000,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'vault' | 'code' | 'transmitter'>('map');
  const [devices, setDevices] = useState<TacticalDevice[]>(INITIAL_DEVICES);
  const [telemetries, setTelemetries] = useState<Record<string, DeviceTelemetry>>({});
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>('ALPHA-01');
  const [logs, setLogs] = useState<DecryptorLogEntry[]>([]);
  const [isConsolePaused, setIsConsolePaused] = useState(false);
  const [radarScanEnabled, setRadarScanEnabled] = useState(true);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);

  // New Device Form State
  const [pairId, setPairId] = useState('');
  const [pairCallsign, setPairCallsign] = useState('');
  const [pairType, setPairType] = useState<'drone' | 'operative' | 'vehicle'>('operative');
  const [pairKey, setPairKey] = useState('');

  const angleRef = useRef(0);

  // Process incoming telemetry frame and add to log
  const handleProcessIncomingTelemetry = useCallback(
    async (telemetry: DeviceTelemetry, source: string) => {
      const dev = devices.find((d) => d.id === telemetry.device_id);
      if (!dev) return;

      try {
        // Real AES-256-GCM encryption & decryption verification
        const packet = await encryptTelemetryPayload(dev.key_hex, telemetry);
        const verifiedTelemetry = await decryptTelemetryPayload(dev.key_hex, packet);

        setTelemetries((prev) => ({
          ...prev,
          [telemetry.device_id]: verifiedTelemetry,
        }));

        if (!isConsolePaused) {
          const nonceBytes = base64ToBuf(packet.nonce);
          const tagBytes = base64ToBuf(packet.tag);

          const newLog: DecryptorLogEntry = {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: Date.now(),
            device_id: telemetry.device_id,
            source,
            nonce_hex: bufToHex(nonceBytes),
            tag_hex: bufToHex(tagBytes),
            ciphertext_preview: packet.ciphertext.substring(0, 36) + '...',
            is_valid: true,
            telemetry: verifiedTelemetry,
          };

          setLogs((prev) => [...prev.slice(-100), newLog]);
        }
      } catch (err) {
        console.error('Decryption Tag Error:', err);
      }
    },
    [devices, isConsolePaused]
  );

  // Autonomous Field Simulation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      angleRef.current += 0.05;
      const angle = angleRef.current;

      devices.forEach((dev, idx) => {
        let baseLat = 40.4168;
        let baseLon = -3.7038;
        let radius = 0.008;
        let speed = 18.0;
        let alt = 650;

        if (dev.id === 'BRAVO-02') {
          baseLat = 40.422;
          baseLon = -3.695;
          radius = 0.015;
          speed = 55.0;
          alt = 630;
        } else if (dev.id === 'DRONE-VIPER') {
          baseLat = 40.41;
          baseLon = -3.715;
          radius = 0.025;
          speed = 115.0;
          alt = 1850;
        } else if (dev.id === 'REAP-07') {
          baseLat = 40.435;
          baseLon = -3.68;
          radius = 0.035;
          speed = 145.0;
          alt = 2400;
        }

        const lat = baseLat + Math.sin(angle + idx * 1.5) * radius;
        const lon = baseLon + Math.cos(angle + idx * 1.5) * radius;
        const heading = Math.round((((Math.atan2(Math.cos(angle), -Math.sin(angle)) * 180) / Math.PI) + 360) % 360);

        const currentStatus = telemetries[dev.id]?.status || 'NORMAL';

        const telem: DeviceTelemetry = {
          device_id: dev.id,
          timestamp: Date.now() / 1000,
          lat: Number(lat.toFixed(6)),
          lon: Number(lon.toFixed(6)),
          alt: Math.round(alt + Math.sin(angle) * 10),
          speed: Number((speed + Math.sin(angle * 2) * 3).toFixed(1)),
          heading,
          battery: Math.max(15, 98 - Math.floor((idx * 6 + (angle % 30)))),
          satellites: 12 + (idx % 5),
          status: currentStatus,
          _callsign: dev.callsign,
          _unit_name: dev.name,
          _unit_type: dev.type,
          _source: idx % 2 === 0 ? 'TLS:TCP_8443' : 'MQTT:MOSQUITTO',
        };

        handleProcessIncomingTelemetry(telem, idx % 2 === 0 ? 'TCP:TLS1.3' : 'MQTT:8883');
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [devices, telemetries, handleProcessIncomingTelemetry]);

  // Trigger Status change (e.g. from UI)
  const handleTriggerStatus = (deviceId: string, status: UnitStatus) => {
    setTelemetries((prev) => {
      if (!prev[deviceId]) return prev;
      return {
        ...prev,
        [deviceId]: { ...prev[deviceId], status },
      };
    });
  };

  // Add a newly paired device
  const handleAddDevice = (newDevice: TacticalDevice) => {
    setDevices((prev) => [...prev, newDevice]);
  };

  // Download all deliverables as a single .ZIP file
  const handleDownloadAllZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder('kali-tactical-gps');

    DELIVERABLES.forEach((file) => {
      folder?.file(file.name, file.code);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kali-tactical-gps-suite.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Count active alerts
  const alertCount = Object.values(telemetries).filter(
    (t) => t.status === 'ALERT' || t.status === 'JAMMING' || t.status === 'SOS'
  ).length;

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#070b13] text-slate-100 font-sans select-none">
      {/* HUD Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAssetCount={devices.length}
        alertCount={alertCount}
        onDownloadZip={handleDownloadAllZip}
      />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'map' && (
          <div className="flex flex-col lg:flex-row w-full h-full overflow-hidden">
            {/* Left Sidebar (Roster) */}
            <div className="w-full lg:w-80 h-64 lg:h-full shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800">
              <DeviceRoster
                devices={devices}
                telemetries={telemetries}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
                onTriggerStatus={handleTriggerStatus}
                onOpenPairModal={() => {
                  setPairKey(
                    Array.from(crypto.getRandomValues(new Uint8Array(32)))
                      .map((b) => b.toString(16).padStart(2, '0'))
                      .join('')
                  );
                  setIsPairModalOpen(true);
                }}
              />
            </div>

            {/* Right Center & Bottom: Map + Live Wire Console */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="flex-1 relative overflow-hidden">
                <TacticalMap
                  devices={devices}
                  telemetries={telemetries}
                  selectedDeviceId={selectedDeviceId}
                  onSelectDevice={setSelectedDeviceId}
                  radarScanEnabled={radarScanEnabled}
                  onToggleRadar={() => setRadarScanEnabled(!radarScanEnabled)}
                />
              </div>

              {/* Bottom Decryptor Console */}
              <div className="h-44 shrink-0 overflow-hidden">
                <WireConsole
                  logs={logs}
                  onClearLogs={() => setLogs([])}
                  isPaused={isConsolePaused}
                  onTogglePause={() => setIsConsolePaused(!isConsolePaused)}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vault' && (
          <VaultCryptoInspector devices={devices} onAddDevice={handleAddDevice} />
        )}

        {activeTab === 'transmitter' && (
          <FieldTransmitter
            devices={devices}
            onInjectTelemetry={(telem, src) => handleProcessIncomingTelemetry(telem, src)}
          />
        )}

        {activeTab === 'code' && (
          <CodeDeliverables onDownloadAllZip={handleDownloadAllZip} />
        )}
      </div>

      {/* Modal: Pair New Device */}
      {isPairModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b111e] border border-emerald-500/60 rounded-lg p-5 w-full max-w-md space-y-4 font-mono-code text-xs text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h2 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>EMPAREJAR NUEVA UNIDAD TÁCTICA</span>
              </h2>
              <button
                onClick={() => setIsPairModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">ID Único del Dispositivo:</label>
                <input
                  type="text"
                  placeholder="ej. RECON-04"
                  value={pairId}
                  onChange={(e) => setPairId(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200 uppercase"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Callsign Táctico:</label>
                <input
                  type="text"
                  placeholder="ej. PHANTOM-4"
                  value={pairCallsign}
                  onChange={(e) => setPairCallsign(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200 uppercase"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Tipo de Activo:</label>
                <select
                  value={pairType}
                  onChange={(e) => setPairType(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200"
                >
                  <option value="operative">Operativo / Agente de Campo</option>
                  <option value="drone">Dron UAV de Reconocimiento</option>
                  <option value="vehicle">Vehículo Blindado / Patrulla</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Clave Simétrica AES-256 (Pre-compartida):</label>
                <input
                  type="text"
                  readOnly
                  value={pairKey}
                  className="w-full px-3 py-1.5 bg-[#070b13] border border-slate-700 rounded text-emerald-400 font-bold select-all text-[11px]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsPairModalOpen(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                disabled={!pairId}
                onClick={() => {
                  handleAddDevice({
                    id: pairId,
                    name: pairCallsign || pairId,
                    callsign: pairCallsign || pairId,
                    type: pairType,
                    key_hex: pairKey,
                    paired_at: Date.now(),
                  });
                  setIsPairModalOpen(false);
                  setPairId('');
                  setPairCallsign('');
                }}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-slate-950 font-bold rounded cursor-pointer"
              >
                GUARDAR Y EMPAREJAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
