import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { DeviceTelemetry, TacticalDevice } from '../types';
import { Crosshair, Eye, Compass, Layers, ShieldCheck } from 'lucide-react';

interface TacticalMapProps {
  devices: TacticalDevice[];
  telemetries: Record<string, DeviceTelemetry>;
  selectedDeviceId: string | null;
  onSelectDevice: (id: string) => void;
  radarScanEnabled: boolean;
  onToggleRadar: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  drone: '#38bdf8', // Blue
  operative: '#10b981', // Emerald
  vehicle: '#f59e0b', // Amber
  asset: '#a855f7', // Purple
};

export const TacticalMap: React.FC<TacticalMapProps> = ({
  devices,
  telemetries,
  selectedDeviceId,
  onSelectDevice,
  radarScanEnabled,
  onToggleRadar,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const tracksRef = useRef<Record<string, L.Polyline>>({});
  const ringsRef = useRef<L.Circle[]>([]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = [40.4168, -3.7038]; // Madrid Tactical Operations Demo Area

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    // Dark styled tiles with offline fallback
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'dark-tiles',
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers and Tracks
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    devices.forEach((dev) => {
      const telem = telemetries[dev.id];
      if (!telem) return;

      const latLng: [number, number] = [telem.lat, telem.lon];
      const color = telem.status === 'ALERT' || telem.status === 'JAMMING' ? '#ef4444' : TYPE_COLORS[dev.type] || '#10b981';
      const isSelected = selectedDeviceId === dev.id;

      // Create Custom SVG Icon with Rotation
      const svgMarker = `
        <div class="relative flex items-center justify-center w-8 h-8 cursor-pointer group" style="transform: rotate(${telem.heading}deg);">
          <div class="absolute inset-0 rounded-full border-2 ${isSelected ? 'border-emerald-400 animate-ping' : 'border-emerald-500/40'}" style="border-color: ${color};"></div>
          <svg class="w-7 h-7 drop-shadow-[0_0_8px_${color}]" viewBox="0 0 32 32">
            ${
              dev.type === 'drone'
                ? `<polygon points="16,2 25,26 16,20 7,26" fill="${color}" stroke="#0b111e" stroke-width="1.5"/>
                   <circle cx="16" cy="14" r="3" fill="#0b111e"/>`
                : dev.type === 'vehicle'
                ? `<rect x="8" y="6" width="16" height="20" rx="3" fill="${color}" stroke="#0b111e" stroke-width="1.5"/>
                   <polygon points="16,2 20,6 12,6" fill="${color}"/>`
                : `<circle cx="16" cy="16" r="8" fill="${color}" stroke="#0b111e" stroke-width="2"/>
                   <polygon points="16,2 20,10 12,10" fill="${color}"/>`
            }
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'tactical-div-icon',
        html: svgMarker,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const popupContent = `
        <div class="p-2 font-mono-code text-xs">
          <div class="flex items-center justify-between border-b border-slate-700 pb-1 mb-1.5">
            <strong style="color: ${color};" class="font-tactical text-sm">${dev.callsign}</strong>
            <span class="px-1.5 py-0.2 rounded text-[10px] ${telem.status === 'NORMAL' ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}">${telem.status}</span>
          </div>
          <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-300">
            <div><span class="text-slate-500">VELOCIDAD:</span> <strong>${telem.speed.toFixed(1)} km/h</strong></div>
            <div><span class="text-slate-500">ALTITUD:</span> <strong>${telem.alt.toFixed(0)} m</strong></div>
            <div><span class="text-slate-500">RUMBO:</span> <strong>${telem.heading}°</strong></div>
            <div><span class="text-slate-500">BATERÍA:</span> <strong class="${telem.battery < 20 ? 'text-red-400' : 'text-emerald-400'}">${telem.battery}%</strong></div>
            <div class="col-span-2 text-[10px] text-slate-400 mt-1 flex items-center justify-between">
              <span>SAT: ${telem.satellites}</span>
              <span class="text-emerald-400 font-bold">AES-256-GCM ✓</span>
            </div>
          </div>
        </div>
      `;

      if (!markersRef.current[dev.id]) {
        const marker = L.marker(latLng, { icon: customIcon }).addTo(map);
        marker.bindPopup(popupContent);
        marker.on('click', () => onSelectDevice(dev.id));
        markersRef.current[dev.id] = marker;

        const polyline = L.polyline([latLng], {
          color,
          weight: 2.5,
          opacity: 0.75,
          smoothFactor: 1,
        }).addTo(map);
        tracksRef.current[dev.id] = polyline;
      } else {
        const marker = markersRef.current[dev.id];
        marker.setLatLng(latLng);
        marker.setIcon(customIcon);
        marker.getPopup()?.setContent(popupContent);

        const polyline = tracksRef.current[dev.id];
        if (polyline) {
          const latLngs = polyline.getLatLngs() as L.LatLng[];
          latLngs.push(L.latLng(latLng[0], latLng[1]));
          if (latLngs.length > 120) latLngs.shift();
          polyline.setLatLngs(latLngs);
        }
      }
    });
  }, [devices, telemetries, selectedDeviceId, onSelectDevice]);

  // Center on Selected Device & Draw Range Rings
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old rings
    ringsRef.current.forEach((r) => r.remove());
    ringsRef.current = [];

    if (selectedDeviceId && telemetries[selectedDeviceId]) {
      const t = telemetries[selectedDeviceId];
      const center: [number, number] = [t.lat, t.lon];
      map.panTo(center, { animate: true, duration: 0.8 });

      // Open popup
      markersRef.current[selectedDeviceId]?.openPopup();

      // Range rings: 200m, 500m, 1000m
      const ring200 = L.circle(center, {
        radius: 200,
        color: '#10b981',
        weight: 1,
        dashArray: '4, 6',
        fill: true,
        fillColor: '#10b981',
        fillOpacity: 0.04,
      }).addTo(map);

      const ring500 = L.circle(center, {
        radius: 500,
        color: '#10b981',
        weight: 1,
        dashArray: '2, 8',
        fill: false,
      }).addTo(map);

      const ring1000 = L.circle(center, {
        radius: 1000,
        color: '#38bdf8',
        weight: 1,
        dashArray: '5, 10',
        fill: false,
      }).addTo(map);

      ringsRef.current = [ring200, ring500, ring1000];
    }
  }, [selectedDeviceId, telemetries]);

  return (
    <div className="relative w-full h-full bg-[#070b13] overflow-hidden select-none">
      {/* Leaflet DOM Node */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Radar Sweep Effect (Tactical Simulation) */}
      {radarScanEnabled && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-30">
          <div className="absolute top-1/2 left-1/2 w-[900px] h-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/20">
            <div className="w-full h-full rounded-full animate-radar origin-center bg-[conic-gradient(from_0deg,transparent_0deg,rgba(16,185,129,0.3)_60deg,transparent_65deg)]" />
          </div>
        </div>
      )}

      {/* Tactical Canvas Grid (Background Graticule) */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(to_right,rgba(16,185,129,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.06)_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* Crosshair Center Reticle */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 opacity-30 text-emerald-400">
        <Crosshair className="w-8 h-8" />
      </div>

      {/* Top Left HUD Status Overlay */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 font-mono-code text-[11px] pointer-events-none">
        <div className="flex items-center gap-2 bg-[#0b111e]/90 border border-emerald-500/40 px-3 py-1.5 rounded shadow-[0_4px_15px_rgba(0,0,0,0.8)] backdrop-blur-sm text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-bold">E2EE SEGURO: AES-256-GCM</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">TELEMETRÍA EN TIEMPO REAL</span>
        </div>
      </div>

      {/* Map Control Tools (Top Right) */}
      <div className="absolute top-3 right-14 z-20 flex items-center gap-2">
        <button
          onClick={onToggleRadar}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono-code border transition-all cursor-pointer shadow-lg backdrop-blur-sm ${
            radarScanEnabled
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
              : 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Activar/Desactivar barrido de radar táctico"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>RADAR {radarScanEnabled ? 'ON' : 'OFF'}</span>
        </button>

        {selectedDeviceId && (
          <button
            onClick={() => {
              const t = telemetries[selectedDeviceId];
              if (t && mapInstanceRef.current) {
                mapInstanceRef.current.flyTo([t.lat, t.lon], 16, { duration: 1 });
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono-code border border-sky-500/50 bg-sky-950/80 text-sky-300 hover:bg-sky-900 transition-all cursor-pointer shadow-lg backdrop-blur-sm"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>CENTRAR ACTIVO</span>
          </button>
        )}
      </div>

      {/* Bottom Map Coordinates & Bearing Ribbon */}
      <div className="absolute bottom-2 left-3 z-20 flex items-center gap-3 bg-[#0b111e]/90 border border-slate-800 px-3 py-1 rounded text-[10px] font-mono-code text-slate-400 pointer-events-none">
        <div className="flex items-center gap-1">
          <Compass className="w-3 h-3 text-emerald-400" />
          <span>DATUM: <strong className="text-slate-200">WGS-84</strong></span>
        </div>
        <span className="text-slate-700">|</span>
        <span>MODO: <strong className="text-emerald-400">OFFLINE LEAFLET EMBEDDED</strong></span>
        <span className="text-slate-700">|</span>
        <span>DESPLAZAMIENTO: <strong className="text-sky-400">0.0 ms</strong></span>
      </div>
    </div>
  );
};
