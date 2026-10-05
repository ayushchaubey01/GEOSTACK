'use client';

/**
 * BuildingViewer.tsx
 *
 * Top-level wrapper that mounts the R3F Canvas, the Scene, and the UI
 * overlay (loading screen, HUD).
 *
 * Light-theme: canvas background #F6F7F9, no dark vignette.
 */

import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import Scene from './Scene';
import LoadingScreen from './LoadingScreen';
import Hud from './Hud';
import { useViewerStore } from '@/lib/viewer-store';
import { COLOR_CANVAS } from '@/lib/design-tokens';

export default function BuildingViewer() {
  const [booted, setBooted] = useState(false);
  const sceneReady = useViewerStore((s) => s.sceneReady);
  const setSceneReady = useViewerStore((s) => s.setSceneReady);
  const setLoadProgress = useViewerStore((s) => s.setLoadProgress);

  // Simulate loading progression while the GL pipeline + assets boot.
  useEffect(() => {
    let p = 0;
    const id = window.setInterval(() => {
      p = Math.min(100, p + 6 + Math.random() * 6);
      setLoadProgress(p / 100);
      if (p >= 100) {
        window.clearInterval(id);
        setTimeout(() => {
          setSceneReady(true);
          setBooted(true);
        }, 320);
      }
    }, 90);
    return () => window.clearInterval(id);
  }, [setLoadProgress, setSceneReady]);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: COLOR_CANVAS }}>
      {/* Canvas */}
      <div className="absolute inset-0">
        <Canvas
          dpr={[1, 1.25]}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: true,
            toneMapping: THREE.NoToneMapping,
            toneMappingExposure: 1.0,
          }}
          camera={{
            fov: 32,
            near: 0.5,
            far: 500,
            position: [55, 32, 55],
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(COLOR_CANVAS);
          }}
        >
          <Scene />
        </Canvas>
      </div>

      {/* HUD overlay — UI on top of canvas */}
      <Hud booted={booted} />

      {/* Loading screen overlay */}
      {!sceneReady && <LoadingScreen />}
    </div>
  );
}
