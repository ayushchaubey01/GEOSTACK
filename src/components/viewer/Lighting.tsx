'use client';

/**
 * Lighting.tsx
 *
 * Bright, neutral lighting for the light-theme 3D viewer.
 * Both modes are bright so no building face is crushed to black.
 *
 *  - Normal: hemisphere + strong directional + fill directional
 *  - X-ray:  slightly stronger ambient so transparent walls are
 *            uniformly lit from all sides
 */

import { useViewerStore } from '@/lib/viewer-store';

export default function Lighting() {
  const xrayMode = useViewerStore((s) => s.xrayMode);

  if (xrayMode) {
    return (
      <>
        <hemisphereLight args={['#FFFFFF', '#E5E7EB', 1.4]} />
        <ambientLight intensity={1.0} color={'#FFFFFF'} />
        <directionalLight position={[20, 30, 20]} intensity={0.8} color={'#FFFFFF'} />
        <directionalLight position={[-15, 20, -10]} intensity={0.6} color={'#FFFFFF'} />
      </>
    );
  }

  // Normal bright mode — matches the light canvas theme
  return (
    <>
      {/* Hemisphere: sky = pure white, ground = light grey */}
      <hemisphereLight args={['#FFFFFF', '#F3F4F6', 1.5]} />
      {/* Ambient: strong enough so no face is black */}
      <ambientLight intensity={1.15} color={'#FFFFFF'} />
      {/* Key light: slightly warm white from upper-right */}
      <directionalLight
        position={[18, 28, 14]}
        intensity={0.9}
        color={'#FFF8F0'}
      />
      {/* Fill light: cool white from left */}
      <directionalLight position={[-20, 14, -10]} intensity={0.5} color={'#EEF2FF'} />
    </>
  );
}
