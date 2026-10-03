import React, { useState, useEffect } from 'react';
import { Shield, Radio, Terminal, Lock, MapPin, Download, AlertTriangle, Cpu } from 'lucide-react';

interface HeaderProps {
  activeTab: 'map' | 'vault' | 'code' | 'transmitter';
  setActiveTab: (tab: 'map' | 'vault' | 'code' | 'transmitter') => void;
  activeAssetCount: number;
  alertCount: number;
  onDownloadZip: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeAssetCount,
  alertCount,
  onDownloadZip,
}) => {
  const [zuluTime, setZuluTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const zulu = now.toISOString().replace('T', ' ').substring(0, 19) + 'Z';
      setZuluTime(zulu);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-[#0b111e] border-b border-emerald-950/80 px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3 select-none">
      {/* Brand & System Status */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-tactical tracking-wider text-base font-bold text-white flex items-center gap-1.5">
                KALI-ARES <span className="text-emerald-400 font-mono-code text-xs px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/40">MIL-SPEC</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono-code flex items-center gap-1.5">
              <span>KALI LINUX NATIVE</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400">TLS 1.3 / AES-256-GCM / PBKDF2</span>
            </p>
          </div>
        </div>

        {/* Security Hardening Badges */}
        <div className="hidden xl:flex items-center gap-1.5 text-[10px] font-mono-code ml-4">
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-slate-300">
            PEP 668: <strong className="text-emerald-400">VENV</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-slate-300">
            SETCAP: <strong className="text-sky-400">443/883</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-slate-300">
            PBKDF2: <strong className="text-amber-400">600K</strong>
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-[#070b13] p-1 rounded-lg border border-slate-800">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono-code transition-all ${
            activeTab === 'map'
              ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.2)] font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>MAPA TÁCTICO</span>
          <span className="ml-1 px-1.5 py-0.2 bg-emerald-950 text-emerald-400 rounded-full text-[10px] border border-emerald-800/80">
            {activeAssetCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('vault')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono-code transition-all ${
            activeTab === 'vault'
              ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.2)] font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>BÓVEDA & CRIPTO</span>
        </button>

        <button
          onClick={() => setActiveTab('transmitter')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono-code transition-all ${
            activeTab === 'transmitter'
              ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.2)] font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>TRANSMISOR</span>
        </button>

        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono-code transition-all ${
            activeTab === 'code'
              ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.2)] font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>ENTREGABLES KALI</span>
        </button>
      </div>

      {/* Right Actions: Military Clock & Download Zip */}
      <div className="flex items-center gap-2.5">
        <div className="hidden lg:flex flex-col items-end font-mono-code">
          <span className="text-emerald-400 text-xs font-semibold tracking-wider">
            {zuluTime || 'UTC 00:00:00Z'}
          </span>
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-slate-500" /> KALI HOST: 127.0.0.1
          </span>
        </div>

        {alertCount > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 bg-red-950/80 border border-red-500/50 text-red-300 rounded text-xs font-mono-code animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span>{alertCount} ALERTA</span>
          </div>
        )}

        <button
          onClick={onDownloadZip}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] cursor-pointer"
          title="Descargar paquete completo para Kali Linux (.zip con todos los scripts)"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">DESCARGAR PAQUETE</span>
          <span className="sm:hidden">ZIP</span>
        </button>
      </div>
    </header>
  );
};
