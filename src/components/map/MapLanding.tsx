'use client';

/**
 * MapLanding.tsx — Leaflet-based 2D map with OSM tiles
 *
 * Level 1 (Overview): OSM street tiles + 24 area/colony boundaries
 * Level 2 (Detail): click an area → fly to it → show parcels (light) +
 *   ALL buildings (colored by height gradient blue→red) together
 * Level 3: click a building → open 3D viewer
 *
 * Uses Leaflet (no Web Workers) so it works in any environment.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Building2, MapPin, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useViewerStore } from '@/lib/viewer-store';
import { createBuildingFromFeature } from '@/lib/building-data';
import type { MapBuildingFeature } from '@/lib/map-data';

// Types
interface Colony {
  id: string;
  name: string;
  bbox: [number, number, number, number];
  center: [number, number];
  coords: [number, number][];
  parcelCount: number;
  buildingCount: number;
}
interface Parcel {
  code: string;
  c: [number, number][];
  ce: [number, number];
  bc: number;
}

type MapLevel = 'overview' | 'detail';

// Swap [lng, lat] → [lat, lng] for Leaflet (GeoJSON uses lng-first, Leaflet uses lat-first)
function toLatLng(coords: [number, number][]): [number, number][] {
  return coords.map(([lng, lat]) => [lat, lng]);
}

// Height → sequential indigo ramp (calm, light theme)
function heightColor(h: number): string {
  if (h < 5) return '#E0E7FF'; // indigo-100
  if (h < 10) return '#A5B4FC'; // indigo-300
  if (h < 20) return '#818CF8'; // indigo-400
  if (h < 40) return '#4F46E5'; // indigo-600
  return '#312E81'; // indigo-900
}

const AOI_CENTER: [number, number] = [12.975, 77.635];

export default function MapLanding() {
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const areaLayerRef = useRef<L.LayerGroup | null>(null);
  const parcelLayerRef = useRef<L.LayerGroup | null>(null);
  const buildingLayerRef = useRef<L.LayerGroup | null>(null);

  const [colonies, setColonies] = useState<Colony[]>([]);
  const [areas, setAreas] = useState<Record<string, { parcels: Parcel[] }>>({});
  const [buildingsByParcel, setBuildingsByParcel] = useState<Record<string, MapBuildingFeature[]> | null>(null);
  const [loadingBuildings, setLoadingBuildings] = useState(false);

  const [level, setLevel] = useState<MapLevel>('overview');
  const [activeColony, setActiveColony] = useState<Colony | null>(null);
  const [hoveredBuilding, setHoveredBuilding] = useState<MapBuildingFeature | null>(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0 });

  const openBuildingFromMap = useViewerStore((s) => s.openBuildingFromMap);

  // --- Function declarations (must be before useEffect hooks) ---

  // Lazy-load buildings
  const loadBuildings = useCallback(async () => {
    if (buildingsByParcel || loadingBuildings) return;
    setLoadingBuildings(true);
    const res = await fetch('/data/buildings-by-parcel.json');
    const data = await res.json();
    setBuildingsByParcel(data);
    setLoadingBuildings(false);
  }, [buildingsByParcel, loadingBuildings]);

  // Enter a colony (overview → detail)
  const enterColony = useCallback((c: Colony) => {
    setActiveColony(c);
    setLevel('detail');
    map.current?.flyToBounds([[c.bbox[1], c.bbox[0]], [c.bbox[3], c.bbox[2]]] as [[number, number], [number, number]], { padding: [50, 50] });
  }, []);

  // Return to overview
  const goBack = useCallback(() => {
    setLevel('overview');
    setActiveColony(null);
    map.current?.flyTo(AOI_CENTER, 13);
  }, []);

  // Click a building → open 3D viewer
  const onBuildingClick = useCallback((b: MapBuildingFeature) => {
    const building = createBuildingFromFeature(b);
    openBuildingFromMap(b, building);
  }, [openBuildingFromMap]);

  // --- useEffect hooks ---

  // Load colony index on mount
  useEffect(() => {
    fetch('/data/colony-index.json')
      .then((r) => r.json())
      .then((data) => {
        setColonies(data.colonies);
        setAreas(data.areas);
      });
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || map.current) return;

    const m = L.map(mapRef.current, {
      center: AOI_CENTER,
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    // OSM tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(m);

    // Layer groups
    areaLayerRef.current = L.layerGroup().addTo(m);
    parcelLayerRef.current = L.layerGroup().addTo(m);
    buildingLayerRef.current = L.layerGroup().addTo(m);

    map.current = m;

    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Render colony boundaries when colonies are loaded (overview level)
  useEffect(() => {
    if (!map.current || !areaLayerRef.current || colonies.length === 0) return;

    areaLayerRef.current.clearLayers();

    if (level === 'overview') {
      // Show all 24 colony boundaries
      colonies.forEach((c) => {
        const poly = L.polygon(toLatLng(c.coords), {
          color: '#4F46E5',
          weight: 2,
          fillColor: '#EEF2FF',
          fillOpacity: 0.25,
        });

        poly.bindTooltip(`<div style="font-family:monospace;font-size:11px"><b>${c.name}</b><br/>${c.parcelCount} parcels · ${c.buildingCount} buildings</div>`, {
          sticky: true,
        });

        poly.on('click', () => enterColony(c));
        poly.addTo(areaLayerRef.current!);
      });
    } else if (level === 'detail' && activeColony) {
      // Show the active colony boundary (highlighted)
      const poly = L.polygon(toLatLng(activeColony.coords), {
        color: '#4F46E5',
        weight: 2,
        fillColor: '#EEF2FF',
        fillOpacity: 0.1,
        dashArray: '5,5',
      });
      poly.addTo(areaLayerRef.current);
    }
  }, [colonies, level, activeColony]);

  // Render parcels + buildings when entering a colony (detail level)
  useEffect(() => {
    if (!map.current || !parcelLayerRef.current || !buildingLayerRef.current) return;
    if (level !== 'detail' || !activeColony) return;

    parcelLayerRef.current.clearLayers();
    buildingLayerRef.current.clearLayers();

    const parcels = areas[activeColony.id]?.parcels ?? [];

    // Render parcels (light grey, semi-transparent)
    parcels.forEach((p) => {
      const poly = L.polygon(toLatLng(p.c), {
        color: '#64748b',
        weight: 0.8,
        fillColor: '#94a3b8',
        fillOpacity: 0.15,
      });

      poly.bindTooltip(`<div style="font-family:monospace;font-size:11px"><b>${p.code}</b><br/>${p.bc} buildings</div>`, {
        sticky: true,
      });

      poly.on('click', () => {
        // Clicking a parcel also loads buildings (if not loaded)
        if (!buildingsByParcel) loadBuildings();
      });

      poly.addTo(parcelLayerRef.current!);
    });

    // Load buildings for this colony (deferred to avoid setState-in-effect)
    Promise.resolve().then(() => loadBuildings());
  }, [level, activeColony, areas, loadBuildings]);

  // Render buildings when buildingsByParcel is loaded
  useEffect(() => {
    if (!buildingLayerRef.current || !buildingsByParcel || level !== 'detail' || !activeColony) return;

    buildingLayerRef.current.clearLayers();

    const parcels = areas[activeColony?.id ?? '']?.parcels ?? [];

    parcels.forEach((p) => {
      const bldgs = buildingsByParcel[p.code] ?? [];
      bldgs.forEach((b) => {
        const poly = L.polygon(toLatLng(b.c), {
          color: heightColor(b.h),
          weight: 1,
          fillColor: heightColor(b.h),
          fillOpacity: 0.7,
        });

        poly.bindTooltip(
          `<div style="font-family:monospace;font-size:11px"><b>${b.n || `#${b.id}`}</b><br/>${b.f} floors · ${b.h.toFixed(1)}m</div>`,
          { sticky: true }
        );

        poly.on('click', () => onBuildingClick(b));
        poly.on('mouseover', (e: any) => {
          setHoveredBuilding(b);
          const container = e.sourceTarget?._map?._container;
          if (container) {
            const rect = container.getBoundingClientRect();
            const point = e.layerPoint;
            setTooltip({ x: rect.left + point.x, y: rect.top + point.y });
          }
        });
        poly.on('mouseout', () => setHoveredBuilding(null));

        poly.addTo(buildingLayerRef.current!);
      });
    });
  }, [buildingsByParcel, level, activeColony, areas]);

  const parcels = activeColony ? areas[activeColony.id]?.parcels ?? [] : [];
  const buildingCount = activeColony?.buildingCount ?? 0;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#1a1d22]">
      {/* Leaflet map container */}
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* Top bar */}
      <motion.header
        className="absolute top-0 left-0 right-0 px-5 md:px-8 py-4 flex items-center justify-between pointer-events-none z-[1000]"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="w-8 h-8 rounded bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex flex-col">
            <div className="text-[11px] font-mono-nums uppercase tracking-[0.3em] text-slate-300">
              3D ULPIN · Vertical Property Mapping
            </div>
            <div className="text-sm font-medium text-white">
              {level === 'overview' ? 'Bengaluru Pilot AOI — 24 Areas' : activeColony?.name}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          {level === 'detail' && (
            <button
              onClick={goBack}
              className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-mono-nums uppercase tracking-wider text-[#0F172A] hover:border-[#6366F1] hover:text-[#4F46E5] transition-all shadow-xs focus-ring"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Overview</span>
            </button>
          )}

          <div className="hidden md:flex items-center gap-3 text-xs font-mono-nums uppercase tracking-wider text-[#6B7280]">
            {level === 'overview' && <span>{colonies.length} areas</span>}
            {level === 'detail' && (
              <>
                <span>{parcels.length} parcels</span>
                <span className="text-[#D1D5DB]">|</span>
                <span>{buildingCount.toLocaleString()} buildings</span>
              </>
            )}
          </div>
        </div>
      </motion.header>

      {/* Left info panel */}
      <motion.aside
        className="absolute left-5 md:left-8 top-20 w-[240px] pointer-events-auto z-[1000]"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-card">
          {level === 'overview' && (
            <>
              <div className="text-[11px] font-semibold font-mono-nums uppercase tracking-[0.06em] text-[#4F46E5] mb-1">
                Area of Interest
              </div>
              <div className="text-lg font-semibold text-[#0F172A] mb-3">Bengaluru Pilot</div>
              <div className="space-y-2 text-xs">
                <StatRow label="Areas" value={String(colonies.length)} />
                <StatRow label="Total Parcels" value="1,284" />
                <StatRow label="Total Buildings" value="25,682" />
                <StatRow label="AOI Size" value="6.66 km²" />
              </div>
              <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-2">How to use</div>
                <div className="text-xs text-[#6B7280] leading-relaxed">
                  Click an <span className="text-[#4F46E5] font-medium">area</span> → see parcels + buildings
                  (colored by height). Click a building → open 3D viewer.
                </div>
              </div>
            </>
          )}

          {level === 'detail' && activeColony && (
            <>
              <div className="text-[11px] font-semibold font-mono-nums uppercase tracking-[0.06em] text-[#4F46E5] mb-1">
                Area Detail
              </div>
              <div className="text-lg font-semibold text-[#0F172A] mb-3">{activeColony.name}</div>
              <div className="space-y-2 text-xs">
                <StatRow label="Parcels" value={String(parcels.length)} />
                <StatRow label="Buildings" value={buildingCount.toLocaleString()} />
                <StatRow label="Center" value={`${activeColony.center[0].toFixed(4)}°E, ${activeColony.center[1].toFixed(4)}°N`} />
              </div>

              {/* Height legend */}
              <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-2">Height (m)</div>
                <div className="flex items-center gap-1 text-xs font-mono-nums text-[#6B7280]">
                  <div className="flex-1 h-2.5 rounded-full" style={{ background: 'linear-gradient(to right, #E0E7FF, #A5B4FC, #818CF8, #4F46E5, #312E81)' }} />
                </div>
                <div className="flex justify-between text-xs font-mono-nums text-[#6B7280] mt-1">
                  <span>0m</span><span>10m</span><span>20m</span><span>40+m</span>
                </div>
              </div>
            </>
          )}

          {/* Zoom controls */}
          <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center gap-2">
            <button
              onClick={() => map.current?.zoomIn()}
              className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white flex items-center justify-center text-[#6B7280] hover:border-[#6366F1] hover:text-[#4F46E5] transition focus-ring"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => map.current?.zoomOut()}
              className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white flex items-center justify-center text-[#6B7280] hover:border-[#6366F1] hover:text-[#4F46E5] transition focus-ring"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredBuilding && (
          <motion.div
            className="absolute pointer-events-none z-[1100]"
            style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
          >
            <div className="rounded-xl border border-[#C7D2FE] bg-white px-3 py-2 shadow-panel">
              <div className="text-xs font-mono-nums text-[#6B7280] mb-0.5">
                {hoveredBuilding.f} floors · {hoveredBuilding.h.toFixed(1)} m
              </div>
              <div className="text-sm font-semibold text-[#0F172A]">
                {hoveredBuilding.n || `Building #${hoveredBuilding.id}`}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <motion.footer
        className="absolute bottom-0 left-0 right-0 px-5 md:px-8 py-3 flex items-center justify-between pointer-events-none z-[1000]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex items-center gap-3 text-xs font-mono-nums text-[#374151] bg-white/95 border border-[#E5E7EB] px-3 py-1.5 rounded-xl shadow-card pointer-events-auto">
          {level === 'overview' && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4F46E5]" />
              <span>24 areas · click to explore</span>
            </div>
          )}
          {level === 'detail' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#9CA3AF]" />
                <span>Parcels</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#4F46E5]" />
                <span>Buildings · click for 3D</span>
              </div>
            </>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs font-mono-nums text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-3 py-1.5 rounded-xl pointer-events-auto">
          <span>Prototype · LoD1 estimated model · Not official ULPINs</span>
        </div>
      </motion.footer>

      {loadingBuildings && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1200]">
          <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-6 py-4 text-xs font-mono-nums uppercase tracking-[0.25em] text-slate-200">
            Loading 25,000 buildings…
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between font-mono-nums">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  );
}
