'use client';

/**
 * SelectionBeam.tsx
 *
 * A glowing "data stream" beam that connects the selected floor in
 * the building (left side, post-translation) to the extracted floor
 * model on the right.
 *
 * Visibility is toggled by the central GSAP transition controller.
 * The pulse is a single per-frame animation (lightweight).
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useViewerStore } from '@/lib/viewer-store';
import { registerRef } from './useTransitionController';

export default function SelectionBeam() {
  const ref = useRef<THREE.Group>(null);
  const phase = useViewerStore((s) => s.phase);
  const selectedFloor = useViewerStore((s) => s.selectedFloor);

  const sourceY = useMemo(() => {
    if (selectedFloor === null) return 0;
    return (selectedFloor + 0.5) * 3.0 + 0.3;
  }, [selectedFloor]);

  // Source = right edge of building (in world coords, building centre is at -12
  // and width is 20 → right edge at -2). Target = left edge of extracted floor
  // (centre at 13, scale 1.3, FLOOR_W 18 → left edge at 13 - 9 * 1.3 ≈ 1.3).
  // Y of extracted floor centre is 8.
  const targetY = 9.5;
  const sourceX = -2.5;
  const targetX = 2.0;

  // Register with the transition controller so GSAP can toggle visibility.
  useEffect(() => {
    registerRef('selectionBeam', ref.current);
    return () => registerRef('selectionBeam', null);
  }, []);

  // Compute the orientation + length of the beam
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const angle = Math.atan2(dy, dx);
  const length = Math.sqrt(dx * dx + dy * dy);

  const segCount = 18;
  const segLen = length / (segCount * 1.7);

  // Throttled pulse — only update opacity every ~80ms (12fps) instead
  // of every frame. The pulse is decorative, doesn't need 60fps.
  const lastPulseUpdate = useRef(0);
  useFrame((state) => {
    if (!ref.current) return;
    // Throttle to ~12fps
    if (state.clock.elapsedTime - lastPulseUpdate.current < 0.08) return;
    lastPulseUpdate.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime;
    ref.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (mat && mat.opacity !== undefined) {
        mat.opacity = 0.55 + Math.sin(t * 2.5 - i * 0.25) * 0.25;
      }
    });
  });

  return (
    <group ref={ref} visible={false}>
      {Array.from({ length: segCount }, (_, i) => {
        const t = (i + 0.5) / segCount;
        const x = sourceX + t * dx;
        const y = sourceY + t * dy;
        return (
          <mesh key={i} position={[x, y, 0]} rotation={[0, 0, angle]}>
            <boxGeometry args={[segLen, 0.08, 0.08]} />
            <meshBasicMaterial
              color={new THREE.Color('#5fe2e6')}
              transparent
              opacity={0.7}
              depthTest={false}
            />
          </mesh>
        );
      })}
      <mesh position={[sourceX, sourceY, 0]}>
        <ringGeometry args={[0.22, 0.4, 24]} />
        <meshBasicMaterial color={new THREE.Color('#5fe2e6')} transparent opacity={0.9} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
      <mesh position={[targetX, targetY, 0]}>
        <ringGeometry args={[0.22, 0.4, 24]} />
        <meshBasicMaterial color={new THREE.Color('#5fe2e6')} transparent opacity={0.9} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
    </group>
  );
}
