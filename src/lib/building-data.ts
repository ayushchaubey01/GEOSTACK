/**
 * Demo data model for the 3D ULPIN / Vertical Property Mapping viewer.
 *
 * The shape of this file is intentionally designed so that real backend
 * data (from a PostGIS / FastAPI service) can later replace the mock
 * values without touching the rendering layer.
 */

export type Vec2 = { x: number; z: number };

export interface UnitFootprint {
  /** Floor-relative origin in meters (x = east, z = north). 0,0 is the center of the floor slab. */
  origin: Vec2;
  /** Footprint size in meters. */
  size: { w: number; d: number };
  /** Door opening position on the central corridor (unit edge index, 0..3). */
  doorEdge: 0 | 1 | 2 | 3;
}

export interface Unit {
  unitId: string;
  floorNumber: number;
  /** e.g. "1102" — display only */
  displayId: string;
  carpetArea: number; // m²
  builtUpArea: number; // m²
  ulpin: string; // 3D ULPIN (vertical, floor, unit)
  footprint: UnitFootprint;
  bedrooms: number;
  bathrooms: number;
  facing: 'East' | 'West' | 'North' | 'South';
  ownerName: string;
  /** True for parking slots in basements. */
  isParking: boolean;
  /** Demo vehicle occupancy for parking slots. */
  occupiedDemo?: boolean;
  /** Quadrant slot for residential units. */
  slot?: 'NE' | 'NW' | 'SW' | 'SE';
}

export interface Floor {
  floorNumber: number; // 0 = ground, 1 = first, etc.; negative = basement
  /** Display label such as "Ground", "1st", "12th", "Basement 1". */
  label: string;
  height: number; // meters floor-to-floor
  units: Unit[];
  /** Vertical ULPIN for this floor. */
  ulpin: string;
  /** Layout variant 0..2 — controls facade variation. */
  variant: 0 | 1 | 2;
  /** Total gross floor area in m² (equals plate 320m²). */
  floorArea: number;
  /** Total built-up area of flats on this floor in m² (272m² for residential). */
  flatsBuiltUp?: number;
  /** Common core/corridor area in m² (48m² for residential). */
  commonArea?: number;
  /** True if this floor is below ground (basement / parking / utility). */
  isUnderground: boolean;
  /** Optional use-type tag for basements: 'parking' | 'utility' | 'residential'. */
  usage?: 'parking' | 'utility' | 'residential';
}

export interface BuildingFootprint {
  /** Width (X axis) of the tower slab. */
  width: number;
  /** Depth (Z axis) of the tower slab. */
  depth: number;
  /** Center of the building in world space (used for camera framing). */
  center: Vec2;
}

export interface Building {
  ulpin: string;
  name: string;
  address: string;
  locality: string;
  reraId: string;
  totalFloors: number;
  floors: Floor[];
  footprint: BuildingFootprint;
  /** Plot size — area of land parcel that the building sits on, in m². */
  plotArea: number;
  /** Year of construction (mock). */
  yearBuilt: number;
}

/* ------------------------------------------------------------------ */
/* Deterministic Seeded PRNG (mulberry32)                             */
/* ------------------------------------------------------------------ */

export function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Residential Built-up Area Profiles ([NE, NW, SW, SE])               */
/* Constraints: each 36-100m², East (NE+SE)=136, West (NW+SW)=136     */
/* ------------------------------------------------------------------ */

export const RESIDENTIAL_PROFILES: readonly (readonly [number, number, number, number])[] = [
  [78, 64, 72, 58], // P0: East=136, West=136
  [90, 52, 84, 46], // P1: East=136, West=136
  [68, 68, 68, 68], // P2: East=136, West=136
  [56, 88, 48, 80], // P3: East=136, West=136
  [96, 72, 64, 40], // P4: East=136, West=136
] as const;

export const PENTHOUSE_PROFILE: readonly [number, number, number, number] = [88, 88, 48, 48] as const;

const ULPIN_ROOT = '27345091827301'; // 14-digit parcel root (synthetic)

const FACINGS: Unit['facing'][] = ['North', 'North', 'South', 'South'];
const SLOTS: Array<'NE' | 'NW' | 'SW' | 'SE'> = ['NE', 'NW', 'SW', 'SE'];

const FIRST_NAMES = [
  'Arjun & Priya Iyer',
  'Rohit & Ananya Sharma',
  'Vikram & Meera Nair',
  'Sanjay & Kavya Reddy',
  'Aditya & Shruti Rao',
  'Karthik & Divya Menon',
  'Nikhil & Isha Agarwal',
  'Manish & Pooja Desai',
];

/** Build a single floor with area-driven units or parking slots. */
export function buildFloor(
  floorNumber: number,
  totalFloors: number,
  ulpinRoot = ULPIN_ROOT,
  profileIdx?: number
): Floor {
  const isUnderground = floorNumber < 0;
  const label = isUnderground
    ? `Basement ${Math.abs(floorNumber)}`
    : floorNumber === 0
      ? 'Ground'
      : ordinalLabel(floorNumber);

  const seed = stringToSeed(`${ulpinRoot}-F${floorNumber}`);
  const rng = mulberry32(seed);

  // ── 1. Parking Basement Floor (B1) ───────────────────────────────────────
  if (floorNumber === -1) {
    const units: Unit[] = [];
    for (let i = 1; i <= 14; i++) {
      const displayId = `P${String(i).padStart(2, '0')}`;
      const unitId = `B1-${displayId}`;
      const ulpin = `${ulpinRoot}-F-1-U${displayId}`;
      const isNorth = i <= 6;
      const occupiedDemo = rng() < 0.65;

      units.push({
        unitId,
        floorNumber: -1,
        displayId,
        carpetArea: 12.5,
        builtUpArea: 12.5,
        ulpin,
        bedrooms: 0,
        bathrooms: 0,
        facing: isNorth ? 'North' : 'South',
        ownerName: 'Parking Slot',
        isParking: true,
        occupiedDemo,
        footprint: {
          origin: { x: 0, z: 0 },
          size: { w: 2.5, d: 5.0 },
          doorEdge: 0,
        },
      });
    }

    return {
      floorNumber: -1,
      label,
      height: 3.0,
      units,
      ulpin: `${ulpinRoot}-F-1`,
      variant: 0,
      floorArea: 320.0,
      flatsBuiltUp: 0,
      commonArea: 320.0,
      isUnderground: true,
      usage: 'parking',
    };
  }

  // ── 2. Utility Basement Floor (B2) ───────────────────────────────────────
  if (floorNumber < -1) {
    return {
      floorNumber,
      label,
      height: 3.0,
      units: [],
      ulpin: `${ulpinRoot}-F${floorNumber}`,
      variant: 0,
      floorArea: 320.0,
      flatsBuiltUp: 0,
      commonArea: 320.0,
      isUnderground: true,
      usage: 'utility',
    };
  }

  // ── 3. Residential Above-ground Floor ────────────────────────────────────
  const isTopFloor = floorNumber === totalFloors - 1;
  const profile = isTopFloor
    ? PENTHOUSE_PROFILE
    : RESIDENTIAL_PROFILES[profileIdx ?? (Math.floor(rng() * RESIDENTIAL_PROFILES.length))];

  // 4 residential units [0: NE, 1: NW, 2: SW, 3: SE]
  const units: Unit[] = [0, 1, 2, 3].map((i) => {
    const displayId = floorNumber === 0 ? `G0${i + 1}` : `${floorNumber}0${i + 1}`;
    const unitId = `${displayId}`;
    const ulpin = `${ulpinRoot}-F${floorNumber}-U${displayId}`;
    const builtUpArea = profile[i];
    // Per-flat carpetArea = builtUpArea / 1.18, rounded to 0.5m²
    const carpetArea = Math.round((builtUpArea / 1.18) * 2) / 2;

    // Derive bedrooms from carpetArea (<45: 1, 45-75: 2, >75: 3)
    const bedrooms = carpetArea < 45 ? 1 : carpetArea <= 75 ? 2 : 3;
    const bathrooms = bedrooms === 1 ? 1 : bedrooms === 2 ? 2 : 3;

    return {
      unitId,
      floorNumber,
      displayId,
      carpetArea,
      builtUpArea,
      ulpin,
      bedrooms,
      bathrooms,
      facing: FACINGS[i],
      slot: SLOTS[i],
      ownerName: FIRST_NAMES[(Math.abs(floorNumber) * 4 + i) % FIRST_NAMES.length],
      isParking: false,
      footprint: {
        origin: unitOrigin(i, builtUpArea),
        size: { w: 8.5, d: (16.0 * builtUpArea) / 136.0 },
        doorEdge: (i as 0 | 1 | 2 | 3),
      },
    };
  });

  const variant: 0 | 1 | 2 = (Math.abs(floorNumber) % 3) as 0 | 1 | 2;

  return {
    floorNumber,
    label,
    height: 3.0,
    units,
    ulpin: `${ulpinRoot}-F${floorNumber}`,
    variant,
    floorArea: 320.0,
    flatsBuiltUp: 272.0,
    commonArea: 48.0,
    isUnderground: false,
    usage: 'residential',
  };
}

function unitOrigin(i: number, builtUpArea: number): Vec2 {
  const d = (16.0 * builtUpArea) / 136.0;
  // 0 = NE, 1 = NW, 2 = SW, 3 = SE quadrant
  switch (i) {
    case 0: // NE
      return { x: 5.75, z: -8 + d / 2 };
    case 1: // NW
      return { x: -5.75, z: -8 + d / 2 };
    case 2: // SW
      return { x: -5.75, z: 8 - d / 2 };
    case 3: // SE
    default:
      return { x: 5.75, z: 8 - d / 2 };
  }
}

function ordinalLabel(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

/** Build an entire Building with deterministic profile assignment ensuring no two adjacent floors share a profile. */
export function buildBuildingFloors(
  aboveGroundFloors: number,
  basementCount = 1,
  ulpinRoot = ULPIN_ROOT
): Floor[] {
  const floors: Floor[] = [];

  // Basements
  for (let b = basementCount; b >= 1; b--) {
    floors.push(buildFloor(-b, aboveGroundFloors, ulpinRoot));
  }

  // Above-ground residential floors
  let lastProfileIdx = -1;
  for (let f = 0; f < aboveGroundFloors; f++) {
    const isTopFloor = f === aboveGroundFloors - 1;
    let currentProfileIdx = 0;

    if (!isTopFloor) {
      const seed = stringToSeed(`${ulpinRoot}-profile-${f}`);
      const rng = mulberry32(seed);
      let chosen = Math.floor(rng() * RESIDENTIAL_PROFILES.length);
      // Guarantee adjacent floors NEVER share a profile
      if (chosen === lastProfileIdx) {
        chosen = (chosen + 1 + Math.floor(rng() * (RESIDENTIAL_PROFILES.length - 1))) % RESIDENTIAL_PROFILES.length;
      }
      currentProfileIdx = chosen;
      lastProfileIdx = chosen;
    }

    floors.push(buildFloor(f, aboveGroundFloors, ulpinRoot, currentProfileIdx));
  }

  return floors;
}

/** Factory: create mock building. */
export function createMockBuilding(): Building {
  const aboveGroundFloors = 13;
  const basementCount = 1;
  const floors = buildBuildingFloors(aboveGroundFloors, basementCount, ULPIN_ROOT);

  return {
    ulpin: ULPIN_ROOT,
    name: 'Prestige Indigo Heights',
    address: '5th Cross, Indiranagar 2nd Stage',
    locality: 'Bengaluru — Ward 111',
    reraId: 'PRM/KA/RERA/1251/446/PR/240218/006821',
    totalFloors: aboveGroundFloors + basementCount,
    floors,
    plotArea: 1860,
    yearBuilt: 2022,
    footprint: {
      width: 20,
      depth: 16,
      center: { x: 0, z: 0 },
    },
  };
}

export const MOCK_BUILDING = createMockBuilding();

/* ------------------------------------------------------------------ */
/* Create a Building from a real GeoJSON map feature                  */
/* ------------------------------------------------------------------ */

import type { MapBuildingFeature } from './map-data';

export function createBuildingFromFeature(feature: MapBuildingFeature): Building {
  const floorsCount = Math.max(1, Math.min(20, feature.f || 3)); // clamp 1..20
  const basementCount = 1; // 1 basement (parking)
  const ulpinRoot = feature.pc || `BLR-P-${String(feature.id).padStart(6, '0')}`;
  const allFloors = buildBuildingFloors(floorsCount, basementCount, ulpinRoot);

  const [lng, lat] = feature.ce;
  const latStr = lat.toFixed(5);
  const lngStr = lng.toFixed(5);

  return {
    ulpin: ulpinRoot,
    name: feature.n || `Building #${feature.id}`,
    address: `${latStr}°N, ${lngStr}°E`,
    locality: 'Bengaluru Pilot AOI',
    reraId: '— (real RERA data pending)',
    totalFloors: floorsCount + basementCount,
    floors: allFloors,
    plotArea: 0,
    yearBuilt: 2020,
    footprint: {
      width: 20,
      depth: 16,
      center: { x: 0, z: 0 },
    },
  };
}
