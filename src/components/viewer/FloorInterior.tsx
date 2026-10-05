'use client';

/**
 * FloorInterior.tsx
 *
 * Data-driven interior wall rendering:
 * - Uses FloorPlan to build and cache merged BufferGeometries by plan.signature
 * - 2 draw calls per floor in tower X-ray (1 mesh + 1 lineSegments)
 * - View-dependent cutaway in floor view (extracted/solo)
 * - Geometries cached and disposed on demand
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FloorPlan, FlatPlan } from '@/lib/floor-plan';
import { FLOOR_DIMENSIONS, WALL_H, WALL_T, DOOR_W, DOOR_H } from '@/lib/floor-plan';
import {
  matWallXrayDefault,
  matWallXrayHover,
  matWallXraySelected,
  matWallFloorNormal,
  matWallFloorXray,
  matWallFloorEdges,
} from '@/lib/viewer-materials';

export interface WallBox {
  position: [number, number, number]; // [x, y, z] center of box
  size: [number, number, number];     // [width, height, depth]
  kind: 'unit' | 'core' | 'partition' | 'lintel' | 'sill';
  side: 'north' | 'south' | 'east' | 'west' | 'inner';
}

function buildMergedBoxes(boxes: WallBox[]): THREE.BufferGeometry {
  if (boxes.length === 0) {
    const empty = new THREE.BufferGeometry();
    empty.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    return empty;
  }
  const geos: THREE.BufferGeometry[] = [];
  for (const b of boxes) {
    const g = new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
    g.translate(b.position[0], b.position[1], b.position[2]);
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged || !merged.attributes.position) {
    const empty = new THREE.BufferGeometry();
    empty.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    return empty;
  }
  return merged;
}

function makeEdges(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geo || !geo.attributes.position || geo.attributes.position.count === 0) {
    const empty = new THREE.BufferGeometry();
    empty.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    return empty;
  }
  return new THREE.EdgesGeometry(geo);
}

export function planToWallBoxes(plan: FloorPlan): WallBox[] {
  const boxes: WallBox[] = [];
  const H = WALL_H;
  const T = WALL_T;
  const yMid = H / 2;
  const WS = FLOOR_DIMENSIONS.windowSillHeight;
  const WH = FLOOR_DIMENSIONS.windowHeight;
  const lintelH = H - (WS + WH);
  const doorLintelH = H - DOOR_H;

  // ── 1. Core Walls ────────────────────────────────────────────────────────
  const core = plan.core.rect;
  boxes.push(
    // North core wall
    { position: [core.x, yMid, core.z - core.d / 2], size: [core.w, H, T], kind: 'core', side: 'inner' },
    // South core wall
    { position: [core.x, yMid, core.z + core.d / 2], size: [core.w, H, T], kind: 'core', side: 'inner' },
    // East core wall
    { position: [core.x + core.w / 2, yMid, core.z], size: [T, H, core.d], kind: 'core', side: 'inner' },
    // West core wall
    { position: [core.x - core.w / 2, yMid, core.z], size: [T, H, core.d], kind: 'core', side: 'inner' }
  );

  // ── 2. Residential Flat Walls ────────────────────────────────────────────
  for (const flat of plan.flats) {
    const isNorth = flat.slot === 'NE' || flat.slot === 'NW';
    const isEast = flat.slot === 'NE' || flat.slot === 'SE';
    const rect = flat.rect;
    const xMin = rect.x - rect.w / 2;
    const xMax = rect.x + rect.w / 2;
    const zMin = rect.z - rect.d / 2;
    const zMax = rect.z + rect.d / 2;

    // (a) Outer N/S perimeter wall with window
    const outerZ = isNorth ? zMin : zMax;
    const sideNS = isNorth ? 'north' : 'south';
    const winNS = flat.windows.find((w) => w.wall === sideNS);
    const winNSW = winNS?.width || 2.4;
    const winNSCenterX = winNS?.pos[0] ?? rect.x;

    const leftFlankW = Math.max(0.1, winNSCenterX - winNSW / 2 - xMin);
    const rightFlankW = Math.max(0.1, xMax - (winNSCenterX + winNSW / 2));

    // Left flank
    boxes.push({
      position: [xMin + leftFlankW / 2, yMid, outerZ],
      size: [leftFlankW, H, T],
      kind: 'unit',
      side: sideNS,
    });
    // Right flank
    boxes.push({
      position: [xMax - rightFlankW / 2, yMid, outerZ],
      size: [rightFlankW, H, T],
      kind: 'unit',
      side: sideNS,
    });
    // Sill
    boxes.push({
      position: [winNSCenterX, WS / 2, outerZ],
      size: [winNSW, WS, T],
      kind: 'sill',
      side: sideNS,
    });
    // Lintel
    boxes.push({
      position: [winNSCenterX, WS + WH + lintelH / 2, outerZ],
      size: [winNSW, lintelH, T],
      kind: 'lintel',
      side: sideNS,
    });

    // (b) Outer E/W perimeter wall with window
    const outerX = isEast ? xMax : xMin;
    const sideEW = isEast ? 'east' : 'west';
    const winEW = flat.windows.find((w) => w.wall === sideEW);
    const winEWW = winEW?.width || 2.4;
    const winEWCenterZ = winEW?.pos[2] ?? rect.z;

    const topFlankD = Math.max(0.1, winEWCenterZ - winEWW / 2 - zMin);
    const botFlankD = Math.max(0.1, zMax - (winEWCenterZ + winEWW / 2));

    boxes.push({
      position: [outerX, yMid, zMin + topFlankD / 2],
      size: [T, H, topFlankD],
      kind: 'unit',
      side: sideEW,
    });
    boxes.push({
      position: [outerX, yMid, zMax - botFlankD / 2],
      size: [T, H, botFlankD],
      kind: 'unit',
      side: sideEW,
    });
    boxes.push({
      position: [outerX, WS / 2, winEWCenterZ],
      size: [T, WS, winEWW],
      kind: 'sill',
      side: sideEW,
    });
    boxes.push({
      position: [outerX, WS + WH + lintelH / 2, winEWCenterZ],
      size: [T, lintelH, winEWW],
      kind: 'lintel',
      side: sideEW,
    });

    // (c) Inner corridor-facing entry wall with door
    const innerX = isEast ? xMin : xMax;
    const doorZ = flat.door.pos[2];
    const flank1D = Math.max(0.1, doorZ - DOOR_W / 2 - zMin);
    const flank2D = Math.max(0.1, zMax - (doorZ + DOOR_W / 2));

    boxes.push({
      position: [innerX, yMid, zMin + flank1D / 2],
      size: [T, H, flank1D],
      kind: 'unit',
      side: 'inner',
    });
    boxes.push({
      position: [innerX, yMid, zMax - flank2D / 2],
      size: [T, H, flank2D],
      kind: 'unit',
      side: 'inner',
    });
    boxes.push({
      position: [innerX, DOOR_H + doorLintelH / 2, doorZ],
      size: [T, doorLintelH, DOOR_W],
      kind: 'lintel',
      side: 'inner',
    });

    // (d) Dividing wall between North and South flats (at zMax for North flats)
    if (isNorth) {
      boxes.push({
        position: [rect.x, yMid, zMax],
        size: [rect.w, H, T],
        kind: 'partition',
        side: 'inner',
      });
    }

    // (e) Interior room partitions
    for (const room of flat.rooms) {
      const isXSplit = Math.abs(room.p1[0] - room.p2[0]) > 0.1;
      if (isXSplit) {
        // Horizontal wall along X
        const pZ = room.p1[1];
        const segLen = (rect.w - DOOR_W) / 2;
        if (segLen > 0.4) {
          boxes.push({
            position: [xMin + segLen / 2, yMid, pZ],
            size: [segLen, H, T],
            kind: 'partition',
            side: 'inner',
          });
          boxes.push({
            position: [xMax - segLen / 2, yMid, pZ],
            size: [segLen, H, T],
            kind: 'partition',
            side: 'inner',
          });
          boxes.push({
            position: [rect.x, DOOR_H + doorLintelH / 2, pZ],
            size: [DOOR_W, doorLintelH, T],
            kind: 'lintel',
            side: 'inner',
          });
        }
      } else {
        // Vertical wall along Z
        const pX = room.p1[0];
        const segLen = (rect.d - DOOR_W) / 2;
        if (segLen > 0.4) {
          boxes.push({
            position: [pX, yMid, zMin + segLen / 2],
            size: [T, H, segLen],
            kind: 'partition',
            side: 'inner',
          });
          boxes.push({
            position: [pX, yMid, zMax - segLen / 2],
            size: [T, H, segLen],
            kind: 'partition',
            side: 'inner',
          });
          boxes.push({
            position: [pX, DOOR_H + doorLintelH / 2, rect.z],
            size: [T, doorLintelH, DOOR_W],
            kind: 'lintel',
            side: 'inner',
          });
        }
      }
    }
  }

  // ── 3. Utility Rooms (if utility floor) ──────────────────────────────────
  if (plan.utilityRooms) {
    for (const uRoom of plan.utilityRooms) {
      const r = uRoom.rect;
      boxes.push(
        { position: [r.x, yMid, r.z - r.d / 2], size: [r.w, H, T], kind: 'partition', side: 'inner' },
        { position: [r.x, yMid, r.z + r.d / 2], size: [r.w, H, T], kind: 'partition', side: 'inner' },
        { position: [r.x - r.w / 2, yMid, r.z], size: [T, H, r.d], kind: 'partition', side: 'inner' },
        { position: [r.x + r.w / 2, yMid, r.z], size: [T, H, r.d], kind: 'partition', side: 'inner' }
      );
    }
  }

  return boxes;
}

/* ------------------------------------------------------------------ */
/* Cached Geometry Store per Plan Signature                           */
/* ------------------------------------------------------------------ */

export interface CachedPlanGeometries {
  towerWallsGeo: THREE.BufferGeometry;
  towerWallsEdges: THREE.BufferGeometry;
  innerWallsGeo: THREE.BufferGeometry;
  innerWallsEdges: THREE.BufferGeometry;
  northWallsGeo: THREE.BufferGeometry;
  northWallsEdges: THREE.BufferGeometry;
  southWallsGeo: THREE.BufferGeometry;
  southWallsEdges: THREE.BufferGeometry;
  eastWallsGeo: THREE.BufferGeometry;
  eastWallsEdges: THREE.BufferGeometry;
  westWallsGeo: THREE.BufferGeometry;
  westWallsEdges: THREE.BufferGeometry;
}

const planGeomCache = new Map<string, CachedPlanGeometries>();

export function getPlanGeometries(plan: FloorPlan): CachedPlanGeometries {
  const sig = plan.signature;
  const existing = planGeomCache.get(sig);
  if (existing) return existing;

  const boxes = planToWallBoxes(plan);

  const towerWallsGeo = buildMergedBoxes(boxes);
  const towerWallsEdges = makeEdges(towerWallsGeo);

  const innerBoxes = boxes.filter((b) => b.side === 'inner' || b.kind === 'core');
  const northBoxes = boxes.filter((b) => b.side === 'north');
  const southBoxes = boxes.filter((b) => b.side === 'south');
  const eastBoxes = boxes.filter((b) => b.side === 'east');
  const westBoxes = boxes.filter((b) => b.side === 'west');

  const innerWallsGeo = buildMergedBoxes(innerBoxes);
  const innerWallsEdges = makeEdges(innerWallsGeo);

  const northWallsGeo = buildMergedBoxes(northBoxes);
  const northWallsEdges = makeEdges(northWallsGeo);

  const southWallsGeo = buildMergedBoxes(southBoxes);
  const southWallsEdges = makeEdges(southWallsGeo);

  const eastWallsGeo = buildMergedBoxes(eastBoxes);
  const eastWallsEdges = makeEdges(eastWallsGeo);

  const westWallsGeo = buildMergedBoxes(westBoxes);
  const westWallsEdges = makeEdges(westWallsGeo);

  const geos: CachedPlanGeometries = {
    towerWallsGeo,
    towerWallsEdges,
    innerWallsGeo,
    innerWallsEdges,
    northWallsGeo,
    northWallsEdges,
    southWallsGeo,
    southWallsEdges,
    eastWallsGeo,
    eastWallsEdges,
    westWallsGeo,
    westWallsEdges,
  };

  planGeomCache.set(sig, geos);
  return geos;
}

export function disposePlanGeometries() {
  for (const geos of planGeomCache.values()) {
    geos.towerWallsGeo.dispose();
    geos.towerWallsEdges.dispose();
    geos.innerWallsGeo.dispose();
    geos.innerWallsEdges.dispose();
    geos.northWallsGeo.dispose();
    northWallsEdgesDispose(geos);
  }
  planGeomCache.clear();
}

function northWallsEdgesDispose(geos: CachedPlanGeometries) {
  geos.northWallsGeo.dispose();
  geos.northWallsEdges.dispose();
  geos.southWallsGeo.dispose();
  geos.southWallsEdges.dispose();
  geos.eastWallsGeo.dispose();
  geos.eastWallsEdges.dispose();
  geos.westWallsGeo.dispose();
  geos.westWallsEdges.dispose();
}

/* ------------------------------------------------------------------ */
/* FloorInterior Component                                            */
/* ------------------------------------------------------------------ */

interface FloorInteriorProps {
  plan: FloorPlan;
  mode: 'tower_xray' | 'floor_view';
  isHovered?: boolean;
  isSelected?: boolean;
  xrayMode?: boolean;
  cutawayActive?: boolean;
}

export function FloorInterior({
  plan,
  mode,
  isHovered = false,
  isSelected = false,
  xrayMode = false,
  cutawayActive = false,
}: FloorInteriorProps) {
  const groupRef = useRef<THREE.Group>(null);
  const worldCamPos = useRef(new THREE.Vector3());
  const localCamPos = useRef(new THREE.Vector3());

  const geos = useMemo(() => getPlanGeometries(plan), [plan]);

  // Perimeter materials for cutaway
  const matNorth = useMemo(() => makePerimeterMaterial(), []);
  const matSouth = useMemo(() => makePerimeterMaterial(), []);
  const matEast = useMemo(() => makePerimeterMaterial(), []);
  const matWest = useMemo(() => makePerimeterMaterial(), []);

  // View-dependent cutaway in floor view (extracted or solo)
  useFrame(({ camera }) => {
    if (!cutawayActive || mode !== 'floor_view' || !groupRef.current) return;

    camera.getWorldPosition(worldCamPos.current);
    localCamPos.current.copy(worldCamPos.current);
    groupRef.current.worldToLocal(localCamPos.current);

    const cx = localCamPos.current.x;
    const cz = localCamPos.current.z;

    const targetNorth = cz < -1 ? 0.20 : 0.95;
    const targetSouth = cz > 1 ? 0.20 : 0.95;
    const targetEast = cx > 1 ? 0.20 : 0.95;
    const targetWest = cx < -1 ? 0.20 : 0.95;

    matNorth.opacity += (targetNorth - matNorth.opacity) * 0.1;
    matSouth.opacity += (targetSouth - matSouth.opacity) * 0.1;
    matEast.opacity += (targetEast - matEast.opacity) * 0.1;
    matWest.opacity += (targetWest - matWest.opacity) * 0.1;
  });

  // ── Tower X-ray Mode: 2 draw calls per floor ─────────────────────────────
  if (mode === 'tower_xray') {
    const wallMat = isSelected
      ? matWallXraySelected
      : isHovered
      ? matWallXrayHover
      : matWallXrayDefault;

    return (
      <group ref={groupRef}>
        <mesh geometry={geos.towerWallsGeo} material={wallMat} />
        <lineSegments geometry={geos.towerWallsEdges} material={matWallFloorEdges} />
      </group>
    );
  }

  // ── Floor View Mode (Extracted / Solo) ───────────────────────────────────
  const fillMat = xrayMode ? matWallFloorXray : matWallFloorNormal;

  return (
    <group ref={groupRef}>
      {/* Inner + Core Walls: Always fully rendered */}
      <mesh geometry={geos.innerWallsGeo} material={fillMat} />
      <lineSegments geometry={geos.innerWallsEdges} material={matWallFloorEdges} />

      {/* Directional Cutaway Perimeter Walls */}
      <mesh geometry={geos.northWallsGeo} material={xrayMode ? matWallFloorXray : matNorth} />
      <lineSegments geometry={geos.northWallsEdges} material={matWallFloorEdges} />

      <mesh geometry={geos.southWallsGeo} material={xrayMode ? matWallFloorXray : matSouth} />
      <lineSegments geometry={geos.southWallsEdges} material={matWallFloorEdges} />

      <mesh geometry={geos.eastWallsGeo} material={xrayMode ? matWallFloorXray : matEast} />
      <lineSegments geometry={geos.eastWallsEdges} material={matWallFloorEdges} />

      <mesh geometry={geos.westWallsGeo} material={xrayMode ? matWallFloorXray : matWest} />
      <lineSegments geometry={geos.westWallsEdges} material={matWallFloorEdges} />
    </group>
  );
}

function makePerimeterMaterial(initialOpacity = 1.0) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F9FAFB'),
    roughness: 0.85,
    metalness: 0.02,
    transparent: true,
    opacity: initialOpacity,
    side: THREE.DoubleSide,
  });
}
