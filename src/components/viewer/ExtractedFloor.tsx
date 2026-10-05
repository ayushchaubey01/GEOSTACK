'use client';

/**
 * ExtractedFloor.tsx
 *
 * Detailed floor plate view (extracted & solo inspect):
 * - Dimensions match building floors (20m x 16m)
 * - 100% data-driven layouts via getFloorPlan(floor)
 * - Exact flat rectangles, room partitions, and window/balcony placements
 * - Central core with 2 lift shafts and stair treads with primary-900 wireframe edges
 * - Circulation corridors highlighted in #F9FAFB
 * - Parking floor: 14 bays on a 2.5m grid, 6m drive aisle, ramp, bay stripes (#CBD5E1),
 *   small P01..P14 labels, and instanced demo cars
 * - Utility floor: open plate with Tank, Pump, and Electrical equipment rooms
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useViewerStore, useBuilding } from '@/lib/viewer-store';
import { registerRef } from './useTransitionController';
import {
  matSlabEdge,
  matSoffit,
  matRailing,
  matBalconyTile,
  matXraySlab,
  matUnitFloorPlane,
  matUnitFloorHover,
  matUnitFloorSelected,
} from '@/lib/viewer-materials';
import { FloorInterior } from './FloorInterior';
import {
  getFloorPlan,
  FLOOR_DIMENSIONS,
  WALL_H,
  type FloorPlan,
  type FlatPlan,
  type ParkingBay,
} from '@/lib/floor-plan';
import { ParkingCars } from './CarModel';
import {
  COLOR_PRIMARY_900,
  COLOR_PRIMARY_500,
  SCENE,
} from '@/lib/design-tokens';
import type { Unit } from '@/lib/building-data';

const {
  width: FLOOR_W,
  depth: FLOOR_D,
  slabThickness: SLAB_T,
} = FLOOR_DIMENSIONS;

export default function ExtractedFloor() {
  const groupRef = useRef<THREE.Group>(null);
  const selectedFloor = useViewerStore((s) => s.selectedFloor);
  const phase = useViewerStore((s) => s.phase);
  const xrayMode = useViewerStore((s) => s.xrayMode);
  const setPhase = useViewerStore((s) => s.setPhase);
  const building = useBuilding();

  const activeFloorNumber = selectedFloor ?? 0;
  const floor = useMemo(
    () => building.floors.find((f) => f.floorNumber === activeFloorNumber) ?? building.floors[0],
    [building, activeFloorNumber],
  );

  const plan = useMemo(
    () => getFloorPlan(floor, building.footprint),
    [floor, building.footprint],
  );

  useEffect(() => {
    if (!groupRef.current) return;
    registerRef('extractedFloor', groupRef.current);

    const shouldShow =
      selectedFloor !== null &&
      phase !== 'overview' &&
      phase !== 'loading' &&
      phase !== 'returning';
    groupRef.current.visible = shouldShow;
  }, [phase, selectedFloor]);

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (phase !== 'extracted') return;
    setPhase('floor_inspect_selecting');
  };

  return (
    <group ref={groupRef} position={[24, 8, 0]} scale={0.6}>
      {/* Floor plate (clickable to enter solo inspect) */}
      <group onClick={onFloorClick}>
        <FloorPlate width={FLOOR_W} depth={FLOOR_D} xrayMode={xrayMode} />
        <CentralCore plan={plan} xrayMode={xrayMode} />
        <ConnectorLine fromX={-11} toX={0} y={0} />
      </group>

      {/* Interior & perimeter walls with directional cutaway */}
      <group position={[0, 0, 0]}>
        <FloorInterior
          plan={plan}
          mode="floor_view"
          xrayMode={xrayMode}
          cutawayActive={phase === 'extracted' || phase === 'floor_inspecting'}
        />
      </group>

      {/* Circulation corridors (slightly distinct tone #F9FAFB) */}
      {plan.corridors.map((c, i) => (
        <mesh key={`corr-${i}`} position={[c.x, 0.012, c.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[c.w, c.d]} />
          <meshBasicMaterial color="#F9FAFB" />
        </mesh>
      ))}

      {/* Residential layout: Flats & Balconies */}
      {floor.usage === 'residential' &&
        plan.flats.map((flat, i) => {
          const unit = floor.units.find((u) => u.slot === flat.slot) ?? floor.units[i];
          return (
            <ResidentialFlatInteractive
              key={flat.unitId}
              flat={flat}
              unit={unit}
              phase={phase}
              xrayMode={xrayMode}
            />
          );
        })}

      {/* Parking layout: Bays, Stripes, Aisle, Ramp, and Demo Cars */}
      {floor.usage === 'parking' && plan.bays && (
        <ParkingLayoutInteractive
          plan={plan}
          units={floor.units}
          phase={phase}
          xrayMode={xrayMode}
        />
      )}

      {/* Utility layout: Equipment rooms */}
      {floor.usage === 'utility' && plan.utilityRooms && (
        <UtilityLayoutInteractive
          plan={plan}
          phase={phase}
        />
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Floor plate slab & perimeter curb                                  */
/* ------------------------------------------------------------------ */

function FloorPlate({
  width,
  depth,
  xrayMode,
}: {
  width: number;
  depth: number;
  xrayMode: boolean;
}) {
  return (
    <group>
      <mesh position={[0, -SLAB_T / 2, 0]} material={xrayMode ? matXraySlab : matSlabEdge}>
        <boxGeometry args={[width, SLAB_T, depth]} />
      </mesh>
      {!xrayMode && (
        <mesh position={[0, -SLAB_T - 0.02, 0]} material={matSoffit}>
          <boxGeometry args={[width + 0.05, 0.04, depth + 0.05]} />
        </mesh>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Central Core (Lifts + Staircase with treads + Lobby)                */
/* ------------------------------------------------------------------ */

function CentralCore({ plan, xrayMode }: { plan: FloorPlan; xrayMode: boolean }) {
  const core = plan.core;
  const edgeColor = new THREE.Color(COLOR_PRIMARY_900); // #312E81

  return (
    <group position={[0, 0.015, 0]}>
      {/* Core base fill */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[core.rect.x, 0.001, core.rect.z]}>
        <planeGeometry args={[core.rect.w, core.rect.d]} />
        <meshBasicMaterial color={xrayMode ? '#EEF2FF' : '#E5E7EB'} />
      </mesh>

      {/* 2 Lift Shafts with primary-900 wireframe edges */}
      {core.lifts.map((lift, i) => (
        <group key={`lift-${i}`} position={[lift.rect.x, 0.002, lift.rect.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[lift.rect.w, lift.rect.d]} />
            <meshBasicMaterial color="#E0E7FF" />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(lift.rect.w, 0.05, lift.rect.d)]} />
            <lineBasicMaterial color={edgeColor} />
          </lineSegments>
        </group>
      ))}

      {/* Staircase with visible treads and primary-900 outlines */}
      <group position={[core.stairs.rect.x, 0.002, core.stairs.rect.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[core.stairs.rect.w, core.stairs.rect.d]} />
          <meshBasicMaterial color="#EDE9FE" />
        </mesh>
        {core.stairs.treads.map((tread, i) => (
          <group key={`tread-${i}`} position={[0, 0.01 + i * 0.015, tread.z]}>
            <mesh>
              <boxGeometry args={[tread.width, 0.02, 0.28]} />
              <meshBasicMaterial color="#DDD6FE" />
            </mesh>
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(tread.width, 0.02, 0.28)]} />
              <lineBasicMaterial color={edgeColor} />
            </lineSegments>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive Residential Flat                                       */
/* ------------------------------------------------------------------ */

interface ResidentialFlatInteractiveProps {
  flat: FlatPlan;
  unit?: Unit;
  phase: string;
  xrayMode: boolean;
}

function ResidentialFlatInteractive({
  flat,
  unit,
  phase,
  xrayMode,
}: ResidentialFlatInteractiveProps) {
  const [hovered, setHovered] = useState(false);
  const selectedUnitId = useViewerStore((s) => s.selectedUnitId);
  const selectUnit = useViewerStore((s) => s.selectUnit);
  const hoverUnit = useViewerStore((s) => s.hoverUnit);

  const unitId = unit?.unitId ?? flat.unitId;
  const isSelected = selectedUnitId === unitId;

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    hoverUnit(unitId);
  };

  const onPointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    hoverUnit(null);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectUnit(isSelected ? null : unitId);
  };

  const isNorth = flat.slot === 'NE' || flat.slot === 'NW';
  const balconyZ = isNorth ? -FLOOR_D / 2 - 0.45 : FLOOR_D / 2 + 0.45;

  return (
    <group>
      {/* Pickable unit floor plane strictly matching flat.rect (no overlap) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[flat.rect.x, 0.018, flat.rect.z]}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onClick={onClick}
        material={
          isSelected
            ? matUnitFloorSelected
            : hovered
            ? matUnitFloorHover
            : matUnitFloorPlane
        }
      >
        <planeGeometry args={[flat.rect.w - 0.04, flat.rect.d - 0.04]} />
      </mesh>

      {/* Exterior Flat Balcony */}
      {!xrayMode && flat.balcony && (
        <group position={[flat.balcony.x, 0, balconyZ]}>
          <mesh position={[0, 0.04, 0]} material={matBalconyTile}>
            <boxGeometry args={[flat.balcony.w, 0.08, 0.9]} />
          </mesh>
          <mesh position={[0, 0.5, isNorth ? -0.42 : 0.42]} material={matRailing}>
            <boxGeometry args={[flat.balcony.w, 0.9, 0.04]} />
          </mesh>
        </group>
      )}

      {/* Unit label in solo inspect mode (HTML pill) */}
      {phase === 'floor_inspecting' && (
        <Html position={[flat.rect.x, WALL_H + 0.45, flat.rect.z]} center distanceFactor={14}>
          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold tracking-tight border shadow-xs select-none pointer-events-none whitespace-nowrap transition-colors ${
              isSelected
                ? 'bg-[#4F46E5] text-white border-[#4338CA]'
                : hovered
                ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE]'
                : 'bg-white/95 text-[#0F172A] border-[#E5E7EB]'
            }`}
          >
            {unit?.displayId ? `Flat ${unit.displayId}` : flat.unitId}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive Parking Layout: Bays, Stripes, Aisle, Ramp, & Cars     */
/* ------------------------------------------------------------------ */

interface ParkingLayoutInteractiveProps {
  plan: FloorPlan;
  units: Unit[];
  phase: string;
  xrayMode: boolean;
}

function ParkingLayoutInteractive({
  plan,
  units,
  phase,
  xrayMode: _xrayMode,
}: ParkingLayoutInteractiveProps) {
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const selectedUnitId = useViewerStore((s) => s.selectedUnitId);
  const selectUnit = useViewerStore((s) => s.selectUnit);
  const hoverUnit = useViewerStore((s) => s.hoverUnit);

  const aisle = plan.aisle;
  const ramp = plan.ramp;

  return (
    <group>
      {/* 1. Drive Aisle */}
      {aisle && (
        <mesh position={[aisle.x, 0.014, aisle.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[aisle.w, aisle.d]} />
          <meshBasicMaterial color={SCENE.parkingAisle} />
        </mesh>
      )}

      {/* 2. Ramp at east end */}
      {ramp && (
        <group position={[ramp.x, 0.02, ramp.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[ramp.w, ramp.d]} />
            <meshBasicMaterial color={SCENE.parkingRamp} />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(ramp.w, 0.02, ramp.d)]} />
            <lineBasicMaterial color="#94A3B8" />
          </lineSegments>
          {phase === 'floor_inspecting' && (
            <Html position={[0, 0.25, 0]} center distanceFactor={14}>
              <div className="px-2 py-0.5 rounded bg-slate-700 text-white text-[10px] font-mono tracking-wider font-semibold shadow-xs uppercase select-none pointer-events-none">
                RAMP
              </div>
            </Html>
          )}
        </group>
      )}

      {/* 3. Bays & Stripes & Clickable tiles */}
      {plan.bays?.map((bay: ParkingBay) => {
        const unit = units.find((u) => u.displayId === bay.slotId) ?? units.find((u) => u.unitId.includes(bay.slotId));
        const unitId = unit?.unitId ?? `B1-${bay.slotId}`;
        const isSelected = selectedUnitId === unitId;
        const isHovered = hoveredSlotId === bay.slotId;

        const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHoveredSlotId(bay.slotId);
          hoverUnit(unitId);
        };

        const onPointerOut = (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHoveredSlotId(null);
          hoverUnit(null);
        };

        const onClick = (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          selectUnit(isSelected ? null : unitId);
        };

        return (
          <group key={bay.slotId}>
            {/* Bay floor tile */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[bay.rect.x, 0.016, bay.rect.z]}
              onPointerOver={onPointerOver}
              onPointerOut={onPointerOut}
              onClick={onClick}
              material={
                isSelected
                  ? matUnitFloorSelected
                  : isHovered
                  ? matUnitFloorHover
                  : matUnitFloorPlane
              }
            >
              <planeGeometry args={[bay.rect.w - 0.04, bay.rect.d - 0.04]} />
            </mesh>

            {/* Bay Stripe Outline (#CBD5E1) */}
            <group position={[bay.rect.x, 0.02, bay.rect.z]}>
              <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(bay.rect.w - 0.06, 0.01, bay.rect.d - 0.06)]} />
                <lineBasicMaterial color={SCENE.parkingStripe} />
              </lineSegments>
            </group>

            {/* Small Slot label in solo inspect view */}
            {phase === 'floor_inspecting' && (
              <Html position={[bay.rect.x, 0.35, bay.rect.z]} center distanceFactor={14}>
                <div
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold tracking-tight border shadow-2xs select-none pointer-events-none whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-[#4F46E5] text-white border-[#4338CA]'
                      : isHovered
                      ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE]'
                      : 'bg-white/95 text-[#334155] border-[#CBD5E1]'
                  }`}
                >
                  {bay.slotId}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* 4. Instanced Demo Cars */}
      {plan.bays && <ParkingCars bays={plan.bays} />}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive Utility Layout                                         */
/* ------------------------------------------------------------------ */

function UtilityLayoutInteractive({
  plan,
  phase,
}: {
  plan: FloorPlan;
  phase: string;
}) {
  return (
    <group>
      {plan.utilityRooms?.map((room) => (
        <group key={room.name} position={[room.rect.x, 0.02, room.rect.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[room.rect.w, room.rect.d]} />
            <meshBasicMaterial color="#E2E8F0" />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(room.rect.w, 1.2, room.rect.d)]} />
            <lineBasicMaterial color={COLOR_PRIMARY_900} />
          </lineSegments>
          {phase === 'floor_inspecting' && (
            <Html position={[0, 1.5, 0]} center distanceFactor={14}>
              <div className="px-2 py-0.5 rounded bg-slate-800 text-white text-[11px] font-medium border border-slate-700 shadow-xs select-none pointer-events-none">
                {room.name}
              </div>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Connector Line (dashed indicator between tower and extracted floor)*/
/* ------------------------------------------------------------------ */

function ConnectorLine({ fromX, toX, y }: { fromX: number; toX: number; y: number }) {
  const totalLen = Math.abs(toX - fromX);
  const segs = 14;
  const segLen = totalLen / (segs * 2);

  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: segs }, (_, i) => {
        const t = (i + 0.5) / segs;
        const x = fromX + t * totalLen;
        return (
          <mesh key={i} position={[x, 0, 0]}>
            <boxGeometry args={[segLen, 0.04, 0.04]} />
            <meshBasicMaterial color={new THREE.Color(COLOR_PRIMARY_500)} transparent opacity={0.65} />
          </mesh>
        );
      })}
    </group>
  );
}
