'use client';

/**
 * useTransitionController.ts
 *
 * Cinematic transition controller with:
 * - Single eased timeline per transition: t = clamp(elapsed / duration, 0, 1), easeInOutCubic
 * - Building slides completely to the left off-screen (x = -48), then the floor view opens centered (x = 0)
 * - Spherical camera interpolation around linear target: arcs gracefully, never cuts through the tower
 * - Snapshot-at-start from actual camera and controls (no teleporting/snapping even after user orbits)
 * - OrbitControls disabled during transitions, updated once on completion
 * - Phase flips strictly at progress = 1
 * - Zero material shader recompiles (materials initialized transparent, opacity driven from timeline)
 * - Supports prefers-reduced-motion (instant transition)
 */

import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useViewerStore, ViewPhase } from '@/lib/viewer-store';

interface RegisteredRefs {
  building?: THREE.Group | null;
  extractedFloor?: THREE.Group | null;
  camera?: THREE.PerspectiveCamera | null;
  controls?: any;
  selectionBeam?: any;
}

const refs: RegisteredRefs = {};

export function getRef(key: keyof RegisteredRefs) {
  return refs[key];
}

export function registerRef(key: keyof RegisteredRefs, value: any) {
  (refs as any)[key] = value;
  if (key === 'building' && value) {
    initBuildingMaterials(value);
  }
}

// ── Cache building materials once up-front ─────────────────────────────────
const buildingMaterials = new Set<THREE.Material>();

function initBuildingMaterials(group: THREE.Group) {
  buildingMaterials.clear();
  group.traverse((obj: any) => {
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m.userData) m.userData = {};
        if (m.userData._origOpacity === undefined) {
          m.userData._origOpacity = m.opacity ?? 1;
          m.userData._origTransparent = m.transparent ?? false;
        }
        // Ensure transparent: true up-front to prevent runtime shader recompile
        m.transparent = true;
        buildingMaterials.add(m);
      }
    }
  });
}

function setBuildingOpacity(opacity: number) {
  for (const m of buildingMaterials) {
    const base = m.userData._origOpacity ?? 1;
    m.opacity = base * opacity;
  }
  if (refs.building) {
    refs.building.visible = opacity > 0.005;
  }
}

function restoreBuildingMaterials() {
  for (const m of buildingMaterials) {
    m.opacity = m.userData._origOpacity ?? 1;
    m.transparent = m.userData._origTransparent ?? false;
  }
  if (refs.building) {
    refs.building.visible = true;
  }
}

/* ------------------------------------------------------------------ */
/* Phase target coordinates                                            */
/* ------------------------------------------------------------------ */

// Building positions
const BUILDING_X_CENTER = 0;
const BUILDING_X_EXTRACTED = -12;
const BUILDING_X_OFFSCREEN = -48; // Completely left outside screen

// Floor positions
const FLOOR_X_HIDDEN = 28;
const FLOOR_X_BESIDE = 13;
const FLOOR_X_CENTER = 0;

const FLOOR_SCALE_HIDDEN = 0.5;
const FLOOR_SCALE_BESIDE = 0.95;
const FLOOR_SCALE_ACTIVE = 1.05;

export const OVERVIEW_POS = new THREE.Vector3(55, 32, 55);
export const OVERVIEW_TARGET = new THREE.Vector3(0, 18, 0);

export const EXTRACTED_POS = new THREE.Vector3(38, 28, 45);
export const EXTRACTED_TARGET = new THREE.Vector3(0.5, 12, 0);

export const SOLO_POS = new THREE.Vector3(26, 22, 30);
export const SOLO_TARGET = new THREE.Vector3(0, 8, 0);

/* ------------------------------------------------------------------ */
/* Easing and Spherical Interpolation Helpers                         */
/* ------------------------------------------------------------------ */

export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function toSpherical(p: THREE.Vector3, center: THREE.Vector3) {
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  const dz = p.z - center.z;
  const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const safeRadius = Math.max(radius, 0.0001);
  const phi = Math.acos(Math.min(Math.max(dy / safeRadius, -1), 1));
  const theta = Math.atan2(dx, dz);
  return { radius, phi, theta };
}

export function fromSpherical(radius: number, phi: number, theta: number, center: THREE.Vector3): THREE.Vector3 {
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    center.x + radius * sinPhi * Math.sin(theta),
    center.y + radius * Math.cos(phi),
    center.z + radius * sinPhi * Math.cos(theta),
  );
}

/* ------------------------------------------------------------------ */
/* Active Timeline State                                              */
/* ------------------------------------------------------------------ */

interface ActiveTimeline {
  startTime: number;
  duration: number;
  settlePhase: ViewPhase;
  kind: 'to_extracted' | 'to_solo' | 'to_overview' | 'floor_switch';

  // Starting snapshots
  fromBuildingX: number;
  fromBuildingOpacity: number;
  fromFloorX: number;
  fromFloorScale: number;
  fromFloorOpacity: number;

  fromCamPos: THREE.Vector3;
  fromCamTarget: THREE.Vector3;

  // Target values
  toBuildingX: number;
  toBuildingOpacity: number;
  toFloorX: number;
  toFloorScale: number;
  toFloorOpacity: number;

  toCamPos: THREE.Vector3;
  toCamTarget: THREE.Vector3;

  // Spherical params
  r1: number;
  phi1: number;
  theta1: number;

  r2: number;
  phi2: number;
  theta2: number;
  deltaTheta: number;
}

let activeTimeline: ActiveTimeline | null = null;
let moduleLastPhase: ViewPhase = 'overview';
let moduleLastFloor: number | null = null;

// Track current values across frames
let curBuildingX = 0;
let curBuildingOpacity = 1;
let curFloorX = FLOOR_X_HIDDEN;
let curFloorScale = FLOOR_SCALE_HIDDEN;
let curFloorOpacity = 0;

export function isTransitionRunning(): boolean {
  return activeTimeline !== null;
}

export function startTransition(targetPhase: ViewPhase, isFloorSwitch = false) {
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const duration = prefersReducedMotion ? 40 : (isFloorSwitch ? 380 : 880);
  const now = performance.now();

  const cam = refs.camera;
  const controls = refs.controls;

  // 1. Snapshot CURRENT camera position and controls target
  const currentCamPos = cam ? cam.position.clone() : OVERVIEW_POS.clone();
  const currentCamTarget = controls?.target ? controls.target.clone() : OVERVIEW_TARGET.clone();

  // Disable controls during transition
  if (controls) {
    controls.enabled = false;
  }

  // 2. Determine target values and choreography kind
  let kind: 'to_extracted' | 'to_solo' | 'to_overview' | 'floor_switch' = 'to_extracted';
  let settlePhase: ViewPhase = 'extracted';

  let toBuildingX = BUILDING_X_EXTRACTED;
  let toBuildingOpacity = 1;
  let toFloorX = FLOOR_X_BESIDE;
  let toFloorScale = FLOOR_SCALE_BESIDE;
  let toFloorOpacity = 1;
  let toCamPos = EXTRACTED_POS.clone();
  let toCamTarget = EXTRACTED_TARGET.clone();

  if (targetPhase === 'overview' || targetPhase === 'returning') {
    kind = 'to_overview';
    settlePhase = 'overview';
    toBuildingX = BUILDING_X_CENTER;
    toBuildingOpacity = 1;
    toFloorX = FLOOR_X_HIDDEN;
    toFloorScale = FLOOR_SCALE_HIDDEN;
    toFloorOpacity = 0;
    toCamPos = OVERVIEW_POS.clone();
    toCamTarget = OVERVIEW_TARGET.clone();
  } else if (targetPhase === 'floor_inspecting' || targetPhase === 'floor_inspect_selecting') {
    kind = 'to_solo';
    settlePhase = 'floor_inspecting';
    toBuildingX = BUILDING_X_OFFSCREEN;
    toBuildingOpacity = 0;
    toFloorX = FLOOR_X_CENTER;
    toFloorScale = FLOOR_SCALE_ACTIVE;
    toFloorOpacity = 1;
    toCamPos = SOLO_POS.clone();
    toCamTarget = SOLO_TARGET.clone();
  } else if (isFloorSwitch) {
    kind = 'floor_switch';
    const currentPhase = useViewerStore.getState().phase;
    if (currentPhase === 'floor_inspecting' || currentPhase === 'floor_inspect_selecting') {
      settlePhase = 'floor_inspecting';
      toBuildingX = BUILDING_X_OFFSCREEN;
      toBuildingOpacity = 0;
      toFloorX = FLOOR_X_CENTER;
      toFloorScale = FLOOR_SCALE_ACTIVE;
      toFloorOpacity = 1;
    } else {
      settlePhase = 'extracted';
      toBuildingX = BUILDING_X_EXTRACTED;
      toBuildingOpacity = 1;
      toFloorX = FLOOR_X_BESIDE;
      toFloorScale = FLOOR_SCALE_BESIDE;
      toFloorOpacity = 1;
    }
    toCamPos = currentCamPos.clone();
    toCamTarget = currentCamTarget.clone();
  } else {
    // target is extracted / floor_selecting / floor_inspect_returning
    kind = 'to_extracted';
    settlePhase = 'extracted';
    toBuildingX = BUILDING_X_EXTRACTED;
    toBuildingOpacity = 1;
    toFloorX = FLOOR_X_BESIDE;
    toFloorScale = FLOOR_SCALE_BESIDE;
    toFloorOpacity = 1;
    toCamPos = EXTRACTED_POS.clone();
    toCamTarget = EXTRACTED_TARGET.clone();
  }

  // 3. Compute spherical coordinates
  const s1 = toSpherical(currentCamPos, currentCamTarget);
  const s2 = toSpherical(toCamPos, toCamTarget);

  let deltaTheta = s2.theta - s1.theta;
  while (deltaTheta > Math.PI) deltaTheta -= 2 * Math.PI;
  while (deltaTheta < -Math.PI) deltaTheta += 2 * Math.PI;

  activeTimeline = {
    startTime: now,
    duration,
    settlePhase,
    kind,

    fromBuildingX: curBuildingX,
    fromBuildingOpacity: curBuildingOpacity,
    fromFloorX: curFloorX,
    fromFloorScale: curFloorScale,
    fromFloorOpacity: curFloorOpacity,

    fromCamPos: currentCamPos,
    fromCamTarget: currentCamTarget,

    toBuildingX,
    toBuildingOpacity,
    toFloorX,
    toFloorScale,
    toFloorOpacity,

    toCamPos,
    toCamTarget,

    r1: s1.radius,
    phi1: s1.phi,
    theta1: s1.theta,

    r2: s2.radius,
    phi2: s2.phi,
    theta2: s2.theta,
    deltaTheta,
  };
}

/* ------------------------------------------------------------------ */
/* React Hook                                                          */
/* ------------------------------------------------------------------ */

export function useTransitionController() {
  const phase = useViewerStore((s) => s.phase);
  const selectedFloor = useViewerStore((s) => s.selectedFloor);

  useEffect(() => {
    if (phase === moduleLastPhase && selectedFloor === moduleLastFloor) {
      return;
    }

    const phaseChanged = phase !== moduleLastPhase;
    const floorChanged = selectedFloor !== moduleLastFloor;
    if (!phaseChanged && !floorChanged) return;

    moduleLastPhase = phase;
    moduleLastFloor = selectedFloor;

    if (phase === 'loading') return;

    const isSwitch = !phaseChanged && floorChanged;
    startTransition(phase, isSwitch);
  }, [phase, selectedFloor]);

  useFrame(() => {
    if (!activeTimeline) return;

    const now = performance.now();
    const elapsed = now - activeTimeline.startTime;
    const rawT = Math.min(1, Math.max(0, elapsed / activeTimeline.duration));
    const ease = easeInOutCubic(rawT);

    const tl = activeTimeline;

    // ── 1. Building and Floor Choreography ──────────────────────────────────
    if (tl.kind === 'to_solo') {
      // (a) Building slides left off-screen (-12 -> -48): sub-range t in [0.0, 0.65]
      const tBldg = easeInOutCubic(Math.min(1, Math.max(0, rawT / 0.65)));
      curBuildingX = THREE.MathUtils.lerp(tl.fromBuildingX, tl.toBuildingX, tBldg);
      curBuildingOpacity = THREE.MathUtils.lerp(tl.fromBuildingOpacity, tl.toBuildingOpacity, tBldg);

      // (b) Floor opens centered (13 -> 0): sub-range t in [0.20, 1.0]
      const tFlr = easeInOutCubic(Math.min(1, Math.max(0, (rawT - 0.20) / 0.80)));
      curFloorX = THREE.MathUtils.lerp(tl.fromFloorX, tl.toFloorX, tFlr);
      curFloorScale = THREE.MathUtils.lerp(tl.fromFloorScale, tl.toFloorScale, tFlr);
      curFloorOpacity = THREE.MathUtils.lerp(tl.fromFloorOpacity, tl.toFloorOpacity, tFlr);
    } else if (tl.kind === 'to_extracted') {
      // (a) Building moves to -12
      const tBldg = easeInOutCubic(Math.min(1, Math.max(0, rawT / 0.80)));
      curBuildingX = THREE.MathUtils.lerp(tl.fromBuildingX, tl.toBuildingX, tBldg);
      curBuildingOpacity = THREE.MathUtils.lerp(tl.fromBuildingOpacity, tl.toBuildingOpacity, tBldg);

      // (b) Floor slides beside building to 13
      const tFlr = easeInOutCubic(Math.min(1, Math.max(0, (rawT - 0.15) / 0.85)));
      curFloorX = THREE.MathUtils.lerp(tl.fromFloorX, tl.toFloorX, tFlr);
      curFloorScale = THREE.MathUtils.lerp(tl.fromFloorScale, tl.toFloorScale, tFlr);
      curFloorOpacity = THREE.MathUtils.lerp(tl.fromFloorOpacity, tl.toFloorOpacity, tFlr);
    } else if (tl.kind === 'to_overview') {
      // (a) Floor leaves to right: sub-range t in [0.0, 0.50]
      const tFlr = easeInOutCubic(Math.min(1, Math.max(0, rawT / 0.50)));
      curFloorX = THREE.MathUtils.lerp(tl.fromFloorX, tl.toFloorX, tFlr);
      curFloorScale = THREE.MathUtils.lerp(tl.fromFloorScale, tl.toFloorScale, tFlr);
      curFloorOpacity = THREE.MathUtils.lerp(tl.fromFloorOpacity, tl.toFloorOpacity, tFlr);

      // (b) Building slides back to center: sub-range t in [0.25, 1.0]
      const tBldg = easeInOutCubic(Math.min(1, Math.max(0, (rawT - 0.25) / 0.75)));
      curBuildingX = THREE.MathUtils.lerp(tl.fromBuildingX, tl.toBuildingX, tBldg);
      curBuildingOpacity = THREE.MathUtils.lerp(tl.fromBuildingOpacity, tl.toBuildingOpacity, tBldg);
    } else {
      // floor switch
      curBuildingX = tl.toBuildingX;
      curBuildingOpacity = tl.toBuildingOpacity;
      curFloorX = tl.toFloorX;
      curFloorScale = tl.toFloorScale;
      curFloorOpacity = 1;
    }

    // Apply to objects
    if (refs.building) {
      refs.building.position.x = curBuildingX;
      setBuildingOpacity(curBuildingOpacity);
    }

    if (refs.extractedFloor) {
      refs.extractedFloor.position.x = curFloorX;
      refs.extractedFloor.scale.setScalar(curFloorScale);
      refs.extractedFloor.visible = curFloorOpacity > 0.01;
    }

    if (refs.selectionBeam) {
      refs.selectionBeam.visible = curFloorOpacity > 0.5 && curBuildingOpacity > 0.5 && curBuildingX > -25;
    }

    // ── 2. Spherical Camera & Target Arc ────────────────────────────────────
    const cam = refs.camera;
    const controls = refs.controls;

    if (cam) {
      const curTarget = new THREE.Vector3().lerpVectors(tl.fromCamTarget, tl.toCamTarget, ease);
      const curRadius = THREE.MathUtils.lerp(tl.r1, tl.r2, ease);
      const curPhi = THREE.MathUtils.lerp(tl.phi1, tl.phi2, ease);
      const curTheta = tl.theta1 + tl.deltaTheta * ease;

      const newPos = fromSpherical(curRadius, curPhi, curTheta, curTarget);
      cam.position.copy(newPos);
      cam.lookAt(curTarget);

      if (controls) {
        controls.target.copy(curTarget);
      }
    }

    // ── 3. Completion at rawT >= 1 ──────────────────────────────────────────
    if (rawT >= 1) {
      // Snap to exact target
      curBuildingX = tl.toBuildingX;
      curBuildingOpacity = tl.toBuildingOpacity;
      curFloorX = tl.toFloorX;
      curFloorScale = tl.toFloorScale;
      curFloorOpacity = tl.toFloorOpacity;

      if (refs.building) {
        refs.building.position.x = tl.toBuildingX;
        if (tl.toBuildingOpacity >= 0.99) {
          restoreBuildingMaterials();
        } else {
          setBuildingOpacity(0);
        }
      }

      if (refs.extractedFloor) {
        refs.extractedFloor.position.x = tl.toFloorX;
        refs.extractedFloor.scale.setScalar(tl.toFloorScale);
        refs.extractedFloor.visible = tl.toFloorOpacity > 0.01;
      }

      if (cam && controls) {
        cam.position.copy(tl.toCamPos);
        controls.target.copy(tl.toCamTarget);
        cam.lookAt(tl.toCamTarget);
        controls.enabled = true;
        controls.update();
      }

      const settle = tl.settlePhase;
      activeTimeline = null;

      // Update moduleLast values so useEffect knows we are ALREADY settled
      moduleLastPhase = settle;
      moduleLastFloor = settle === 'overview' ? null : useViewerStore.getState().selectedFloor;

      // Update Zustand store strictly on completion
      if (settle === 'overview') {
        useViewerStore.setState({
          phase: 'overview',
          selectedFloor: null,
          selectedUnitId: null,
          hoveredUnitId: null,
          tooltipFloor: null,
        });
      } else {
        useViewerStore.getState().setPhase(settle);
      }
    }
  });
}
