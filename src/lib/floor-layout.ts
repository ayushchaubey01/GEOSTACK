/**
 * floor-layout.ts
 *
 * Shared dimensional constants for 3D floor geometry.
 * Detailed floor layouts are generated deterministically by getFloorPlan in floor-plan.ts.
 */

export const FLOOR_DIMENSIONS = {
  width: 20.0,
  depth: 16.0,
  height: 3.0,
  slabThickness: 0.22,
  wallHeight: 2.78, // 3.0 - 0.22
  wallThickness: 0.14,
  coreWidth: 3.0,
  coreDepth: 5.0,
  corridorGap: 0.8,
  doorWidth: 0.9,
  doorHeight: 2.1,
  windowWidth: 1.6,
  windowHeight: 1.3,
  windowSillHeight: 0.85,
} as const;
