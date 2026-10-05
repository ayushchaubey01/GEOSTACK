'use client';

/**
 * Rooftop.tsx
 *
 * Parapet wall around the roof + mechanical equipment (lift overrun,
 * water tank, AC units). All geometry is generated procedurally.
 */

import * as THREE from 'three';
import {
  matParapet,
  matWaterTank,
  matMech,
  matConcrete,
} from '@/lib/viewer-materials';

interface RooftopProps {
  y: number;
  width: number;
  depth: number;
}

export default function Rooftop({ y, width, depth }: RooftopProps) {
  const parapetH = 0.9;
  const parapetT = 0.18;

  return (
    <group position={[0, y, 0]}>
      {/* Roof slab cap (a thin slab that finishes the top of the tower). */}
      <mesh material={matConcrete}>
        <boxGeometry args={[width + 0.15, 0.18, depth + 0.15]} />
      </mesh>

      {/* Parapet — 4 thin walls on the roof edge. */}
      <mesh position={[0, parapetH / 2 + 0.09, -depth / 2 + parapetT / 2]} material={matParapet}>
        <boxGeometry args={[width, parapetH, parapetT]} />
      </mesh>
      <mesh position={[0, parapetH / 2 + 0.09, depth / 2 - parapetT / 2]} material={matParapet}>
        <boxGeometry args={[width, parapetH, parapetT]} />
      </mesh>
      <mesh position={[width / 2 - parapetT / 2, parapetH / 2 + 0.09, 0]} material={matParapet}>
        <boxGeometry args={[parapetT, parapetH, depth]} />
      </mesh>
      <mesh position={[-width / 2 + parapetT / 2, parapetH / 2 + 0.09, 0]} material={matParapet}>
        <boxGeometry args={[parapetT, parapetH, depth]} />
      </mesh>

      {/* Lift overrun — a small box near the centre, slightly offset. */}
      <mesh
        position={[1.5, 1.1 + 0.09, -1]}
        material={matMech}
       
      >
        <boxGeometry args={[3, 2.2, 2.5]} />
      </mesh>
      {/* Stair headroom — adjacent smaller box. */}
      <mesh
        position={[-2, 0.85 + 0.09, -1]}
        material={matMech}
       
      >
        <boxGeometry args={[2.4, 1.7, 2.2]} />
      </mesh>

      {/* Water tank — a cylindrical fibreglass tank. */}
      <mesh
        position={[-3, 1.5 + 0.09, 2]}
        material={matWaterTank}
       
      >
        <cylinderGeometry args={[1.6, 1.6, 1.8, 24]} />
      </mesh>
      {/* Water tank lid */}
      <mesh
        position={[-3, 2.4 + 0.09, 2]}
        material={matWaterTank}
       
      >
        <cylinderGeometry args={[1.65, 1.6, 0.18, 24]} />
      </mesh>

      {/* AC units — 4 small boxes scattered on the roof. */}
      {[
        [4, 1.5],
        [5.5, 2],
        [-5, 3],
        [4.5, -3],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.4 + 0.09, z]} material={matMech}>
          <boxGeometry args={[1.2, 0.7, 1.0]} />
        </mesh>
      ))}

      {/* Solar panel array — a few thin slabs tilted south. */}
      {[-1.5, 0, 1.5].map((x) => (
        <group key={x} position={[x, 0.6 + 0.09, 4]} rotation={[-0.3, 0, 0]}>
          <mesh material={matMech}>
            <boxGeometry args={[1.8, 0.05, 1.2]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
