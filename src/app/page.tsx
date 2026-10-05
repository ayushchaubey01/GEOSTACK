'use client';

import dynamic from 'next/dynamic';
import { useViewerStore } from '@/lib/viewer-store';

/**
 * The app has two views, both rendered in the single `/` route:
 *  - 'map': 2D MapLibre map (the ZIP's full 2D property mapping system
 *    with 24 colonies, layer toggles, 3D extrusion, stats, etc.)
 *  - 'viewer': 3D building viewer (our Three.js/R3F building/floor/unit
 *    inspector with X-ray mode, floor extraction, etc.)
 *
 * When a building is clicked on the 2D map → "Open 3D Vertical Property Map"
 * button → opens the 3D viewer with that building's real data.
 * The 3D viewer's "Map" button returns to the 2D map.
 */

const MapApp = dynamic(() => import('@/components/map/MapApp'), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen bg-white flex items-center justify-center">
      <div className="text-xs font-mono text-slate-500 tracking-[0.3em] uppercase animate-pulse">
        Loading map…
      </div>
    </div>
  ),
});

const BuildingViewer = dynamic(
  () => import('@/components/viewer/BuildingViewer'),
  {
    ssr: false,
    loading: () => (
      <div className="w-screen h-screen bg-background flex items-center justify-center">
        <div className="text-xs font-mono-nums text-muted-foreground tracking-[0.3em] uppercase animate-pulse">
          Booting 3D viewer…
        </div>
      </div>
    ),
  },
);

export default function Home() {
  const appView = useViewerStore((s) => s.appView);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-white">
      {appView === 'map' ? <MapApp /> : <BuildingViewer />}
    </main>
  );
}
