'use client';

/**
 * Zustand store for the 3D ULPIN viewer.
 *
 * Two top-level views:
 *  - 'map': 2D map landing page showing all buildings in the AOI
 *  - 'viewer': 3D building viewer (the existing Three.js experience)
 *
 * State machine within the 3D viewer:
 *   loading → overview
 *             ↓ (click floor)
 *             floor_selecting → extracted (floor on RIGHT, building on LEFT)
 *             ↓ (click the extracted floor)
 *             floor_inspect_selecting → floor_inspecting (solo centered)
 *             ↓ (back)
 *             floor_inspect_returning → extracted → returning → overview
 */

import { create } from 'zustand';
import { MOCK_BUILDING } from './building-data';
import type { Building } from './building-data';
import type { MapBuildingFeature } from './map-data';

export type AppView = 'map' | 'viewer';

export type ViewPhase =
  | 'loading'
  | 'overview'
  | 'floor_selecting'
  | 'extracted'
  | 'floor_inspect_selecting'
  | 'floor_inspecting'
  | 'returning'
  | 'floor_inspect_returning';

interface ViewerState {
  appView: AppView;
  selectedMapBuilding: MapBuildingFeature | null;
  buildingData: Building;

  phase: ViewPhase;
  selectedFloor: number | null;
  hoveredFloor: number | null;
  selectedUnitId: string | null;
  hoveredUnitId: string | null;
  loadProgress: number;
  sceneReady: boolean;
  tooltipFloor: number | null;
  xrayMode: boolean;

  setAppView: (v: AppView) => void;
  openBuildingFromMap: (feature: MapBuildingFeature, building: Building) => void;
  returnToMap: () => void;
  setPhase: (p: ViewPhase) => void;
  selectFloor: (n: number | null) => void;
  hoverFloor: (n: number | null) => void;
  selectUnit: (id: string | null) => void;
  hoverUnit: (id: string | null) => void;
  setLoadProgress: (p: number) => void;
  setSceneReady: (v: boolean) => void;
  toggleXray: () => void;
  reset: () => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  appView: 'map',
  selectedMapBuilding: null,
  buildingData: MOCK_BUILDING,

  phase: 'loading',
  selectedFloor: null,
  hoveredFloor: null,
  selectedUnitId: null,
  hoveredUnitId: null,
  loadProgress: 0,
  sceneReady: false,
  tooltipFloor: null,
  xrayMode: false,

  setAppView: (v) => set({ appView: v }),
  openBuildingFromMap: (feature, building) =>
    set({
      selectedMapBuilding: feature,
      buildingData: building,
      appView: 'viewer',
      phase: 'loading',
      sceneReady: false,
      selectedFloor: null,
      selectedUnitId: null,
      hoveredFloor: null,
      hoveredUnitId: null,
      tooltipFloor: null,
      xrayMode: false,
      loadProgress: 0,
    }),
  returnToMap: () =>
    set({
      appView: 'map',
      phase: 'loading',
      sceneReady: false,
      selectedFloor: null,
      selectedUnitId: null,
      hoveredFloor: null,
      hoveredUnitId: null,
      tooltipFloor: null,
      xrayMode: false,
    }),
  setPhase: (p) => set({ phase: p }),
  selectFloor: (n) => set({ selectedFloor: n, selectedUnitId: null, phase: 'overview' }),
  hoverFloor: (n) => set({ hoveredFloor: n }),
  selectUnit: (id) => set({ selectedUnitId: id }),
  hoverUnit: (id) => set({ hoveredUnitId: id }),
  setLoadProgress: (p) => set({ loadProgress: p }),
  setSceneReady: (v) => set({ sceneReady: v, phase: v ? 'overview' : 'loading' }),
  toggleXray: () => set((s) => ({ xrayMode: !s.xrayMode })),
  reset: () =>
    set({
      phase: 'overview',
      selectedFloor: null,
      hoveredFloor: null,
      selectedUnitId: null,
      hoveredUnitId: null,
      tooltipFloor: null,
    }),
}));

export function useBuilding() {
  return useViewerStore((s) => s.buildingData);
}

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as any).__viewerStore = useViewerStore;
}

