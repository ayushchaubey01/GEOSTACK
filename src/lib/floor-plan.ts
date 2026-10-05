/**
 * floor-plan.ts
 *
 * Deterministic, data-driven floor plan engine:
 * - Computes exact metric geometry for residential, parking, and utility floors
 * - Proportional flat sizing matching built-up area data
 * - Core continuity with clamped drift (+/- 1.5m)
 * - LRU memoization cache (cap 64)
 */

import type { Floor, Unit } from './building-data';

export interface Rect {
  x: number; // center x in floor-local coordinates
  z: number; // center z in floor-local coordinates
  w: number; // width
  d: number; // depth
}

export interface LiftShaft {
  id: string;
  rect: Rect;
}

export interface StairTread {
  z: number;
  width: number;
}

export interface StairCase {
  rect: Rect;
  treads: StairTread[];
}

export interface CorePart {
  rect: Rect; // 3 x 5 m centered in spine (z in [-2.5, 2.5])
  lifts: [LiftShaft, LiftShaft];
  stairs: StairCase;
  lobby: Rect;
}

export interface WindowOpening {
  wall: 'north' | 'south' | 'east' | 'west';
  pos: [number, number, number]; // [x, y, z] center of window opening
  width: number;
  height: number;
}

export interface BalconySpec {
  side: 'north' | 'south';
  x: number; // center x
  w: number; // width
}

export interface RoomPartition {
  p1: [number, number]; // [x, z] start
  p2: [number, number]; // [x, z] end
  doorGap?: { start: number; end: number }; // gap offset along segment
}

export interface FlatPlan {
  unitId: string;
  slot: 'NE' | 'NW' | 'SW' | 'SE';
  rect: Rect; // x, z, w, d
  doorWall: 'spine';
  door: {
    pos: [number, number, number]; // [x, y, z]
    width: number;
    height: number;
  };
  windows: WindowOpening[];
  balcony?: BalconySpec;
  rooms: RoomPartition[];
}

export interface ParkingBay {
  slotId: string;
  displayId: string;
  rect: Rect; // 2.5 x 5.0 m
  occupiedDemo: boolean;
  yaw: number; // small seeded angle in radians (~ +/- 2 deg)
  carColor?: string;
}

export interface UtilityRoom {
  name: string;
  rect: Rect;
}

export interface FloorPlan {
  signature: string;
  plate: { w: number; d: number };
  spine: Rect;
  core: CorePart;
  corridors: Rect[];
  flats: FlatPlan[];
  bays: ParkingBay[];
  aisle?: Rect;
  ramp?: Rect & { label: string };
  utilityRooms?: UtilityRoom[];
  usedArea: number;
  commonArea: number;
  areaScale: number; // 1 = true to scale, < 1 if clamped
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/* Shared Dimensional Constants                                       */
/* ------------------------------------------------------------------ */

export const FLOOR_DIMENSIONS = {
  width: 20.0,
  depth: 16.0,
  height: 3.0,
  slabThickness: 0.22,
  wallHeight: 2.78, // 3.0 - 0.22
  wallThickness: 0.14,
  coreWidth: 3.0,
  coreDepth: 5.0,
  doorWidth: 0.9,
  doorHeight: 2.1,
  windowHeight: 1.3,
  windowSillHeight: 0.85,
} as const;

export const SLAB_T = FLOOR_DIMENSIONS.slabThickness;
export const WALL_H = FLOOR_DIMENSIONS.wallHeight;
export const WALL_T = FLOOR_DIMENSIONS.wallThickness;
export const DOOR_W = FLOOR_DIMENSIONS.doorWidth;
export const DOOR_H = FLOOR_DIMENSIONS.doorHeight;

/* ------------------------------------------------------------------ */
/* LRU Cache                                                          */
/* ------------------------------------------------------------------ */

const planCache = new Map<string, FloorPlan>();
const CACHE_CAP = 64;

export function clearFloorPlanCache() {
  planCache.clear();
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/* ------------------------------------------------------------------ */
/* Helper to Generate Core Components                                 */
/* ------------------------------------------------------------------ */

function buildCore(spineX: number): CorePart {
  // Core is 3 x 5 m centered in spine (z in [-2.5, 2.5])
  const coreRect: Rect = { x: spineX, z: 0, w: 3.0, d: 5.0 };

  // 2 Lift shafts on north half (z in [-2.5, 0])
  const liftWest: LiftShaft = {
    id: 'lift-w',
    rect: { x: spineX - 0.75, z: -1.25, w: 1.25, d: 2.2 },
  };
  const liftEast: LiftShaft = {
    id: 'lift-e',
    rect: { x: spineX + 0.75, z: -1.25, w: 1.25, d: 2.2 },
  };

  // 1 Stair with treads on south half (z in [0, 2.5])
  const stairRect: Rect = { x: spineX, z: 1.25, w: 2.7, d: 2.2 };
  const treads: StairTread[] = [];
  const treadCount = 7;
  const treadDepth = 2.0 / treadCount;
  for (let i = 0; i < treadCount; i++) {
    treads.push({
      z: 0.25 + i * treadDepth,
      width: 2.5,
    });
  }

  // Lobby is the central landing area between lifts and stairs
  const lobby: Rect = { x: spineX, z: 0, w: 2.8, d: 1.0 };

  return {
    rect: coreRect,
    lifts: [liftWest, liftEast],
    stairs: { rect: stairRect, treads },
    lobby,
  };
}

/* ------------------------------------------------------------------ */
/* Layout Engine: getFloorPlan                                        */
/* ------------------------------------------------------------------ */

export function getFloorPlan(
  floor: Floor,
  footprint?: { width: number; depth: number }
): FloorPlan {
  const W = footprint?.width || FLOOR_DIMENSIONS.width;
  const D = footprint?.depth || FLOOR_DIMENSIONS.depth;
  const usage = floor.usage || (floor.isUnderground ? (floor.floorNumber === -1 ? 'parking' : 'utility') : 'residential');

  // Compute cache key signature: areas rounded to 0.1 + usage + plate size
  let signature = '';
  if (usage === 'parking') {
    const occ = floor.units.map((u) => (u.occupiedDemo ? '1' : '0')).join('');
    signature = `pkg:${W.toFixed(1)}x${D.toFixed(1)}:${occ}`;
  } else if (usage === 'utility') {
    signature = `utl:${W.toFixed(1)}x${D.toFixed(1)}`;
  } else {
    // Residential: areas rounded to 0.1 + plate size
    const areas = floor.units.map((u) => u.builtUpArea.toFixed(1)).join(';');
    signature = `res:${W.toFixed(1)}x${D.toFixed(1)}:${areas}`;
  }

  // Check cache
  const cached = planCache.get(signature);
  if (cached) {
    // Move to end of Map for LRU
    planCache.delete(signature);
    planCache.set(signature, cached);
    return cached;
  }

  let plan: FloorPlan;

  if (usage === 'parking') {
    plan = buildParkingPlan(floor, W, D, signature);
  } else if (usage === 'utility') {
    plan = buildUtilityPlan(floor, W, D, signature);
  } else {
    plan = buildResidentialPlan(floor, W, D, signature);
  }

  // Enforce LRU cap
  if (planCache.size >= CACHE_CAP) {
    const oldestKey = planCache.keys().next().value;
    if (oldestKey !== undefined) {
      planCache.delete(oldestKey);
    }
  }
  planCache.set(signature, plan);

  return plan;
}

/* ------------------------------------------------------------------ */
/* Residential Plan Generator                                         */
/* ------------------------------------------------------------------ */

function buildResidentialPlan(
  floor: Floor,
  W: number,
  D: number,
  signature: string
): FloorPlan {
  const warnings: string[] = [];
  let areaScale = 1.0;

  const spineWidth = FLOOR_DIMENSIONS.coreWidth; // 3.0 m
  const totalUsableWidth = W - spineWidth; // 17.0 m for 20m plate

  // Flat slots order: units[0]=NE, units[1]=NW, units[2]=SW, units[3]=SE
  const uNE = floor.units[0];
  const uNW = floor.units[1];
  const uSW = floor.units[2];
  const uSE = floor.units[3];

  const aNE = uNE?.builtUpArea || 68;
  const aNW = uNW?.builtUpArea || 68;
  const aSW = uSW?.builtUpArea || 68;
  const aSE = uSE?.builtUpArea || 68;

  const aEast = aNE + aSE;
  const aWest = aNW + aSW;
  const aTotal = aEast + aWest;

  // Proportional column widths
  const idealWestW = totalUsableWidth * (aWest / aTotal);
  const idealEastW = totalUsableWidth * (aEast / aTotal);

  // Spine drift = (idealWestW - idealEastW) / 2
  let spineDrift = (idealWestW - idealEastW) / 2;
  if (Math.abs(spineDrift) > 1.5) {
    warnings.push(`Spine drift ${spineDrift.toFixed(2)}m clamped to +/-1.5m`);
    spineDrift = clamp(spineDrift, -1.5, 1.5);
    areaScale = Math.min(areaScale, 0.95);
  }

  // Actual column widths
  const westW = totalUsableWidth / 2 + spineDrift;
  const eastW = totalUsableWidth / 2 - spineDrift;

  // Actual flat depths
  let depthNE = D * (aNE / aEast);
  let depthSE = D * (aSE / aEast);
  let depthNW = D * (aNW / aWest);
  let depthSW = D * (aSW / aWest);

  // Depth clamping [3.5, 12.0] m
  if (depthNE < 3.5 || depthNE > 12.0) {
    warnings.push(`NE flat depth ${depthNE.toFixed(2)}m clamped to [3.5, 12.0]m`);
    depthNE = clamp(depthNE, 3.5, 12.0);
    depthSE = D - depthNE;
    areaScale = Math.min(areaScale, 0.95);
  }
  if (depthNW < 3.5 || depthNW > 12.0) {
    warnings.push(`NW flat depth ${depthNW.toFixed(2)}m clamped to [3.5, 12.0]m`);
    depthNW = clamp(depthNW, 3.5, 12.0);
    depthSW = D - depthNW;
    areaScale = Math.min(areaScale, 0.95);
  }

  const spineRect: Rect = {
    x: spineDrift,
    z: 0,
    w: spineWidth,
    d: D,
  };

  const core = buildCore(spineDrift);

  // Corridors north & south of core in the spine
  const corridors: Rect[] = [
    { x: spineDrift, z: -(D / 2 + 2.5) / 2, w: spineWidth, d: D / 2 - 2.5 },
    { x: spineDrift, z: (D / 2 + 2.5) / 2, w: spineWidth, d: D / 2 - 2.5 },
  ];

  // Helper to construct FlatPlan
  const buildFlat = (
    u: Unit | undefined,
    slot: 'NE' | 'NW' | 'SW' | 'SE',
    xMin: number,
    xMax: number,
    zMin: number,
    zMax: number
  ): FlatPlan => {
    const w = xMax - xMin;
    const d = zMax - zMin;
    const cx = (xMin + xMax) / 2;
    const cz = (zMin + zMax) / 2;
    const isNorth = slot === 'NE' || slot === 'NW';
    const isEast = slot === 'NE' || slot === 'SE';

    // Door position on inner wall facing spine
    const doorX = isEast ? xMin : xMax;
    // Keep door outside core z-range [-2.5, 2.5] if possible
    let doorZ: number;
    if (isNorth) {
      doorZ = clamp(cz, zMin + 0.6, Math.min(zMax - 0.6, -2.6));
    } else {
      doorZ = clamp(cz, Math.max(zMin + 0.6, 2.6), zMax - 0.6);
    }

    // Windows on outer walls
    const windows: WindowOpening[] = [];
    const winNSW = clamp(0.45 * w, 1.6, 3.6);
    const winEWW = clamp(0.45 * d, 1.6, 3.6);

    // Outer N/S window
    windows.push({
      wall: isNorth ? 'north' : 'south',
      pos: [cx, FLOOR_DIMENSIONS.windowSillHeight + FLOOR_DIMENSIONS.windowHeight / 2, isNorth ? zMin : zMax],
      width: winNSW,
      height: FLOOR_DIMENSIONS.windowHeight,
    });
    // Outer E/W window
    windows.push({
      wall: isEast ? 'east' : 'west',
      pos: [isEast ? xMax : xMin, FLOOR_DIMENSIONS.windowSillHeight + FLOOR_DIMENSIONS.windowHeight / 2, cz],
      width: winEWW,
      height: FLOOR_DIMENSIONS.windowHeight,
    });

    // Balcony on outer N/S wall
    const balconyW = Math.min(5.0, 0.6 * w);
    const balcony: BalconySpec = {
      side: isNorth ? 'north' : 'south',
      x: cx,
      w: balconyW,
    };

    // Rooms / partitions based on bedrooms (1 BHK: 1, 2 BHK: 2, 3 BHK: 3)
    const rooms: RoomPartition[] = [];
    const bhk = u?.bedrooms || 2;
    const partitionCount = clamp(bhk, 1, 3);

    for (let p = 1; p <= partitionCount; p++) {
      const frac = p / (partitionCount + 1);
      if (d >= w) {
        // Flat is longer in Z -> split along Z
        const pz = zMin + d * frac;
        rooms.push({
          p1: [xMin, pz],
          p2: [xMax, pz],
          doorGap: { start: w * 0.4, end: w * 0.4 + 0.9 },
        });
      } else {
        // Flat is wider in X -> split along X
        const px = xMin + w * frac;
        rooms.push({
          p1: [px, zMin],
          p2: [px, zMax],
          doorGap: { start: d * 0.4, end: d * 0.4 + 0.9 },
        });
      }
    }

    return {
      unitId: u?.unitId || `U-${slot}`,
      slot,
      rect: { x: cx, z: cz, w, d },
      doorWall: 'spine',
      door: {
        pos: [doorX, FLOOR_DIMENSIONS.doorHeight / 2, doorZ],
        width: FLOOR_DIMENSIONS.doorWidth,
        height: FLOOR_DIMENSIONS.doorHeight,
      },
      windows,
      balcony,
      rooms,
    };
  };

  // Build each quadrant
  // West column: x from -W/2 to spineDrift - 1.5
  const westXMin = -W / 2;
  const westXMax = spineDrift - spineWidth / 2;
  const nwFlat = buildFlat(uNW, 'NW', westXMin, westXMax, -D / 2, -D / 2 + depthNW);
  const swFlat = buildFlat(uSW, 'SW', westXMin, westXMax, -D / 2 + depthNW, D / 2);

  // East column: x from spineDrift + 1.5 to W/2
  const eastXMin = spineDrift + spineWidth / 2;
  const eastXMax = W / 2;
  const neFlat = buildFlat(uNE, 'NE', eastXMin, eastXMax, -D / 2, -D / 2 + depthNE);
  const seFlat = buildFlat(uSE, 'SE', eastXMin, eastXMax, -D / 2 + depthNE, D / 2);

  const flats: FlatPlan[] = [neFlat, nwFlat, swFlat, seFlat];
  const usedArea = flats.reduce((sum, f) => sum + f.rect.w * f.rect.d, 0);
  const commonArea = spineRect.w * spineRect.d;

  return {
    signature,
    plate: { w: W, d: D },
    spine: spineRect,
    core,
    corridors,
    flats,
    bays: [],
    usedArea,
    commonArea,
    areaScale,
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* Parking Plan Generator (Section 2.4)                               */
/* ------------------------------------------------------------------ */

function buildParkingPlan(
  floor: Floor,
  W: number,
  D: number,
  signature: string
): FloorPlan {
  const core = buildCore(0);

  // 6 m central drive aisle (z in [-3.0, 3.0])
  const aisle: Rect = { x: 0, z: 0, w: W, d: 6.0 };

  // Ramp at east end of the aisle (x in [6, 10], z in [-3, 3])
  const ramp: Rect & { label: string } = {
    x: 8.0,
    z: 0,
    w: 4.0,
    d: 5.4,
    label: 'RAMP',
  };

  // 14 bays on a 2.5m x 5.0m grid
  // North row: z in [-8, -3], 6 bays (middle 2 bays [-2.5, 2.5] occupied by core)
  // South row: z in [3, 8], 8 bays
  const bays: ParkingBay[] = [];

  const northXCoords = [-8.75, -6.25, -3.75, 3.75, 6.25, 8.75]; // 6 bays
  const southXCoords = [-8.75, -6.25, -3.75, -1.25, 1.25, 3.75, 6.25, 8.75]; // 8 bays

  // Seed pseudo-random yaw & occupancy per slot
  let slotIdx = 0;

  // North row (P01..P06)
  for (let i = 0; i < northXCoords.length; i++) {
    const slotId = `P${String(slotIdx + 1).padStart(2, '0')}`;
    const unit = floor.units.find((u) => u.displayId === slotId || u.unitId.endsWith(slotId));
    const occupied = unit?.occupiedDemo !== undefined ? unit.occupiedDemo : ((slotIdx * 7 + 3) % 10 < 7);
    const yaw = (((slotIdx * 17) % 7) - 3) * (Math.PI / 180); // +/- 2 deg

    bays.push({
      slotId,
      displayId: slotId,
      rect: { x: northXCoords[i], z: -5.5, w: 2.5, d: 5.0 },
      occupiedDemo: occupied,
      yaw,
    });
    slotIdx++;
  }

  // South row (P07..P14)
  for (let i = 0; i < southXCoords.length; i++) {
    const slotId = `P${String(slotIdx + 1).padStart(2, '0')}`;
    const unit = floor.units.find((u) => u.displayId === slotId || u.unitId.endsWith(slotId));
    const occupied = unit?.occupiedDemo !== undefined ? unit.occupiedDemo : ((slotIdx * 7 + 3) % 10 < 7);
    const yaw = Math.PI + (((slotIdx * 13) % 7) - 3) * (Math.PI / 180); // face south +/- 2 deg

    bays.push({
      slotId,
      displayId: slotId,
      rect: { x: southXCoords[i], z: 5.5, w: 2.5, d: 5.0 },
      occupiedDemo: occupied,
      yaw,
    });
    slotIdx++;
  }

  return {
    signature,
    plate: { w: W, d: D },
    spine: { x: 0, z: 0, w: 3.0, d: D },
    core,
    corridors: [],
    flats: [],
    bays,
    aisle,
    ramp,
    usedArea: 14 * 12.5,
    commonArea: W * D - 14 * 12.5,
    areaScale: 1.0,
    warnings: [],
  };
}

/* ------------------------------------------------------------------ */
/* Utility Plan Generator                                             */
/* ------------------------------------------------------------------ */

function buildUtilityPlan(
  _floor: Floor,
  W: number,
  D: number,
  signature: string
): FloorPlan {
  const core = buildCore(0);

  const utilityRooms: UtilityRoom[] = [
    { name: 'Water Tank Room', rect: { x: -6.0, z: -4.5, w: 6.0, d: 5.0 } },
    { name: 'Fire Pump Station', rect: { x: 6.0, z: -4.5, w: 6.0, d: 5.0 } },
    { name: 'Electrical Substation', rect: { x: 0.0, z: 5.5, w: 8.0, d: 4.0 } },
  ];

  const usedArea = utilityRooms.reduce((sum, r) => sum + r.rect.w * r.rect.d, 0);

  return {
    signature,
    plate: { w: W, d: D },
    spine: { x: 0, z: 0, w: 3.0, d: D },
    core,
    corridors: [],
    flats: [],
    bays: [],
    utilityRooms,
    usedArea,
    commonArea: W * D - usedArea,
    areaScale: 1.0,
    warnings: [],
  };
}
