'use client';

/**
 * inspector/index.tsx
 *
 * Shared inspector component kit:
 *  - InspectorHeader
 *  - InfoCard
 *  - StatTile
 *  - KeyValueRow
 *  - CopyableCode
 *  - ConfidenceBar
 *  - EmptyState
 *
 * Used in both the 2D map inspector panel and the 3D viewer HUD cards.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  Copy, Check, X, Download,
  AlertCircle, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import type { BadgeTone } from '@/components/ui/status-badge';

/* ── CopyableCode ──────────────────────────────────────────────────────── */
interface CopyableCodeProps {
  value: string;
  className?: string;
  short?: boolean; // truncate to first 16 chars + …
}

export function CopyableCode({ value, className, short }: CopyableCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }, [value]);

  const display = short && value.length > 20 ? `${value.slice(0, 18)}…` : value;

  return (
    <span
      className={cn(
        'group inline-flex items-center gap-1.5 font-mono-nums text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-md px-2 py-1 text-[#0F172A] cursor-pointer hover:border-[#6366F1] transition-colors',
        className
      )}
      onClick={handleCopy}
      title={`${value} — click to copy`}
      role="button"
      aria-label={`Copy ${value}`}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCopy()}
    >
      <span className="font-mono-nums">{display}</span>
      {copied
        ? <Check className="w-3 h-3 text-[#059669] flex-shrink-0" />
        : <Copy className="w-3 h-3 text-[#9CA3AF] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      }
    </span>
  );
}

/* ── KeyValueRow ───────────────────────────────────────────────────────── */
interface KeyValueRowProps {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  copyValue?: string;
  className?: string;
}

export function KeyValueRow({ label, value, mono, copyValue, className }: KeyValueRowProps) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1.5 border-b border-[#F3F4F6] last:border-0', className)}>
      <span className="text-xs text-[#6B7280] flex-shrink-0 min-w-0">{label}</span>
      <span className={cn('text-xs text-[#0F172A] text-right min-w-0 break-all', mono && 'font-mono-nums')}>
        {copyValue ? (
          <CopyableCode value={copyValue} short />
        ) : value}
      </span>
    </div>
  );
}

/* ── StatTile ──────────────────────────────────────────────────────────── */
interface StatTileProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  badge?: { text: string; tone: BadgeTone };
  className?: string;
}

export function StatTile({ label, value, unit, badge, className }: StatTileProps) {
  return (
    <div className={cn('bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-3 flex flex-col gap-1', className)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums text-[#0F172A] font-mono-nums leading-none">{value}</span>
        {unit && <span className="text-xs text-[#6B7280]">{unit}</span>}
      </div>
      {badge && (
        <StatusBadge tone={badge.tone} variant="soft" className="mt-1 self-start">
          {badge.text}
        </StatusBadge>
      )}
    </div>
  );
}

/* ── ConfidenceBar ─────────────────────────────────────────────────────── */
interface ConfidenceBarProps {
  value: number; // 0..1 or 0..100
  label?: string;
  className?: string;
}

export function ConfidenceBar({ value, label, className }: ConfidenceBarProps) {
  const pct = value > 1 ? value : value * 100;
  const tone: BadgeTone =
    pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'danger';
  const barColor =
    pct >= 70 ? '#059669' : pct >= 40 ? '#B45309' : '#B91C1C';

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#6B7280]">{label}</span>
          <StatusBadge tone={tone} variant="soft">{pct.toFixed(0)}%</StatusBadge>
        </div>
      )}
      <div className="h-1.5 w-full rounded-full bg-[#E5E7EB] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

/* ── InfoCard ──────────────────────────────────────────────────────────── */
interface InfoCardProps {
  icon?: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

export function InfoCard({
  icon,
  title,
  badge,
  children,
  collapsible = false,
  defaultOpen = true,
  className,
}: InfoCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-card', className)}>
      <div
        className={cn(
          'flex items-center gap-2.5 px-4 py-3 border-b border-[#F3F4F6]',
          collapsible && 'cursor-pointer hover:bg-[#F9FAFB] transition-colors select-none'
        )}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        {icon && (
          <span className="text-[#6B7280] flex-shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="text-sm font-semibold text-[#0F172A] flex-1" style={{ letterSpacing: '-0.01em' }}>
          {title}
        </span>
        {badge}
        {collapsible && (
          <span className={cn('text-[#9CA3AF] transition-transform duration-200', !open && '-rotate-90')} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      {(!collapsible || open) && (
        <div className="px-4 py-3 space-y-0">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── InspectorHeader ───────────────────────────────────────────────────── */
interface InspectorHeaderProps {
  typeLabel: string;
  typeTone: BadgeTone;
  title: string;           // display code or name
  subtitle?: string;
  onClose?: () => void;
  onDownload?: () => void;
  honestNote?: string;     // honesty disclaimer
}

export function InspectorHeader({
  typeLabel,
  typeTone,
  title,
  subtitle,
  onClose,
  onDownload,
  honestNote,
}: InspectorHeaderProps) {
  return (
    <div className="bg-white border-b border-[#E5E7EB] px-4 pt-4 pb-0">
      {/* Type chip + actions */}
      <div className="flex items-center justify-between mb-2">
        <StatusBadge tone={typeTone} variant="soft">{typeLabel}</StatusBadge>
        <div className="flex items-center gap-1">
          {onDownload && (
            <button
              onClick={onDownload}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0F172A] transition-colors focus-ring"
              aria-label="Download GeoJSON"
              title="Download GeoJSON"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#0F172A] transition-colors focus-ring"
              aria-label="Close inspector"
              title="Close inspector"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="mb-0.5">
        <CopyableCode value={title} className="text-sm" />
      </div>
      {subtitle && (
        <p className="text-xs text-[#6B7280] mt-1 mb-2">{subtitle}</p>
      )}

      {/* Honesty notice */}
      {honestNote && (
        <div className="mt-2 mb-3 flex items-start gap-2 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] px-3 py-2">
          <Info className="w-3.5 h-3.5 text-[#1D4ED8] flex-shrink-0 mt-0.5" />
          <span className="text-xs text-[#1D4ED8] leading-relaxed">{honestNote}</span>
        </div>
      )}
    </div>
  );
}

/* ── EmptyState ────────────────────────────────────────────────────────── */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-6 text-center', className)}>
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center mb-4 text-[#9CA3AF]">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-[#0F172A] mb-1" style={{ letterSpacing: '-0.01em' }}>
        {title}
      </p>
      {description && (
        <p className="text-xs text-[#6B7280] max-w-[220px] leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── SectionLabel ──────────────────────────────────────────────────────── */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-2', className)}>
      {children}
    </div>
  );
}

/* ── HonestyStrip ──────────────────────────────────────────────────────── */
export function HonestyStrip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] px-3 py-2">
      <AlertCircle className="w-3.5 h-3.5 text-[#B45309] flex-shrink-0 mt-0.5" />
      <span className="text-xs text-[#B45309] leading-relaxed">{text}</span>
    </div>
  );
}
