'use client';

/**
 * BuildingOutline.tsx
 *
 * A subtle outline drawn around the building silhouette to add the
 * "selection / focus" feel that professional GIS tools have.
 * Implemented as a thin emissive wireframe box that sits just outside
 * the building footprint.
 *
 * Opacity updates on selection state change only — no per-frame work.
 */

import { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useViewerStore } from '@/lib/viewer-store';
import { COLOR_PRIMARY_600 } from '@/lib/design-tokens';

export default function BuildingOutline({ totalHeight, basementDepth = 0 }: { totalHeight: number; basementDepth?: number }) {
  const ref = useRef<THREE.LineSegments>(null);
  const selectedFloor = useViewerStore((s) => s.selectedFloor);

  const geo = useMemo(
    () => new THREE.EdgesGeometry(
      new THREE.BoxGeometry(20.6, totalHeight + basementDepth + 0.6, 16.6),
    ),
    [totalHeight, basementDepth],
  );
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({
      color: new THREE.Color(COLOR_PRIMARY_600),
      transparent: true,
      opacity: 0.15,
    }),
    [],
  );

  useEffect(() => {
    if (!ref.current) return;
    const m = ref.current.material as THREE.LineBasicMaterial;
    m.opacity = selectedFloor !== null ? 0.55 : 0.18;
  }, [selectedFloor]);

  // Center the wireframe vertically: middle of (basementDepth + totalHeight)
  const centerY = (totalHeight - basementDepth) / 2 + 0.15;
  return (
    <lineSegments ref={ref} position={[0, centerY, 0]} geometry={geo} material={mat} />
  );
}
