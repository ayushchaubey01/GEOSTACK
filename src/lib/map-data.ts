/**
 * Types + loader for the pre-processed Bengaluru map data.
 *
 * The data is split into two files:
 *  - /data/demo-buildings.json — 57 named apartment buildings (12 KB, loads instantly)
 *  - /data/all-buildings.json — all 33k buildings + roads (7 MB, lazy-loaded for context)
 */

export interface MapBuildingFeature {
  id: number;
  /** Polygon coordinates [lng, lat][] (simplified, rounded to 5 dp). */
  c: [number, number][];
  /** Centroid [lng, lat]. */
  ce: [number, number];
  /** Height in meters. */
  h: number;
  /** Floor count. */
  f: number;
  /** Building name (if any). */
  n: string | null;
  /** Building type: 'apartments' | 'house' | 'commercial' | etc. */
  t: string | null;
  /** Parent parcel code (ULPIN-like). */
  pc: string | null;
}

export interface MapRoad {
  /** Coordinates [lng, lat][]. */
  c: [number, number][];
  /** Road name (if any). */
  n: string | null;
  /** Highway type: 'primary' | 'secondary' | 'service' | etc. */
  h: string | null;
}

export interface MapAOI {
  west: number;
  south: number;
  east: number;
  north: number;
  center: [number, number];
}

export interface DemoBuildingsData {
  aoi: MapAOI;
  demoBuildings: MapBuildingFeature[];
  stats: {
    totalBuildings: number;
    demoBuildings: number;
    roads: number;
  };
}

export interface AllBuildingsData {
  aoi: MapAOI;
  roads: MapRoad[];
  buildings: MapBuildingFeature[];
}

let demoCache: DemoBuildingsData | null = null;
let allCache: AllBuildingsData | null = null;

/** Load the 57 demo buildings (fast, 12 KB). */
export async function loadDemoBuildings(): Promise<DemoBuildingsData> {
  if (demoCache) return demoCache;
  const res = await fetch('/data/demo-buildings.json');
  demoCache = await res.json();
  return demoCache;
}

/** Load all 33k buildings + roads (slow, 7 MB, lazy-loaded). */
export async function loadAllBuildings(): Promise<AllBuildingsData> {
  if (allCache) return allCache;
  const res = await fetch('/data/all-buildings.json');
  allCache = await res.json();
  return allCache;
}
