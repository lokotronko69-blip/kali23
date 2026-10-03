import React, { useState } from 'react';
import { DecryptorLogEntry } from '../types';
import { Terminal, ShieldCheck, ShieldAlert, Pause, Play, Trash2, Filter } from 'lucide-react';

interface WireConsoleProps {
  logs: DecryptorLogEntry[];
  onClearLogs: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
}

export const WireConsole: React.FC<WireConsoleProps> = ({
  logs,
  onClearLogs,
  isPaused,
  onTogglePause,
}) => {
  const [selectedEntry, setSelectedEntry] = useState<DecryptorLogEntry | null>(null);
  const [filterDevice, setFilterDevice] = useState<string>('all');

  const filteredLogs = logs.filter(
    (l) => filterDevice === 'all' || l.device_id === filterDevice
  );

  return (
    <div className="flex flex-col h-full bg-[#080d17] border-t border-slate-800 select-none">
      {/* Console Controls Header */}
      <div className="px-3 py-1.5 bg-[#0b1220] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-bold font-mono-code text-slate-200">
            AUDITORÍA DE RED // DESCRIPTADOR EN VIVO (AES-256-GCM + TLS 1.3)
          </span>
          <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
            ANTI-REPLAY ACTIVO
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono-code">
          <button
            onClick={onTogglePause}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-all cursor-pointer ${
              isPaused
                ? 'bg-amber-950 border-amber-600 text-amber-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3 text-amber-400" /> : <Pause className="w-3 h-3" />}
            <span>{isPaused ? 'REANUDAR' : 'PAUSAR'}</span>
          </button>

          <button
            onClick={onClearLogs}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
            title="Limpiar consola"
          >
            <Trash2 className="w-3 h-3" />
            <span>LIMPIAR</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="flex-1 overflow-y-auto font-mono-code text-[11px] p-2 space-y-1 divide-y divide-slate-800/40">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-6 text-slate-600 text-xs italic">
            Esperando tramas de red cifradas desde sockets TLS o MQTT...
          </div>
        ) : (
          filteredLogs.slice(-40).reverse().map((entry) => {
            const timeStr = new Date(entry.timestamp).toISOString().substring(11, 19);

            return (
              <div
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className={`py-1 px-2 rounded flex flex-col md:flex-row items-start md:items-center justify-between gap-1 transition-all cursor-pointer hover:bg-slate-800/40 ${
                  !entry.is_valid ? 'bg-red-950/30 border-l-2 border-red-500' : ''
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 text-[10px]">{timeStr}</span>
                  <span className="text-sky-400 font-bold">[{entry.source}]</span>
                  <span className="text-emerald-300 font-semibold">{entry.device_id}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400 text-[10px]">
                    NONCE: <span className="text-amber-400">{entry.nonce_hex.substring(0, 12)}...</span>
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    TAG: <span className="text-sky-400">{entry.tag_hex.substring(0, 10)}...</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {entry.is_valid ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>TAG VÁLIDO</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800">
                      <ShieldAlert className="w-3 h-3 text-red-400" />
                      <span>TAG FALLIDO / MANIPULACIÓN</span>
                    </span>
                  )}

                  {entry.telemetry && (
                    <span className="text-slate-400 text-[10px]">
                      POS:({entry.telemetry.lat.toFixed(4)}, {entry.telemetry.lon.toFixed(4)}) SPD:{entry.telemetry.speed.toFixed(1)}km/h
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Payload Modal / Bottom Inspector */}
      {selectedEntry && (
        <div className="p-3 bg-[#0d1527] border-t border-slate-700/80 flex flex-col md:flex-row items-start justify-between gap-3 text-xs font-mono-code">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <span>DETALLE DE TRAMA CIFRADA (WIRE PACKET AUDIT)</span>
              <span className="text-slate-500">[{selectedEntry.device_id}]</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-300">
              <div>
                <span className="text-slate-500">NONCE (96 bits): </span>
                <span className="text-amber-400 break-all">{selectedEntry.nonce_hex}</span>
              </div>
              <div>
                <span className="text-slate-500">GCM TAG (128 bits): </span>
                <span className="text-sky-400 break-all">{selectedEntry.tag_hex}</span>
              </div>
              <div className="col-span-1 md:col-span-2">
                <span className="text-slate-500">TEXTO CIFRADO: </span>
                <span className="text-slate-400 break-all">{selectedEntry.ciphertext_preview}</span>
              </div>
              {selectedEntry.telemetry && (
                <div className="col-span-1 md:col-span-2 p-2 rounded bg-slate-900 border border-slate-800 text-emerald-300">
                  <span className="text-slate-500 block text-[10px] mb-1">PAYLOAD JSON DESCIFRADO Y VERIFICADO:</span>
                  <pre className="text-[10px] text-emerald-300 overflow-x-auto">
                    {JSON.stringify(selectedEntry.telemetry, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setSelectedEntry(null)}
            className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
          >
            CERRAR
          </button>
        </div>
      )}
    </div>
  );
};
