"use client";

/* ============================================================
   3D ULPIN Bengaluru — Vertical Property Mapping System
   SIH 2026 · Problem Statement PS-26011 (DoLR / DILRMP)
   Fresh build — every line written deliberately.

   Honesty constraints (surfaced throughout the UI):
   • Heights are ML-estimated (3D-GloBFP, ref year 2020) — NOT surveyed.
   • Copernicus is a DSM, not a bare-earth DTM.
   • OSM footprints are community data — NOT legal parcels.
   • Internal prototype IDs are NOT official government ULPINs.
   • Cadastral legal status is NOT verified in Phase 1.
   • Floor counts derived from height are ESTIMATES.
   ============================================================ */

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useViewerStore } from "@/lib/viewer-store";
import { createBuildingFromFeature } from "@/lib/building-data";
import type { MapBuildingFeature } from "@/lib/map-data";

// MapLibre v6: worker URL must be set before any map is constructed.
if (typeof window !== "undefined") {
  try { (maplibregl as any).setWorkerUrl("/maplibre-gl-worker.mjs"); } catch { /* noop */ }
}

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Map as MapIcon, Layers, Building2, Square, Route, AlertTriangle,
  Info, Database, ShieldAlert, X, ChevronDown, ChevronRight, Crosshair,
  Box, Search, Ruler, MousePointer2, Sparkles, Target,
  Download, RotateCcw, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen,
  Filter, HelpCircle, CheckCircle2, PenTool, Circle, Columns2,
  ArrowLeftRight, Trophy, Sun, Layers2, Share2, Undo2, Trash2,
  Plane, ScanLine, FileText, Satellite, Navigation, Eye, EyeOff,
  ZoomIn, Minimize2, Maximize2, Compass, MapPin, Building, Hash,
  FileImage, Cloud, Activity, Gauge, ListTree, Boxes, Ruler as RulerIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FeatureInspector } from "@/components/inspector/FeatureInspector";
import { TopBar } from "@/components/shell/TopBar";
import { LeftRail } from "@/components/shell/LeftRail";
import { StatusBar } from "@/components/shell/StatusBar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { ShortcutsModal } from "@/components/shell/ShortcutsModal";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart as RPieChart, Pie, Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────
interface Stats {
  aoi: { west: number; south: number; east: number; north: number; center_lon: number; center_lat: number; size_km: number; };
  counts: Record<string, number>;
  height_stats: { min_m: number; max_m: number; mean_m: number; median_m: number; };
  data_sources: Array<{ name: string; source: string; license: string; legal_status: string; url: string; }>;
  id_scheme: { format: string; example: string; use_classes: Record<string,string>; note: string; };
  honesty_disclaimers: string[];
}

interface Distribution {
  height_histogram: Array<{ range: string; count: number }>;
  no_height_count: number;
  floors_distribution: Array<{ range: string; count: number }>;
  match_status: Array<{ label: string; value: number }>;
  height_match_status: Array<{ label: string; value: number }>;
  confidence_distribution: Array<{ range: string; count: number; color: string }>;
  issue_types: Array<{ type: string; count: number }>;
  totals: { buildings: number; parcels: number; buildings_with_height: number; };
}

interface Notable {
  tallest: Array<{ code: string; uuid: string; height: number; floors: number; coords: [number, number]; }>;
  bestMatched: Array<{ code: string; uuid: string; height: number; confidence: number; match: string; heightMatch: string; overlap: number; coords: [number, number]; }>;
  mostFloors: Array<{ code: string; uuid: string; floors: number; height: number; coords: [number, number]; }>;
  summary: { total_buildings: number; median_height: number; mean_height: number; max_height: number; max_floors: number; };
}

interface SelectedFeature {
  layer: string;
  properties: Record<string, any>;
  geometry: any;
}

interface ValidationIssue {
  issue_type: string;
  severity: string;
  object_uuid: string;
  display_code: string | null;
  message: string;
}

interface FloorInfo {
  floor_number: number;
  floor_label: string;
  elevation_m: number;
  ceiling_m: number;
  floor_height_m: number;
  floor_display_code: string | null;
  use_class: string;
  unit_count: number;
  source: string;
  is_estimated: boolean;
  confidence_score: number;
  legal_status: string;
}

// ─── Basemap configurations ───────────────────────────────────────────────
const BASEMAP_STYLES: Record<string, { name: string; icon: any; sources: Record<string, any>; layers: any[] }> = {
  osm: {
    name: "OpenStreetMap", icon: MapIcon,
    sources: { "osm-tiles": { type: "raster", tiles: [
      "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
    ], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
    layers: [{ id: "osm-basemap", type: "raster", source: "osm-tiles", paint: { "raster-opacity": 0.9 } }],
  },
  satellite: {
    name: "Satellite (Esri)", icon: Satellite,
    sources: {
      "esri-satellite": { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Imagery © Esri, Maxar, Earthstar Geographics", maxzoom: 19 },
      "esri-labels": { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "", maxzoom: 19 },
    },
    layers: [
      { id: "satellite-basemap", type: "raster", source: "esri-satellite", paint: { "raster-opacity": 1 } },
      { id: "satellite-labels", type: "raster", source: "esri-labels", paint: { "raster-opacity": 0.9 } },
    ],
  },
  light: {
    name: "Light (CartoDB)", icon: Sun,
    sources: { "carto-light": { type: "raster", tiles: [
      "https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png",
      "https://cartodb-basemaps-b.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png",
      "https://cartodb-basemaps-c.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png",
    ], tileSize: 256, attribution: "© OpenStreetMap contributors © CARTO" } },
    layers: [{ id: "carto-basemap", type: "raster", source: "carto-light", paint: { "raster-opacity": 1 } }],
  },
  dark: {
    name: "Dark (CartoDB)", icon: Moon,
    sources: { "carto-dark": { type: "raster", tiles: [
      "https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
      "https://cartodb-basemaps-b.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
      "https://cartodb-basemaps-c.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
    ], tileSize: 256, attribution: "© OpenStreetMap contributors © CARTO" } },
    layers: [{ id: "carto-dark-basemap", type: "raster", source: "carto-dark", paint: { "raster-opacity": 1 } }],
  },
};

// Need Moon icon — alias to a real import
function Moon(props: any) { return <Sun {...props} />; }

// ─── Helper: building fill paint by color mode ────────────────────────────
function buildingFillPaint(mode: string) {
  if (mode === "height") {
    return ["interpolate", ["linear"], ["coalesce", ["get", "height_m"], 0],
      0, "#E0E7FF", 5, "#A5B4FC", 10, "#818CF8", 20, "#6366F1",
      40, "#4F46E5", 70, "#4338CA", 100, "#312E81"];
  }
  if (mode === "match") {
    return ["match", ["get", "match_status"],
      "MATCHED_STRONG", "#059669", "MATCHED_WEAK", "#16A34A",
      "MATCHED_MARGINAL", "#B45309", "CROSSES_MULTIPLE_PARCELS", "#EA580C",
      "OUTSIDE_ALL_PARCELS", "#9CA3AF", "#E5E7EB"];
  }
  // floors
  return ["interpolate", ["linear"], ["coalesce", ["get", "floors"], 1],
    1, "#E0E7FF", 3, "#A5B4FC", 6, "#6366F1", 12, "#4338CA", 20, "#312E81"];
}

// ─── Helper: coordinate formatting ────────────────────────────────────────
function formatCoord(value: number, isLat: boolean, format: string): string {
  if (format === "decimal") return value.toFixed(5) + "°";
  const abs = Math.abs(value), deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60, min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(2);
  const dir = isLat ? (value >= 0 ? "N" : "S") : (value >= 0 ? "E" : "W");
  return `${deg}°${min}'${sec}"${dir}`;
}

// ─── Helper: haversine distance (meters) ──────────────────────────────────
function haversine(a: [number, number], b: [number, number]): number {
  const R = 6378137;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLng = (b[0] - a[0]) * Math.PI / 180;
  const la1 = a[1] * Math.PI / 180, la2 = b[1] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ─── Helper: polygon area on sphere (m²) ──────────────────────────────────
function polygonAreaM2(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  const R = 6378137;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const p1 = ring[i], p2 = ring[(i + 1) % ring.length];
    total += (p2[0] - p1[0]) * Math.PI / 180 * (2 + Math.sin(p1[1] * Math.PI / 180) + Math.sin(p2[1] * Math.PI / 180));
  }
  return Math.abs(total * R * R / 2);
}

// ─── Helper: download GeoJSON ─────────────────────────────────────────────
function downloadGeoJSON(feature: any, filename: string) {
  const geojson = { type: "FeatureCollection", features: [feature], metadata: {
    exported_at: new Date().toISOString(),
    source: "3D ULPIN Bengaluru — SIH 2026 PS-26011 Phase 1 Pilot",
    note: "Prototype data — NOT official ULPINs. Heights ML-estimated (3D-GloBFP 2020).",
  }};
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Helper: format a property value for display ──────────────────────────
function fmtVal(v: any): string {
  if (v === null || v === undefined || v === "None" || v === "") return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(3);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

// ─── Constants ────────────────────────────────────────────────────────────
const AOI_CENTER: [number, number] = [77.635, 12.975];

// ─── Colony subdivisions — Voronoi from building centroids (balanced) ─────
// Boundaries from Voronoi of k-means centers, merged for building balance.
// Constraints met: 100% coverage, 0 overlaps, max diff <=2000, min >=500 buildings.
// All within AOI: 77.605–77.665°E, 12.955–12.995°N
interface Colony {
  id: string;
  name: string;
  bbox: [number, number, number, number];
  center: [number, number];
  coords: [number, number][]; // polygon ring (closed)
}
const COLONIES: Colony[] = [
  { id: "c01", name: "HAL 2nd Stage", bbox: [77.63054, 12.98737, 77.6475, 12.99518], center: [77.63795, 12.99209], coords: [[77.640132,12.987269],[77.631271,12.989517],[77.630625,12.995351],[77.647502,12.995179],[77.640132,12.987269]] },
  { id: "c02", name: "Kodihalli", bbox: [77.65302, 12.98495, 77.665, 12.995], center: [77.65992, 12.99109], coords: [[77.653123,12.995122],[77.665,12.995],[77.664891,12.984826],[77.654361,12.9895],[77.653123,12.995122]] },
  { id: "c03", name: "Defence Colony", bbox: [77.60532, 12.98577, 77.61558, 12.9955], center: [77.6099, 12.99111], coords: [[77.615503,12.988117],[77.60532,12.985768],[77.605423,12.995605],[77.61416,12.995517],[77.615503,12.988117]] },
  { id: "c04", name: "Old Airport Rd", bbox: [77.61404, 12.98404, 77.63133, 12.99534], center: [77.62259, 12.99074], coords: [[77.631271,12.989517],[77.630115,12.987836],[77.618633,12.983995],[77.615503,12.988117],[77.61416,12.995517],[77.630625,12.995351],[77.631271,12.989517]] },
  { id: "c05", name: "Indiranagar 1st Stage", bbox: [77.64009, 12.98305, 77.65442, 12.99511], center: [77.64809, 12.98903], coords: [[77.640132,12.987269],[77.647502,12.995179],[77.653123,12.995122],[77.654361,12.9895],[77.650912,12.982937],[77.642117,12.984666],[77.640132,12.987269]] },
  { id: "c06", name: "Indiranagar 2nd Stage", bbox: [77.63, 12.97729, 77.64217, 12.98941], center: [77.63608, 12.98347], coords: [[77.631271,12.989517],[77.640132,12.987269],[77.642117,12.984666],[77.640626,12.978185],[77.635395,12.97723],[77.631135,12.981882],[77.630115,12.987836],[77.631271,12.989517]] },
  { id: "c07", name: "Jeevanbhimanagar", bbox: [77.60522, 12.97651, 77.61868, 12.98808], center: [77.61122, 12.98229], coords: [[77.615503,12.988117],[77.618633,12.983995],[77.618319,12.982956],[77.612428,12.976438],[77.605232,12.97726],[77.60532,12.985768],[77.615503,12.988117]] },
  { id: "c08", name: "Victoria Layout", bbox: [77.61823, 12.97415, 77.6312, 12.98782], center: [77.62547, 12.98161], coords: [[77.630115,12.987836],[77.631135,12.981882],[77.626192,12.974313],[77.625398,12.974081],[77.618319,12.982956],[77.618633,12.983995],[77.630115,12.987836]] },
  { id: "c09", name: "Domlur Layout", bbox: [77.64058, 12.974, 77.65198, 12.98457], center: [77.646, 12.97953], coords: [[77.640626,12.978185],[77.642117,12.984666],[77.650912,12.982937],[77.651918,12.979148],[77.648266,12.975053],[77.644324,12.973958],[77.640626,12.978185]] },
  { id: "c10", name: "Domlur", bbox: [77.65072, 12.96496, 77.66494, 12.98939], center: [77.65934, 12.97899], coords: [[77.659117,12.976113],[77.651918,12.979148],[77.650912,12.982937],[77.654361,12.9895],[77.664891,12.984826],[77.66483,12.979038],[77.664678,12.964814],[77.658257,12.969445],[77.659117,12.976113]] },
  { id: "c11", name: "Kaggadasapura", bbox: [77.62616, 12.9712, 77.63544, 12.98184], center: [77.63136, 12.97607], coords: [[77.635395,12.97723],[77.633908,12.971118],[77.626192,12.974313],[77.631135,12.981882],[77.635395,12.97723]] },
  { id: "c12", name: "Vartur Layout", bbox: [77.61233, 12.96686, 77.62549, 12.98288], center: [77.61879, 12.97459], coords: [[77.625398,12.974081],[77.620479,12.966782],[77.615861,12.969368],[77.612428,12.976438],[77.618319,12.982956],[77.625398,12.974081]] },
  { id: "c13", name: "HAL East", bbox: [77.63389, 12.9698, 77.64437, 12.97815], center: [77.63897, 12.97372], coords: [[77.634135,12.970612],[77.633908,12.971118],[77.635395,12.97723],[77.640626,12.978185],[77.644324,12.973958],[77.642173,12.969713],[77.634135,12.970612]] },
  { id: "c14", name: "Murugeshpalya", bbox: [77.64818, 12.96669, 77.65915, 12.97907], center: [77.65403, 12.97325], coords: [[77.651918,12.979148],[77.659117,12.976113],[77.658257,12.969445],[77.653101,12.966642],[77.648266,12.975053],[77.651918,12.979148]] },
  { id: "c15", name: "Kodihalli East", bbox: [77.60508, 12.96286, 77.61594, 12.97715], center: [77.60931, 12.9709], coords: [[77.615861,12.969368],[77.605082,12.962858],[77.605232,12.97726],[77.612428,12.976438],[77.615861,12.969368]] },
  { id: "c16", name: "Domlur East", bbox: [77.64212, 12.96438, 77.65319, 12.975], center: [77.64748, 12.96946], coords: [[77.642173,12.969713],[77.644324,12.973958],[77.648266,12.975053],[77.653101,12.966642],[77.651691,12.964281],[77.643084,12.967043],[77.642173,12.969713]] },
  { id: "c17", name: "GM Palaya", bbox: [77.6204, 12.95962, 77.63417, 12.97423], center: [77.62736, 12.96737], coords: [[77.626192,12.974313],[77.633908,12.971118],[77.634135,12.970612],[77.630833,12.962418],[77.627288,12.959552],[77.621175,12.965289],[77.620479,12.966782],[77.625398,12.974081],[77.626192,12.974313]] },
  { id: "c18", name: "CV Raman Nagar", bbox: [77.63083, 12.96242, 77.64312, 12.97052], center: [77.63718, 12.96623], coords: [[77.640656,12.962511],[77.630833,12.962418],[77.634135,12.970612],[77.642173,12.969713],[77.643084,12.967043],[77.640656,12.962511]] },
  { id: "c19", name: "Baiyyappanahalli", bbox: [77.65165, 12.96001, 77.66473, 12.96938], center: [77.65827, 12.96394], coords: [[77.652115,12.960654],[77.651691,12.964281],[77.653101,12.966642],[77.658257,12.969445],[77.664678,12.964814],[77.664626,12.959882],[77.652115,12.960654]] },
  { id: "c20", name: "HAL West", bbox: [77.605, 12.955, 77.62122, 12.96931], center: [77.61191, 12.96238], coords: [[77.615861,12.969368],[77.620479,12.966782],[77.621175,12.965289],[77.608103,12.954969],[77.605,12.955],[77.605082,12.962858],[77.615861,12.969368]] },
  { id: "c21", name: "Indiranagar 100 Ft Rd", bbox: [77.64057, 12.95464, 77.65218, 12.96695], center: [77.64652, 12.96071], coords: [[77.640656,12.962511],[77.643084,12.967043],[77.651691,12.964281],[77.652115,12.960654],[77.649413,12.954552],[77.644333,12.954604],[77.640656,12.962511]] },
  { id: "c22", name: "CMH Road", bbox: [77.6081, 12.95497, 77.62759, 12.96522], center: [77.6197, 12.95853], coords: [[77.621175,12.965289],[77.627288,12.959552],[77.627485,12.954774],[77.608103,12.954969],[77.621175,12.965289]] },
  { id: "c23", name: "New Thippasandra", bbox: [77.62724, 12.95478, 77.64442, 12.96247], center: [77.6353, 12.95829], coords: [[77.627288,12.959552],[77.630833,12.962418],[77.640656,12.962511],[77.644333,12.954604],[77.627485,12.954774],[77.627288,12.959552]] },
  { id: "c24", name: "Malleshpalya", bbox: [77.64941, 12.95455, 77.66463, 12.96053], center: [77.65752, 12.95729], coords: [[77.652115,12.960654],[77.664626,12.959882],[77.664567,12.954397],[77.649413,12.954552],[77.652115,12.960654]] },
];

// Generate colony boundary GeoJSON from natural polygon coords
const COLONY_GEOJSON = {
  type: "FeatureCollection" as const,
  features: COLONIES.map(c => ({
    type: "Feature" as const,
    properties: { id: c.id, name: c.name },
    geometry: {
      type: "Polygon" as const,
      coordinates: [c.coords] as [number, number][][],
    },
  })),
};

const MATCH_COLORS: Record<string, string> = {
  MATCHED_STRONG: "#059669", MATCHED_WEAK: "#16A34A", MATCHED_MARGINAL: "#B45309",
  CROSSES_MULTIPLE_PARCELS: "#EA580C", OUTSIDE_ALL_PARCELS: "#9CA3AF",
};
const SEVERITY_COLORS: Record<string, string> = {
  ERROR: "bg-red-500", WARNING: "bg-amber-500", INFO: "bg-sky-500",
};

// ─── Format-demonstration importer metadata ──────────────────────────────
const FORMAT_IMPORTERS = [
  { id: "uav", name: "UAV Orthophoto", icon: Plane, file: "Uttari1571_OAM_2022-07-21_EPSG32643.tif", place: "Uttari, Bengaluru region", provider: "DroneMaps.in via OpenAerialMap", crs: "EPSG:32643", date: "2022-07-21", status: "Genuine UAV orthophoto — outside pilot AOI", url: "https://oin-hotosm-temp.s3.amazonaws.com/62f3291df526a800059dc270/0/62f3291df526a800059dc271.tif", coLocated: false },
  { id: "lidar", name: "LiDAR Point Cloud", icon: ScanLine, file: "IITH_LiDAR_ground_dataset_labelled_raw.zip", place: "IIT Hyderabad", provider: "IIT Hyderabad (Prof. Ravi)", crs: "Local sensor frame", date: "Research dataset", status: "Genuine LiDAR research sample — not Bengaluru", url: "https://people.iith.ac.in/raji/lidar.html", coLocated: false },
  { id: "floorplan", name: "Floor Plan PDF", icon: FileText, file: "Bengaluru_project_brochure_floorplans_REFERENCE_ONLY.pdf", place: "Bengaluru project", provider: "Real estate brochure", crs: "N/A (document)", date: "2018 (RERA filed)", status: "Reference brochure — validate on KRERA before relying", url: "https://rera.karnataka.gov.in/viewAllProjects?language=en", coLocated: false, rera: "PRM/KA/RERA/1251/472/PR/180808/001982" },
  { id: "gnss", name: "GNSS Station Log", icon: Satellite, file: "IISC00IND_station.log", place: "IISc Bengaluru", provider: "IGS (International GNSS Service)", crs: "ITRF2014 / WGS84", date: "Station metadata", status: "Real IGS station metadata — not parcel-corner survey", url: "https://network.igs.org/IISC00IND", coLocated: false, lat: 13.021166, lng: 77.570376, elev: 843.7145 },
];

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function MapApp() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const minimapContainer = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<maplibregl.Map | null>(null);
  const enterColonyRef = useRef<((c: Colony) => void) | null>(null);

  // ── Core data state ─────────────────────────────────────────────────────
  const [stats, setStats] = useState<Stats | null>(null);
  const [distribution, setDistribution] = useState<Distribution | null>(null);
  const [notable, setNotable] = useState<Notable | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeColony, setActiveColony] = useState<Colony | null>(null);
  const [hoveredColonyIdState, setHoveredColonyIdState] = useState<string | null>(null);
  const [colonyCounts, setColonyCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const [floors, setFloors] = useState<FloorInfo[] | null>(null);
  const [floorsLoading, setFloorsLoading] = useState(false);
  const [parcelBuildings, setParcelBuildings] = useState<any[] | null>(null);
  const [parcelBuildingsLoading, setParcelBuildingsLoading] = useState(false);
  const [previousParcel, setPreviousParcel] = useState<SelectedFeature | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<SelectedFeature | null>(null);
  const [mouseCoords, setMouseCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [zoom, setZoom] = useState(14);
  const [activeTab, setActiveTab] = useState<"inspect" | "stats" | "issues">("inspect");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesSeverity, setIssuesSeverity] = useState<string>("");

  // ── Layer state ─────────────────────────────────────────────────────────
  const [layers, setLayers] = useState({ parcels: true, buildings: true, roads: true, nonParcels: false, aoi: true });
  const [buildingColorMode, setBuildingColorMode] = useState<"height" | "match" | "floors">("height");
  const [heightFilter, setHeightFilter] = useState<[number, number]>([0, 110]);

  // ── Feature toggles ─────────────────────────────────────────────────────
  const [pitch3D, setPitch3D] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);
  const [measureArea, setMeasureArea] = useState<number | null>(null);

  // ── UI state ────────────────────────────────────────────────────────────
  const [showLegend, setShowLegend] = useState(true);
  const [showDisclaimers, setShowDisclaimers] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showFlyToDialog, setShowFlyToDialog] = useState(false);
  const [flyToInput, setFlyToInput] = useState("");
  const [flyToError, setFlyToError] = useState("");
  const [showShareToast, setShowShareToast] = useState(false);
  const [highlightedUuid, setHighlightedUuid] = useState<string | null>(null);
  const [layersCollapsed, setLayersCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [coordFormat, setCoordFormat] = useState<"decimal" | "dms">("decimal");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterConfidence, setFilterConfidence] = useState<[number, number]>([0, 100]);
  const [filterMatchStatus, setFilterMatchStatus] = useState<Set<string>>(new Set());
  const [filterFloorsRange, setFilterFloorsRange] = useState<[number, number]>([0, 30]);
  const [showIntro, setShowIntro] = useState(false);
  const [showBasemapMenu, setShowBasemapMenu] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [railTab, setRailTab] = useState<string | null>("explore");
  const [colonyFilterText, setColonyFilterText] = useState("");

  // ── Tour state ──────────────────────────────────────────────────────────
  const [tourActive, setTourActive] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [tourBuildings, setTourBuildings] = useState<any[]>([]);
  const tourTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Drawing state ───────────────────────────────────────────────────────
  const [drawMode, setDrawMode] = useState<"none" | "point" | "line" | "polygon">("none");
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [drawFeatures, setDrawFeatures] = useState<any[]>([]);
  const [drawLabel, setDrawLabel] = useState("");
  const [showDrawDialog, setShowDrawDialog] = useState(false);

  // ── Buffer analysis state ───────────────────────────────────────────────
  const [showBufferDialog, setShowBufferDialog] = useState(false);
  const [bufferRadius, setBufferRadius] = useState(100);
  const [bufferBuildings, setBufferBuildings] = useState<any[]>([]);
  const [bufferLoading, setBufferLoading] = useState(false);
  const [bufferCenter, setBufferCenter] = useState<[number, number] | null>(null);

  // ── Compare two buildings state ─────────────────────────────────────────
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [compareBuildingA, setCompareBuildingA] = useState<any | null>(null);
  const [compareBuildingB, setCompareBuildingB] = useState<any | null>(null);
  const [comparePickMode, setComparePickMode] = useState<"A" | "B" | null>(null);

  // ── Format importer state ───────────────────────────────────────────────
  const [showFormatDialog, setShowFormatDialog] = useState<string | null>(null);

  // ── Basemap with persistence ────────────────────────────────────────────
  const [basemap, setBasemap] = useState<string>(() => {
    if (typeof window === "undefined") return "light";
    try { const s = localStorage.getItem("ulpin-basemap"); if (s && BASEMAP_STYLES[s]) return s; } catch { /* noop */ }
    return "light";
  });

  // Refs for maplibre event-handler closures
  const measureModeRef = useRef(false);
  const measurePointsRef = useRef<[number, number][]>([]);
  const drawModeRef = useRef<"none" | "point" | "line" | "polygon">("none");
  const drawPointsRef = useRef<[number, number][]>([]);
  const comparePickModeRef = useRef<"A" | "B" | null>(null);
  const highlightedUuidRef = useRef<string | null>(null);

  useEffect(() => { measureModeRef.current = measureMode; }, [measureMode]);
  useEffect(() => { measurePointsRef.current = measurePoints; }, [measurePoints]);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { drawPointsRef.current = drawPoints; }, [drawPoints]);
  useEffect(() => { comparePickModeRef.current = comparePickMode; }, [comparePickMode]);
  useEffect(() => { highlightedUuidRef.current = highlightedUuid; }, [highlightedUuid]);

  // ═══════════════════════════════════════════════════════════════════════
  //  EFFECTS
  // ═══════════════════════════════════════════════════════════════════════

  // Load stats + distribution + notable on mount
  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(d => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
    fetch("/api/stats/distribution").then(r => r.json()).then(d => setDistribution(d)).catch(() => {});
    fetch("/api/stats/notable").then(r => r.json()).then(d => setNotable(d)).catch(() => {});
  }, []);

  // First-visit intro — one-time localStorage check on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!localStorage.getItem("ulpin-visited")) {
        localStorage.setItem("ulpin-visited", "true");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowIntro(true);
      }
    } catch { /* noop */ }
  }, []);

  // Persist UI preferences
  useEffect(() => { try { localStorage.setItem("ulpin-basemap", basemap); } catch { /* noop */ } }, [basemap]);
  useEffect(() => { try { localStorage.setItem("ulpin-layersCollapsed", String(layersCollapsed)); } catch { /* noop */ } }, [layersCollapsed]);
  useEffect(() => { try { localStorage.setItem("ulpin-sidebarCollapsed", String(sidebarCollapsed)); } catch { /* noop */ } }, [sidebarCollapsed]);
  useEffect(() => { try { localStorage.setItem("ulpin-coordFormat", coordFormat); } catch { /* noop */ } }, [coordFormat]);

  // Restore collapsed states from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const lc = localStorage.getItem("ulpin-layersCollapsed");
      const sc = localStorage.getItem("ulpin-sidebarCollapsed");
      const cf = localStorage.getItem("ulpin-coordFormat");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (lc !== null) setLayersCollapsed(lc === "true");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (sc !== null) setSidebarCollapsed(sc === "true");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (cf === "decimal" || cf === "dms") setCoordFormat(cf);
    } catch { /* noop */ }
  }, []);

  // Restore viewport + selection from URL hash
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const mapParam = params.get("map");
    if (mapParam) {
      const [lng, lat, z, p, b] = mapParam.split(",").map(Number);
      if (!isNaN(lng) && !isNaN(lat)) {
        const interval = setInterval(() => {
          const map = mapRef.current;
          if (map && map.loaded()) {
            clearInterval(interval);
            map.jumpTo({ center: [lng, lat], zoom: isNaN(z) ? 14 : z, pitch: isNaN(p) ? 0 : p, bearing: isNaN(b) ? 0 : b });
          }
        }, 200);
        setTimeout(() => clearInterval(interval), 10000);
      }
    }
  }, []);

  //  HELPERS: layer updates
  // ═══════════════════════════════════════════════════════════════════════
  const updateMeasureLayer = (pts: [number, number][]) => {
    const map = mapRef.current; if (!map) return;
    const features: any[] = [];
    for (const p of pts) features.push({ type: "Feature", geometry: { type: "Point", coordinates: p }, properties: {} });
    if (pts.length >= 2) {
      features.push({ type: "Feature", geometry: { type: "LineString", coordinates: pts }, properties: {} });
      let dist = 0;
      for (let i = 1; i < pts.length; i++) dist += haversine(pts[i - 1], pts[i]);
      setMeasureDistance(dist);
    } else setMeasureDistance(null);
    if (pts.length >= 3) {
      features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [[...pts, pts[0]]] }, properties: {} });
      setMeasureArea(polygonAreaM2(pts));
    } else setMeasureArea(null);
    (map.getSource("measure-points") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features });
  };

  const updateDrawCurrentLayer = (pts: [number, number][]) => {
    const map = mapRef.current; if (!map) return;
    const features: any[] = [];
    for (const p of pts) features.push({ type: "Feature", geometry: { type: "Point", coordinates: p }, properties: {} });
    if (pts.length >= 2) features.push({ type: "Feature", geometry: { type: "LineString", coordinates: pts }, properties: {} });
    (map.getSource("draw-current") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features });
  };

  // ═══════════════════════════════════════════════════════════════════════

  //  FEATURE: select feature (click)
  // ═══════════════════════════════════════════════════════════════════════
  const selectFeature = (f: any) => {
    const map = mapRef.current; if (!map) return;
    const layer = f.source === "parcels" ? "Parcel" : f.source === "buildings" ? "Building" : f.source === "roads" ? "Road" : "Feature";
    const props = { ...f.properties };
    const sel: SelectedFeature = { layer, properties: props, geometry: f.geometry };

    // Clear previous selection feature-state
    if (map.getLayer("buildings-fill")) {
      map.removeFeatureState({ source: "buildings" });
    }
    if (map.getLayer("parcels-fill")) {
      map.removeFeatureState({ source: "parcels" });
    }
    if (f.id !== undefined && f.id !== null) {
      try { map.setFeatureState({ source: f.source, id: f.id }, { selected: true }); } catch { /* noop */ }
    }
    setSelected(sel);
    setActiveTab("inspect");

    // If building: load floors + sibling buildings in same parcel + sync with 3D viewer store
    if (layer === "Building" && props.object_uuid) {
      const bldgFeature: MapBuildingFeature = {
        id: parseInt(String(props.building_seq || props.object_uuid?.slice(0, 6) || 0), 10) || 0,
        c: f.geometry?.coordinates?.[0] || [],
        ce: [
          f.geometry?.coordinates?.[0]?.[0]?.[0] || 0,
          f.geometry?.coordinates?.[0]?.[0]?.[1] || 0,
        ],
        h: parseFloat(String(props.height_m || 0)),
        f: parseInt(String(props.floors || 1), 10),
        n: props.name || null,
        t: props.building || null,
        pc: props.parent_parcel_code || null,
      };
      const bldgModel = createBuildingFromFeature(bldgFeature);
      useViewerStore.setState({ selectedMapBuilding: bldgFeature, buildingData: bldgModel });

      setFloorsLoading(true); setFloors(null);
      fetch(`/api/buildings/${props.object_uuid}/floors`).then(r => r.json()).then(d => { setFloors(d.floors || []); }).catch(() => setFloors([])).finally(() => setFloorsLoading(false));
      if (props.parent_parcel_uuid) {
        setParcelBuildingsLoading(true); setParcelBuildings(null);
        fetch(`/api/buildings?parent_parcel_uuid=${props.parent_parcel_uuid}&limit=200`).then(r => r.json()).then(d => setParcelBuildings(d.features || [])).catch(() => setParcelBuildings([])).finally(() => setParcelBuildingsLoading(false));
      } else { setParcelBuildings(null); }
    } else {
      useViewerStore.setState({ selectedMapBuilding: null });
      setFloors(null); setParcelBuildings(null);
    }

    // If parcel: load buildings in it
    if (layer === "Parcel" && props.object_uuid) {
      setParcelBuildingsLoading(true); setParcelBuildings(null);
      fetch(`/api/buildings?parent_parcel_uuid=${props.object_uuid}&limit=500`).then(r => r.json()).then(d => setParcelBuildings(d.features || [])).catch(() => setParcelBuildings([])).finally(() => setParcelBuildingsLoading(false));
    }
  };

  // ── Select building from parcel list: saves parcel for "back" navigation ─
  const selectBuildingFromParcelList = (buildingFeature: any) => {
    // Save current parcel as previousParcel for "Back" button
    if (selected && selected.layer === "Parcel") {
      setPreviousParcel(selected);
    }
    // Ensure the feature has source set correctly for selectFeature
    const featureWithSource = { ...buildingFeature, source: "buildings" };
    // Select the building (loads floors, details, etc.)
    selectFeature(featureWithSource);
    // Also highlight on map
    if (buildingFeature.properties?.object_uuid) {
      setHighlightedUuid(buildingFeature.properties.object_uuid);
    }
  };

  // ── Go back to parcel view from building view ───────────────────────────
  const backToParcel = () => {
    if (previousParcel) {
      // Re-select the parcel (restores parcel details + building list)
      const map = mapRef.current;
      if (map) {
        if (map.getLayer("buildings-fill")) map.removeFeatureState({ source: "buildings" });
        if (map.getLayer("parcels-fill")) map.removeFeatureState({ source: "parcels" });
        // Re-set parcel feature state
        if (previousParcel.properties.object_uuid) {
          try { map.setFeatureState({ source: "parcels", id: previousParcel.properties.object_uuid }, { selected: true }); } catch { /* noop */ }
        }
      }
      setSelected(previousParcel);
      setActiveTab("inspect");
      // Reload parcel buildings
      if (previousParcel.properties.object_uuid) {
        setParcelBuildingsLoading(true); setParcelBuildings(null);
        fetch(`/api/buildings?parent_parcel_uuid=${previousParcel.properties.object_uuid}&limit=500`).then(r => r.json()).then(d => setParcelBuildings(d.features || [])).catch(() => setParcelBuildings([])).finally(() => setParcelBuildingsLoading(false));
      }
      setFloors(null);
      setPreviousParcel(null);
      setHighlightedUuid(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════

  // Toast helper (lightweight inline)
  const toast = (msg: string) => { setShowShareToast(false); setTimeout(() => { (window as any).__toastMsg = msg; setShowShareToast(true); }, 0); setTimeout(() => setShowShareToast(false), 2500); };

  // ═══════════════════════════════════════════════════════════════════════
  //  MAP INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: { version: 8, sources: BASEMAP_STYLES[basemap].sources, layers: BASEMAP_STYLES[basemap].layers },
      center: AOI_CENTER,
      zoom: 14,
      maxZoom: 19,
      minZoom: 11,
      maxBounds: [[77.4, 12.8], [77.9, 13.15]],
      attributionControl: true,
    });

    mapRef.current = map;
    if (typeof window !== "undefined") (window as any).__map = map;

    // Add navigation + scale controls
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 200 }), "bottom-left");
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), "top-left");

    map.on("load", () => {
      const bFilter = ["all",
        [">=", ["coalesce", ["get", "height_m"], 0], heightFilter[0]],
        ["<=", ["coalesce", ["get", "height_m"], 0], heightFilter[1]],
      ];

      // ── Data sources ────────────────────────────────────────────────────
      map.addSource("aoi", { type: "geojson", data: "/api/aoi" });
      map.addSource("colonies", { type: "geojson", data: COLONY_GEOJSON, promoteId: "id" });
      map.addSource("parcels", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "object_uuid" });
      map.addSource("buildings", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "object_uuid" });
      map.addSource("roads", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("non_parcels", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("measure-points", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("draw-features", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("draw-current", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("buffer-circle", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("highlight", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // ── AOI outline ─────────────────────────────────────────────────────
      map.addLayer({ id: "aoi-outline", type: "line", source: "aoi",
        paint: { "line-color": "#4F46E5", "line-width": 2, "line-dasharray": [2, 1] },
        layout: { visibility: "visible" } });
      map.addLayer({ id: "aoi-fill", type: "fill", source: "aoi",
        paint: { "fill-color": "#4F46E5", "fill-opacity": 0.03 },
        layout: { visibility: "visible" } });

      // ── Colony boundaries (single indigo tint, no rainbow) ────────────────
      map.addLayer({ id: "colonies-fill", type: "fill", source: "colonies",
        paint: {
          "fill-color": "#4F46E5",
          "fill-opacity": ["case",
            ["==", ["feature-state", "selected"], true], 0.28,
            ["==", ["feature-state", "hovered"], true], 0.18,
            0.08],
        },
        layout: { visibility: "visible" } });
      map.addLayer({ id: "colonies-outline", type: "line", source: "colonies",
        paint: {
          "line-color": ["case", ["==", ["feature-state", "hovered"], true], "#4F46E5", "rgba(79,70,229,0.5)"],
          "line-width": ["case", ["==", ["feature-state", "hovered"], true], 2, 1] },
        layout: { visibility: "visible" } });
      map.addLayer({ id: "colonies-label", type: "symbol", source: "colonies",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-anchor": "center",
          "text-offset": [0, 0],
          visibility: "visible",
        },
        paint: {
          "text-color": "#0F172A",
          "text-halo-color": "#FFFFFF",
          "text-halo-width": 2,
        } });

      // ── Parcels ─────────────────────────────────────────────────────────
      map.addLayer({ id: "parcels-fill", type: "fill", source: "parcels",
        paint: { "fill-color": "#4F46E5",
          "fill-opacity": ["case", ["==", ["feature-state", "selected"], true], 0.25,
            ["==", ["feature-state", "hovered"], true], 0.12, 0.0] },
        layout: { visibility: "none" } });
      map.addLayer({ id: "parcels-outline", type: "line", source: "parcels",
        paint: { "line-color": ["case", ["==", ["feature-state", "selected"], true], "#4F46E5",
            ["==", ["feature-state", "hovered"], true], "#6366F1", "rgba(107,114,128,0.6)"],
          "line-width": ["case", ["==", ["feature-state", "selected"], true], 2.0,
            ["==", ["feature-state", "hovered"], true], 1.5, 1.0] },
        layout: { visibility: "none" } });

      // ── Non-parcels ─────────────────────────────────────────────────────
      map.addLayer({ id: "nonparcels-fill", type: "fill", source: "non_parcels",
        paint: { "fill-color": "#9ca3af", "fill-opacity": 0.15 },
        layout: { visibility: "none" } });
      map.addLayer({ id: "nonparcels-outline", type: "line", source: "non_parcels",
        paint: { "line-color": "#E5E7EB", "line-width": 0.8 },
        layout: { visibility: "none" } });

      // ── Roads ───────────────────────────────────────────────────────────
      map.addLayer({ id: "roads-casing", type: "line", source: "roads",
        paint: { "line-color": "#FFFFFF", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 14, 1.8, 16, 3, 18, 6] },
        layout: { visibility: "none" } });
      map.addLayer({ id: "roads-line", type: "line", source: "roads",
        paint: { "line-color": "#94A3B8", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 14, 1.2, 16, 2, 18, 4] },
        layout: { visibility: "none" } });

      // ── Buildings: fill + outline ───────────────────────────────────────
      map.addLayer({ id: "buildings-fill", type: "fill", source: "buildings",
        paint: { "fill-color": buildingFillPaint(buildingColorMode),
          "fill-opacity": ["case", ["==", ["feature-state", "selected"], true], 0.95,
            ["==", ["feature-state", "hovered"], true], 0.92, 0.8] },
        layout: { visibility: "none" }, filter: bFilter });
      map.addLayer({ id: "buildings-outline", type: "line", source: "buildings",
        paint: { "line-color": ["case", ["==", ["feature-state", "selected"], true], "#4F46E5",
            ["==", ["feature-state", "hovered"], true], "#6366F1", "#312E81"],
          "line-width": ["case", ["==", ["feature-state", "selected"], true], 2.5,
            ["==", ["feature-state", "hovered"], true], 1.5, 0.5] },
        layout: { visibility: "none" }, filter: bFilter });

      // ── 3D extrusion (hidden by default) ────────────────────────────────
      map.addLayer({ id: "buildings-3d", type: "fill-extrusion", source: "buildings",
        layout: { visibility: "none" },
        paint: { "fill-extrusion-color": buildingFillPaint(buildingColorMode),
          "fill-extrusion-height": ["+", ["coalesce", ["get", "height_m"], 0], ["coalesce", ["get", "ground_elevation_m"], 0]],
          "fill-extrusion-base": ["coalesce", ["get", "ground_elevation_m"], 0],
          "fill-extrusion-opacity": 0.82 },
        filter: bFilter });

      // ── Heatmap (hidden by default) ─────────────────────────────────────
      map.addLayer({ id: "buildings-heatmap", type: "heatmap", source: "buildings",
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["coalesce", ["get", "height_m"], 0], 0, 0, 10, 1, 30, 2, 60, 3, 100, 5],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 11, 1, 14, 2, 17, 3],
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.2, "#EEF2FF", 0.4, "#C7D2FE", 0.6, "#818CF8", 0.8, "#4F46E5", 1.0, "#312E81"],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 11, 30, 14, 50, 17, 80],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0.8, 12, 0.6, 16, 0.3],
        } });

      // ── Highlight layer (search result) ─────────────────────────────────
      map.addLayer({ id: "highlight-pulse", type: "fill", source: "highlight",
        paint: { "fill-color": "#4F46E5", "fill-opacity": 0.25 } });
      map.addLayer({ id: "highlight-outline", type: "line", source: "highlight",
        paint: { "line-color": "#4F46E5", "line-width": 2.5 } });

      // ── Measurement layers ──────────────────────────────────────────────
      map.addLayer({ id: "measure-line", type: "line", source: "measure-points",
        paint: { "line-color": "#4F46E5", "line-width": 2.5, "line-dasharray": [2, 1] },
        filter: ["==", "$type", "LineString"] });
      map.addLayer({ id: "measure-fill", type: "fill", source: "measure-points",
        paint: { "fill-color": "#4F46E5", "fill-opacity": 0.15 },
        filter: ["==", "$type", "Polygon"] });
      map.addLayer({ id: "measure-points-circle", type: "circle", source: "measure-points",
        paint: { "circle-radius": 5, "circle-color": "#4F46E5", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
        filter: ["==", "$type", "Point"] });

      // ── Drawing layers ──────────────────────────────────────────────────
      map.addLayer({ id: "draw-polygons", type: "fill", source: "draw-features",
        paint: { "fill-color": "#6366F1", "fill-opacity": 0.2 }, filter: ["==", "$type", "Polygon"] });
      map.addLayer({ id: "draw-lines", type: "line", source: "draw-features",
        paint: { "line-color": "#6366F1", "line-width": 2 }, filter: ["==", "$type", "LineString"] });
      map.addLayer({ id: "draw-points", type: "circle", source: "draw-features",
        paint: { "circle-radius": 6, "circle-color": "#6366F1", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
        filter: ["==", "$type", "Point"] });
      map.addLayer({ id: "draw-current-line", type: "line", source: "draw-current",
        paint: { "line-color": "#6366F1", "line-width": 2, "line-dasharray": [2, 1] },
        filter: ["==", "$type", "LineString"] });
      map.addLayer({ id: "draw-current-points", type: "circle", source: "draw-current",
        paint: { "circle-radius": 4, "circle-color": "#6366F1", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 },
        filter: ["==", "$type", "Point"] });

      // ── Buffer circle layers ────────────────────────────────────────────
      map.addLayer({ id: "buffer-circle-fill", type: "fill", source: "buffer-circle",
        paint: { "fill-color": "#4F46E5", "fill-opacity": 0.1 } });
      map.addLayer({ id: "buffer-circle-outline", type: "line", source: "buffer-circle",
        paint: { "line-color": "#4F46E5", "line-width": 2, "line-dasharray": [2, 1] } });

      // In overview mode: no building/parcel/road data loaded.
      // Data loads only when a colony is selected (see enterColony function).
    });

    // ── Mouse coordinate tracking ─────────────────────────────────────────
    map.on("mousemove", (e: maplibregl.MapMouseEvent) => setMouseCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
    map.on("mouseout", () => setMouseCoords(null));
    map.on("moveend", () => {
      setZoom(parseFloat(map.getZoom().toFixed(2)));
    });
    map.on("zoomend", () => setZoom(parseFloat(map.getZoom().toFixed(2))));

    // ── Hover popup ───────────────────────────────────────────────────────
    const hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, anchor: "bottom-left", offset: 8, maxWidth: "280px" });
    let hoveredId: any = null, hoveredSrc = "";

    const clearHover = () => {
      if (hoveredId) {
        try { map.setFeatureState({ source: hoveredSrc, id: hoveredId }, { hovered: false }); } catch { /* noop */ }
        hoveredId = null; hoveredSrc = "";
      }
      hoverPopup.remove();
      setHoveredFeature(null);
    };

    // Unified mousemove handler — queries all visible layers in priority order
    // (buildings first, then parcels, then roads) so hovering a building inside
    // a parcel shows the BUILDING tooltip, not the parcel's.
    const hoverHandler = (e: maplibregl.MapMouseEvent) => {
      // Build list of visible layers to query, in priority order
      const layersToCheck: string[] = [];
      if (map.getLayoutProperty("buildings-fill", "visibility") === "visible") layersToCheck.push("buildings-fill");
      if (map.getLayoutProperty("parcels-fill", "visibility") === "visible") layersToCheck.push("parcels-fill");
      if (map.getLayoutProperty("roads-line", "visibility") === "visible") layersToCheck.push("roads-line");

      if (layersToCheck.length === 0) { clearHover(); return; }

      const features = map.queryRenderedFeatures(e.point, { layers: layersToCheck });
      if (features.length === 0) { clearHover(); return; }

      // Find the first feature from the highest-priority layer
      let f = null;
      for (const layerId of layersToCheck) {
        const feat = features.find(ft => ft.layer?.id === layerId);
        if (feat) { f = feat; break; }
      }
      if (!f) { clearHover(); return; }

      // Update feature-state hover
      const fid = f.id ?? f.properties?.object_uuid;
      const fsrc = f.source;
      if (hoveredId !== fid || hoveredSrc !== fsrc) {
        if (hoveredId) { try { map.setFeatureState({ source: hoveredSrc, id: hoveredId }, { hovered: false }); } catch { /* noop */ } }
        hoveredId = fid; hoveredSrc = fsrc;
        if (fid !== undefined && fid !== null) {
          try { map.setFeatureState({ source: fsrc, id: fid }, { hovered: true }); } catch { /* noop */ }
        }
      }

      const p = { ...f.properties };
      const ln = fsrc === "parcels" ? "Parcel" : fsrc === "buildings" ? "Building" : fsrc === "roads" ? "Road" : "Feature";
      let html = `<div style="font-family:ui-sans-serif,system-ui;font-size:11px;line-height:1.45;max-width:260px;"><div style="font-weight:600;color:#0f172a;margin-bottom:2px;">${ln}</div>`;
      if (p.display_code) html += `<div style="font-family:ui-monospace,monospace;font-size:10px;color:#475569;margin-bottom:4px;word-break:break-all;">${p.display_code}</div>`;
      if (fsrc === "buildings") {
        if (p.height_m) html += `<div style="color:#475569;">Height: <b>${Number(p.height_m).toFixed(1)} m</b> <span style="color:#f59e0b;font-size:9px;">(est.)</span></div>`;
        if (p.floors) html += `<div style="color:#475569;">Floors: <b>${p.floors}</b> <span style="color:#f59e0b;font-size:9px;">(est.)</span></div>`;
        if (p.ground_elevation_m) html += `<div style="color:#475569;">Ground Elev: <b>${Number(p.ground_elevation_m).toFixed(1)} m</b></div>`;
        if (p.parent_parcel_code) html += `<div style="color:#475569;">Parcel: <span style="font-family:ui-monospace;font-size:9px;">${p.parent_parcel_code}</span></div>`;
        if (p.name) html += `<div style="color:#475569;">Name: <b>${p.name}</b></div>`;
      } else if (fsrc === "parcels") {
        if (p.source_ulpin && p.source_ulpin !== "None") html += `<div style="color:#475569;">Source ID: <b>${p.source_ulpin}</b></div>`;
        if (p.Surveynumber_Old) html += `<div style="color:#475569;">Survey No: <b>${p.Surveynumber_Old}</b></div>`;
        if (p.bhucode) html += `<div style="color:#475569;">Bhucode: <span style="font-family:ui-monospace;font-size:9px;">${p.bhucode}</span></div>`;
        if (p.parcel_area_m2) html += `<div style="color:#475569;">Area: <b>${Number(p.parcel_area_m2).toLocaleString()} m²</b></div>`;
      } else if (fsrc === "roads") {
        if (p.name) html += `<div style="color:#475569;">Name: <b>${p.name}</b></div>`;
        if (p.highway) html += `<div style="color:#475569;">Type: <b>${p.highway}</b></div>`;
        if (p.surface) html += `<div style="color:#475569;">Surface: <b>${p.surface}</b></div>`;
      }
      html += `<div style="color:#94a3b8;font-size:9px;margin-top:4px;">Click to inspect →</div></div>`;
      hoverPopup.setHTML(html).setLngLat(e.lngLat).addTo(map);
      setHoveredFeature({ layer: ln, properties: p, geometry: f.geometry });
    };

    // Single mousemove + mouseout on the whole map (not per-layer)
    map.on("mousemove", hoverHandler);
    map.on("mouseout", clearHover);

    // ── Click: select feature OR measure OR draw OR compare-pick ──────────
    // ── Unified click handler: queries all layers in priority order ──────
    // Priority: buildings (top) → parcels → roads
    // This ensures clicking a building inside a parcel selects the BUILDING,
    // not the parcel underneath.
    const clickHandler = (e: maplibregl.MapMouseEvent) => {
      const lng = e.lngLat.lng, lat = e.lngLat.lat;

      // Compare-pick mode intercepts clicks (only buildings)
      if (comparePickModeRef.current) {
        const bldgFeats = map.queryRenderedFeatures(e.point, { layers: ["buildings-fill"] });
        if (bldgFeats.length > 0) {
          const f = bldgFeats[0];
          const b = { ...f.properties, _coords: [lng, lat] };
          const slot = comparePickModeRef.current;
          if (slot === "A") setCompareBuildingA(b);
          else setCompareBuildingB(b);
          setComparePickMode(null);
          toast(`Building ${slot} selected`);
        }
        return;
      }

      // Measure mode
      if (measureModeRef.current) {
        const pts = [...measurePointsRef.current, [lng, lat] as [number, number]];
        setMeasurePoints(pts);
        updateMeasureLayer(pts);
        return;
      }

      // Draw mode
      if (drawModeRef.current !== "none") {
        const pts = [...drawPointsRef.current, [lng, lat] as [number, number]];
        setDrawPoints(pts);
        updateDrawCurrentLayer(pts);
        return;
      }

      // Default: query layers in priority order — buildings first, then parcels, then roads
      const layersToCheck: string[] = [];
      if (map.getLayoutProperty("buildings-fill", "visibility") === "visible") layersToCheck.push("buildings-fill");
      if (map.getLayoutProperty("parcels-fill", "visibility") === "visible") layersToCheck.push("parcels-fill");
      if (map.getLayoutProperty("roads-line", "visibility") === "visible") layersToCheck.push("roads-line");

      const features = map.queryRenderedFeatures(e.point, { layers: layersToCheck });

      if (features.length === 0) return;

      // Pick the first feature from the highest-priority layer
      // queryRenderedFeatures returns features grouped by layer in z-order (top first)
      // But to be safe, explicitly find the first building, then first parcel, then first road
      let selectedFeature = null;
      for (const layerId of layersToCheck) {
        const feat = features.find(f => f.layer?.id === layerId);
        if (feat) {
          selectedFeature = feat;
          break;
        }
      }

      if (selectedFeature) {
        // Clear previousParcel when selecting directly from map (not from parcel list)
        setPreviousParcel(null);
        selectFeature(selectedFeature);
      }
    };

    // Register a SINGLE click handler on the map (not per-layer)
    // This avoids multiple handlers firing for the same click
    map.on("click", clickHandler);

    // ── Colony hover + click (overview mode) ──────────────────────────────
    let hoveredColonyId: string | number | null = null;
    const colonyMove = (e: any) => {
      const f = e.features?.[0];
      if (!f) {
        if (hoveredColonyId !== null) {
          try { map.setFeatureState({ source: "colonies", id: hoveredColonyId }, { hovered: false }); } catch { /* noop */ }
          hoveredColonyId = null;
          setHoveredColonyIdState(null);
        }
        map.getCanvas().style.cursor = "";
        return;
      }
      map.getCanvas().style.cursor = "pointer";
      const fid = f.id ?? f.properties?.id;
      const fidStr = fid !== undefined && fid !== null ? String(fid) : null;
      if (hoveredColonyId !== fid) {
        if (hoveredColonyId !== null) {
          try { map.setFeatureState({ source: "colonies", id: hoveredColonyId }, { hovered: false }); } catch { /* noop */ }
        }
        if (fid !== undefined && fid !== null) {
          try { map.setFeatureState({ source: "colonies", id: fid }, { hovered: true }); } catch { /* noop */ }
        }
        hoveredColonyId = fid;
        setHoveredColonyIdState(fidStr);
      }
    };
    const colonyLeave = () => {
      if (hoveredColonyId !== null) {
        try { map.setFeatureState({ source: "colonies", id: hoveredColonyId }, { hovered: false }); } catch { /* noop */ }
        hoveredColonyId = null;
        setHoveredColonyIdState(null);
      }
      map.getCanvas().style.cursor = "";
    };
    const colonyClick = (e: any) => {
      const f = e.features?.[0]; if (!f) return;
      const colony = COLONIES.find(c => c.id === f.properties.id);
      if (colony) enterColonyRef.current?.(colony);
    };
    map.on("mousemove", "colonies-fill", colonyMove);
    map.on("mouseleave", "colonies-fill", colonyLeave);
    map.on("click", "colonies-fill", colonyClick);

    // Cleanup
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // (Data loading now happens per-colony via enterColony, not on bounds change)
  // ═══════════════════════════════════════════════════════════════════════
  //  FEATURE: unified layer visibility (detail mode only) — handles layers + 3D + heatmap
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const map = mapRef.current; if (!map || !map.loaded()) return;
    if (!activeColony) return; // In overview mode, enterColony/exitColony manage visibility
    const setVis = (id: string, v: boolean) => { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v ? "visible" : "none"); };

    // Building layers depend on: layers.buildings, pitch3D, heatmapMode
    const showBuildingsFill = layers.buildings && !pitch3D && !heatmapMode;
    const showBuildingsOutline = layers.buildings && !pitch3D;
    const showBuildings3D = layers.buildings && pitch3D && !heatmapMode;
    const showHeatmap = layers.buildings && heatmapMode;

    setVis("parcels-fill", layers.parcels); setVis("parcels-outline", layers.parcels);
    setVis("nonparcels-fill", layers.nonParcels); setVis("nonparcels-outline", layers.nonParcels);
    setVis("roads-casing", layers.roads); setVis("roads-line", layers.roads);
    setVis("buildings-fill", showBuildingsFill);
    setVis("buildings-outline", showBuildingsOutline);
    setVis("buildings-3d", showBuildings3D);
    setVis("buildings-heatmap", showHeatmap);

    // Pitch animation
    if (pitch3D && !heatmapMode) {
      map.easeTo({ pitch: 55, duration: 600 });
    } else {
      map.easeTo({ pitch: 0, duration: 600 });
    }
  }, [layers, heatmapMode, pitch3D, activeColony]);

  // ═══════════════════════════════════════════════════════════════════════
  //  FEATURE: building color mode + height filter
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const map = mapRef.current; if (!map || !map.loaded()) return;
    const paint = buildingFillPaint(buildingColorMode);
    if (map.getLayer("buildings-fill")) map.setPaintProperty("buildings-fill", "fill-color", paint);
    if (map.getLayer("buildings-3d")) map.setPaintProperty("buildings-3d", "fill-extrusion-color", paint);
    const bFilter = ["all",
      [">=", ["coalesce", ["get", "height_m"], 0], heightFilter[0]],
      ["<=", ["coalesce", ["get", "height_m"], 0], heightFilter[1]],
    ];
    for (const id of ["buildings-fill", "buildings-outline", "buildings-3d", "buildings-heatmap"]) {
      if (map.getLayer(id)) map.setFilter(id, bFilter);
    }
  }, [buildingColorMode, heightFilter]);

  // ═══════════════════════════════════════════════════════════════════════
  //  FEATURE: basemap switching
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const map = mapRef.current; if (!map || !map.loaded()) return;
    const style = BASEMAP_STYLES[basemap];
    // Remove old basemap sources/layers
    for (const id of ["osm-basemap", "satellite-basemap", "satellite-labels", "carto-basemap", "carto-dark-basemap"]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const sid of ["osm-tiles", "esri-satellite", "esri-labels", "carto-light", "carto-dark"]) {
      if (map.getSource(sid)) map.removeSource(sid);
    }
    // Add new basemap sources + layers at the bottom
    for (const [sid, src] of Object.entries(style.sources)) {
      map.addSource(sid, src as any);
    }
    for (const layer of style.layers) {
      map.addLayer(layer, "aoi-fill"); // insert below AOI
    }
  }, [basemap]);

  // ═══════════════════════════════════════════════════════════════════════
  //  FEATURE: highlight a building by UUID (search result)
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const map = mapRef.current; if (!map || !map.loaded() || !highlightedUuid) return;
    fetch(`/api/buildings?object_uuid=${highlightedUuid}&limit=1`).then(r => r.json()).then(d => {
      const feats = d.features || [];
      if (feats.length > 0) {
        (map.getSource("highlight") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: feats });
        const coords = feats[0].geometry.coordinates[0][0];
        map.flyTo({ center: coords, zoom: 17, duration: 1500 });
      }
    }).catch(() => {});
  }, [highlightedUuid]);

  // ═══════════════════════════════════════════════════════════════════════
  //  FEATURE: minimap — waits for main map to load, then inits
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!minimapContainer.current || minimapRef.current) return;
    let cancelled = false;
    const tryInit = () => {
      if (cancelled || minimapRef.current) return;
      const map = mapRef.current;
      if (!map || !map.loaded()) { setTimeout(tryInit, 500); return; }
      const mini = new maplibregl.Map({
      container: minimapContainer.current,
      style: { version: 8, sources: BASEMAP_STYLES.osm.sources, layers: BASEMAP_STYLES.osm.layers },
      center: AOI_CENTER, zoom: 10, maxZoom: 12, minZoom: 9, interactive: false,
      attributionControl: false,
    });
    minimapRef.current = mini;
    mini.on("load", () => {
      mini.addSource("aoi-mini", { type: "geojson", data: "/api/aoi" });
      mini.addLayer({ id: "aoi-mini-outline", type: "line", source: "aoi-mini", paint: { "line-color": "#4F46E5", "line-width": 1.5, "line-dasharray": [2, 1] } });
      mini.addLayer({ id: "aoi-mini-fill", type: "fill", source: "aoi-mini", paint: { "fill-color": "#4F46E5", "fill-opacity": 0.08 } });
      // Viewport rectangle
      mini.addSource("vp", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mini.addLayer({ id: "vp-fill", type: "fill", source: "vp", paint: { "fill-color": "#4F46E5", "fill-opacity": 0.15 } });
      mini.addLayer({ id: "vp-outline", type: "line", source: "vp", paint: { "line-color": "#4338CA", "line-width": 1.5 } });
    });
      const updateVp = () => {
        const b = map.getBounds();
        const fc = { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[
          [b.getWest(), b.getSouth()], [b.getEast(), b.getSouth()], [b.getEast(), b.getNorth()], [b.getWest(), b.getNorth()], [b.getWest(), b.getSouth()],
        ]] } }] };
        (mini.getSource("vp") as maplibregl.GeoJSONSource)?.setData(fc);
      };
      map.on("move", updateVp);
      updateVp();
    // Store cleanup ref so we can remove the listener
    (mini as any).__updateVp = updateVp;
    (mini as any).__parentMap = map;
    };
    tryInit();
    return () => {
      cancelled = true;
      if (minimapRef.current) {
        const mini = minimapRef.current;
        const updateVp = (mini as any).__updateVp;
        const parentMap = (mini as any).__parentMap;
        if (updateVp && parentMap) { try { parentMap.off("move", updateVp); } catch { /* noop */ } }
        mini.remove();
        minimapRef.current = null;
      }
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  //  ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  // ── Enter a colony: switch to detail mode ───────────────────────────────
  const enterColony = useCallback((colony: Colony) => {
    const map = mapRef.current; if (!map || !map.loaded()) return;
    setActiveColony(colony);
    setSelected(null);

    // Hide colony layers, show detail layers
    const setVis = (id: string, v: boolean) => { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v ? "visible" : "none"); };
    setVis("colonies-fill", false);
    setVis("colonies-outline", false);
    setVis("colonies-label", false);
    setVis("parcels-fill", true);
    setVis("parcels-outline", true);
    setVis("roads-casing", true);
    setVis("roads-line", true);
    setVis("buildings-fill", !heatmapMode && !pitch3D);
    setVis("buildings-outline", !pitch3D);

    // Fly to colony
    map.flyTo({ center: colony.center, zoom: 15.5, pitch: 0, bearing: 0, duration: 1200 });

    // Load data for this colony's bbox
    const bbox = `${colony.bbox[0]},${colony.bbox[1]},${colony.bbox[2]},${colony.bbox[3]}`;
    fetch(`/api/parcels?bbox=${bbox}&limit=3000`).then(r => r.json()).then(d => { (map.getSource("parcels") as maplibregl.GeoJSONSource)?.setData(d); }).catch(() => {});
    fetch(`/api/buildings?bbox=${bbox}&limit=8000`).then(r => r.json()).then(d => { (map.getSource("buildings") as maplibregl.GeoJSONSource)?.setData(d); }).catch(() => {});
    fetch(`/api/roads?bbox=${bbox}&limit=5000`).then(r => r.json()).then(d => { (map.getSource("roads") as maplibregl.GeoJSONSource)?.setData(d); }).catch(() => {});

    toast(`Entered ${colony.name}`);
  }, [heatmapMode, pitch3D]);

  useEffect(() => { enterColonyRef.current = enterColony; }, [enterColony]);

  // ── Exit colony: back to overview mode ──────────────────────────────────
  const exitColony = useCallback(() => {
    const map = mapRef.current; if (!map || !map.loaded()) return;
    setActiveColony(null);
    setSelected(null);

    // Show colony layers, hide detail layers
    const setVis = (id: string, v: boolean) => { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v ? "visible" : "none"); };
    setVis("colonies-fill", true);
    setVis("colonies-outline", true);
    setVis("colonies-label", true);
    setVis("parcels-fill", false);
    setVis("parcels-outline", false);
    setVis("roads-casing", false);
    setVis("roads-line", false);
    setVis("buildings-fill", false);
    setVis("buildings-outline", false);
    setVis("buildings-3d", false);
    setVis("buildings-heatmap", false);

    // Clear data sources
    (map.getSource("parcels") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [] });
    (map.getSource("buildings") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [] });
    (map.getSource("roads") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [] });

    // Fly back to overview
    map.flyTo({ center: AOI_CENTER, zoom: 14, pitch: 0, bearing: 0, duration: 1200 });
    setPitch3D(false);
    setHeatmapMode(false);
  }, []);

  // ── Fetch building counts per colony (for the colony list) ──────────────
  useEffect(() => {
    const counts: Record<string, number> = {};
    let pending = COLONIES.length;
    for (const c of COLONIES) {
      const bbox = `${c.bbox[0]},${c.bbox[1]},${c.bbox[2]},${c.bbox[3]}`;
      fetch(`/api/buildings?bbox=${bbox}&limit=1`).then(r => r.json()).then(d => {
        counts[c.id] = d.metadata?.total || 0;
      }).catch(() => { counts[c.id] = 0; }).finally(() => {
        pending--;
        if (pending === 0) setColonyCounts({ ...counts });
      });
    }
  }, []);

  // Fly to coordinate
  const handleFlyTo = () => {
    const input = flyToInput.trim();
    const m = input.match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
    if (!m) { setFlyToError("Use format: lng, lat  (e.g. 77.635, 12.975)"); return; }
    const lng = parseFloat(m[1]), lat = parseFloat(m[2]);
    if (lng < 77.4 || lng > 77.9 || lat < 12.8 || lat > 13.15) { setFlyToError("Coordinates outside pilot AOI bounds."); return; }
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 17, duration: 1500 });
    setShowFlyToDialog(false); setFlyToInput(""); setFlyToError("");
  };

  // Search by code/uuid
  const handleSearch = (q: string) => {
    const query = q.trim(); if (!query) return;
    fetch(`/api/buildings?display_code=${encodeURIComponent(query)}&limit=1`).then(r => r.json()).then(d => {
      const feats = d.features || [];
      if (feats.length === 0) {
        // try uuid
        return fetch(`/api/buildings?object_uuid=${encodeURIComponent(query)}&limit=1`).then(r => r.json());
      }
      return { features: feats };
    }).then(d => {
      if (d && d.features && d.features.length > 0) {
        setHighlightedUuid(d.features[0].properties.object_uuid);
        toast("Found — flying to building");
      } else {
        toast("No building found");
      }
    }).catch(() => toast("Search error"));
  };

  // Share URL
  const handleShare = () => {
    const map = mapRef.current; if (!map) return;
    const c = map.getCenter(), z = map.getZoom(), p = map.getPitch(), b = map.getBearing();
    const hash = `map=${c.lng.toFixed(5)},${c.lat.toFixed(5)},${z.toFixed(2)},${p.toFixed(0)},${b.toFixed(0)}`;
    const url = `${window.location.origin}/#${hash}`;
    navigator.clipboard?.writeText(url).then(() => toast("Share URL copied to clipboard")).catch(() => toast(url));
  };

  // Tour
  const startTour = () => {
    if (!notable || notable.tallest.length === 0) return;
    setTourBuildings(notable.tallest);
    setTourIndex(0);
    setTourActive(true);
  };
  useEffect(() => {
    if (!tourActive || tourBuildings.length === 0) return;
    const b = tourBuildings[tourIndex];
    if (!b) { setTourActive(false); return; }
    mapRef.current?.flyTo({ center: b.coords, zoom: 17, pitch: 50, duration: 2000 });
    tourTimerRef.current = setTimeout(() => {
      setTourIndex(i => i + 1);
    }, 4000);
    return () => { if (tourTimerRef.current) clearTimeout(tourTimerRef.current); };
  }, [tourActive, tourIndex, tourBuildings]);

  // Measurement finish
  const finishMeasure = () => { setMeasureMode(false); };
  const clearMeasure = () => { setMeasurePoints([]); setMeasureDistance(null); setMeasureArea(null); updateMeasureLayer([]); };

  // Drawing finish
  const finishDraw = () => {
    if (drawPoints.length < 1) { setDrawMode("none"); setDrawPoints([]); updateDrawCurrentLayer([]); return; }
    const geom = drawMode === "polygon" && drawPoints.length >= 3
      ? { type: "Polygon", coordinates: [[...drawPoints, drawPoints[0]]] }
      : drawMode === "line" && drawPoints.length >= 2
      ? { type: "LineString", coordinates: drawPoints }
      : { type: "Point", coordinates: drawPoints[0] };
    setDrawFeatures(prev => [...prev, { type: "Feature", geometry: geom, properties: { label: drawLabel || `Draw ${prev.length + 1}`, mode: drawMode } }]);
    (mapRef.current?.getSource("draw-features") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [...drawFeatures, { type: "Feature", geometry: geom, properties: { label: drawLabel || `Draw ${drawFeatures.length + 1}`, mode: drawMode } }] });
    setDrawPoints([]); setDrawMode("none"); updateDrawCurrentLayer([]); setShowDrawDialog(false); setDrawLabel("");
  };
  const cancelDraw = () => { setDrawPoints([]); setDrawMode("none"); updateDrawCurrentLayer([]); setShowDrawDialog(false); };
  const clearDraw = () => { setDrawFeatures([]); (mapRef.current?.getSource("draw-features") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [] }); };

  // Buffer analysis
  const runBuffer = () => {
    if (!bufferCenter) { toast("Click on map to set buffer center first"); return; }
    setBufferLoading(true);
    const bbox = `${bufferCenter[0] - 0.005},${bufferCenter[1] - 0.005},${bufferCenter[0] + 0.005},${bufferCenter[1] + 0.005}`;
    fetch(`/api/buildings?bbox=${bbox}&limit=8000`).then(r => r.json()).then(d => {
      const feats = d.features || [];
      const within = feats.filter((f: any) => {
        const c = f.geometry.coordinates[0][0];
        return haversine(bufferCenter, c) <= bufferRadius;
      });
      setBufferBuildings(within);
      // Draw buffer circle
      const circle = makeCircleGeoJSON(bufferCenter, bufferRadius);
      (mapRef.current?.getSource("buffer-circle") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [circle] });
    }).catch(() => {}).finally(() => setBufferLoading(false));
  };
  const clearBuffer = () => { setBufferBuildings([]); setBufferCenter(null); (mapRef.current?.getSource("buffer-circle") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [] }); };

  // Make circle polygon
  const makeCircleGeoJSON = (center: [number, number], radiusM: number) => {
    const pts: [number, number][] = [];
    const R = 6378137;
    for (let i = 0; i <= 64; i++) {
      const brg = (i * 360 / 64) * Math.PI / 180;
      const lat1 = center[1] * Math.PI / 180, lng1 = center[0] * Math.PI / 180;
      const dByR = radiusM / R;
      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dByR) + Math.cos(lat1) * Math.sin(dByR) * Math.cos(brg));
      const lng2 = lng1 + Math.atan2(Math.sin(brg) * Math.sin(dByR) * Math.cos(lat1), Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2));
      pts.push([lng2 * 180 / Math.PI, lat2 * 180 / Math.PI]);
    }
    return { type: "Feature", properties: { radius: radiusM }, geometry: { type: "Polygon", coordinates: [pts] } };
  };

  // Buffer: capture map clicks when dialog open
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const handler = (e: any) => {
      if (showBufferDialog) {
        setBufferCenter([e.lngLat.lng, e.lngLat.lat]);
        const circle = makeCircleGeoJSON([e.lngLat.lng, e.lngLat.lat], bufferRadius);
        (map.getSource("buffer-circle") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [circle] });
      }
    };
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [showBufferDialog, bufferRadius]);

  // Compare two buildings
  const startComparePick = (which: "A" | "B") => {
    setComparePickMode(which);
    toast(`Click building ${which} on the map`);
  };

  // Load validation issues
  const loadIssues = (sev: string) => {
    setIssuesLoading(true);
    const url = sev ? `/api/validation/issues?severity=${sev}&limit=500` : `/api/validation/issues?limit=500`;
    fetch(url).then(r => r.json()).then(d => setIssues(d.issues || [])).catch(() => setIssues([])).finally(() => setIssuesLoading(false));
  };
  // Validation issue summary for the drawer
  const issueSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of issues) {
      const k = `${it.severity || "FLAG"}:${it.issue_type || "anomaly"}`;
      counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  }, [issues]);

  // Dynamic breadcrumbs for TopBar
  const breadcrumbs = useMemo(() => [
    {
      label: "Bengaluru AOI",
      onClick: () => {
        setActiveColony(null);
        setSelected(null);
        if (mapRef.current) mapRef.current.flyTo({ center: AOI_CENTER, zoom: 13 });
      },
    },
    ...(activeColony
      ? [
          {
            label: activeColony.name,
            onClick: () => {
              setSelected(null);
              if (mapRef.current) {
                mapRef.current.fitBounds(
                  [
                    [activeColony.bbox[0], activeColony.bbox[1]],
                    [activeColony.bbox[2], activeColony.bbox[3]],
                  ],
                  { padding: 40 }
                );
              }
            },
          },
        ]
      : []),
    ...(selected
      ? [
          {
            label: String(selected.properties?.display_code || selected.properties?.name || selected.layer),
            isMono: true,
          },
        ]
      : []),
  ], [activeColony, selected]);

  // Handler to open 3D viewer for selected building
  const handleOpen3DFromSelected = () => {
    if (selected?.layer === "Building" && selected.properties) {
      const props = selected.properties;
      const bldgFeature: MapBuildingFeature = {
        id: parseInt(String(props.building_seq || props.object_uuid?.slice(0, 6) || 0), 10) || 0,
        c: selected.geometry?.coordinates?.[0] || [],
        ce: [
          selected.geometry?.coordinates?.[0]?.[0]?.[0] || 0,
          selected.geometry?.coordinates?.[0]?.[0]?.[1] || 0,
        ],
        h: parseFloat(String(props.height_m || 0)),
        f: parseInt(String(props.floors || 1), 10),
        n: props.name || null,
        t: props.building || null,
        pc: props.parent_parcel_code || null,
      };
      const bldgModel = createBuildingFromFeature(bldgFeature);
      useViewerStore.setState({
        appView: "viewer",
        selectedMapBuilding: bldgFeature,
        buildingData: bldgModel,
      });
    }
  };

  // Export handlers
  const handleExportGeoJSON = () => {
    if (selected) {
      downloadGeoJSON(
        {
          type: "Feature",
          geometry: selected.geometry || {},
          properties: selected.properties,
        },
        `${selected.layer.toLowerCase()}-${selected.properties?.display_code || "feature"}.geojson`
      );
    } else {
      fetch("/api/buildings?limit=500")
        .then((r) => r.json())
        .then((data) => {
          downloadGeoJSON(data, "bengaluru-buildings-sample.geojson");
        })
        .catch(() => {});
    }
  };

  const handleExportCSV = () => {
    if (selected?.properties) {
      const rows = [
        ["Property", "Value"],
        ...Object.entries(selected.properties).map(([k, v]) => [k, String(v ?? "")]),
      ];
      const csvContent =
        "data:text/csv;charset=utf-8," +
        rows.map((e) => e.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const encoded = encodeURI(csvContent);
      const a = document.createElement("a");
      a.href = encoded;
      a.download = `${selected.layer.toLowerCase()}-${selected.properties?.display_code || "export"}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="h-screen w-screen flex flex-col bg-[#F9FAFB] text-[#0F172A] overflow-hidden select-none relative">
      {/* ═══ TOP BAR (FLOATING) ═══ */}
      <TopBar
        breadcrumbs={breadcrumbs}
        onOpenCommandPalette={() => setCmdPaletteOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onExportGeoJSON={handleExportGeoJSON}
        onExportCSV={handleExportCSV}
        onOpen3DAction={selected?.layer === "Building" ? handleOpen3DFromSelected : undefined}
      />

      {/* ═══ MAIN WORKSPACE ═══ */}
      <div className="flex-1 flex relative min-h-0 pt-[68px]">
        {/* ── LEFT RAIL ── */}
        <LeftRail
          activeTab={railTab}
          onTabChange={setRailTab}
          issuesCount={issues.length || stats?.counts?.validation_issues || 0}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />

        {/* ── LEFT DRAWER (FLYOUT PANEL) ── */}
        {railTab && (
          <aside className="w-80 shrink-0 bg-white border-r border-[#E5E7EB] flex flex-col z-20 min-h-0 shadow-sm animate-in slide-in-from-left-2 duration-150">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-3 h-10 border-b border-[#E5E7EB] shrink-0 bg-[#F9FAFB]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
                {railTab === "explore" && <MapPin className="w-4 h-4 text-[#4F46E5]" />}
                {railTab === "layers" && <Layers className="w-4 h-4 text-[#4F46E5]" />}
                {railTab === "stats" && <BarChart className="w-4 h-4 text-[#4F46E5]" />}
                {railTab === "issues" && <AlertTriangle className="w-4 h-4 text-[#B45309]" />}
                {railTab === "sources" && <Database className="w-4 h-4 text-[#4F46E5]" />}
                <span>
                  {railTab === "explore" && "Pilot Colonies"}
                  {railTab === "layers" && "Layers & Styling"}
                  {railTab === "stats" && "Cadastral Stats"}
                  {railTab === "issues" && "Validation Issues"}
                  {railTab === "sources" && "Data Lineage"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-[#6B7280] hover:text-[#0F172A]"
                onClick={() => setRailTab(null)}
                title="Collapse drawer"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scroll min-h-0">
              {/* TAB: EXPLORE COLONIES */}
              {railTab === "explore" && (
                <div className="p-3 space-y-3">
                  {activeColony && (
                    <div className="space-y-2">
                      <button
                        className="w-full flex items-center justify-center gap-2 text-xs py-2 px-3 rounded-xl bg-[#EEF2FF] text-[#4F46E5] hover:bg-[#E0E7FF] transition font-medium border border-[#C7D2FE]"
                        onClick={exitColony}
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Return to Bengaluru AOI
                      </button>
                      <div className="p-2.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">Active Colony</div>
                        <div className="text-sm font-semibold text-[#0F172A] mt-0.5">{activeColony.name}</div>
                        <div className="text-xs font-mono-nums text-[#6B7280] mt-0.5">
                          {activeColony.bbox[0].toFixed(3)}, {activeColony.bbox[1].toFixed(3)} → {activeColony.bbox[2].toFixed(3)}, {activeColony.bbox[3].toFixed(3)}
                        </div>
                        {colonyCounts[activeColony.id] !== undefined && (
                          <div className="text-xs text-[#4F46E5] font-medium mt-1">
                            {colonyCounts[activeColony.id].toLocaleString()} estimated building footprints
                          </div>
                        )}
                      </div>
                      <Separator className="bg-[#E5E7EB]" />
                    </div>
                  )}

                  {/* Colony Filter & List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
                        Colonies ({COLONIES.length})
                      </span>
                      {activeColony && (
                        <span className="text-[11px] text-[#4F46E5] font-medium">1 Selected</span>
                      )}
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                      <Input
                        value={colonyFilterText}
                        onChange={(e) => setColonyFilterText(e.target.value)}
                        placeholder="Filter colonies…"
                        className="h-8 pl-8 text-xs bg-[#F9FAFB] border-[#E5E7EB]"
                      />
                    </div>
                    <div className="space-y-1">
                      {COLONIES.filter(c => c.name.toLowerCase().includes(colonyFilterText.toLowerCase())).map((c) => {
                        const isHovered = hoveredColonyIdState === c.id;
                        const isCurrent = activeColony?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            className={cn(
                              "w-full flex items-center justify-between p-2 rounded-xl border transition text-left group cursor-pointer",
                              isCurrent
                                ? "bg-[#EEF2FF] border-[#4F46E5] ring-1 ring-[#4F46E5]"
                                : isHovered
                                ? "bg-[#F3F4F6] border-[#C7D2FE]"
                                : "bg-white border-[#E5E7EB] hover:bg-[#F9FAFB]"
                            )}
                            onClick={() => enterColony(c)}
                            onMouseEnter={() => {
                              const map = mapRef.current;
                              if (map && map.getLayer("colonies-fill")) {
                                try { map.setFeatureState({ source: "colonies", id: c.id }, { hovered: true }); } catch { /* noop */ }
                              }
                            }}
                            onMouseLeave={() => {
                              const map = mapRef.current;
                              if (map && map.getLayer("colonies-fill") && hoveredColonyIdState !== c.id) {
                                try { map.setFeatureState({ source: "colonies", id: c.id }, { hovered: false }); } catch { /* noop */ }
                              }
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <MapPin className={cn("w-3.5 h-3.5 shrink-0", isCurrent ? "text-[#4F46E5]" : "text-[#6B7280]")} />
                              <span className={cn("text-xs font-medium truncate", isCurrent ? "text-[#4F46E5] font-semibold" : "text-[#0F172A]")}>
                                {c.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {colonyCounts[c.id] !== undefined && (
                                <Badge variant="outline" className={cn("text-[11px] font-mono-nums border-[#E5E7EB]", isCurrent ? "border-[#C7D2FE] text-[#4F46E5]" : "text-[#6B7280]")}>
                                  {colonyCounts[c.id].toLocaleString()}
                                </Badge>
                              )}
                              <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#0F172A]" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Separator className="bg-[#E5E7EB]" />

                  {/* AOI Overview Counters */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">Pilot Scope</div>
                    <div className="p-2.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] leading-relaxed">
                      <ShieldAlert className="w-3.5 h-3.5 inline mr-1 text-[#B45309]" />
                      Pilot AOI: 6.66 km² in East Bengaluru. 24 cadastral colony subdivisions.
                    </div>
                    {stats && (
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="p-2 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                          <div className="text-sm font-bold text-[#059669] font-mono-nums">{stats.counts.parcels?.toLocaleString()}</div>
                          <div className="text-[11px] uppercase tracking-wider text-[#6B7280]">Parcels</div>
                        </div>
                        <div className="p-2 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                          <div className="text-sm font-bold text-[#4F46E5] font-mono-nums">{stats.counts.buildings?.toLocaleString()}</div>
                          <div className="text-[11px] uppercase tracking-wider text-[#6B7280]">Buildings</div>
                        </div>
                        <div className="p-2 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                          <div className="text-sm font-bold text-[#0F172A] font-mono-nums">{stats.counts.roads?.toLocaleString()}</div>
                          <div className="text-[11px] uppercase tracking-wider text-[#6B7280]">Roads</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: LAYERS & STYLING */}
              {railTab === "layers" && (
                <div className="p-3 space-y-4">
                  {!activeColony && (
                    <div className="p-2.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] leading-relaxed">
                      <Info className="w-3.5 h-3.5 inline mr-1 text-[#B45309]" />
                      Detailed cadastral and building layers activate upon entering a colony.
                    </div>
                  )}

                  {/* Layer switches */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">Cadastral Layers</div>
                    {[
                      { key: "parcels", label: "Cadastral Parcels", icon: Square, color: "text-[#059669]" },
                      { key: "buildings", label: "Building Footprints", icon: Building2, color: "text-[#4F46E5]" },
                      { key: "roads", label: "Road Network", icon: Route, color: "text-[#6B7280]" },
                      { key: "nonParcels", label: "Non-Parcel Features", icon: Hash, color: "text-[#9CA3AF]" },
                    ].map(({ key, label, icon: Icon, color }) => (
                      <div key={key} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#F9FAFB]">
                        <div className="flex items-center gap-2 text-xs font-medium text-[#0F172A]">
                          <Icon className={cn("w-4 h-4", color)} />
                          <span>{label}</span>
                        </div>
                        <Switch checked={(layers as any)[key]} onCheckedChange={(v) => setLayers(prev => ({ ...prev, [key]: v }))} />
                      </div>
                    ))}
                  </div>

                  <Separator className="bg-[#E5E7EB]" />

                  {/* Building color mode */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">Color Palette Mode</div>
                    <div className="grid grid-cols-3 gap-1 bg-[#F3F4F6] p-1 rounded-xl">
                      {[
                        { key: "height", label: "Height" },
                        { key: "match", label: "Match" },
                        { key: "floors", label: "Floors" },
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          className={cn(
                            "text-xs py-1.5 rounded-lg font-medium transition cursor-pointer",
                            buildingColorMode === key ? "bg-white text-[#4F46E5] shadow-xs" : "text-[#6B7280] hover:text-[#0F172A]"
                          )}
                          onClick={() => setBuildingColorMode(key as any)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Height filter slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
                      <span>Height Filter</span>
                      <span className="font-mono-nums text-[#0F172A]">{heightFilter[0]}–{heightFilter[1]} m</span>
                    </div>
                    <Slider value={heightFilter} min={0} max={110} step={1} onValueChange={(v) => setHeightFilter([v[0], v[1]])} className="py-2" />
                  </div>

                  <Separator className="bg-[#E5E7EB]" />

                  {/* Visualization modes */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">3D & Density Views</div>
                    <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#F9FAFB]">
                      <div className="flex items-center gap-2 text-xs font-medium text-[#0F172A]">
                        <Box className="w-4 h-4 text-[#4F46E5]" />
                        <span>3D Extrusion</span>
                      </div>
                      <Switch checked={pitch3D} onCheckedChange={setPitch3D} />
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#F9FAFB]">
                      <div className="flex items-center gap-2 text-xs font-medium text-[#0F172A]">
                        <Activity className="w-4 h-4 text-[#B45309]" />
                        <span>Density Heatmap</span>
                      </div>
                      <Switch checked={heatmapMode} onCheckedChange={setHeatmapMode} />
                    </div>
                  </div>

                  <Separator className="bg-[#E5E7EB]" />

                  {/* Analysis Tools */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">Spatial Tools</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        className={cn(
                          "flex items-center justify-center gap-1.5 text-xs py-2 px-2.5 rounded-xl border font-medium transition cursor-pointer",
                          measureMode ? "bg-[#EEF2FF] border-[#4F46E5] text-[#4F46E5]" : "bg-white border-[#E5E7EB] text-[#0F172A] hover:bg-[#F9FAFB]"
                        )}
                        onClick={() => { setMeasureMode(!measureMode); if (!measureMode) { setDrawMode("none"); setComparePickMode(null); } }}
                      >
                        <Ruler className="w-3.5 h-3.5" /> Measure
                      </button>
                      <button
                        className={cn(
                          "flex items-center justify-center gap-1.5 text-xs py-2 px-2.5 rounded-xl border font-medium transition cursor-pointer",
                          drawMode !== "none" ? "bg-[#EEF2FF] border-[#4F46E5] text-[#4F46E5]" : "bg-white border-[#E5E7EB] text-[#0F172A] hover:bg-[#F9FAFB]"
                        )}
                        onClick={() => setShowDrawDialog(true)}
                      >
                        <PenTool className="w-3.5 h-3.5" /> Draw
                      </button>
                      <button
                        className="flex items-center justify-center gap-1.5 text-xs py-2 px-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F9FAFB] font-medium transition cursor-pointer"
                        onClick={() => { setShowBufferDialog(true); setMeasureMode(false); setDrawMode("none"); }}
                      >
                        <Target className="w-3.5 h-3.5" /> Buffer
                      </button>
                      <button
                        className="flex items-center justify-center gap-1.5 text-xs py-2 px-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F9FAFB] font-medium transition cursor-pointer"
                        onClick={() => { setShowCompareDialog(true); setMeasureMode(false); setDrawMode("none"); }}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" /> Compare
                      </button>
                    </div>
                    <button
                      className="w-full flex items-center justify-center gap-1.5 text-xs py-2 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F9FAFB] font-medium transition cursor-pointer"
                      onClick={startTour}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" /> Tour Tallest Buildings
                    </button>
                  </div>

                  {drawFeatures.length > 0 && (
                    <>
                      <Separator className="bg-[#E5E7EB]" />
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
                          Drawn Features ({drawFeatures.length})
                        </div>
                        {drawFeatures.map((f, i) => (
                          <div key={i} className="text-xs text-[#0F172A] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 truncate">
                            {f.properties.label}
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-[#B91C1C]" onClick={clearDraw}>
                          <Trash2 className="w-3 h-3 mr-1" /> Clear all drawings
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB: CADASTRAL STATS */}
              {railTab === "stats" && (
                <div className="p-3 space-y-4">
                  {stats && (
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-2.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                        <div className="text-base font-bold text-[#059669] font-mono-nums">{stats.counts.parcels?.toLocaleString()}</div>
                        <div className="text-[11px] uppercase tracking-wider text-[#6B7280]">Parcels</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                        <div className="text-base font-bold text-[#4F46E5] font-mono-nums">{stats.counts.buildings?.toLocaleString()}</div>
                        <div className="text-[11px] uppercase tracking-wider text-[#6B7280]">Buildings</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                        <div className="text-base font-bold text-[#0F172A] font-mono-nums">{stats.counts.roads?.toLocaleString()}</div>
                        <div className="text-[11px] uppercase tracking-wider text-[#6B7280]">Roads</div>
                      </div>
                    </div>
                  )}

                  {/* Height Histogram */}
                  {distribution && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">Height Distribution (m)</div>
                      <div className="h-36 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={distribution.height_histogram} margin={{ top: 4, right: 4, bottom: 4, left: -24 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis dataKey="range" tick={{ fill: "#6B7280", fontSize: 9 }} angle={-25} textAnchor="end" height={30} />
                            <YAxis tick={{ fill: "#6B7280", fontSize: 9 }} />
                            <RTooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 11 }} />
                            <Bar dataKey="count" fill="#4F46E5" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Floors Distribution */}
                  {distribution && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">Floors Distribution (est.)</div>
                      <div className="h-32 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={distribution.floors_distribution} margin={{ top: 4, right: 4, bottom: 4, left: -24 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis dataKey="range" tick={{ fill: "#6B7280", fontSize: 9 }} />
                            <YAxis tick={{ fill: "#6B7280", fontSize: 9 }} />
                            <RTooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 11 }} />
                            <Bar dataKey="count" fill="#059669" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Match status pie */}
                  {distribution && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">Parcel Match Status</div>
                      <div className="h-32 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <RPieChart>
                            <Pie data={distribution.match_status} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={44} label={{ fill: "#6B7280", fontSize: 9 }}>
                              {distribution.match_status.map((e, i) => <Cell key={i} fill={Object.values(MATCH_COLORS)[i] || "#C7D2FE"} />)}
                            </Pie>
                            <RTooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 11 }} />
                          </RPieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Notable buildings */}
                  {notable && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-[#B45309]" /> Tallest Buildings
                      </div>
                      <div className="space-y-1">
                        {notable.tallest.slice(0, 4).map((b, i) => (
                          <button
                            key={i}
                            className="w-full flex items-center justify-between p-2 rounded-xl bg-[#F9FAFB] hover:bg-[#EEF2FF] border border-[#E5E7EB] text-left transition cursor-pointer"
                            onClick={() => setHighlightedUuid(b.uuid)}
                          >
                            <span className="text-xs text-[#0F172A] truncate">
                              <span className="text-[#B45309] font-semibold mr-1.5">#{i + 1}</span>
                              {b.code || b.uuid.slice(0, 8)}
                            </span>
                            <span className="text-xs text-[#4F46E5] font-semibold font-mono-nums">{b.height.toFixed(1)} m</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: VALIDATION ISSUES */}
              {railTab === "issues" && (
                <div className="p-3 space-y-3">
                  <div className="flex gap-1 bg-[#F3F4F6] p-1 rounded-xl">
                    {["", "ERROR", "WARNING", "INFO"].map(sev => (
                      <button
                        key={sev}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex-1 text-center",
                          issuesSeverity === sev ? "bg-white text-[#4F46E5] shadow-xs" : "text-[#6B7280] hover:text-[#0F172A]"
                        )}
                        onClick={() => setIssuesSeverity(sev)}
                      >
                        {sev || "ALL"}
                      </button>
                    ))}
                  </div>

                  <div className="text-xs text-[#6B7280]">
                    {issues.length} flags shown · {stats?.counts?.validation_issues?.toLocaleString()} total in dataset
                  </div>

                  {/* Issue summary by type */}
                  {Object.keys(issueSummary).length > 0 && (
                    <div className="p-2.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-1.5">Issue Summary</div>
                      <div className="space-y-1">
                        {Object.entries(issueSummary).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between text-xs">
                            <span className="text-[#6B7280] truncate">{k.split(":")[1]?.replace(/_/g, " ").toLowerCase() || k}</span>
                            <span className="text-[#B45309] font-semibold font-mono-nums ml-2">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {issuesLoading ? (
                    <div className="text-xs text-[#6B7280] py-6 text-center">Loading validation flags…</div>
                  ) : (
                    <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-0.5 custom-scroll">
                      {issues.map((iss, i) => (
                        <button
                          key={i}
                          className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] transition cursor-pointer"
                          onClick={() => { if (iss.object_uuid) setHighlightedUuid(iss.object_uuid); }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={cn("w-2 h-2 rounded-full", SEVERITY_COLORS[iss.severity] || "bg-slate-400")} />
                            <span className="text-xs font-mono-nums text-[#6B7280] font-medium">{iss.issue_type}</span>
                          </div>
                          <div className="text-xs text-[#0F172A] leading-relaxed">{iss.message}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] text-[#B45309] p-2 rounded-xl bg-[#FFFBEB] border border-[#FDE68A]">
                    ⚠ Phase 1 research prototype validation flags — NOT an official land title audit.
                  </div>
                </div>
              )}

              {/* TAB: DATA SOURCES & LINEAGE */}
              {railTab === "sources" && (
                <div className="p-3 space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
                    Data Lineage & Provenance
                  </div>
                  {stats && (
                    <div className="space-y-2">
                      {stats.data_sources.map((s, i) => (
                        <div key={i} className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#0F172A]">{s.name}</span>
                            <Badge variant="outline" className="text-[11px] border-[#E5E7EB] text-[#6B7280]">{s.legal_status}</Badge>
                          </div>
                          <div className="text-xs text-[#6B7280]">{s.source}</div>
                          <div className="flex items-center justify-between text-[11px] text-[#6B7280] pt-0.5">
                            <span>License: {s.license}</span>
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#4F46E5] hover:underline">Source ↗</a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator className="bg-[#E5E7EB]" />

                  {/* Format demonstration importers button */}
                  <button
                    className="w-full flex items-center justify-center gap-1.5 text-xs py-2 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F9FAFB] font-medium transition cursor-pointer"
                    onClick={() => setShowFormatDialog("menu")}
                  >
                    <Boxes className="w-3.5 h-3.5 text-[#4F46E5]" /> Open Demonstration Importers
                  </button>

                  <button
                    className="w-full flex items-center justify-center gap-1.5 text-xs py-2 px-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] hover:bg-[#FEF3C7] font-medium transition cursor-pointer"
                    onClick={() => setShowDisclaimers(true)}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-[#B45309]" /> Review Honesty Disclaimers
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ── CENTER: MAP CANVAS ── */}
        <div className="flex-1 relative min-w-0">
          <div ref={mapContainer} style={{ width: "100%", height: "100%" }} className="bg-white" />

          {loading && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-3">
                <Box className="w-6 h-6 animate-pulse text-[#4F46E5]" />
                <span className="text-base font-semibold text-[#0F172A]">Loading 3D ULPIN Bengaluru…</span>
              </div>
              <div className="text-xs text-[#6B7280] max-w-sm text-center mb-4">
                Loading cadastral parcels, building footprints, and 3D-GloBFP height models.
              </div>
              <div className="w-56 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div className="h-full bg-[#4F46E5] animate-pulse" style={{ width: "70%" }} />
              </div>
            </div>
          )}

          {/* Basemap switcher (floating top right) */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
            <button
              className="h-9 w-9 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:text-[#0F172A] hover:bg-[#F9FAFB] shadow-card cursor-pointer focus-ring"
              onClick={() => setShowBasemapMenu(v => !v)}
              title="Switch basemap (B)"
            >
              {(() => { const Icon = BASEMAP_STYLES[basemap].icon; return <Icon className="w-4 h-4" />; })()}
            </button>
            {showBasemapMenu && (
              <div className="rounded-xl bg-white border border-[#E5E7EB] shadow-floating overflow-hidden p-1 min-w-[140px] text-xs">
                {Object.entries(BASEMAP_STYLES).map(([key, val]) => {
                  const Icon = val.icon;
                  return (
                    <button
                      key={key}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg w-full transition cursor-pointer text-left",
                        basemap === key ? "bg-[#EEF2FF] text-[#4F46E5] font-medium" : "text-[#0F172A] hover:bg-[#F9FAFB]"
                      )}
                      onClick={() => { setBasemap(key); setShowBasemapMenu(false); }}
                    >
                      <Icon className="w-3.5 h-3.5" /> {val.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend (floating bottom left) */}
          {showLegend && (
            <div className="absolute bottom-3 left-3 z-10 w-60 rounded-2xl bg-white/95 backdrop-blur-md border border-[#E5E7EB] shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#E5E7EB]">
                <span className="text-xs font-semibold text-[#0F172A]">{activeColony ? "Colony Legend" : "Overview Legend"}</span>
                <button onClick={() => setShowLegend(false)} className="text-[#6B7280] hover:text-[#0F172A] cursor-pointer"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="p-3 space-y-2 text-xs">
                {!activeColony ? (
                  <>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-1">Colony Subdivisions</div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm border border-[#4F46E5]" style={{ background: "rgba(79,70,229,0.12)" }} />
                      <span className="text-[#0F172A]">Colony Boundary</span>
                    </div>
                    <div className="text-[11px] text-[#6B7280] mt-1">Click any colony to inspect parcels and buildings.</div>
                  </>
                ) : (
                  <>
                    {buildingColorMode === "height" && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-1">Building Height (est.)</div>
                        <div className="h-2 rounded-full" style={{ background: "linear-gradient(to right, #E0E7FF, #A5B4FC, #818CF8, #4F46E5, #312E81)" }} />
                        <div className="flex justify-between text-[11px] font-mono-nums text-[#6B7280] mt-0.5"><span>0m</span><span>50m</span><span>100m+</span></div>
                      </div>
                    )}
                    {buildingColorMode === "match" && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-1">Parcel Match Status</div>
                        {Object.entries(MATCH_COLORS).map(([k, c]) => (
                          <div key={k} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} /><span className="text-[#0F172A] capitalize">{k.replace(/_/g, " ").toLowerCase()}</span></div>
                        ))}
                      </div>
                    )}
                    {buildingColorMode === "floors" && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-1">Estimated Floors</div>
                        <div className="h-2 rounded-full" style={{ background: "linear-gradient(to right, #E0E7FF, #A5B4FC, #6366F1, #4338CA, #312E81)" }} />
                        <div className="flex justify-between text-[11px] font-mono-nums text-[#6B7280] mt-0.5"><span>1</span><span>10</span><span>20+</span></div>
                      </div>
                    )}
                    <Separator className="bg-[#E5E7EB] my-1" />
                    <div className="flex items-center gap-2"><span className="w-3 h-3 border border-[#4F46E5] bg-[#EEF2FF] rounded-sm" /><span className="text-[#0F172A]">Cadastral Parcel</span></div>
                    <div className="flex items-center gap-2"><span className="w-3 h-1 bg-[#94A3B8] rounded" /><span className="text-[#0F172A]">Road Network</span></div>
                  </>
                )}
                <Separator className="bg-[#E5E7EB] my-1" />
                <div className="flex items-center gap-2"><span className="w-3 h-3 border border-dashed border-[#4F46E5]" style={{ background: "rgba(79,70,229,0.08)" }} /><span className="text-[#0F172A]">Pilot AOI (6.66 km²)</span></div>
              </div>
            </div>
          )}

          {!showLegend && (
            <button
              className="absolute bottom-3 left-3 z-10 h-8 px-3 rounded-xl bg-white border border-[#E5E7EB] text-xs font-medium text-[#0F172A] hover:bg-[#F9FAFB] shadow-card cursor-pointer focus-ring"
              onClick={() => setShowLegend(true)}
            >
              Show Legend
            </button>
          )}

          {/* Minimap (floating bottom right) */}
          <div className="absolute bottom-3 right-3 z-10 w-[160px] h-[110px] rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-card bg-white">
            <div ref={minimapContainer} style={{ width: "100%", height: "100%" }} />
            <div className="absolute top-1.5 left-1.5 text-[11px] font-semibold text-[#0F172A] bg-white/90 backdrop-blur px-1.5 py-0.5 rounded shadow-xs">Overview</div>
          </div>

          {/* Measurement readout banner */}
          {measureMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-medium shadow-floating flex items-center gap-3">
              <Ruler className="w-4 h-4 text-[#818CF8]" />
              <span>{measurePoints.length} points</span>
              {measureDistance !== null && <span>· {measureDistance < 1000 ? `${measureDistance.toFixed(1)} m` : `${(measureDistance / 1000).toFixed(2)} km`}</span>}
              {measureArea !== null && <span>· {measureArea < 10000 ? `${measureArea.toFixed(0)} m²` : `${(measureArea / 10000).toFixed(2)} ha`}</span>}
              <button className="ml-2 px-2.5 py-1 bg-white text-[#0F172A] rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer" onClick={finishMeasure}>Done</button>
              <button className="px-2.5 py-1 bg-[#B91C1C] text-white rounded-lg text-xs font-medium hover:bg-red-700 cursor-pointer" onClick={clearMeasure}>Clear</button>
            </div>
          )}

          {/* Drawing hint banner */}
          {drawMode !== "none" && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-medium shadow-floating flex items-center gap-3">
              <PenTool className="w-4 h-4 text-[#818CF8]" />
              <span>Drawing {drawMode} ({drawPoints.length} points). Double click to finish.</span>
              <button className="ml-2 px-2.5 py-1 bg-white text-[#0F172A] rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer" onClick={finishDraw}>Done</button>
              <button className="px-2.5 py-1 bg-[#B91C1C] text-white rounded-lg text-xs font-medium hover:bg-red-700 cursor-pointer" onClick={cancelDraw}>Cancel</button>
            </div>
          )}

          {/* Compare pick indicator */}
          {comparePickMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-medium shadow-floating flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-[#818CF8]" /> Pick building {comparePickMode} — click on map
            </div>
          )}

          {/* Tour indicator */}
          {tourActive && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-medium shadow-floating flex items-center gap-3">
              <Trophy className="w-4 h-4 text-[#FBBF24]" /> Tour {tourIndex + 1}/{tourBuildings.length}
              <button className="px-2.5 py-1 bg-white text-[#0F172A] rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer" onClick={() => setTourActive(false)}>Stop</button>
            </div>
          )}

          {/* Toast */}
          {showShareToast && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-[#0F172A] text-xs font-medium shadow-floating">
              {(window as any).__toastMsg || "Copied to clipboard"}
            </div>
          )}
        </div>

        {/* ── RIGHT INSPECTOR DRAWER (WHEN A FEATURE IS SELECTED) ── */}
        {selected && (
          <aside className="w-80 md:w-96 shrink-0 bg-white border-l border-[#E5E7EB] flex flex-col z-20 min-h-0 shadow-floating animate-in slide-in-from-right-2 duration-150">
            <FeatureInspector
              selected={selected}
              activeColony={activeColony}
              floors={floors || []}
              floorsLoading={floorsLoading}
              parcelBuildings={parcelBuildings || []}
              parcelBuildingsLoading={parcelBuildingsLoading}
              previousParcel={previousParcel}
              onClose={() => {
                setSelected(null);
                setPreviousParcel(null);
                useViewerStore.setState({ selectedMapBuilding: null });
                if (mapRef.current?.loaded()) {
                  try {
                    mapRef.current.removeFeatureState({ source: "buildings" });
                    mapRef.current.removeFeatureState({ source: "parcels" });
                  } catch { /* noop */ }
                }
              }}
              onBackToParcel={backToParcel}
              onSelectBuilding={(b) => selectBuildingFromParcelList(b)}
              onOpen3D={handleOpen3DFromSelected}
              onDownloadGeoJSON={(data, filename) => downloadGeoJSON(data, filename)}
            />
          </aside>
        )}
      </div>

      {/* ═══ BOTTOM STATUS BAR ═══ */}
      <StatusBar zoom={zoom} mouseCoords={mouseCoords} attribution="© OpenStreetMap contributors © CARTO © KSRSAC · SIH26011" />

      {/* ═══ GLOBAL COMMAND PALETTE (⌘K) ═══ */}
      <CommandPalette
        open={cmdPaletteOpen}
        onOpenChange={setCmdPaletteOpen}
        onSelectColony={(colonyName) => {
          const found = COLONIES.find(c => c.name.toLowerCase() === colonyName.toLowerCase());
          if (found) enterColony(found);
        }}
        onSearchQuery={(q) => handleSearch(q)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      {/* ═══ KEYBOARD SHORTCUTS MODAL (?) ═══ */}
      <ShortcutsModal
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
      {/* ═══ MODALS ═══ */}

      {/* Intro dialog */}
      {showIntro && (
        <ModalOverlay onClose={() => setShowIntro(false)}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-emerald-500 flex items-center justify-center"><Box className="w-6 h-6 text-slate-900" /></div>
              <div><div className="text-lg font-bold">3D ULPIN Bengaluru</div><div className="text-xs text-slate-500">SIH 2026 · PS-26011 · Phase 1 Prototype</div></div>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              This viewer demonstrates vertical property mapping for a Bengaluru pilot AOI. It integrates
              BBMP cadastral parcels, OSM building footprints, and 3D-GloBFP ML-estimated heights to generate
              prototype vertical ULPIN codes (floor-level).
            </p>
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 space-y-1">
              <div className="font-semibold flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Honesty Disclaimers</div>
              <ul className="space-y-0.5 list-disc list-inside text-amber-700/80">
                <li>Heights are ML-estimated (3D-GloBFP, 2020) — NOT surveyed.</li>
                <li>OSM footprints are community data — NOT legal parcels.</li>
                <li>Internal prototype IDs are NOT official ULPINs.</li>
                <li>Cadastral legal status is NOT verified in Phase 1.</li>
              </ul>
            </div>
            <div className="text-xs text-slate-500">Click parcels/buildings to inspect. Use the left panel to toggle layers, color modes, and tools.</div>
            <Button className="w-full" onClick={() => setShowIntro(false)}>Start exploring</Button>
          </div>
        </ModalOverlay>
      )}

      {/* Disclaimers dialog */}
      {showDisclaimers && (
        <ModalOverlay onClose={() => setShowDisclaimers(false)} title="Honesty Disclaimers & Data Provenance" icon={ShieldAlert}>
          <div className="space-y-3">
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
              <div className="text-sm font-semibold text-amber-700 mb-2">Phase 1 Limitations</div>
              <ul className="space-y-1.5 text-xs text-amber-100/90 list-disc list-inside">
                {stats?.honesty_disclaimers.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800 mb-2">Data Sources & Legal Status</div>
              <div className="space-y-2">
                {stats?.data_sources.map((s, i) => (
                  <div key={i} className="p-2 rounded-md bg-slate-100/80 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900">{s.name}</span>
                      <Badge variant="outline" className="text-xs border-slate-400 text-slate-500">{s.legal_status}</Badge>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{s.source}</div>
                    <div className="text-xs text-slate-500">License: {s.license}</div>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 hover:underline mt-1 inline-block">{s.url} ↗</a>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-md bg-slate-100/80 border border-slate-200">
              <div className="text-sm font-semibold text-slate-800 mb-1">Prototype ID Scheme</div>
              <div className="font-mono text-[11px] text-amber-600 bg-white/60 p-2 rounded">{stats?.id_scheme.format}</div>
              <div className="text-[11px] text-slate-500 mt-1">Example: <span className="font-mono text-amber-600">{stats?.id_scheme.example}</span></div>
              <div className="text-xs text-slate-500 mt-1">{stats?.id_scheme.note}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(stats?.id_scheme.use_classes || {}).map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-xs border-slate-400 text-slate-700">{k} = {v}</Badge>
                ))}
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Keyboard help */}
      {showKeyboardHelp && (
        <ModalOverlay onClose={() => setShowKeyboardHelp(false)} title="Keyboard & Mouse" icon={HelpCircle}>
          <div className="space-y-2 text-sm">
            {[
              ["Click", "Select a feature (parcel / building / road)"],
              ["Hover", "Show quick-info popup"],
              ["Scroll", "Zoom in / out"],
              ["Right-drag", "Rotate view (pitch)"],
              ["Ctrl + drag", "Tilt view"],
              ["Shift + drag", "Box zoom"],
              ["B", "Toggle basemap menu"],
              ["L", "Toggle layers panel"],
              ["P", "Toggle right panel"],
              ["3", "Toggle 3D extrusion"],
              ["H", "Toggle heatmap"],
              ["M", "Toggle measurement tool"],
              ["+ / -", "Zoom in / out"],
              ["0", "Reset to AOI center"],
              ["Esc", "Clear selection / close dialogs"],
            ].map(([k, d]) => (
              <div key={k} className="flex items-center gap-3">
                <kbd className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[11px] font-mono text-slate-800 min-w-[80px] text-center">{k}</kbd>
                <span className="text-slate-500 text-xs">{d}</span>
              </div>
            ))}
          </div>
        </ModalOverlay>
      )}

      {/* Fly to dialog */}
      {showFlyToDialog && (
        <ModalOverlay onClose={() => { setShowFlyToDialog(false); setFlyToError(""); }} title="Fly to Coordinates" icon={Crosshair} maxWidth="max-w-md">
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Enter longitude, latitude within the pilot AOI (77.4–77.9°E, 12.8–13.15°N).</p>
            <Input value={flyToInput} onChange={(e) => setFlyToInput(e.target.value)} placeholder="77.635, 12.975"
              onKeyDown={(e) => { if (e.key === "Enter") handleFlyTo(); }} className="bg-slate-100 border-slate-300" />
            {flyToError && <div className="text-xs text-red-600">{flyToError}</div>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { mapRef.current?.flyTo({ center: AOI_CENTER, zoom: 14, duration: 1500 }); setShowFlyToDialog(false); }}>Reset to AOI center</Button>
              <Button className="flex-1" onClick={handleFlyTo}>Fly</Button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Draw dialog */}
      {showDrawDialog && (
        <ModalOverlay onClose={cancelDraw} title="Draw Feature" icon={PenTool} maxWidth="max-w-md">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(["point", "line", "polygon"] as const).map(m => (
                <button key={m} className={cn("flex flex-col items-center gap-1 py-3 rounded-md border-2 transition",
                  drawMode === m ? "border-violet-500 bg-violet-500/10 text-violet-600" : "border-slate-300 bg-slate-100/70 text-slate-500 hover:border-slate-400")}
                  onClick={() => { setDrawMode(m); setDrawPoints([]); updateDrawCurrentLayer([]); }}>
                  {m === "point" ? <Circle className="w-5 h-5" /> : m === "line" ? <RulerIcon className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  <span className="text-xs capitalize">{m}</span>
                </button>
              ))}
            </div>
            {drawMode !== "none" && (
              <>
                <p className="text-xs text-slate-500">Click on the map to add points. When done, click "Finish".</p>
                <Input value={drawLabel} onChange={(e) => setDrawLabel(e.target.value)} placeholder="Label (optional)" className="bg-slate-100 border-slate-300" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={cancelDraw}>Cancel</Button>
                  <Button className="flex-1" onClick={finishDraw}>Finish ({drawPoints.length} pts)</Button>
                </div>
              </>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* Buffer dialog */}
      {showBufferDialog && (
        <ModalOverlay onClose={() => { setShowBufferDialog(false); clearBuffer(); }} title="Buffer Analysis" icon={Target} maxWidth="max-w-md">
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Click on the map to set the buffer center, then adjust radius and run.</p>
            <div className="p-2 rounded bg-slate-100/80 text-xs">
              {bufferCenter ? <span className="text-slate-800">Center: <span className="font-mono">{bufferCenter[0].toFixed(5)}, {bufferCenter[1].toFixed(5)}</span></span> : <span className="text-amber-600">No center selected — click map</span>}
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Radius</span><span className="text-slate-800">{bufferRadius} m</span></div>
              <Slider value={[bufferRadius]} min={10} max={1000} step={10} onValueChange={(v) => { setBufferRadius(v[0]); if (bufferCenter) { const c = makeCircleGeoJSON(bufferCenter, v[0]); (mapRef.current?.getSource("buffer-circle") as maplibregl.GeoJSONSource)?.setData({ type: "FeatureCollection", features: [c] }); } }} />
            </div>
            <Button className="w-full" onClick={runBuffer} disabled={!bufferCenter || bufferLoading}>
              {bufferLoading ? "Analyzing…" : `Find buildings within ${bufferRadius}m`}
            </Button>
            {bufferBuildings.length > 0 && (
              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700">
                Found <b>{bufferBuildings.length}</b> buildings within {bufferRadius}m.
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* Compare dialog */}
      {showCompareDialog && (
        <ModalOverlay onClose={() => { setShowCompareDialog(false); setComparePickMode(null); }} title="Compare Two Buildings" icon={ArrowLeftRight} maxWidth="max-w-lg">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {(["A", "B"] as const).map(slot => {
                const b = slot === "A" ? compareBuildingA : compareBuildingB;
                return (
                  <div key={slot} className="p-3 rounded-md bg-slate-100/80 border border-slate-200 min-h-[120px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-800">Building {slot}</span>
                      {b && <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500" onClick={() => slot === "A" ? setCompareBuildingA(null) : setCompareBuildingB(null)}><X className="w-3 h-3" /></Button>}
                    </div>
                    {b ? (
                      <div className="space-y-1 text-xs">
                        <div className="font-mono text-amber-600 break-all">{b.display_code || b.object_uuid?.slice(0, 8)}</div>
                        <div className="flex justify-between"><span className="text-slate-500">Height</span><span className="text-sky-600">{fmtVal(b.height_m)}m</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Floors</span><span className="text-emerald-600">{fmtVal(b.floors)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Confidence</span><span className="text-amber-600">{Math.round((b.confidence_score || 0) * 100)}%</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Match</span><span className="text-slate-700 text-xs">{b.match_status?.replace(/_/g, " ")}</span></div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => startComparePick(slot)}>Pick on map</Button>
                    )}
                  </div>
                );
              })}
            </div>
            {compareBuildingA && compareBuildingB && (
              <div className="p-3 rounded-md bg-slate-100/80 border border-slate-200">
                <div className="text-xs text-slate-500 mb-2">Comparison</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Height difference</span><span className="text-slate-800">{Math.abs((compareBuildingA.height_m || 0) - (compareBuildingB.height_m || 0)).toFixed(1)}m</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Floor difference</span><span className="text-slate-800">{Math.abs((compareBuildingA.floors || 0) - (compareBuildingB.floors || 0))} floors</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Confidence difference</span><span className="text-slate-800">{Math.abs(Math.round((compareBuildingA.confidence_score || 0) * 100) - Math.round((compareBuildingB.confidence_score || 0) * 100))}%</span></div>
                </div>
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* Format demonstration importers menu */}
      {showFormatDialog === "menu" && (
        <ModalOverlay onClose={() => setShowFormatDialog(null)} title="Format Demonstration Importers" icon={Boxes} maxWidth="max-w-2xl">
          <div className="space-y-3">
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-1">FORMAT DEMONSTRATION — NON-CO-LOCATED SAMPLES</div>
                These are real files from other locations, used to prove the software can parse each format.
                They are <b>NOT</b> co-located with the Bengaluru pilot AOI and must never be rendered over the live parcels.
                Exact-AOI data requires authorised access (BDA/BBMP/KSRSAC/SOI).
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-[#1D4ED8] flex items-start gap-2">
              <Database className="w-4 h-4 shrink-0 mt-0.5 text-[#1D4ED8]" />
              <div>
                <div className="font-semibold mb-1">PROTOTYPE BENGALURU AOI — PUBLIC RESEARCH DATA (LoD1 ESTIMATED)</div>
                The prototype map combines 4 open datasets: BBMP cadastral (KSRSAC via OpenCity), OSM buildings/roads, 3D-GloBFP heights (2020 ML model), and Copernicus GLO-30 DSM. Clipped to pilot AOI (77.605–77.665°E, 12.955–12.995°N).
              </div>
            </div>
            <div className="p-3 rounded-md bg-slate-500/10 border border-slate-400/30 text-xs text-slate-600 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-1">PLANNED AUTHORISED INTEGRATION — DATA NOT YET AVAILABLE</div>
                Exact-AOI drone imagery, LiDAR point clouds, sanctioned floor plans, and CORS GNSS observations require authorised access from BDA/BBMP/KSRSAC/SOI. Request templates are in the handoff documents.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_IMPORTERS.map(imp => {
                const Icon = imp.icon;
                return (
                  <button key={imp.id} className="text-left p-3 rounded-md bg-slate-100/80 border border-slate-200 hover:border-sky-500/50 hover:bg-slate-100 transition"
                    onClick={() => setShowFormatDialog(imp.id)}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-5 h-5 text-sky-600" />
                      <span className="text-sm font-semibold text-slate-900">{imp.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{imp.place}</div>
                    <div className="text-xs text-slate-500 font-mono truncate">{imp.file}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Individual format importer detail */}
      {showFormatDialog && showFormatDialog !== "menu" && (() => {
        const imp = FORMAT_IMPORTERS.find(i => i.id === showFormatDialog); if (!imp) return null;
        const Icon = imp.icon;
        return (
          <ModalOverlay onClose={() => setShowFormatDialog("menu")} title={imp.name} icon={Icon} maxWidth="max-w-lg">
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700">
                <div className="font-semibold mb-1">FORMAT DEMONSTRATION — NON-CO-LOCATED SAMPLE</div>
                <div>{imp.status}</div>
              </div>
              <div className="space-y-1.5 text-sm">
                <Row label="File" value={imp.file} mono />
                <Row label="Place" value={imp.place} />
                <Row label="Provider" value={imp.provider} />
                <Row label="CRS" value={imp.crs} mono />
                <Row label="Date" value={imp.date} />
                <Row label="Co-located with pilot" value="No" />
                {imp.rera && <Row label="RERA Number" value={imp.rera} mono />}
                {imp.lat !== undefined && <Row label="Latitude" value={String(imp.lat)} mono />}
                {imp.lng !== undefined && <Row label="Longitude" value={String(imp.lng)} mono />}
                {imp.elev !== undefined && <Row label="Elevation (m)" value={String(imp.elev)} mono />}
              </div>
              <a href={imp.url} target="_blank" rel="noopener noreferrer" className="block w-full text-center py-2 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-600 text-sm hover:bg-sky-500/30 transition">
                Open source ↗
              </a>

              {/* Format-specific demonstration */}
              {imp.id === "uav" && (
                <div className="p-3 rounded-md bg-slate-100/80 border border-slate-200">
                  <div className="text-xs font-semibold text-slate-800 mb-1">Importer Capability</div>
                  <div className="text-[11px] text-slate-500">Parses GeoTIFF metadata: CRS, bounds, resolution, band count. Would orthorectify and overlay on basemap. The Uttari tile is ~12 km north of the pilot AOI.</div>
                </div>
              )}
              {imp.id === "lidar" && (
                <div className="p-3 rounded-md bg-slate-100/80 border border-slate-200">
                  <div className="text-xs font-semibold text-slate-800 mb-1">Importer Capability</div>
                  <div className="text-[11px] text-slate-500">Parses PCD/LAS point clouds: point count, classification, density. Would classify ground vs non-ground and derive precise building heights (replacing ML estimates). IIT-H dataset is in Hyderabad.</div>
                </div>
              )}
              {imp.id === "floorplan" && (
                <div className="p-3 rounded-md bg-slate-100/80 border border-slate-200">
                  <div className="text-xs font-semibold text-slate-800 mb-1">Importer Capability</div>
                  <div className="text-[11px] text-slate-500">Extracts floor-plan geometry from PDF: unit boundaries, floor labels, use classes. Would replace derived floor estimates with sanctioned plans. Validate on <a href="https://rera.karnataka.gov.in/viewAllProjects?language=en" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">KRERA portal ↗</a> before relying.</div>
                </div>
              )}
              {imp.id === "gnss" && (
                <div className="p-3 rounded-md bg-slate-100/80 border border-slate-200">
                  <div className="text-xs font-semibold text-slate-800 mb-1">Importer Capability</div>
                  <div className="text-[11px] text-slate-500">Parses IGS station log/XML: published coordinates, antenna, receiver, epoch. Provides cm-level control — but IISC00IND is a reference station, not parcel-corner survey. For parcel corners, register at <a href="https://cors.surveyofindia.gov.in/" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">SOI CORS ↗</a>.</div>
                </div>
              )}

              <button className="w-full text-center py-1.5 text-xs text-slate-500 hover:text-slate-800" onClick={() => setShowFormatDialog("menu")}>← Back to importers</button>
            </div>
          </ModalOverlay>
        );
      })()}
    </div>
  );
}

// ─── Reusable: modal overlay ──────────────────────────────────────────────
function ModalOverlay({ children, onClose, title, icon: Icon, maxWidth = "max-w-md" }: {
  children: React.ReactNode; onClose: () => void; title?: string; icon?: any; maxWidth?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={cn("w-full rounded-xl bg-white border border-slate-300 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col min-h-0", maxWidth)} onClick={e => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between px-4 h-12 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              {Icon && <Icon className="w-4 h-4 text-sky-600" />} {title}
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-700"><X className="w-4 h-4" /></button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto custom-scroll min-h-0">
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable: key-value row ──────────────────────────────────────────────
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={cn("text-slate-800 text-right break-all", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
