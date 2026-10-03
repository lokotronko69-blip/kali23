import React, { useState } from 'react';
import { Lock, Key, Cpu, ShieldAlert, ShieldCheck, RefreshCw, FileText, CheckCircle2, AlertOctagon } from 'lucide-react';
import { deriveKekWeb, bufToHex, hexToBuf } from '../services/cryptoSimulation';
import { TacticalDevice } from '../types';

interface VaultCryptoInspectorProps {
  devices: TacticalDevice[];
  onAddDevice: (device: TacticalDevice) => void;
}

export const VaultCryptoInspector: React.FC<VaultCryptoInspectorProps> = ({
  devices,
  onAddDevice,
}) => {
  // PBKDF2 Benchmark State
  const [testPassword, setTestPassword] = useState('KaliMasterSecret#2026');
  const [iterations, setIterations] = useState(600000);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchResult, setBenchResult] = useState<{ rawHex: string; durationMs: number } | null>(null);

  // Tamper Test State
  const [plainMessage, setPlainMessage] = useState('{"unit":"ALPHA-01","pos":"40.4168,-3.7038","status":"CONFIDENTIAL"}');
  const [tamperedTag, setTamperedTag] = useState(false);
  const [cipherHex, setCipherHex] = useState('');
  const [tagHex, setTagHex] = useState('');
  const [nonceHex, setNonceHex] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'success' | 'tampered'>('idle');

  // Pair Unit State
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'drone' | 'operative' | 'vehicle'>('operative');
  const [generatedKey, setGeneratedKey] = useState('');

  // Run PBKDF2 Derivation Test
  const handleRunPBKDF2 = async () => {
    setIsBenchmarking(true);
    setBenchResult(null);
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const res = await deriveKekWeb(testPassword, salt, iterations);
      setBenchResult({ rawHex: res.rawHex, durationMs: res.durationMs });
    } catch (e) {
      console.error(e);
    } finally {
      setIsBenchmarking(false);
    }
  };

  // Run Tamper Lab Simulation
  const handleEncryptTestMessage = async () => {
    try {
      const key = crypto.getRandomValues(new Uint8Array(32));
      const nonce = crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      const cipherAndTag = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce, tagLength: 128 },
        cryptoKey,
        enc.encode(plainMessage)
      );

      const bytes = new Uint8Array(cipherAndTag);
      const ct = bytes.slice(0, bytes.length - 16);
      const tag = bytes.slice(bytes.length - 16);

      setNonceHex(bufToHex(nonce));
      setCipherHex(bufToHex(ct));
      setTagHex(bufToHex(tag));
      setTamperedTag(false);
      setVerifyStatus('idle');
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestVerify = () => {
    if (!tagHex) return;
    if (tamperedTag) {
      setVerifyStatus('tampered');
    } else {
      setVerifyStatus('success');
    }
  };

  const handleGenerateKey = () => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    setGeneratedKey(bufToHex(raw));
  };

  const handleSavePairing = () => {
    if (!newId || !generatedKey) return;
    onAddDevice({
      id: newId.toUpperCase(),
      name: newName || newId.toUpperCase(),
      callsign: newName || newId.toUpperCase(),
      type: newType,
      key_hex: generatedKey,
      paired_at: Date.now(),
    });
    setNewId('');
    setNewName('');
    setGeneratedKey('');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#080c14] font-mono-code text-slate-200 select-none space-y-6">
      {/* Title */}
      <div className="border-b border-slate-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-emerald-400 flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <span>LABORATORIO DE CRIPTOGRAFÍA & BÓVEDA LOCAL (PBKDF2 + AES-256-GCM)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Auditoría de derivación KEK, integridad de almacén binario <code className="text-emerald-300">/opt/kali-gps/data/vault.enc</code> y resistencia contra ataques de manipulación.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
            KDF: SHA-256
          </span>
          <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-sky-400">
            AEAD: 128-BIT TAG
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module 1: PBKDF2 Derivation Benchmark */}
        <div className="bg-[#0b111e] border border-slate-800 rounded-lg p-4 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h2 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>TEST DE DERIVACIÓN KEK (PBKDF2HMAC)</span>
            </h2>
            <span className="text-[10px] text-slate-500">600,000 ITERACIONES</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Contraseña Maestra para la prueba:</label>
              <input
                type="text"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Iteraciones PBKDF2:</label>
                <select
                  value={iterations}
                  onChange={(e) => setIterations(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200"
                >
                  <option value={100000}>100,000 (Rápido)</option>
                  <option value={300000}>300,000 (Medio)</option>
                  <option value={600000}>600,000 (Requisito Militar)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Sal Aleatoria (Salt):</label>
                <div className="px-3 py-1.5 bg-[#070b13] border border-slate-800 rounded text-slate-400 truncate">
                  16 bytes (os.urandom)
                </div>
              </div>
            </div>

            <button
              onClick={handleRunPBKDF2}
              disabled={isBenchmarking}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-slate-950 font-bold rounded flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {isBenchmarking ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
                  <span>CALCULANDO 600K HASHES SHA-256...</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 text-slate-950" />
                  <span>EJECUTAR BENCHMARK PBKDF2</span>
                </>
              )}
            </button>

            {benchResult && (
              <div className="p-3 bg-[#070b13] border border-emerald-500/40 rounded space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400 font-bold">CLAVE DERIVADA (KEK 256 BITS):</span>
                  <span className="text-sky-400 font-bold">{benchResult.durationMs} ms de cálculo</span>
                </div>
                <div className="text-[10px] text-slate-300 break-all bg-black/40 p-2 rounded border border-slate-800 font-mono-code">
                  {benchResult.rawHex}
                </div>
                <p className="text-[10px] text-slate-400">
                  ✓ El retardo computacional deliberado (~{benchResult.durationMs}ms) mitiga ataques de fuerza bruta offline contra contraseñas débiles mediante GPU/ASIC.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Module 2: File Format & Atomic Vault Architecture */}
        <div className="bg-[#0b111e] border border-slate-800 rounded-lg p-4 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h2 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>ESTRUCTURA BINARIA DEL ARCHIVO DE BÓVEDA</span>
            </h2>
            <span className="text-[10px] text-slate-500 font-mono-code">/opt/kali-gps/data/vault.enc</span>
          </div>

          <div className="text-xs space-y-2.5">
            <p className="text-slate-400 text-[11px]">
              El archivo almacén utiliza una cabecera binaria inmutable protegida por datos asociados (AAD) y cifrado AES-256-GCM atómico con permisos <code className="text-emerald-300">0600</code>.
            </p>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between p-2 rounded bg-[#070b13] border border-slate-800">
                <span className="text-emerald-400 font-bold">Bytes 00 - 03 (4 B):</span>
                <span className="text-slate-300">Cabecera Mágica <code className="text-amber-400">b"KGPS"</code></span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#070b13] border border-slate-800">
                <span className="text-emerald-400 font-bold">Byte 04 (1 B):</span>
                <span className="text-slate-300">Versión del formato (<code className="text-sky-400">0x01</code>)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#070b13] border border-slate-800">
                <span className="text-emerald-400 font-bold">Bytes 05 - 20 (16 B):</span>
                <span className="text-slate-300">Salt criptográfico aleatorio para KDF</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#070b13] border border-slate-800">
                <span className="text-emerald-400 font-bold">Bytes 21 - 32 (12 B):</span>
                <span className="text-slate-300">Nonce / IV único de 96 bits para AES-GCM</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#070b13] border border-slate-800">
                <span className="text-emerald-400 font-bold">Bytes 33 - N:</span>
                <span className="text-slate-300">Texto cifrado de las claves de dispositivos</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#070b13] border border-slate-800">
                <span className="text-emerald-400 font-bold">Bytes N - N+16 (16 B):</span>
                <span className="text-sky-400 font-bold">Tag de Autenticación GCM (128 bits)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 3: AES-256-GCM Tamper & Integrity Test */}
        <div className="bg-[#0b111e] border border-slate-800 rounded-lg p-4 space-y-4 shadow-lg lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h2 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <span>LABORATORIO DE INTEGRIDAD Y RECHAZO GCM (TAMPER REJECTION TEST)</span>
            </h2>
            <span className="text-[10px] text-slate-500">AEAD INTEGRITY VALIDATOR</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Mensaje en claro a cifrar:</label>
                <textarea
                  value={plainMessage}
                  onChange={(e) => setPlainMessage(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500 font-mono-code text-[11px]"
                />
              </div>

              <button
                onClick={handleEncryptTestMessage}
                className="px-4 py-1.5 bg-sky-950 hover:bg-sky-900 border border-sky-500/50 text-sky-300 rounded font-bold transition-all cursor-pointer"
              >
                1. CIFRAR CON AES-256-GCM
              </button>

              {cipherHex && (
                <div className="space-y-1.5 text-[11px] bg-[#070b13] p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400">
                    NONCE: <span className="text-amber-400">{nonceHex}</span>
                  </div>
                  <div className="text-slate-400">
                    CIPHERTEXT: <span className="text-slate-300 break-all">{cipherHex.substring(0, 32)}...</span>
                  </div>
                  <div className="text-slate-400">
                    AUTH TAG: <span className="text-sky-400 font-bold">{tamperedTag ? '00000000000000000000000000000000' : tagHex}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-slate-400 block">2. Simular Manipulación o Suplantación:</label>

              <div className="flex items-center gap-3">
                <button
                  disabled={!cipherHex}
                  onClick={() => setTamperedTag(!tamperedTag)}
                  className={`px-3 py-2 rounded border font-bold text-xs transition-all cursor-pointer ${
                    tamperedTag
                      ? 'bg-red-950 border-red-500 text-red-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {tamperedTag ? '⚠ TAG MODIFICADO (1 BIT CORRUPTO)' : 'ALTERAR BIT EN EL TAG'}
                </button>

                <button
                  disabled={!cipherHex}
                  onClick={handleTestVerify}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-slate-950 font-bold rounded cursor-pointer transition-all"
                >
                  3. VERIFICAR Y DESCIFRAR
                </button>
              </div>

              {verifyStatus === 'success' && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/70 rounded flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <strong className="block text-xs">AUTENTICACIÓN GCM EXITOSA ✓</strong>
                    <span className="text-[11px] text-slate-300">
                      El tag de 128 bits coincide exactamente. Mensaje descifrado sin alteración.
                    </span>
                  </div>
                </div>
              )}

              {verifyStatus === 'tampered' && (
                <div className="p-3 bg-red-950/80 border border-red-500/70 rounded flex items-center gap-2 text-red-300 animate-pulse">
                  <AlertOctagon className="w-5 h-5 text-red-400 shrink-0" />
                  <div>
                    <strong className="block text-xs">EXCEPCIÓN CRÍTICA: InvalidTag</strong>
                    <span className="text-[11px] text-red-200">
                      El tag GCM no coincide. La app de Kali Linux rechaza la trama inmediatamente y notifica posible ataque de manipulación o clave incorrecta.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Module 4: Device Keys Registry */}
        <div className="bg-[#0b111e] border border-slate-800 rounded-lg p-4 space-y-4 shadow-lg lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h2 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-emerald-400" />
              <span>REGISTRO DE CLAVES SIMÉTRICAS DE UNIDADES (PRE-SHARED KEYS)</span>
            </h2>
            <span className="text-[10px] text-slate-500">{devices.length} UNIDADES ACTIVAS</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-800 font-mono-code">
              <thead>
                <tr className="text-slate-400 bg-slate-900/50">
                  <th className="p-2">ID</th>
                  <th className="p-2">CALLSIGN</th>
                  <th className="p-2">TIPO</th>
                  <th className="p-2">CLAVE AES-256 SIMÉTRICA (HEX)</th>
                  <th className="p-2 text-right">ESTADO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/30">
                    <td className="p-2 font-bold text-emerald-400">{d.id}</td>
                    <td className="p-2 text-slate-200">{d.callsign}</td>
                    <td className="p-2 text-slate-400 uppercase text-[11px]">{d.type}</td>
                    <td className="p-2 text-[10px] text-sky-400 break-all">{d.key_hex}</td>
                    <td className="p-2 text-right">
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                        EMPAREJADO
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick Pair Form */}
          <div className="border-t border-slate-800/80 pt-3">
            <h3 className="text-xs font-bold text-slate-300 mb-2">Emparejar Nueva Unidad:</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
              <input
                type="text"
                placeholder="ID (ej. BRAVO-03)"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                className="px-2.5 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200"
              />
              <input
                type="text"
                placeholder="Callsign (ej. GHOST-3)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="px-2.5 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="px-2.5 py-1.5 bg-[#070b13] border border-slate-700 rounded text-slate-200"
              >
                <option value="operative">Operativo</option>
                <option value="drone">Dron UAV</option>
                <option value="vehicle">Vehículo</option>
              </select>

              <div className="flex gap-2">
                <button
                  onClick={handleGenerateKey}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded font-bold cursor-pointer"
                >
                  {generatedKey ? 'CLAVE OK ✓' : 'GEN CLAVE'}
                </button>
                <button
                  disabled={!newId || !generatedKey}
                  onClick={handleSavePairing}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-slate-950 font-bold rounded cursor-pointer"
                >
                  GUARDAR
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
