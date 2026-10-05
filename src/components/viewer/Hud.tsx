'use client';

/**
 * Hud.tsx — UI overlay for the 3D building viewer.
 *
 * Light Whimsical/Linear redesign:
 * - Top bar: logo + back-to-map button + X-ray toggle
 * - Left floor card: selected floor summary with indigo palette, Synthetic demo badge
 * - Right unit card: selected unit with Synthetic demo badge; owner name deprioritised
 * - Floor hover tooltip: indigo-tinted, no cyan
 * - Back-to-overview / back-to-floor buttons: secondary style
 * - Bottom status bar: keyboard hint chips + prototype notice
 * - Floor strip (right edge): Linear active-pill style, indigo active, warning for basement
 * Honesty: Uses "Prototype · LoD1 estimated model"
 *          All mock data surfaces carry "Synthetic demo data" badge.
 *          "Registered Owner" hidden behind badge.
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Building2, Eye, EyeOff,
  Map as MapIcon, MousePointerClick, RotateCcw, ZoomIn, Maximize2,
} from 'lucide-react';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useBuilding, useViewerStore } from '@/lib/viewer-store';
import { StatusBadge } from '@/components/ui/status-badge';
import { CopyableCode } from '@/components/inspector';
import { getFloorPlan } from '@/lib/floor-plan';

interface HudProps {
  booted: boolean;
}

/* ── Tiny stat metric tile ─────────────────────────────────────────────── */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] p-2 bg-[#F9FAFB]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-0.5">{label}</div>
      <div className="font-mono-nums text-sm text-[#0F172A]">{value}</div>
    </div>
  );
}

/* ── Keyboard hint chip ─────────────────────────────────────────────────── */
function KbdHint({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[#6B7280]">
      <span className="text-[#9CA3AF]">{icon}</span>
      <span className="text-xs font-mono-nums">{label}</span>
    </div>
  );
}

export default function Hud({ booted }: HudProps) {
  const phase          = useViewerStore((s) => s.phase);
  const selectedFloor  = useViewerStore((s) => s.selectedFloor);
  const hoveredFloor   = useViewerStore((s) => s.hoveredFloor);
  const tooltipFloor   = useViewerStore((s) => s.tooltipFloor);
  const selectedUnitId = useViewerStore((s) => s.selectedUnitId);
  const xrayMode       = useViewerStore((s) => s.xrayMode);
  const toggleXray     = useViewerStore((s) => s.toggleXray);
  const setPhase       = useViewerStore((s) => s.setPhase);
  const returnToMap    = useViewerStore((s) => s.returnToMap);
  const building       = useBuilding();

  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const floor        = building.floors.find((f) => f.floorNumber === selectedFloor) ?? null;
  const plan         = floor ? getFloorPlan(floor, building.footprint) : null;
  const selectedUnit = floor?.units.find((u) => u.unitId === selectedUnitId) ?? null;

  const handleReturnToOverview    = () => setPhase('returning');
  const handleReturnToExtracted   = () => setPhase('floor_inspect_returning');

  const hintLabel =
    phase === 'overview'     ? 'Click floor to extract'
    : phase === 'extracted'  ? 'Click floor to inspect'
    : phase === 'floor_inspecting' ? 'Orbit to inspect floor'
    : 'Transitioning…';

  const isFloorVisible =
    !!floor &&
    (phase === 'floor_selecting' || phase === 'extracted' || phase === 'floor_inspect_selecting' ||
     phase === 'floor_inspecting' || phase === 'floor_inspect_returning' || phase === 'returning');

  return (
    <div className="absolute inset-0 pointer-events-none z-30 select-none">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <motion.header
        className="absolute top-3 left-3 right-3 flex items-center justify-between px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-2xl shadow-panel pointer-events-auto"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: booted ? 1 : 0, y: booted ? 0 : -12 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Left: logo + building name */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center flex-shrink-0">
            <Building2 className="w-3.5 h-3.5 text-[#4F46E5]" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#0F172A]" style={{ letterSpacing: '-0.01em' }}>
              {building.name}
            </div>
            <div className="text-[11px] text-[#6B7280]">{building.locality}</div>
          </div>
        </div>

        {/* Centre: breadcrumb */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-[#6B7280]">
          <span>Bengaluru</span>
          <span className="text-[#D1D5DB]">›</span>
          <span>{building.locality}</span>
          <span className="text-[#D1D5DB]">›</span>
          <span className="font-mono-nums text-[#4F46E5]">{building.ulpin}</span>
          <StatusBadge tone="warning" variant="dashed" className="ml-2">
            Synthetic demo data
          </StatusBadge>
        </div>

        {/* Right: X-ray + Back to map */}
        <div className="flex items-center gap-2">
          {/* RERA badge — dashed planned */}
          <div className="hidden lg:block">
            <StatusBadge tone="neutral" variant="dashed" tooltip="Real RERA data pending — Phase 2">
              RERA · Planned
            </StatusBadge>
          </div>

          {/* X-ray toggle */}
          <button
            onClick={toggleXray}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all focus-ring ${
              xrayMode
                ? 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4338CA]'
                : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#6366F1] hover:text-[#4F46E5]'
            }`}
            title={xrayMode ? 'Disable X-ray (show solid walls)' : 'Enable X-ray (see through walls)'}
            aria-label={xrayMode ? 'X-ray on — click to disable' : 'X-ray off — click to enable'}
          >
            {xrayMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{xrayMode ? 'X-Ray On' : 'X-Ray'}</span>
          </button>

          {/* Back to map */}
          <button
            onClick={returnToMap}
            className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#6B7280] hover:border-[#6366F1] hover:text-[#4F46E5] transition-all focus-ring shadow-card"
            title="Return to the 2D map"
            aria-label="Return to 2D map"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Map</span>
          </button>
        </div>
      </motion.header>

      {/* ── Left floor card ────────────────────────────────────────────── */}
      <AnimatePresence>
        {isFloorVisible && floor && (
          <motion.aside
            className="absolute left-3 top-1/2 -translate-y-1/2 w-64 pointer-events-auto"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-panel overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-[#F3F4F6] bg-[#F9FAFB]">
                <div className="flex items-center justify-between mb-1 gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge
                      tone={floor.isUnderground ? 'warning' : 'indigo'}
                      variant="soft"
                    >
                      {floor.usage === 'parking' ? 'Parking basement' : floor.usage === 'utility' ? 'Utility floor' : 'Residential floor'}
                    </StatusBadge>
                    {floor.usage === 'parking' && (
                      <StatusBadge tone="indigo" variant="soft">
                        Synthetic demo vehicles
                      </StatusBadge>
                    )}
                    {floor.usage === 'residential' && (
                      plan?.areaScale === 1 ? (
                        <StatusBadge tone="neutral" variant="soft">
                          Drawn to scale
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="warning" variant="soft">
                          Schematic: sizes approx
                        </StatusBadge>
                      )
                    )}
                  </div>
                  <span className="font-mono-nums text-xs font-semibold text-[#4F46E5]">
                    {floor.isUnderground ? `B${Math.abs(floor.floorNumber)}` : `F${floor.floorNumber >= 0 ? '+' : ''}${floor.floorNumber.toString().padStart(2, '0')}`}
                  </span>
                </div>
                <div className="text-xl font-semibold text-[#0F172A]" style={{ letterSpacing: '-0.02em' }}>
                  {floor.label}
                </div>
              </div>

              {/* Stats grid */}
              {floor.usage === 'parking' ? (
                <div className="px-4 py-3 grid grid-cols-2 gap-2">
                  <Metric label="Slots" value={String(floor.units.length)} />
                  <Metric label="Slot area" value={`${floor.units.reduce((acc, u) => acc + u.builtUpArea, 0).toFixed(1)} m²`} />
                </div>
              ) : floor.usage === 'utility' ? (
                <div className="px-4 py-3 grid grid-cols-2 gap-2">
                  <Metric label="Rooms" value="3" />
                  <Metric label="Floor area" value={`${floor.floorArea} m²`} />
                </div>
              ) : (
                <div className="px-4 py-3 grid grid-cols-3 gap-2">
                  <Metric label="Gross area" value={`${floor.floorArea} m²`} />
                  <Metric label="Flats built-up" value={`${floor.flatsBuiltUp ?? 272} m²`} />
                  <Metric label="Common area" value={`${floor.commonArea ?? 48} m²`} />
                </div>
              )}

              {/* Usage + Vertical ID */}
              <div className="px-4 pb-3 space-y-2">
                {floor.usage && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">Usage</span>
                    <StatusBadge tone="neutral" variant="soft">{floor.usage}</StatusBadge>
                  </div>
                )}

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-1">
                    Prototype floor ID
                  </div>
                  <CopyableCode value={floor.ulpin} short className="text-[11px]" />
                  <div className="text-[11px] text-[#9CA3AF] mt-1">
                    Internal prototype ID — not an official ULPIN
                  </div>
                </div>
              </div>

              {/* Units / Slots list */}
              <div className="border-t border-[#F3F4F6] px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
                    {floor.usage === 'parking' ? 'Slots on floor' : 'Units on floor'}
                  </div>
                  <StatusBadge tone="warning" variant="dashed" tooltip="Synthetic demo data — derived layout">
                    Synthetic demo data
                  </StatusBadge>
                </div>

                {floor.usage === 'parking' ? (
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {floor.units.map((u) => {
                      const isSelected = selectedUnitId === u.unitId;
                      return (
                        <button
                          key={u.unitId}
                          onClick={() => useViewerStore.setState({ selectedUnitId: isSelected ? null : u.unitId })}
                          className={`flex justify-between items-center px-2 py-1.5 rounded-lg text-left border transition-colors ${
                            isSelected
                              ? 'bg-[#EEF2FF] border-[#6366F1] text-[#4F46E5]'
                              : 'bg-white border-[#E5E7EB] text-[#374151] hover:border-[#C7D2FE]'
                          }`}
                        >
                          <span className="font-mono-nums text-xs font-semibold">Slot {u.displayId}</span>
                          <span className="text-[11px] text-[#6B7280] font-mono-nums">
                            {u.occupiedDemo ? '🚗 Busy' : 'Free'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {[...floor.units]
                      .sort((a, b) => {
                        const slotOrder = ['NE', 'NW', 'SW', 'SE'];
                        return slotOrder.indexOf(a.slot ?? '') - slotOrder.indexOf(b.slot ?? '');
                      })
                      .map((u) => {
                        const isSelected = selectedUnitId === u.unitId;
                        return (
                          <button
                            key={u.unitId}
                            onClick={() => useViewerStore.setState({ selectedUnitId: isSelected ? null : u.unitId })}
                            className={`w-full flex justify-between items-center px-2 py-1.5 rounded-lg text-left border transition-colors ${
                              isSelected
                                ? 'bg-[#EEF2FF] border-[#6366F1] text-[#4F46E5]'
                                : 'bg-white border-[#F3F4F6] hover:bg-[#F9FAFB] text-[#374151]'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono-nums text-xs font-semibold">
                                Flat {u.displayId}
                              </span>
                              {u.slot && (
                                <span className="text-[10px] px-1 py-0.2 rounded bg-slate-100 text-slate-500 font-mono">
                                  {u.slot}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-mono-nums tabular-nums">
                              <span className="text-[#374151] font-medium">{u.builtUpArea} m²</span>
                              <span className="text-[#9CA3AF] text-[11px]">({u.carpetArea} m² carpet)</span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Action: Open separate floor view */}
              {(phase === 'extracted' || phase === 'floor_selecting') && (
                <div className="border-t border-[#F3F4F6] px-4 py-3 bg-[#F9FAFB]">
                  <button
                    onClick={() => setPhase('floor_inspect_selecting')}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#4F46E5] text-white px-3 py-2 text-xs font-semibold shadow-sm hover:bg-[#4338CA] transition-all focus-ring"
                    aria-label="Inspect floor layout in separate view"
                  >
                    <span>Inspect Floor Layout</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Action: Return to building + floor view */}
              {(phase === 'floor_inspecting' || phase === 'floor_inspect_selecting') && (
                <div className="border-t border-[#F3F4F6] px-4 py-3 bg-[#F9FAFB]">
                  <button
                    onClick={handleReturnToExtracted}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] px-3 py-2 text-xs font-semibold shadow-sm hover:bg-[#F9FAFB] hover:border-[#6366F1] hover:text-[#4F46E5] transition-all focus-ring"
                    aria-label="Return to floor beside building view"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Floor Beside Building</span>
                  </button>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Right unit card ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedUnit && (
          phase === 'extracted' || phase === 'floor_inspect_selecting' ||
          phase === 'floor_inspecting' || phase === 'floor_inspect_returning' ||
          phase === 'floor_selecting'
        ) && (
          <motion.aside
            className="absolute right-16 top-1/2 -translate-y-1/2 w-64 pointer-events-auto"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="rounded-xl border border-[#C7D2FE] bg-white shadow-panel overflow-hidden ring-1 ring-[#EEF2FF]">
              {/* Header */}
              <div className="px-4 py-3 border-b border-[#F3F4F6] bg-[#F9FAFB]">
                <div className="flex items-center justify-between mb-1">
                  <StatusBadge tone="indigo" variant="soft">
                    {selectedUnit.isParking ? 'Slot selected' : 'Unit selected'}
                  </StatusBadge>
                  <StatusBadge tone="warning" variant="dashed">Synthetic demo data</StatusBadge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xl font-semibold text-[#0F172A]" style={{ letterSpacing: '-0.02em' }}>
                    {selectedUnit.isParking ? 'Slot' : 'Flat'} {selectedUnit.displayId}
                  </div>
                  {!selectedUnit.isParking && (
                    plan?.areaScale === 1 ? (
                      <StatusBadge tone="neutral" variant="soft">Drawn to scale</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning" variant="soft">Schematic</StatusBadge>
                    )
                  )}
                </div>
              </div>

              {/* Metrics */}
              {selectedUnit.isParking ? (
                <div className="px-4 py-3 grid grid-cols-2 gap-2">
                  <Metric label="Slot ID" value={`Slot ${selectedUnit.displayId}`} />
                  <Metric label="Floor" value={`B${Math.abs(selectedUnit.floorNumber)}`} />
                  <Metric label="Bay size" value="2.5 × 5.0 m" />
                  <Metric label="Area" value={`${selectedUnit.carpetArea} m²`} />
                  <Metric label="Occupied (demo)" value={selectedUnit.occupiedDemo ? 'Yes' : 'No'} />
                </div>
              ) : (
                <div className="px-4 py-3 grid grid-cols-2 gap-2">
                  <Metric label="Floor" value={`${selectedUnit.floorNumber >= 0 ? '+' : ''}${selectedUnit.floorNumber}`} />
                  <Metric label="Facing" value={selectedUnit.facing} />
                  <Metric label="Bedrooms" value={`${selectedUnit.bedrooms} BHK`} />
                  <Metric label="Bathrooms" value={`${selectedUnit.bathrooms}`} />
                  <Metric label="Carpet area" value={`${selectedUnit.carpetArea} m²`} />
                  <Metric label="Built-up" value={`${selectedUnit.builtUpArea.toFixed(1)} m²`} />
                </div>
              )}

              {/* Prototype ID */}
              <div className="px-4 pb-3 space-y-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-1">
                    Prototype {selectedUnit.isParking ? 'slot' : 'unit'} ID
                  </div>
                  <CopyableCode value={selectedUnit.ulpin} short className="text-[11px]" />
                  <div className="text-[11px] text-[#9CA3AF] mt-1">
                    Internal prototype ID — not an official ULPIN
                  </div>
                </div>

                {/* Owner name — deprioritised, ONLY for residential flats */}
                {!selectedUnit.isParking && selectedUnit.ownerName && selectedUnit.ownerName !== 'Parking Slot' && (
                  <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#B45309] mb-0.5">
                      Occupant (demo only)
                    </div>
                    <div className="text-xs text-[#6B7280]">{selectedUnit.ownerName}</div>
                    <div className="text-[11px] text-[#B45309] mt-0.5">
                      Synthetic demo data — real owner data not collected
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Floor hover tooltip ─────────────────────────────────────────── */}
      <AnimatePresence>
        {tooltipFloor !== null && phase === 'overview' && (
          <motion.div
            className="absolute pointer-events-none z-40"
            style={{ left: mouse.x + 14, top: mouse.y + 14 }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.12 }}
          >
            <div className="rounded-xl border border-[#C7D2FE] bg-white px-3 py-2 shadow-panel">
              <div className="text-[11px] uppercase tracking-[0.06em] text-[#6B7280] mb-0.5">Floor</div>
              <div className="text-sm font-semibold text-[#0F172A] font-mono-nums flex items-center gap-2">
                {building.floors.find((f) => f.floorNumber === tooltipFloor)?.label}
                <span className="text-xs text-[#4F46E5]">
                  {building.floors.find((f) => f.floorNumber === tooltipFloor)?.isUnderground
                    ? `B${Math.abs(tooltipFloor)}`
                    : `F${tooltipFloor}`}
                </span>
              </div>
              <div className="text-xs text-[#6B7280] font-mono-nums mt-0.5">
                {building.floors.find((f) => f.floorNumber === tooltipFloor)?.floorArea} m² gross
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Back to building overview ────────────────────────────────────── */}
      <AnimatePresence>
        {(phase === 'extracted' || phase === 'floor_selecting') && (
          <motion.button
            className="absolute top-20 left-3 pointer-events-auto flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#6B7280] hover:border-[#6366F1] hover:text-[#4F46E5] transition-all shadow-card focus-ring"
            onClick={handleReturnToOverview}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            aria-label="Return to building overview"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Building Overview
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Back to floor view ──────────────────────────────────────────── */}
      <AnimatePresence>
        {(phase === 'floor_inspecting' || phase === 'floor_inspect_selecting') && (
          <motion.button
            className="absolute top-20 left-3 pointer-events-auto flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#6B7280] hover:border-[#6366F1] hover:text-[#4F46E5] transition-all shadow-card focus-ring"
            onClick={handleReturnToExtracted}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            aria-label="Return to floor view"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Floor View
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Status bar (bottom) ─────────────────────────────────────────── */}
      <motion.footer
        className="absolute bottom-0 left-0 right-0 px-4 py-2 flex items-center justify-between bg-white/90 backdrop-blur-sm border-t border-[#E5E7EB]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: booted ? 1 : 0, y: booted ? 0 : 12 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        {/* Keyboard hints */}
        <div className="flex items-center gap-4">
          <KbdHint icon={<RotateCcw className="w-3 h-3" />} label="Drag · Orbit" />
          <KbdHint icon={<ZoomIn className="w-3 h-3" />} label="Scroll · Zoom" />
          <KbdHint icon={<Maximize2 className="w-3 h-3" />} label="Right-drag · Pan" />
          <KbdHint icon={<MousePointerClick className="w-3 h-3" />} label={hintLabel} />
        </div>

        {/* Prototype honesty notice */}
        <div className="hidden md:flex items-center gap-2">
          <StatusBadge tone="neutral" variant="soft">
            Synthetic demo data & vehicles
          </StatusBadge>
          <StatusBadge tone="warning" variant="soft">
            Prototype · LoD1 estimated model · Not official ULPINs
          </StatusBadge>
        </div>
      </motion.footer>

      {/* ── Floor strip (right edge) ─────────────────────────────────────── */}
      <motion.div
        className="absolute right-3 top-20 bottom-12 pointer-events-auto overflow-hidden"
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: booted ? 1 : 0, x: booted ? 0 : 16 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="flex flex-col gap-0.5 h-full overflow-y-auto py-1">
          {[...building.floors].reverse().map((f) => {
            const active = selectedFloor === f.floorNumber;
            const hov = hoveredFloor === f.floorNumber;
            return (
              <button
                key={f.floorNumber}
                onClick={() => {
                  if (active && (phase === 'extracted' || phase === 'floor_selecting' || phase === 'floor_inspecting' || phase === 'floor_inspect_selecting' || phase === 'floor_inspect_returning')) {
                    setPhase('returning');
                    return;
                  }
                  if (!active && (phase === 'extracted' || phase === 'floor_selecting' || phase === 'floor_inspecting' || phase === 'floor_inspect_selecting' || phase === 'floor_inspect_returning')) {
                    useViewerStore.setState({ selectedFloor: f.floorNumber, selectedUnitId: null, phase: 'floor_selecting' });
                    return;
                  }
                  if (phase !== 'overview') return;
                  useViewerStore.setState({ selectedFloor: f.floorNumber, selectedUnitId: null, phase: 'floor_selecting' });
                }}
                onMouseEnter={() => useViewerStore.setState({ hoveredFloor: f.floorNumber, tooltipFloor: f.floorNumber })}
                onMouseLeave={() => useViewerStore.setState({ hoveredFloor: null, tooltipFloor: null })}
                className={`relative flex items-center justify-between gap-2 text-xs font-mono-nums px-2.5 py-1 rounded-lg transition-all duration-150 min-w-[72px] ${
                  f.isUnderground
                    ? active
                      ? 'bg-[#FFFBEB] text-[#B45309] font-semibold'
                      : hov
                        ? 'bg-[#FFF7ED] text-[#92400E]'
                        : 'text-[#B45309]/70 hover:bg-[#FFF7ED]'
                    : active
                      ? 'bg-[#EEF2FF] text-[#4338CA] font-semibold'
                      : hov
                        ? 'bg-[#F5F3FF] text-[#4F46E5]'
                        : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]'
                }`}
                title={`${f.label} — ${f.floorArea} m²`}
                aria-label={`Select ${f.label}`}
              >
                <span className="text-[11px]">{f.label}</span>
                <span className="tabular-nums text-[11px]">
                  {f.isUnderground ? `B${Math.abs(f.floorNumber)}` : f.floorNumber.toString().padStart(2, '0')}
                </span>
                {active && (
                  <span
                    className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full ${f.isUnderground ? 'bg-[#B45309]' : 'bg-[#4F46E5]'}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
