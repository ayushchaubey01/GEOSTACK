'use client';

/**
 * CameraRig.tsx
 *
 * Registers the active camera + OrbitControls with the central
 * transition controller so GSAP can tween them on phase change.
 *
 * No per-frame work — keeps scroll/orbit buttery smooth because
 * OrbitControls fully owns the camera between transitions.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { registerRef } from './useTransitionController';

export default function CameraRig() {
  const { camera, controls } = useThree() as any;

  useEffect(() => {
    registerRef('camera', camera);
    registerRef('controls', controls ?? null);
    return () => {
      registerRef('camera', null);
      registerRef('controls', null);
    };
  }, [camera, controls]);

  return null;
}
