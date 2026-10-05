'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Keyboard, MousePointer, Orbit, Search, Layers, Box } from 'lucide-react';

interface ShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsModal({ open, onOpenChange }: ShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <DialogTitle className="text-base font-semibold text-[#0F172A]">
              Keyboard Shortcuts & Controls
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-[#6B7280]">
            Speed up exploration across the 2D map and 3D vertical property viewer.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* General navigation */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-2">
              Global & Navigation
            </div>
            <div className="space-y-1.5 border border-[#E5E7EB] rounded-xl p-2.5 bg-[#F9FAFB]">
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[#0F172A]">Quick Command Palette / Search</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[11px] font-mono-nums bg-white border border-[#E5E7EB] rounded shadow-xs text-[#0F172A]">⌘K</kbd>
                  <span className="text-[#6B7280]">/</span>
                  <kbd className="px-1.5 py-0.5 text-[11px] font-mono-nums bg-white border border-[#E5E7EB] rounded shadow-xs text-[#0F172A]">Ctrl K</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[#0F172A]">Toggle Shortcuts Modal</span>
                <kbd className="px-1.5 py-0.5 text-[11px] font-mono-nums bg-white border border-[#E5E7EB] rounded shadow-xs text-[#0F172A]">?</kbd>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[#0F172A]">Clear selection / Close panels</span>
                <kbd className="px-1.5 py-0.5 text-[11px] font-mono-nums bg-white border border-[#E5E7EB] rounded shadow-xs text-[#0F172A]">Esc</kbd>
              </div>
            </div>
          </div>

          {/* 2D Map controls */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-2">
              2D Map Controls
            </div>
            <div className="space-y-1.5 border border-[#E5E7EB] rounded-xl p-2.5 bg-[#F9FAFB]">
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[#0F172A]">Pan map</span>
                <span className="text-xs text-[#6B7280] font-mono-nums">Click + Drag</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[#0F172A]">Zoom in / out</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[11px] font-mono-nums bg-white border border-[#E5E7EB] rounded shadow-xs text-[#0F172A]">+</kbd>
                  <kbd className="px-1.5 py-0.5 text-[11px] font-mono-nums bg-white border border-[#E5E7EB] rounded shadow-xs text-[#0F172A]">-</kbd>
                  <span className="text-[#6B7280]">or Scroll</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[#0F172A]">Select parcel or building</span>
                <span className="text-xs text-[#6B7280] font-mono-nums">Left Click</span>
              </div>
            </div>
          </div>

          {/* 3D Viewer controls */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-2">
              3D Vertical Viewer Controls
            </div>
            <div className="space-y-1.5 border border-[#E5E7EB] rounded-xl p-2.5 bg-[#F9FAFB]">
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[#0F172A]">Orbit camera</span>
                <span className="text-xs text-[#6B7280] font-mono-nums">Left-click + Drag</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[#0F172A]">Pan camera</span>
                <span className="text-xs text-[#6B7280] font-mono-nums">Right-click + Drag</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[#0F172A]">Extract & Inspect floor</span>
                <span className="text-xs text-[#6B7280] font-mono-nums">Click on floor slab</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[#0F172A]">Toggle X-ray structural view</span>
                <kbd className="px-1.5 py-0.5 text-[11px] font-mono-nums bg-white border border-[#E5E7EB] rounded shadow-xs text-[#0F172A]">X</kbd>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#E5E7EB] text-center text-[11px] text-[#6B7280]">
          SIH26011 · 3D ULPIN Vertical Property Mapping Prototype · Bengaluru Pilot
        </div>
      </DialogContent>
    </Dialog>
  );
}
