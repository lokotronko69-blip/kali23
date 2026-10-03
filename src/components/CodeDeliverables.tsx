import React, { useState } from 'react';
import { DELIVERABLES, DeliverableFile } from '../data/deliverables';
import { Terminal, Copy, Check, Download, FileCode, Shield, ExternalLink } from 'lucide-react';
import JSZip from 'jszip';

interface CodeDeliverablesProps {
  onDownloadAllZip: () => void;
}

export const CodeDeliverables: React.FC<CodeDeliverablesProps> = ({ onDownloadAllZip }) => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const currentFile = DELIVERABLES[activeFileIndex] || DELIVERABLES[0];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = (file: DeliverableFile) => {
    const blob = new Blob([file.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const curlCommand = `curl -sSL https://raw.githubusercontent.com/kali-ares/kali-gps/main/install.sh | sudo bash`;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#080c14] font-mono-code text-slate-200 select-none space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-emerald-400 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <span>ENTREGABLES NATIVOS PARA KALI LINUX & CÓDIGO FUENTE COMPLETO</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Archivos listos para producción con hardening PEP 668, Linux Capabilities (`setcap`), TLS 1.3 y PyQt6.
          </p>
        </div>

        <button
          onClick={onDownloadAllZip}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] cursor-pointer"
        >
          <Download className="w-4 h-4 text-slate-950" />
          <span>DESCARGAR PAQUETE COMPLETO (.ZIP)</span>
        </button>
      </div>

      {/* One-Command Installer Banner */}
      <div className="bg-[#0b1220] border border-emerald-500/40 rounded-lg p-3.5 space-y-2 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>INSTALACIÓN SILENCIOSA EN UN SOLO COMANDO (KALI LINUX TERMINAL)</span>
          </span>
          <span className="text-[10px] text-slate-400">REQUIERE SUDO</span>
        </div>

        <div className="flex items-center gap-2 bg-[#060910] border border-slate-700/80 rounded p-2 text-xs">
          <code className="flex-1 text-sky-300 overflow-x-auto whitespace-nowrap">
            {curlCommand}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(curlCommand);
              setCopiedSnippet(true);
              setTimeout(() => setCopiedSnippet(false), 2000);
            }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 cursor-pointer transition-all shrink-0"
          >
            {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSnippet ? 'COPIADO' : 'COPIAR'}</span>
          </button>
        </div>
      </div>

      {/* Files Navigator & Code Viewer */}
      <div className="bg-[#0b111e] border border-slate-800 rounded-lg overflow-hidden shadow-xl flex flex-col h-[650px]">
        {/* File Tabs */}
        <div className="bg-[#080d17] border-b border-slate-800 p-2 flex items-center gap-1 overflow-x-auto">
          {DELIVERABLES.map((file, idx) => {
            const isActive = idx === activeFileIndex;
            return (
              <button
                key={file.name}
                onClick={() => setActiveFileIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono-code transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/60 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-emerald-500" />
                <span>{file.name}</span>
              </button>
            );
          })}
        </div>

        {/* Current File Meta Bar */}
        <div className="px-4 py-2 bg-[#0c1322] border-b border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div>
            <div className="flex items-center gap-2">
              <strong className="text-slate-100">{currentFile.name}</strong>
              <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                {currentFile.path}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">{currentFile.description}</p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIADO' : 'COPIAR CÓDIGO'}</span>
            </button>

            <button
              onClick={() => handleDownloadSingle(currentFile)}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 rounded text-xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DESCARGAR</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto bg-[#060910] p-4 font-mono-code text-xs leading-relaxed text-slate-300">
          <pre className="selection:bg-emerald-900 selection:text-emerald-200">
            <code>{currentFile.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
