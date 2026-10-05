'use client';

/**
 * Ground.tsx
 *
 * The plot environment: driveway, pavement, walkway, entrance canopy,
 * small vegetation. Light-theme redesign:
 * - Ground: near-white (#F3F4F6), no dark earthy colour
 * - Driveway ring removed (was dark); replaced with very light pavement
 * - Grid lines: #E5E7EB (border token)
 * - Parking markings: #D1D5DB
 */

import * as THREE from 'three';
import { useMemo } from 'react';
import {
  matGround,
  matPavement,
  matPathway,
  matFoliage,
  matTrunk,
  matCanopy,
  matConcrete,
  matMullion,
} from '@/lib/viewer-materials';

const PLOT_W = 60;
const PLOT_D = 50;

const BLDG_W = 24;
const BLDG_D = 20;

/** Build a plane with a rectangular hole in the middle. */
function useHoledPlane(outerW: number, outerD: number, innerW: number, innerD: number) {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-outerW / 2, -outerD / 2);
    shape.lineTo(outerW / 2, -outerD / 2);
    shape.lineTo(outerW / 2, outerD / 2);
    shape.lineTo(-outerW / 2, outerD / 2);
    shape.closePath();

    const hole = new THREE.Path();
    hole.moveTo(-innerW / 2, -innerD / 2);
    hole.lineTo(innerW / 2, -innerD / 2);
    hole.lineTo(innerW / 2, innerD / 2);
    hole.lineTo(-innerW / 2, innerD / 2);
    hole.closePath();

    shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape);
  }, [outerW, outerD, innerW, innerD]);
}

/** Subtle grid material — very light border lines on the ground plane. */
const matGridLine = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#E5E7EB'),
  transparent: true,
  opacity: 0.8,
});

/** Parking stripe — light neutral. */
const matParking = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#D1D5DB'),
  transparent: true,
  opacity: 0.7,
});

export default function Ground() {
  const plotGeo = useHoledPlane(PLOT_W, PLOT_D, BLDG_W + 0.5, BLDG_D + 0.5);
  const pavementGeo = useHoledPlane(34, 26, BLDG_W + 0.5, BLDG_D + 0.5);

  return (
    <group position={[0, 0, 0]}>
      {/* Plot ground — light, has hole so basements are visible */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} geometry={plotGeo} material={matGround} />

      {/* Inner pavement — also with hole */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} geometry={pavementGeo} material={matPavement} />

      {/* Subtle grid lines every 6m on the ground plane */}
      {[-18, -12, -6, 0, 6, 12, 18].map((x) => (
        <mesh key={`gx${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.003, 0]} material={matGridLine}>
          <planeGeometry args={[0.06, PLOT_D]} />
        </mesh>
      ))}
      {[-18, -12, -6, 0, 6, 12, 18].map((z) => (
        <mesh key={`gz${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, z]} material={matGridLine}>
          <planeGeometry args={[PLOT_W, 0.06]} />
        </mesh>
      ))}

      {/* Plinth walls (upstand around building base) */}
      <mesh position={[0, 0.25, -BLDG_D / 2]} material={matConcrete}>
        <boxGeometry args={[BLDG_W, 0.5, 0.2]} />
      </mesh>
      <mesh position={[0, 0.25, BLDG_D / 2]} material={matConcrete}>
        <boxGeometry args={[BLDG_W, 0.5, 0.2]} />
      </mesh>
      <mesh position={[BLDG_W / 2, 0.25, 0]} material={matConcrete}>
        <boxGeometry args={[0.2, 0.5, BLDG_D]} />
      </mesh>
      <mesh position={[-BLDG_W / 2, 0.25, 0]} material={matConcrete}>
        <boxGeometry args={[0.2, 0.5, BLDG_D]} />
      </mesh>

      {/* Entrance walkway (south side) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 12]} material={matPathway}>
        <planeGeometry args={[4, 8]} />
      </mesh>

      {/* Entrance canopy — thin slab on 4 posts */}
      <group position={[0, 2.4, 9.5]}>
        <mesh material={matCanopy}>
          <boxGeometry args={[5, 0.12, 3]} />
        </mesh>
        {[
          [2.3, -1.3],
          [-2.3, -1.3],
          [2.3, 1.3],
          [-2.3, 1.3],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, -1.2, z]} material={matMullion}>
            <cylinderGeometry args={[0.06, 0.06, 2.4, 12]} />
          </mesh>
        ))}
      </group>

      {/* Parking markings — light stripes */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-9 + i * 3.6, 0.007, 14]}
        >
          <planeGeometry args={[3, 0.1]} />
          <primitive object={matParking} />
        </mesh>
      ))}

      {/* Landscaping — soft green trees */}
      {[
        [9, 9, 0.8],
        [-9, 9, 0.9],
        [9, -9, 0.7],
        [-9, -9, 1.0],
        [11, 0, 0.8],
        [-11, 0, 0.85],
      ].map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh material={matTrunk} position={[0, (s as number) * 0.4, 0]}>
            <cylinderGeometry args={[0.06, 0.08, (s as number) * 0.8, 8]} />
          </mesh>
          <mesh material={matFoliage} position={[0, (s as number) * 0.9, 0]}>
            <icosahedronGeometry args={[(s as number) * 0.7, 0]} />
          </mesh>
          <mesh material={matFoliage} position={[(s as number) * 0.4, (s as number) * 1.05, (s as number) * 0.2]}>
            <icosahedronGeometry args={[(s as number) * 0.45, 0]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
