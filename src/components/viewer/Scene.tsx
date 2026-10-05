'use client';

/**
 * Scene.tsx — the contents rendered inside the R3F Canvas.
 *
 * Drives the background/fog/grid colors based on `xrayMode`:
 *  - Both modes: unified light background (#F6F7F9) + architectural grid tokens
 *  - X-RAY ON: transparent walls + interior floor layout walls
 *              (matches the reference "glass-box architectural visualization")
 */

import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Building from './Building';
import ExtractedFloor from './ExtractedFloor';
import Lighting from './Lighting';
import CameraRig from './CameraRig';
import { useViewerStore, useBuilding } from '@/lib/viewer-store';
import { useTransitionController, isTransitionRunning, startTransition, getRef } from './useTransitionController';
import { COLOR_CANVAS, COLOR_BORDER, COLOR_BORDER_STRONG } from '@/lib/design-tokens';
import { getFloorPlan, clearFloorPlanCache } from '@/lib/floor-plan';
import { getPlanGeometries, disposePlanGeometries } from './FloorInterior';

export default function Scene() {
  const phase = useViewerStore((s) => s.phase);
  const xrayMode = useViewerStore((s) => s.xrayMode);
  const sceneReady = useViewerStore((s) => s.sceneReady);
  const building = useBuilding();
  useTransitionController();

  const { gl, camera, scene } = useThree();
  const controlsRef = useRef<any>(null);

  // Warm up all scene materials/shaders asynchronously at boot
  useEffect(() => {
    gl.compileAsync(scene, camera);
  }, [gl, camera, scene]);

  // Clear cache on building change and dispose geometries
  useEffect(() => {
    return () => {
      clearFloorPlanCache();
      disposePlanGeometries();
    };
  }, [building.ulpin]);

  // Prewarm plans and merged geometries in requestIdleCallback after sceneReady
  useEffect(() => {
    if (!sceneReady) return;
    const prewarm = () => {
      for (const floor of building.floors) {
        const plan = getFloorPlan(floor, building.footprint);
        getPlanGeometries(plan);
      }
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(prewarm);
      return () => (window as any).cancelIdleCallback(handle);
    } else {
      const timer = setTimeout(prewarm, 50);
      return () => clearTimeout(timer);
    }
  }, [sceneReady, building]);

  // Expose dev-only hook for Playwright / test automation
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      (window as any).__viewer = {
        store: useViewerStore,
        gl,
        camera,
        scene,
        isTransitionRunning,
        startTransition,
        get building() {
          return getRef('building');
        },
        get extractedFloor() {
          return getRef('extractedFloor');
        },
        get selectionBeam() {
          return getRef('selectionBeam');
        },
        get controls() {
          return controlsRef.current;
        },
      };
    }
  }, [gl, camera]);

  // Both modes use COLOR_CANVAS (#F6F7F9) for a clean, consistent light architectural backdrop
  const bgColor = COLOR_CANVAS;
  const fogColor = COLOR_CANVAS;
  const fogNear = 80;
  const fogFar = 220;
  const gridSectionColor = COLOR_BORDER_STRONG; // #D1D5DB
  const gridColor = COLOR_BORDER;               // #E5E7EB

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

      <Lighting />

      {/* Main building */}
      <Building />

      {/* Extracted floor — always mounted to prevent shader compilation hitches */}
      <ExtractedFloor />

      {/* Ground grid — at y=0.01 in both modes, aligned with ground plane */}
      <gridHelper
        args={[120, 60, gridSectionColor, gridColor]}
        position={[0, 0.01, 0]}
      />

      <CameraRig />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={true}
        enableDamping
        dampingFactor={0.08}
        minDistance={5}
        maxDistance={150}
        maxPolarAngle={Math.PI - 0.05}
        minPolarAngle={0.05}
        target={[0, 20, 0]}
        panSpeed={0.5}
        rotateSpeed={0.65}
        zoomSpeed={0.8}
      />
    </>
  );
}
