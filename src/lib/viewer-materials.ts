/**
 * viewer-materials.ts
 *
 * Shared geometries + materials for the 3D building viewer.
 *
 * Design system: light Whimsical/Linear theme.
 * - Scene background: #F6F7F9 (canvas token)
 * - Building facade: warm white / light grey — no dark colours
 * - Windows: indigo-200 glass (#C7D2FE) — no pure black
 * - X-ray: indigo-900 (#312E81) edges, indigo-50 transparent body
 * - Ground: near-white (#F3F4F6) with #E5E7EB grid
 * - NO pure black (#000 / 'black') anywhere
 *
 * Mirrors src/lib/design-tokens.ts SCENE palette.
 */

import * as THREE from 'three';
import { SCENE } from './design-tokens';

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

/** Concrete facade — warm off-white, architectural light tone. */
export const matConcrete = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.concreteFacade), // #F3F4F6
  roughness: 0.72,
  metalness: 0.02,
});

/** X-ray facade — very transparent, indigo-50 tint.
 *  Edge lines (EdgesGeometry) carry the silhouette. */
export const matXrayFacade = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.xrayFacade), // #EEF2FF
  roughness: 0.2,
  metalness: 0.0,
  transparent: true,
  opacity: 0.08,
  side: THREE.DoubleSide,
  depthWrite: false,
});

/** X-ray slab — darkish blue with low transparency to segregate floor levels cleanly. */
export const matXraySlab = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#1E3A8A'), // Darkish architectural blue
  roughness: 0.4,
  metalness: 0.1,
  transparent: true,
  opacity: 0.75,
  side: THREE.DoubleSide,
  depthWrite: true,
});

/** X-ray wireframe overlay — indigo-900 edges (#312E81), blueprint feel. */
export const matXrayWireframe = new THREE.LineBasicMaterial({
  color: new THREE.Color(SCENE.xrayEdge), // #312E81
  transparent: true,
  opacity: 0.85,
});

/** Slab edge — slightly darker neutral, visible band between floors. */
export const matSlabEdge = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.slabEdge), // #D1D5DB
  roughness: 0.85,
  metalness: 0.03,
});

/** Soffit / underside of slab — medium grey, reads as a shadow line. */
export const matSoffit = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.soffit), // #9CA3AF
  roughness: 0.95,
  metalness: 0.0,
});

/** Basement concrete — cooler, slightly darker neutral. */
export const matBasement = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.basement), // #CBD5E1
  roughness: 0.90,
  metalness: 0.02,
});

/** Glass — light architectural pane (#DBEAFE) at ~30% opacity.
 *  Low metalness (no env map), non-intrusive. */
export const matGlass = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#DBEAFE'),
  roughness: 0.15,
  metalness: 0.02,
  transparent: true,
  opacity: 0.30,
  depthWrite: false,
});

/** X-ray glass — faint tint (<= 0.10 opacity) with hairline frame. */
export const matGlassXray = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#DBEAFE'),
  roughness: 0.15,
  metalness: 0.0,
  transparent: true,
  opacity: 0.08,
  depthWrite: false,
});

/** Window mullion / frame — light neutral (#CBD5E1), low metalness. */
export const matMullion = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#CBD5E1'),
  roughness: 0.50,
  metalness: 0.05,
});

/** Balcony railing — light neutral (#CBD5E1). */
export const matRailing = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#CBD5E1'),
  roughness: 0.50,
  metalness: 0.05,
});

/** Balcony tile surface — very light warm grey. */
export const matBalconyTile = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.balconyTile), // #E5E7EB
  roughness: 0.92,
  metalness: 0.01,
});

/** Parapet — near-white, slightly lighter than facade. */
export const matParapet = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.parapet), // #F3F4F6
  roughness: 0.82,
  metalness: 0.02,
});

/** Rooftop water tank — slate blue-grey. */
export const matWaterTank = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#CBD5E1'),
  roughness: 0.65,
  metalness: 0.05,
});

/** Rooftop mechanical equipment — medium grey. */
export const matMech = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#9CA3AF'),
  roughness: 0.70,
  metalness: 0.05,
});

/** Ground / plot surface — very light, near canvas background. */
export const matGround = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.ground), // #EBEBED
  roughness: 0.98,
  metalness: 0.0,
});

/* ------------------------------------------------------------------ */
/* Shared Interior & Wall Materials (Part B & Part D)                 */
/* ------------------------------------------------------------------ */

/** X-ray tower walls — default floor state (0.28 opacity) */
export const matWallXrayDefault = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#EEF2FF'),
  roughness: 0.3,
  metalness: 0.0,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
  side: THREE.DoubleSide,
});

/** X-ray tower walls — hovered floor state (0.45 opacity) */
export const matWallXrayHover = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#EEF2FF'),
  roughness: 0.3,
  metalness: 0.0,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
  side: THREE.DoubleSide,
});

/** X-ray tower walls — selected floor state (0.70 opacity with indigo tint) */
export const matWallXraySelected = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#E0E7FF'),
  emissive: new THREE.Color('#6366F1'),
  emissiveIntensity: 0.25,
  roughness: 0.3,
  metalness: 0.0,
  transparent: true,
  opacity: 0.70,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
  side: THREE.DoubleSide,
});

/** Floor-view walls (normal mode) — opaque #F9FAFB */
export const matWallFloorNormal = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#F9FAFB'),
  roughness: 0.85,
  metalness: 0.02,
});

/** Floor-view walls (X-ray mode) — ~0.55 fill */
export const matWallFloorXray = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#EEF2FF'),
  roughness: 0.40,
  metalness: 0.0,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  side: THREE.DoubleSide,
});

/** Floor-view wall edges — primary-900 at 0.5 opacity */
export const matWallFloorEdges = new THREE.LineBasicMaterial({
  color: new THREE.Color(SCENE.xrayEdge), // #312E81
  transparent: true,
  opacity: 0.50,
});

/** Unit floor plane (extracted floor) */
export const matUnitFloorPlane = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#F3F4F6'),
  roughness: 0.92,
  metalness: 0.0,
});

/** Unit floor plane hovered */
export const matUnitFloorHover = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#EEF2FF'),
  roughness: 0.92,
  metalness: 0.0,
});

/** Unit floor plane selected */
export const matUnitFloorSelected = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#E0E7FF'),
  roughness: 0.92,
  metalness: 0.0,
});

/** Pavement / driveway — slightly darker than ground. */
export const matPavement = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.pavement), // #F3F4F6
  roughness: 0.90,
  metalness: 0.01,
});

/** Pathway — same as pavement, slightly warmer. */
export const matPathway = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.pathway), // #E5E7EB
  roughness: 0.94,
  metalness: 0.0,
});

/** Vegetation — soft green (not dark). */
export const matFoliage = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.foliage), // #86EFAC
  roughness: 0.90,
  metalness: 0.0,
});

/** Tree trunk — neutral grey. */
export const matTrunk = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.trunk), // #A3A3A3
  roughness: 0.96,
  metalness: 0.0,
});

/** Entrance canopy glass — light indigo tint. */
export const matCanopy = new THREE.MeshStandardMaterial({
  color: new THREE.Color(SCENE.canopy), // #C7D2FE
  roughness: 0.20,
  metalness: 0.3,
  transparent: true,
  opacity: 0.55,
});

/* ------------------------------------------------------------------ */
/* Highlight materials (per-floor selection / hover)                  */
/* ------------------------------------------------------------------ */

/**
 * Selected floor: translucent indigo-500 slab.
 * Clone of concrete so swapping is cheap.
 */
export function makeFacadeHighlight(tint: string, intensity = 0.5) {
  const m = matConcrete.clone();
  m.emissive = new THREE.Color(tint);
  m.emissiveIntensity = intensity;
  m.toneMapped = true;
  return m;
}

/**
 * X-ray compatible highlight — clones matXrayFacade (transparent).
 */
export function makeXrayHighlight(tint: string, intensity = 0.12) {
  const m = matXrayFacade.clone();
  m.emissive = new THREE.Color(tint);
  m.emissiveIntensity = intensity;
  m.toneMapped = true;
  m.opacity = matXrayFacade.opacity;
  m.transparent = true;
  m.depthWrite = false;
  m.side = THREE.DoubleSide;
  return m;
}

/** Accent emissive — indigo-500 for selection beam / outline glow. */
export const matAccentEmissive = new THREE.MeshBasicMaterial({
  color: new THREE.Color(SCENE.accentEmissive), // #6366F1
  transparent: true,
  opacity: 0.85,
});

/* ------------------------------------------------------------------ */
/* Shared geometries                                                   */
/* ------------------------------------------------------------------ */

/** A thin box geometry helper. */
export function box(w: number, h: number, d: number) {
  return new THREE.BoxGeometry(w, h, d);
}

/** A hollow railing segment using flat panel + posts. */
export function makeRailingSegment(length: number, height: number) {
  const group = new THREE.Group();
  // Top rail
  const top = new THREE.Mesh(box(length, 0.04, 0.04), matRailing);
  top.position.y = height - 0.02;
  group.add(top);
  // Mid rail
  const mid = new THREE.Mesh(box(length, 0.03, 0.03), matRailing);
  mid.position.y = height * 0.55;
  group.add(mid);
  // Vertical posts every ~0.6m
  const postCount = Math.max(2, Math.round(length / 0.6));
  const postGeo = box(0.04, height, 0.04);
  for (let i = 0; i <= postCount; i++) {
    const t = i / postCount;
    const post = new THREE.Mesh(postGeo, matRailing);
    post.position.set(-length / 2 + t * length, height / 2, 0);
    group.add(post);
  }
  return group;
}
