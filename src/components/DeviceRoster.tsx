import React, { useState } from 'react';
import { TacticalDevice, DeviceTelemetry, UnitType } from '../types';
import { Search, Navigation, Battery, Cpu, AlertTriangle, Shield, Plus, Radio } from 'lucide-react';

interface DeviceRosterProps {
  devices: TacticalDevice[];
  telemetries: Record<string, DeviceTelemetry>;
  selectedDeviceId: string | null;
  onSelectDevice: (id: string) => void;
  onTriggerStatus: (deviceId: string, status: 'NORMAL' | 'ALERT' | 'JAMMING' | 'SOS') => void;
  onOpenPairModal: () => void;
}

export const DeviceRoster: React.FC<DeviceRosterProps> = ({
  devices,
  telemetries,
  selectedDeviceId,
  onSelectDevice,
  onTriggerStatus,
  onOpenPairModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      d.callsign.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || d.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col h-full bg-[#090d16] border-r border-slate-800/80 w-full select-none">
      {/* Top Header */}
      <div className="p-3 border-b border-slate-800 bg-[#0c1220]/70 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold font-mono-code text-emerald-400 tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" />
            <span>UNIDADES TÁCTICAS ({devices.length})</span>
          </h2>
          <span className="text-[10px] text-slate-500 font-mono-code">ENCRIPTACIÓN E2EE ACTIVA</span>
        </div>

        <button
          onClick={onOpenPairModal}
          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-[11px] font-mono-code rounded transition-all cursor-pointer shadow-[0_0_8px_rgba(16,185,129,0.2)]"
          title="Emparejar nueva unidad con clave AES-256 pre-compartida"
        >
          <Plus className="w-3 h-3 text-emerald-400" />
          <span>NUEVA</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="p-2.5 border-b border-slate-800/80 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por ID, Callsign..."
            className="w-full pl-8 pr-2.5 py-1.5 bg-[#0e1626] border border-slate-700/60 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono-code"
          />
        </div>

        <div className="flex items-center gap-1 text-[10px] font-mono-code">
          {(['all', 'drone', 'operative', 'vehicle'] as (string | UnitType)[]).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`flex-1 py-1 rounded border transition-all cursor-pointer ${
                filterType === t
                  ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300 font-bold'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              {t === 'all' ? 'TODOS' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Device List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-1.5 space-y-1">
        {filteredDevices.map((dev) => {
          const telem = telemetries[dev.id];
          const isSelected = selectedDeviceId === dev.id;
          const status = telem?.status || 'NORMAL';

          return (
            <div
              key={dev.id}
              onClick={() => onSelectDevice(dev.id)}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-950/40 border-emerald-500/70 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                  : 'bg-[#0d1424]/60 border-slate-800/80 hover:border-slate-700 hover:bg-[#10192e]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                  <span className="font-tactical font-bold text-sm text-slate-100">{dev.callsign}</span>
                  <span className="text-[10px] font-mono-code text-slate-500">[{dev.id}]</span>
                </div>

                <span
                  className={`text-[9px] font-mono-code px-1.5 py-0.5 rounded font-bold ${
                    status === 'NORMAL'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                      : status === 'ALERT'
                      ? 'bg-red-950 text-red-400 border border-red-800/50 animate-pulse'
                      : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                  }`}
                >
                  {status}
                </span>
              </div>

              {/* Telemetry Summary */}
              {telem ? (
                <div className="grid grid-cols-3 gap-1 text-[11px] font-mono-code text-slate-400 mb-2">
                  <div className="flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-sky-400" />
                    <span>{telem.speed.toFixed(1)} km/h</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[10px]">ALT:</span>
                    <span>{telem.alt.toFixed(0)}m</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Battery className={`w-3 h-3 ${telem.battery < 20 ? 'text-red-400' : 'text-emerald-400'}`} />
                    <span>{telem.battery}%</span>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] font-mono-code text-slate-500 italic mb-2">
                  Esperando trama cifrada...
                </div>
              )}

              {/* Coordinates & AES Indicator */}
              <div className="flex items-center justify-between text-[10px] font-mono-code text-slate-500 border-t border-slate-800/50 pt-1.5">
                <span className="text-slate-400">
                  {telem ? `${telem.lat.toFixed(4)}, ${telem.lon.toFixed(4)}` : '--.----, --.----'}
                </span>

                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-400 text-[9px] font-bold">AES-GCM</span>
                </div>
              </div>

              {/* Quick Status Modifiers (for simulation) */}
              {isSelected && (
                <div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-1 text-[10px] font-mono-code">
                  <span className="text-slate-500 text-[9px]">SIMULAR:</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTriggerStatus(dev.id, 'NORMAL');
                    }}
                    className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900"
                  >
                    NORMAL
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTriggerStatus(dev.id, 'ALERT');
                    }}
                    className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 hover:bg-amber-900"
                  >
                    ALERTA
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTriggerStatus(dev.id, 'JAMMING');
                    }}
                    className="px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 hover:bg-red-900 flex items-center gap-0.5"
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>JAM</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Summary Bar */}
      <div className="p-2 border-t border-slate-800 bg-[#0c1220]/80 text-[10px] font-mono-code text-slate-500 flex items-center justify-between">
        <span>RED: <strong className="text-emerald-400">TLS 1.3 / TCP 8443</strong></span>
        <span>BROKER: <strong className="text-emerald-400">MOSQUITTO</strong></span>
      </div>
    </div>
  );
};
