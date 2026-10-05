'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  Layers, Box, Search, ChevronRight, Share2, Download,
  HelpCircle, ShieldAlert, Check, Copy, Sparkles, AlertCircle
} from 'lucide-react';
import { useViewerStore } from '@/lib/viewer-store';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const BRAND = '3D ULPIN Bengaluru';

interface BreadcrumbItem {
  label: string;
  isMono?: boolean;
  onClick?: () => void;
}

interface TopBarProps {
  breadcrumbs?: BreadcrumbItem[];
  onOpenCommandPalette: () => void;
  onOpenShortcuts: () => void;
  onExportGeoJSON?: () => void;
  onExportCSV?: () => void;
  onOpen3DAction?: () => void;
}

export function TopBar({
  breadcrumbs = [{ label: 'Bengaluru' }],
  onOpenCommandPalette,
  onOpenShortcuts,
  onExportGeoJSON,
  onExportCSV,
  onOpen3DAction,
}: TopBarProps) {
  const appView = useViewerStore((s) => s.appView);
  const setAppView = useViewerStore((s) => s.setAppView);
  const selectedMapBuilding = useViewerStore((s) => s.selectedMapBuilding);
  const [copiedShare, setCopiedShare] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <header className="absolute top-3 left-3 right-3 z-30 h-14 bg-white/95 backdrop-blur-md border border-[#E5E7EB] rounded-2xl shadow-floating px-4 flex items-center justify-between gap-3 select-none">
      {/* ── Left: Brand & Breadcrumbs ── */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-[#4F46E5] shadow-xs">
            <Box className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-[#0F172A] hidden sm:inline">
            {BRAND}
          </span>
        </div>

        <div className="h-4 w-[1px] bg-[#E5E7EB] hidden sm:block flex-shrink-0" />

        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 min-w-0 overflow-hidden text-xs">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" />
                )}
                {isLast ? (
                  <span
                    className={`font-medium truncate max-w-[180px] sm:max-w-[240px] text-[#0F172A] ${
                      crumb.isMono ? 'font-mono-nums' : ''
                    }`}
                    title={crumb.label}
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <button
                    onClick={crumb.onClick}
                    disabled={!crumb.onClick}
                    className={`text-[#6B7280] hover:text-[#4F46E5] truncate max-w-[120px] transition-colors ${
                      crumb.onClick ? 'cursor-pointer hover:underline' : 'cursor-default'
                    } ${crumb.isMono ? 'font-mono-nums' : ''}`}
                    title={crumb.label}
                  >
                    {crumb.label}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* ── Center: Search Trigger (⌘K) ── */}
      <div className="hidden md:flex items-center justify-center flex-1 max-w-xs">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-white hover:border-[#D1D5DB] text-xs text-[#6B7280] transition-all cursor-pointer shadow-xs focus-ring"
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <span>Search colony, parcel, code…</span>
          </span>
          <kbd className="inline-flex items-center gap-0.5 rounded border border-[#E5E7EB] bg-white px-1.5 py-0.5 text-[11px] font-mono text-[#6B7280]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* ── Right: View Toggle, Status, Actions ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Map | 3D Segmented Control */}
        <div className="flex items-center p-0.5 rounded-lg bg-[#F3F4F6] border border-[#E5E7EB]">
          <button
            onClick={() => setAppView('map')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              appView === 'map'
                ? 'bg-white text-[#0F172A] shadow-xs'
                : 'text-[#6B7280] hover:text-[#0F172A]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Map</span>
          </button>

          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <button
                    disabled={!selectedMapBuilding}
                    onClick={() => setAppView('viewer')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      appView === 'viewer'
                        ? 'bg-white text-[#4F46E5] shadow-xs'
                        : selectedMapBuilding
                        ? 'text-[#6B7280] hover:text-[#0F172A]'
                        : 'text-[#9CA3AF] opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">3D</span>
                  </button>
                </span>
              </TooltipTrigger>
              {!selectedMapBuilding && (
                <TooltipContent side="bottom" className="text-xs">
                  Select a building footprint to inspect in 3D
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Phase 1 · Prototype Soft Badge with Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="cursor-pointer focus-ring rounded-full">
              <StatusBadge tone="warning" variant="soft" className="hover:opacity-90 transition-opacity">
                Phase 1 · Prototype
              </StatusBadge>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 rounded-xl shadow-floating bg-white border border-[#E5E7EB] text-xs space-y-2">
            <div className="flex items-start gap-2 text-[#B45309] font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Honesty & Data Provenance Notice</span>
            </div>
            <p className="text-[#6B7280] leading-relaxed">
              This is an academic research prototype (SIH26011). Identifiers are <strong>internal prototype IDs, not official ULPINs</strong> issued by the Department of Land Resources (DoLR).
            </p>
            <p className="text-[#6B7280] leading-relaxed">
              Building heights and floor counts are <strong>LoD1 estimated values</strong> derived from 3D-GloBFP and Copernicus DSM data. No live government ownership records or official floor plans are implied.
            </p>
          </PopoverContent>
        </Popover>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white flex items-center justify-center text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#0F172A] transition-colors focus-ring"
          title="Copy link"
          aria-label="Share link"
        >
          {copiedShare ? (
            <Check className="w-3.5 h-3.5 text-[#059669]" />
          ) : (
            <Share2 className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white flex items-center justify-center text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#0F172A] transition-colors focus-ring"
              title="Export data"
              aria-label="Export data options"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-white border border-[#E5E7EB] rounded-xl shadow-floating p-1 text-xs">
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] px-2 py-1.5">
              Export Options
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={onExportGeoJSON}
              className="rounded-lg px-2 py-1.5 hover:bg-[#F9FAFB] cursor-pointer"
            >
              Export Selected GeoJSON
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onExportCSV}
              className="rounded-lg px-2 py-1.5 hover:bg-[#F9FAFB] cursor-pointer"
            >
              Export Summary CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Shortcuts / Help Modal Trigger */}
        <button
          onClick={onOpenShortcuts}
          className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white flex items-center justify-center text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#0F172A] transition-colors focus-ring"
          title="Keyboard shortcuts & help (?)"
          aria-label="Keyboard shortcuts"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        {/* Contextual Primary Action Button: "Open 3D vertical map" */}
        {appView === 'map' && selectedMapBuilding && onOpen3DAction && (
          <button
            onClick={onOpen3DAction}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-medium shadow-xs transition-colors focus-ring cursor-pointer"
          >
            <Box className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open 3D</span>
          </button>
        )}
      </div>
    </header>
  );
}
