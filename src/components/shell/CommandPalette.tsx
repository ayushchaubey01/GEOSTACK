'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  MapPin, Building2, Search, Layers, Box, HelpCircle,
  Sparkles, FileText, ArrowRight
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { useViewerStore } from '@/lib/viewer-store';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectColony?: (name: string) => void;
  onSearchQuery?: (q: string) => void;
  onOpenShortcuts?: () => void;
}

const COMMON_COLONIES = [
  'Domlur',
  'Indiranagar',
  'HAL 2nd Stage',
  'Koramangala',
  'Old Airport Road',
  'Ulsoor',
  'Austin Town',
  'Ejipura',
  'Richmond Town',
  'Ashok Nagar',
];

export function CommandPalette({
  open,
  onOpenChange,
  onSelectColony,
  onSearchQuery,
  onOpenShortcuts,
}: CommandPaletteProps) {
  const appView = useViewerStore((s) => s.appView);
  const setAppView = useViewerStore((s) => s.setAppView);
  const selectedMapBuilding = useViewerStore((s) => s.selectedMapBuilding);

  // Global Ctrl+K / Cmd+K shortcut listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search and Navigation"
      description="Quickly jump to a colony, parcel code, or change views"
    >
      <CommandInput placeholder="Type a colony, display code, or command…" />
      <CommandList className="max-h-80 custom-scroll">
        <CommandEmpty>No matching results found.</CommandEmpty>

        <CommandGroup heading="Navigation & Views">
          <CommandItem
            onSelect={() => {
              setAppView('map');
              onOpenChange(false);
            }}
          >
            <Layers className="mr-2 h-4 w-4 text-[#4F46E5]" />
            <span>Switch to 2D Map View</span>
            {appView === 'map' && (
              <span className="ml-auto text-[11px] font-mono-nums text-[#6B7280]">Current</span>
            )}
          </CommandItem>

          <CommandItem
            disabled={!selectedMapBuilding}
            onSelect={() => {
              if (selectedMapBuilding) {
                setAppView('viewer');
                onOpenChange(false);
              }
            }}
          >
            <Box className="mr-2 h-4 w-4 text-[#4F46E5]" />
            <span>Open 3D Vertical Property Viewer</span>
            {appView === 'viewer' ? (
              <span className="ml-auto text-[11px] font-mono-nums text-[#6B7280]">Current</span>
            ) : !selectedMapBuilding ? (
              <span className="ml-auto text-[11px] text-[#9CA3AF]">Select building first</span>
            ) : null}
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              onOpenShortcuts?.();
            }}
          >
            <HelpCircle className="mr-2 h-4 w-4 text-[#6B7280]" />
            <span>Keyboard Shortcuts & Help</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-[#E5E7EB] bg-[#F9FAFB] px-1.5 font-mono text-[11px] font-medium text-[#6B7280]">
              ?
            </kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Bengaluru Pilot Colonies">
          {COMMON_COLONIES.map((colony) => (
            <CommandItem
              key={colony}
              onSelect={() => {
                onSelectColony?.(colony);
                onOpenChange(false);
              }}
            >
              <MapPin className="mr-2 h-4 w-4 text-[#6B7280]" />
              <span>{colony}</span>
              <ArrowRight className="ml-auto h-3.5 w-3.5 text-[#9CA3AF]" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Example Queries">
          <CommandItem
            onSelect={() => {
              onSearchQuery?.('BLR-P-');
              onOpenChange(false);
            }}
          >
            <Search className="mr-2 h-4 w-4 text-[#6B7280]" />
            <span className="font-mono-nums">BLR-P-*</span>
            <span className="ml-2 text-xs text-[#6B7280]">Search cadastral parcels</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onSearchQuery?.('BLR-B-');
              onOpenChange(false);
            }}
          >
            <Building2 className="mr-2 h-4 w-4 text-[#6B7280]" />
            <span className="font-mono-nums">BLR-B-*</span>
            <span className="ml-2 text-xs text-[#6B7280]">Search building footprints</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
