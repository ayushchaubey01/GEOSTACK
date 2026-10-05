'use client';

import * as React from 'react';
import {
  MapPin, Layers, BarChart3, AlertTriangle, Database,
  HelpCircle, Box, Eye, Grid3X3, Layers3
} from 'lucide-react';
import { useViewerStore } from '@/lib/viewer-store';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type MapRailTab = 'explore' | 'layers' | 'stats' | 'issues' | 'sources';
export type ViewerRailTab = 'floors' | 'display' | 'units';

interface LeftRailProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  issuesCount?: number;
  onOpenShortcuts: () => void;
}

export function LeftRail({
  activeTab,
  onTabChange,
  issuesCount = 0,
  onOpenShortcuts,
}: LeftRailProps) {
  const appView = useViewerStore((s) => s.appView);

  const handleTabClick = (tabId: string) => {
    // Toggling: if already open, collapse it
    if (activeTab === tabId) {
      onTabChange(null);
    } else {
      onTabChange(tabId);
    }
  };

  return (
    <aside className="w-14 bg-white border-r border-[#E5E7EB] flex flex-col items-center py-3 select-none z-20 flex-shrink-0">
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-col items-center gap-1.5 w-full px-2">
          {appView === 'map' ? (
            <>
              {/* Explore / Colonies */}
              <RailButton
                icon={<MapPin className="w-4 h-4" strokeWidth={1.5} />}
                label="Explore Colonies"
                active={activeTab === 'explore'}
                onClick={() => handleTabClick('explore')}
              />

              {/* Layers */}
              <RailButton
                icon={<Layers className="w-4 h-4" strokeWidth={1.5} />}
                label="Map Layers & Filters"
                active={activeTab === 'layers'}
                onClick={() => handleTabClick('layers')}
              />

              {/* Stats */}
              <RailButton
                icon={<BarChart3 className="w-4 h-4" strokeWidth={1.5} />}
                label="Cadastral Statistics"
                active={activeTab === 'stats'}
                onClick={() => handleTabClick('stats')}
              />

              {/* Issues */}
              <RailButton
                icon={<AlertTriangle className="w-4 h-4" strokeWidth={1.5} />}
                label="Validation & Anomaly Issues"
                active={activeTab === 'issues'}
                badge={issuesCount > 0 ? issuesCount : undefined}
                onClick={() => handleTabClick('issues')}
              />

              {/* Data Sources */}
              <RailButton
                icon={<Database className="w-4 h-4" strokeWidth={1.5} />}
                label="Data Lineage & Importers"
                active={activeTab === 'sources'}
                onClick={() => handleTabClick('sources')}
              />
            </>
          ) : (
            <>
              {/* 3D Floors */}
              <RailButton
                icon={<Layers3 className="w-4 h-4" strokeWidth={1.5} />}
                label="Floors & Strata"
                active={activeTab === 'floors'}
                onClick={() => handleTabClick('floors')}
              />

              {/* 3D Display / X-ray */}
              <RailButton
                icon={<Eye className="w-4 h-4" strokeWidth={1.5} />}
                label="Display & X-ray Mode"
                active={activeTab === 'display'}
                onClick={() => handleTabClick('display')}
              />

              {/* 3D Units */}
              <RailButton
                icon={<Grid3X3 className="w-4 h-4" strokeWidth={1.5} />}
                label="Units & Spatial Registry"
                active={activeTab === 'units'}
                onClick={() => handleTabClick('units')}
              />
            </>
          )}
        </div>

        {/* Bottom Help / Shortcuts */}
        <div className="mt-auto flex flex-col items-center w-full px-2 pt-2 border-t border-[#F3F4F6]">
          <RailButton
            icon={<HelpCircle className="w-4 h-4" strokeWidth={1.5} />}
            label="Shortcuts & Documentation (?)"
            active={false}
            onClick={onOpenShortcuts}
          />
        </div>
      </TooltipProvider>
    </aside>
  );
}

interface RailButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}

function RailButton({ icon, label, active, badge, onClick }: RailButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label={label}
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer focus-ring ${
            active
              ? 'bg-[#EEF2FF] text-[#4F46E5] shadow-xs'
              : 'text-[#6B7280] hover:text-[#0F172A] hover:bg-[#F9FAFB]'
          }`}
        >
          {icon}
          {badge !== undefined && (
            <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#B91C1C] text-white text-[11px] font-mono-nums font-semibold flex items-center justify-center">
              {badge}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
