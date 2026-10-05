/**
 * CarModel.tsx
 *
 * Low-poly demo sedan (~4.2 x 1.75 x 1.45 m) and InstancedMesh renderer for parking floors.
 * - Built once: body, glass, and wheels geometries
 * - Theme-aligned tokens: dark-bluish primary-900 (#312E81) base, per-instance variation (#3730A3, #1E1B4B)
 * - 3 draw calls total per parking floor via InstancedMesh
 * - Seeded +/- 2 degree yaw and occupancy
 */

import React, { useMemo, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SCENE } from '@/lib/design-tokens';
import type { ParkingBay } from '@/lib/floor-plan';

/* ------------------------------------------------------------------ */
/* Geometry Construction (Built Once at Module Scope)                 */
/* ------------------------------------------------------------------ */

let cachedCarGeometries: {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  wheels: THREE.BufferGeometry;
} | null = null;

export function getCarGeometries() {
  if (cachedCarGeometries) return cachedCarGeometries;

  const carLength = 4.2;
  const carWidth = 1.75;
  const halfW = carWidth / 2;

  // ── 1. Body Silhouette (Extruded along X) ────────────────────────────────
  // In local space: Length is along Z, Height along Y, Width along X
  const shape = new THREE.Shape();
  // Start at front bumper bottom
  shape.moveTo(-2.1, 0.22);
  shape.lineTo(-2.1, 0.60); // front bumper top
  shape.lineTo(-1.95, 0.68); // hood front
  shape.lineTo(-0.95, 0.78); // windshield base
  shape.lineTo(-0.35, 1.42); // roof front
  shape.lineTo(0.75, 1.42);  // roof rear
  shape.lineTo(1.35, 0.88);  // rear window base
  shape.lineTo(1.95, 0.82);  // trunk rear
  shape.lineTo(2.1, 0.60);   // rear bumper top
  shape.lineTo(2.1, 0.22);   // rear bumper bottom
  shape.closePath();

  // Extrude across carWidth
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: carWidth - 0.08,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 1,
  };
  const bodyExtruded = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // Center along X: ExtrudeGeometry extrudes in +Z in 2D shape coords,
  // rotate to align shape (Z, Y) with 3D (Z, Y) and extrusion along X
  bodyExtruded.rotateY(Math.PI / 2);
  bodyExtruded.translate(-halfW, 0, 0);

  // ── 2. Cabin Glass (Slightly Inset) ─────────────────────────────────────
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-0.90, 0.80);
  glassShape.lineTo(-0.33, 1.40);
  glassShape.lineTo(0.72, 1.40);
  glassShape.lineTo(1.30, 0.90);
  glassShape.closePath();

  const glassExtrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: carWidth - 0.16,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  };
  const glass = new THREE.ExtrudeGeometry(glassShape, glassExtrudeSettings);
  glass.rotateY(Math.PI / 2);
  glass.translate(-(halfW - 0.06), 0, 0);

  // ── 3. Wheels (4 Cylinders Merged into One Geometry) ────────────────────
  const wheelRadius = 0.32;
  const wheelWidth = 0.22;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16);
  // Cylinder default is upright along Y, rotate so axle is along X
  wheelGeo.rotateZ(Math.PI / 2);

  const wheelPositions = [
    [-halfW - 0.02, wheelRadius, -1.25], // front-left
    [halfW + 0.02, wheelRadius, -1.25],  // front-right
    [-halfW - 0.02, wheelRadius, 1.25],  // rear-left
    [halfW + 0.02, wheelRadius, 1.25],   // rear-right
  ];

  const wheelInstances: THREE.BufferGeometry[] = [];
  for (const pos of wheelPositions) {
    const w = wheelGeo.clone();
    w.translate(pos[0], pos[1], pos[2]);
    wheelInstances.push(w);
  }
  const wheels = mergeGeometries(wheelInstances, false);
  for (const w of wheelInstances) w.dispose();
  wheelGeo.dispose();

  cachedCarGeometries = {
    body: bodyExtruded,
    glass,
    wheels,
  };

  return cachedCarGeometries;
}

/* ------------------------------------------------------------------ */
/* Materials for Cars (Tokens)                                        */
/* ------------------------------------------------------------------ */

export const matCarBody = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.carBodyBase), // #312E81
  roughness: 0.40,
  metalness: 0.15,
  emissive: new THREE.Color(SCENE.carBodyAlt1), // #3730A3
  emissiveIntensity: 0.28,
});

export const matCarGlass = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.carGlass), // #C7D2FE
  roughness: 0.15,
  metalness: 0.3,
  transparent: true,
  opacity: 0.55,
});

export const matCarWheels = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.carWheels), // #1E293B
  roughness: 0.6,
  metalness: 0.05,
  emissive: new THREE.Color('#475569'),
  emissiveIntensity: 0.35,
});

const CAR_COLOR_VARIANTS = [
  new THREE.Color(SCENE.carBodyBase), // #312E81 (primary-900)
  new THREE.Color(SCENE.carBodyAlt1), // #3730A3 (indigo-700)
  new THREE.Color('#2E2A72'),         // vibrant deep indigo (#312E81 family)
];

/* ------------------------------------------------------------------ */
/* ParkingCars Component: 3 Draw Calls via InstancedMesh              */
/* ------------------------------------------------------------------ */

interface ParkingCarsProps {
  bays: ParkingBay[];
}

export function ParkingCars({ bays }: ParkingCarsProps) {
  const occupiedBays = useMemo(() => bays.filter((b) => b.occupiedDemo), [bays]);
  const count = occupiedBays.length;

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const glassRef = useRef<THREE.InstancedMesh>(null);
  const wheelsRef = useRef<THREE.InstancedMesh>(null);

  const { body, glass, wheels } = useMemo(() => getCarGeometries(), []);

  useLayoutEffect(() => {
    if (!bodyRef.current || !glassRef.current || !wheelsRef.current || count === 0) return;

    const dummy = new THREE.Object3D();

    occupiedBays.forEach((bay, i) => {
      dummy.position.set(bay.rect.x, 0, bay.rect.z);
      dummy.rotation.set(0, bay.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();

      bodyRef.current!.setMatrixAt(i, dummy.matrix);
      glassRef.current!.setMatrixAt(i, dummy.matrix);
      wheelsRef.current!.setMatrixAt(i, dummy.matrix);

      // Color variation
      const colIdx = Math.abs(Math.round(bay.rect.x * 3 + bay.rect.z)) % CAR_COLOR_VARIANTS.length;
      bodyRef.current!.setColorAt(i, CAR_COLOR_VARIANTS[colIdx]);
    });

    bodyRef.current.instanceMatrix.needsUpdate = true;
    if (bodyRef.current.instanceColor) bodyRef.current.instanceColor.needsUpdate = true;
    glassRef.current.instanceMatrix.needsUpdate = true;
    wheelsRef.current.instanceMatrix.needsUpdate = true;
  }, [occupiedBays, count]);

  if (count === 0) return null;

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[body, matCarBody, count]} castShadow receiveShadow />
      <instancedMesh ref={glassRef} args={[glass, matCarGlass, count]} />
      <instancedMesh ref={wheelsRef} args={[wheels, matCarWheels, count]} />
    </group>
  );
}
