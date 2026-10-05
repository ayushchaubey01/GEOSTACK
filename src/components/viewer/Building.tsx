'use client';

/**
 * Building.tsx
 *
 * Procedurally generates a 14-storey residential tower from the mock
 * data model. Each floor is a `<Floor>` R3F component that owns its own
 * slab, facade, windows, balconies, and is independently interactive.
 *
 * The whole building is wrapped in a `<group>` whose `position.x` is
 * animated by the centralized GSAP transition controller — no per-frame
 * lerp here, which keeps the motion cinematic + frame-synced.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { useBuilding, useViewerStore } from '@/lib/viewer-store';
import { registerRef } from './useTransitionController';
import Floor from './Floor';
import Rooftop from './Rooftop';
import Ground from './Ground';
import BuildingOutline from './BuildingOutline';

export default function Building() {
  const groupRef = useRef<THREE.Group>(null);
  const building = useBuilding();

  // Compute Y position for each floor. Underground floors stack
  // below y=0; above-ground stack above. Floor data is ordered:
  // basements first (-N..-1), then 0..N-1.
  const { floorYs, totalHeight, basementDepth } = useMemo(() => {
    const ys: number[] = [];
    let y = 0;
    // First pass: underground floors (negative floorNumber)
    const underground = building.floors.filter((f) => f.isUnderground);
    const aboveground = building.floors.filter((f) => !f.isUnderground);
    // Stack basements below y=0 (top of B1 is at y=0, going down)
    let yUnder = 0;
    for (const f of underground) {
      yUnder -= f.height;
      ys.push(yUnder + f.height / 2);
    }
    // Above-ground stack from y=0 upward
    let yAbove = 0;
    for (const f of aboveground) {
      ys.push(yAbove + f.height / 2);
      yAbove += f.height;
    }
    // Re-order ys to match building.floors order
    const ordered = building.floors.map((f) => {
      const list = f.isUnderground ? underground : aboveground;
      const idx = list.indexOf(f);
      return f.isUnderground
        ? ys[idx]
        : ys[underground.length + idx];
    });
    return {
      floorYs: ordered,
      totalHeight: yAbove,
      basementDepth: Math.abs(yUnder),
    };
  }, [building]);

  // Register this group with the transition controller.
  useEffect(() => {
    registerRef('building', groupRef.current);
    return () => registerRef('building', null);
  }, []);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <Ground />
      {building.floors.map((floor, i) => (
        <Floor
          key={floor.floorNumber}
          floor={floor}
          y={floorYs[i]}
          isTopFloor={i === building.floors.length - 1}
        />
      ))}
      <Rooftop
        y={totalHeight + 0.15}
        width={building.footprint.width}
        depth={building.footprint.depth}
      />
      <BuildingOutline totalHeight={totalHeight} basementDepth={basementDepth} />
    </group>
  );
}
