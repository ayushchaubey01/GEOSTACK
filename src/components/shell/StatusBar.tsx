'use client';

import * as React from 'react';
import { useViewerStore } from '@/lib/viewer-store';
import { AlertCircle } from 'lucide-react';

interface StatusBarProps {
  zoom?: number;
  mouseCoords?: { lng: number; lat: number } | null;
  attribution?: string;
}

export function StatusBar({
  zoom = 13,
  mouseCoords,
  attribution = '© OpenStreetMap contributors © CARTO © KSRSAC',
}: StatusBarProps) {
  const appView = useViewerStore((s) => s.appView);

  return (
    <footer className="h-7 bg-white border-t border-[#E5E7EB] px-3 flex items-center justify-between text-[11px] text-[#6B7280] select-none z-20 flex-shrink-0">
      {/* ── Left: Coords / Zoom in Map, or Controls Hint in 3D ── */}
      <div className="flex items-center gap-3 min-w-0 font-mono-nums">
        {appView === 'map' ? (
          <>
            <span className="text-[#0F172A] font-medium">
              Zoom: {zoom.toFixed(1)}
            </span>
            {mouseCoords ? (
              <span className="hidden sm:inline text-[#6B7280]">
                {mouseCoords.lng.toFixed(5)}°E, {mouseCoords.lat.toFixed(5)}°N
              </span>
            ) : (
              <span className="hidden sm:inline text-[#9CA3AF]">
                Hover map for coordinates
              </span>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-[#0F172A]">
            <span className="font-semibold text-[#4F46E5]">3D Controls:</span>
            <span className="hidden sm:inline">Drag orbit · Scroll zoom · Right-drag pan · Click slab</span>
          </div>
        )}
      </div>



      {/* ── Right: Attribution ── */}
      <div className="flex items-center gap-2 truncate text-right">
        <span className="truncate text-[#9CA3AF] hidden md:inline">
          {attribution}
        </span>
      </div>
    </footer>
  );
}
