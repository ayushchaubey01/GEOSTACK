'use client';

/**
 * Floor.tsx
 *
 * Each floor is a self-contained R3F group containing:
 *  - The concrete floor slab (with a visible band / soffit)
 *  - The facade walls (front + back + 2 short sides)
 *  - Glass + mullions (per window opening)
 *  - Balcony slabs + railings on the long facades
 *  - A "halo" overlay that fades in on hover/selection
 *
 * The floor group is interactive: pointer-over / pointer-out / click all
 * dispatch into the Zustand store. Selection state is reflected by
 * raising the floor a few cm + tinting the facade with an accent
 * emissive.
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Floor as FloorData } from '@/lib/building-data';
import { useViewerStore } from '@/lib/viewer-store';
import {
  matConcrete,
  matSlabEdge,
  matSoffit,
  matBalconyTile,
  matRailing,
  matBasement,
  matXrayFacade,
  matXraySlab,
  makeFacadeHighlight,
} from '@/lib/viewer-materials';
import { FloorInterior } from './FloorInterior';
import { getFloorPlan } from '@/lib/floor-plan';
import { ParkingCars } from './CarModel';

// ── Cached box geometries for railings and balconies ───────────────────────
const geoCache = new Map<string, THREE.BufferGeometry>();
function getCachedBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const k = `${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}`;
  let g = geoCache.get(k);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(k, g);
  }
  return g;
}



interface FloorProps {
  floor: FloorData;
  y: number;
  isTopFloor: boolean;
}

const HOVER_TINT = '#C7D2FE';    // indigo-200
const SELECTED_TINT = '#6366F1'; // indigo-500

function FloorComponent({ floor, y, isTopFloor }: FloorProps) {
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    (window as any).__floorRenderCounts = ((window as any).__floorRenderCounts || 0) + 1;
  }

  const groupRef = useRef<THREE.Group>(null);
  const liftRef = useRef<THREE.Group>(null); // inner group — only Y lift
  const facadeNorthRef = useRef<THREE.Mesh>(null);
  const facadeSouthRef = useRef<THREE.Mesh>(null);
  const facadeEastRef = useRef<THREE.Mesh>(null);
  const facadeWestRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const [_, setHovered] = useState(false);

  // Narrow boolean selectors: only the hovered/selected floors re-render
  const isSelected = useViewerStore((s) => s.selectedFloor === floor.floorNumber);
  const isHovered = useViewerStore((s) => s.hoveredFloor === floor.floorNumber && s.selectedFloor !== floor.floorNumber);
  const phase = useViewerStore((s) => s.phase);
  const xrayMode = useViewerStore((s) => s.xrayMode);
  const hoverFloor = useViewerStore((s) => s.hoverFloor);
  const selectFloor = useViewerStore((s) => s.selectFloor);
  const setPhase = useViewerStore((s) => s.setPhase);

  const mats = useMemo(
    () => ({
      hoverMat: makeFacadeHighlight(HOVER_TINT, 0.18),
      selectedMat: makeFacadeHighlight(SELECTED_TINT, 0.45),
    }),
    [],
  );

  // Floor dimensions
  const W = 20;
  const D = 16;
  const H = floor.height; // 3.0 m
  const wallThickness = 0.18;
  const slabThickness = 0.22;

  const plan = useMemo(() => getFloorPlan(floor), [floor]);



  /* ------------------- hover + selection effects (no per-frame lerp) -------------------- */

  // Update lift position when isSelected changes (no per-frame work).
  useEffect(() => {
    if (!liftRef.current) return;
    const targetY = isSelected && (phase === 'extracted' || phase === 'floor_selecting' || phase === 'floor_inspecting' || phase === 'floor_inspect_selecting') ? 0.35 : 0;
    liftRef.current.position.y = targetY;
  }, [isSelected, phase]);

  // Swap facade material based on hover/selection/xray state.
  // Priority: xray > selected > hover > default (basement or concrete)
  const targetMat = xrayMode
    ? matXrayFacade
    : isSelected
      ? mats.selectedMat
      : isHovered
        ? mats.hoverMat
        : floor.isUnderground
          ? matBasement
          : matConcrete;

  useEffect(() => {
    for (const ref of [facadeNorthRef, facadeSouthRef, facadeEastRef, facadeWestRef]) {
      if (ref.current) {
        ref.current.material = targetMat;
      }
    }
  }, [targetMat]);

  // Update halo opacity on hover/selection change.
  useEffect(() => {
    if (!haloRef.current) return;
    const mat = haloRef.current.material as THREE.MeshBasicMaterial;
    const targetOpacity = isSelected ? 0.22 : isHovered ? 0.10 : 0.0;
    mat.opacity = targetOpacity;
  }, [isSelected, isHovered]);

  /* ------------------- handlers -------------------- */

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    hoverFloor(floor.floorNumber);
    useViewerStore.setState({ tooltipFloor: floor.floorNumber });
    document.body.style.cursor = 'pointer';
  };

  const onPointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    hoverFloor(null);
    useViewerStore.setState({ tooltipFloor: null });
    document.body.style.cursor = 'default';
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // If clicking the SAME floor that's already selected → collapse back to overview
    if (isSelected && (phase === 'extracted' || phase === 'floor_selecting' || phase === 'floor_inspecting' || phase === 'floor_inspect_selecting' || phase === 'floor_inspect_returning')) {
      setPhase('returning');
      return;
    }
    // If clicking a DIFFERENT floor while in ANY inspection/transition mode → switch directly
    if (!isSelected && (phase === 'extracted' || phase === 'floor_selecting' || phase === 'floor_inspecting' || phase === 'floor_inspect_selecting' || phase === 'floor_inspect_returning')) {
      selectFloor(floor.floorNumber);
      // Re-trigger the selecting transition for the new floor.
      // Even if phase is already 'floor_selecting', setting it again
      // + the selectedFloor change will cause the transition controller
      // to re-run.
      setPhase('floor_selecting');
      return;
    }
    // Normal: only allow new selection from overview phase
    if (phase !== 'overview') return;
    selectFloor(floor.floorNumber);
    setPhase('floor_selecting');
  };

  /* ------------------- render -------------------- */

  return (
    <group
      ref={groupRef}
      position={[0, y, 0]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      <group ref={liftRef} position={[0, 0, 0]}>
      {/* Slab (floor + ceiling combined as a single thick box). */}
      <mesh position={[0, -H / 2 + slabThickness / 2, 0]} material={xrayMode ? matXraySlab : floor.isUnderground ? matBasement : matSlabEdge}>
        <boxGeometry args={[W + 0.15, slabThickness, D + 0.15]} />
      </mesh>
      {!xrayMode && (
        <mesh position={[0, -H / 2 + slabThickness + 0.02, 0]} material={matSoffit}>
          <boxGeometry args={[W + 0.2, 0.06, D + 0.2]} />
        </mesh>
      )}

      {/* Floor separation band — hidden in X-ray mode (would obscure interior). */}
      {!xrayMode && (
        <mesh position={[0, H / 2 - 0.06, 0]} material={matSoffit}>
          <boxGeometry args={[W + 0.25, 0.14, D + 0.25]} />
        </mesh>
      )}

      {/* Long facades. */}
      <mesh
        ref={facadeNorthRef}
        position={[0, 0, -D / 2 + wallThickness / 2]}
        material={matConcrete}
       
      >
        <boxGeometry args={[W, H - slabThickness * 1.5, wallThickness]} />
      </mesh>
      <mesh
        ref={facadeSouthRef}
        position={[0, 0, D / 2 - wallThickness / 2]}
        material={matConcrete}
       
      >
        <boxGeometry args={[W, H - slabThickness * 1.5, wallThickness]} />
      </mesh>
      {/* Short facades. */}
      <mesh
        ref={facadeEastRef}
        position={[W / 2 - wallThickness / 2, 0, 0]}
        material={matConcrete}
       
      >
        <boxGeometry args={[wallThickness, H - slabThickness * 1.5, D]} />
      </mesh>
      <mesh
        ref={facadeWestRef}
        position={[-W / 2 + wallThickness / 2, 0, 0]}
        material={matConcrete}
       
      >
        <boxGeometry args={[wallThickness, H - slabThickness * 1.5, D]} />
      </mesh>



      {/* Balconies — hidden in X-ray mode for cleaner interior view */}
      {!xrayMode && !floor.isUnderground && plan.flats.map((flat, i) => {
        if (!flat.balcony) return null;
        const b = flat.balcony;
        const isNorth = b.side === 'north';
        const z = isNorth ? -D / 2 - 0.45 : D / 2 + 0.45;
        return (
          <Balcony
            key={`bal-${i}`}
            position={[b.x, -H / 2 + slabThickness + 0.02, z]}
            width={b.w}
            depth={1.2}
            height={H - slabThickness * 1.5 - 0.1}
            flipZ={!isNorth}
          />
        );
      })}

      {/* Halo — a slightly larger transparent shell that glows on hover/select. */}
      {!xrayMode && (
        <mesh ref={haloRef} position={[0, 0, 0]}>
          <boxGeometry args={[W + 0.4, H + 0.15, D + 0.4]} />
          <meshBasicMaterial
            color={new THREE.Color(SELECTED_TINT)}
            transparent
            opacity={0}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* X-ray interior walls — merged BufferGeometry from FloorInterior (2 draw calls) */}
      {xrayMode && (
        <>
          <FloorInterior
            plan={plan}
            mode="tower_xray"
            isHovered={isHovered}
            isSelected={isSelected}
          />
          {floor.usage === 'parking' && plan.bays && (
            <ParkingCars bays={plan.bays} />
          )}
        </>
      )}

      {/* Invisible click target — a slightly larger box that ensures
          clicks anywhere over the floor's footprint register reliably. */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[W + 0.5, H + 0.1, D + 0.5]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      </group>
    </group>
  );
}

export const Floor = React.memo(FloorComponent);
export default Floor;

/* ------------------------------------------------------------------ */
/* Balcony                                                             */
/* ------------------------------------------------------------------ */

interface BalconyProps {
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  flipZ: boolean;
}

function Balcony({ position, width, depth, height, flipZ }: BalconyProps) {
  const slabY = -height / 2;
  const railingH = 1.05;
  const frontZ = flipZ ? -depth : depth;
  const sideZ = flipZ ? -depth / 2 : depth / 2;

  return (
    <group position={position}>
      {/* Slab */}
      <mesh
        position={[0, slabY + 0.04, flipZ ? -depth / 2 : depth / 2]}
        material={matBalconyTile}
      >
        <boxGeometry args={[width, 0.08, depth]} />
      </mesh>
      {/* Soffit */}
      <mesh position={[0, slabY, flipZ ? -depth / 2 : depth / 2]} material={matSoffit}>
        <boxGeometry args={[width + 0.02, 0.04, depth + 0.02]} />
      </mesh>

      {/* Front railing — top + mid rail + posts */}
      <RailingSegment
        length={width}
        height={railingH}
        position={[0, slabY + 0.06, frontZ]}
        axis="x"
      />
      {/* Left + right side railings */}
      <RailingSegment
        length={depth}
        height={railingH}
        position={[-width / 2, slabY + 0.06, sideZ]}
        axis="z"
      />
      <RailingSegment
        length={depth}
        height={railingH}
        position={[width / 2, slabY + 0.06, sideZ]}
        axis="z"
      />

      {/* Parapet edge */}
      <mesh
        position={[0, slabY + 0.08, flipZ ? -depth + 0.04 : depth - 0.04]}
        material={matRailing}
      >
        <boxGeometry args={[width, 0.16, 0.06]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Railing — minimal: top rail + 2 corner posts (no middle posts).   */
/* Consolidated to keep mesh count low (was: ~10/railing, now: 3).    */
/* ------------------------------------------------------------------ */

function RailingSegment({
  length,
  height,
  position,
  axis,
}: {
  length: number;
  height: number;
  position: [number, number, number];
  axis: 'x' | 'z';
}) {
  const railGeo = axis === 'x'
    ? getCachedBox(length, 0.05, 0.05)
    : getCachedBox(0.05, 0.05, length);
  const postGeo = getCachedBox(0.05, height, 0.05);

  return (
    <group position={position}>
      {/* Top rail */}
      <mesh geometry={railGeo} material={matRailing} position={[0, height - 0.025, 0]} />
      {/* Mid rail */}
      <mesh geometry={railGeo} material={matRailing} position={[0, height * 0.55, 0]} scale={[1, 0.6, 1]} />
      {/* 2 corner posts only */}
      <mesh geometry={postGeo} material={matRailing} position={axis === 'x' ? [-length / 2, height / 2, 0] : [0, height / 2, -length / 2]} />
      <mesh geometry={postGeo} material={matRailing} position={axis === 'x' ? [length / 2, height / 2, 0] : [0, height / 2, length / 2]} />
    </group>
  );
}
