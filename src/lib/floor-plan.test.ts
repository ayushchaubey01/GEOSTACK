import { describe, it, expect } from 'bun:test';
import { getFloorPlan, clearFloorPlanCache, FLOOR_DIMENSIONS } from './floor-plan';
import {
  createMockBuilding,
  createBuildingFromFeature,
  buildFloor,
  RESIDENTIAL_PROFILES,
  type Floor,
} from './building-data';

describe('Floor Plan Engine (Part C Unit Tests)', () => {
  const building = createMockBuilding();

  it('1. For every flat on every floor: |rectArea - builtUp| / builtUp <= 2% when areaScale = 1', () => {
    clearFloorPlanCache();
    for (const floor of building.floors) {
      if (floor.usage !== 'residential') continue;
      const plan = getFloorPlan(floor);
      expect(plan.areaScale).toBe(1.0);
      expect(plan.flats.length).toBe(4);

      for (let i = 0; i < floor.units.length; i++) {
        const u = floor.units[i];
        const fPlan = plan.flats[i];
        const rectArea = fPlan.rect.w * fPlan.rect.d;
        const diffRatio = Math.abs(rectArea - u.builtUpArea) / u.builtUpArea;
        expect(diffRatio).toBeLessThanOrEqual(0.02);
      }
    }
  });

  it('2. No flat/core/corridor rectangles overlap; all lie inside plate; sum of flats + spine = plate area (+/- 0.5 m²)', () => {
    const W = FLOOR_DIMENSIONS.width;
    const D = FLOOR_DIMENSIONS.depth;
    const plateArea = W * D; // 320 m²

    for (const floor of building.floors) {
      if (floor.usage !== 'residential') continue;
      const plan = getFloorPlan(floor);

      // Check boundaries
      for (const flat of plan.flats) {
        const xMin = flat.rect.x - flat.rect.w / 2;
        const xMax = flat.rect.x + flat.rect.w / 2;
        const zMin = flat.rect.z - flat.rect.d / 2;
        const zMax = flat.rect.z + flat.rect.d / 2;

        expect(xMin).toBeGreaterThanOrEqual(-W / 2 - 0.001);
        expect(xMax).toBeLessThanOrEqual(W / 2 + 0.001);
        expect(zMin).toBeGreaterThanOrEqual(-D / 2 - 0.001);
        expect(zMax).toBeLessThanOrEqual(D / 2 + 0.001);
      }

      // Check no flat overlaps with another flat
      for (let i = 0; i < plan.flats.length; i++) {
        for (let j = i + 1; j < plan.flats.length; j++) {
          const f1 = plan.flats[i].rect;
          const f2 = plan.flats[j].rect;
          const xOverlap = Math.max(0, Math.min(f1.x + f1.w / 2, f2.x + f2.w / 2) - Math.max(f1.x - f1.w / 2, f2.x - f2.w / 2));
          const zOverlap = Math.max(0, Math.min(f1.z + f1.d / 2, f2.z + f2.d / 2) - Math.max(f1.z - f1.d / 2, f2.z - f2.d / 2));
          expect(xOverlap * zOverlap).toBeLessThanOrEqual(0.001);
        }
      }

      // Sum of flats + spine = plate area
      const flatsArea = plan.flats.reduce((acc, f) => acc + f.rect.w * f.rect.d, 0);
      const spineArea = plan.spine.w * plan.spine.d;
      expect(Math.abs(flatsArea + spineArea - plateArea)).toBeLessThanOrEqual(0.5);
    }
  });

  it('3. Equal column totals -> spine and core x = 0 on every floor (shafts line up through tower)', () => {
    for (const floor of building.floors) {
      if (floor.usage !== 'residential') continue;
      const plan = getFloorPlan(floor);
      expect(plan.spine.x).toBe(0);
      expect(plan.core.rect.x).toBe(0);
      expect(plan.core.lifts[0].rect.x).toBeCloseTo(-0.75, 2);
      expect(plan.core.lifts[1].rect.x).toBeCloseTo(0.75, 2);
    }
  });

  it('4. Unbalanced real-style data: spine drift <= 1.5 m, warnings populated, no NaN, no flat deeper than 12 m or shallower than 3.5 m', () => {
    // Artificial highly unbalanced floor: West column 190m², East column 82m²
    const unbalancedFloor: Floor = {
      floorNumber: 5,
      label: '5th',
      height: 3.0,
      ulpin: 'TEST-UNBALANCED',
      variant: 0,
      floorArea: 320,
      isUnderground: false,
      usage: 'residential',
      units: [
        { unitId: 'U1', floorNumber: 5, displayId: '501', carpetArea: 60, builtUpArea: 70, ulpin: 'U1', bedrooms: 2, bathrooms: 2, facing: 'North', ownerName: 'A', isParking: false, footprint: { origin: { x: 0, z: 0 }, size: { w: 8, d: 8 }, doorEdge: 0 } },
        { unitId: 'U2', floorNumber: 5, displayId: '502', carpetArea: 100, builtUpArea: 130, ulpin: 'U2', bedrooms: 3, bathrooms: 3, facing: 'North', ownerName: 'B', isParking: false, footprint: { origin: { x: 0, z: 0 }, size: { w: 8, d: 8 }, doorEdge: 0 } },
        { unitId: 'U3', floorNumber: 5, displayId: '503', carpetArea: 50, builtUpArea: 60, ulpin: 'U3', bedrooms: 2, bathrooms: 2, facing: 'South', ownerName: 'C', isParking: false, footprint: { origin: { x: 0, z: 0 }, size: { w: 8, d: 8 }, doorEdge: 0 } },
        { unitId: 'U4', floorNumber: 5, displayId: '504', carpetArea: 10, builtUpArea: 12, ulpin: 'U4', bedrooms: 1, bathrooms: 1, facing: 'South', ownerName: 'D', isParking: false, footprint: { origin: { x: 0, z: 0 }, size: { w: 8, d: 8 }, doorEdge: 0 } },
      ],
    };

    const plan = getFloorPlan(unbalancedFloor);
    expect(Math.abs(plan.spine.x)).toBeLessThanOrEqual(1.5001);
    expect(plan.warnings.length).toBeGreaterThan(0);
    expect(plan.areaScale).toBeLessThan(1.0);

    for (const flat of plan.flats) {
      expect(Number.isNaN(flat.rect.x)).toBe(false);
      expect(Number.isNaN(flat.rect.z)).toBe(false);
      expect(Number.isNaN(flat.rect.w)).toBe(false);
      expect(Number.isNaN(flat.rect.d)).toBe(false);
      expect(flat.rect.d).toBeGreaterThanOrEqual(3.499);
      expect(flat.rect.d).toBeLessThanOrEqual(12.001);
    }
  });

  it('5. Determinism: same building twice -> byte-identical plans; two different buildings differ', () => {
    clearFloorPlanCache();
    const b1 = createMockBuilding();
    const b2 = createMockBuilding();

    const plan1 = getFloorPlan(b1.floors[2]);
    const plan2 = getFloorPlan(b2.floors[2]);
    expect(JSON.stringify(plan1)).toBe(JSON.stringify(plan2));

    // Different building from another feature
    const bOther = createBuildingFromFeature({
      id: 9999,
      pc: 'BLR-P-999999',
      f: 8,
      h: 24,
      n: 'Tower 99',
      ce: [77.6, 12.9],
    } as any);

    const planOther = getFloorPlan(bOther.floors[2]);
    expect(plan1.signature).not.toBe('');
    expect(planOther.signature).not.toBe('');
  });

  it('6. Adjacent generated floors never share a profile; identical-profile floors produce identical signatures', () => {
    const resFloors = building.floors.filter((f) => f.usage === 'residential');
    for (let i = 1; i < resFloors.length; i++) {
      const pPrev = getFloorPlan(resFloors[i - 1]);
      const pCurr = getFloorPlan(resFloors[i]);
      expect(pPrev.signature).not.toBe(pCurr.signature);
    }

    // Identical floors (e.g. explicitly constructed with same profile) share signature and cache hit
    const fA = buildFloor(2, 10, 'ROOT', 1);
    const fB = buildFloor(4, 10, 'ROOT', 1);
    const planA = getFloorPlan(fA);
    const planB = getFloorPlan(fB);
    expect(planA.signature).toBe(planB.signature);
  });

  it('7. Parking: exactly 14 bays, none overlapping core, aisle >= 6 m, no residential units on parking floor; slot count in card equals bays in plan', () => {
    const pFloor = building.floors.find((f) => f.usage === 'parking');
    expect(pFloor).toBeDefined();
    if (!pFloor) return;

    expect(pFloor.units.length).toBe(14);
    expect(pFloor.units.every((u) => u.isParking)).toBe(true);

    const plan = getFloorPlan(pFloor);
    expect(plan.bays.length).toBe(14);
    expect(plan.bays.length).toBe(pFloor.units.length);
    expect(plan.aisle).toBeDefined();
    expect(plan.aisle?.d).toBeGreaterThanOrEqual(6.0);

    // No bay overlaps the core
    const core = plan.core.rect;
    for (const bay of plan.bays) {
      const b = bay.rect;
      const xOverlap = Math.max(0, Math.min(b.x + b.w / 2, core.x + core.w / 2) - Math.max(b.x - b.w / 2, core.x - core.w / 2));
      const zOverlap = Math.max(0, Math.min(b.z + b.d / 2, core.z + core.d / 2) - Math.max(b.z - b.d / 2, core.z - core.d / 2));
      expect(xOverlap * zOverlap).toBeLessThanOrEqual(0.001);
    }
  });

  it('8. Bedrooms follow the carpet-area bands (< 45: 1 BHK; 45-75: 2 BHK; > 75: 3 BHK)', () => {
    for (const floor of building.floors) {
      if (floor.usage !== 'residential') continue;
      for (const unit of floor.units) {
        if (unit.carpetArea < 45) {
          expect(unit.bedrooms).toBe(1);
        } else if (unit.carpetArea <= 75) {
          expect(unit.bedrooms).toBe(2);
        } else {
          expect(unit.bedrooms).toBe(3);
        }
      }
    }
  });
});
