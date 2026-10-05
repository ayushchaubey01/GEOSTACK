'use client';

/**
 * StatusBadge.tsx
 *
 * Universal pill badge used across inspector, rail, and map.
 *
 * Tones: neutral | indigo | success | warning | danger | info
 * Variants:
 *   soft    — tinted bg + text (default)
 *   outline — border, transparent bg
 *   dashed  — dashed border, transparent bg (for Planned / Synthetic demo)
 *
 * Minimum size: 11px (text-[11px]).
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'indigo' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeVariant = 'soft' | 'outline' | 'dashed';

interface StatusBadgeProps {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  dot?: boolean;
  icon?: React.ReactNode;
  tooltip?: string;
  className?: string;
  children: React.ReactNode;
}

const TONE_SOFT: Record<BadgeTone, string> = {
  neutral: 'bg-[#F3F4F6] text-[#374151] ring-1 ring-inset ring-[#E5E7EB]',
  indigo:  'bg-[#EEF2FF] text-[#4338CA] ring-1 ring-inset ring-[#C7D2FE]',
  success: 'bg-[#ECFDF5] text-[#059669] ring-1 ring-inset ring-[#A7F3D0]',
  warning: 'bg-[#FFFBEB] text-[#B45309] ring-1 ring-inset ring-[#FDE68A]',
  danger:  'bg-[#FEF2F2] text-[#B91C1C] ring-1 ring-inset ring-[#FCA5A5]',
  info:    'bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-inset ring-[#BFDBFE]',
};

const TONE_OUTLINE: Record<BadgeTone, string> = {
  neutral: 'border-[#D1D5DB] text-[#6B7280]',
  indigo:  'border-[#6366F1] text-[#4F46E5]',
  success: 'border-[#059669] text-[#059669]',
  warning: 'border-[#B45309] text-[#B45309]',
  danger:  'border-[#B91C1C] text-[#B91C1C]',
  info:    'border-[#1D4ED8] text-[#1D4ED8]',
};

const TONE_DASHED: Record<BadgeTone, string> = {
  neutral: 'border-[#9CA3AF] text-[#6B7280]',
  indigo:  'border-[#6366F1] text-[#4F46E5]',
  success: 'border-[#059669] text-[#059669]',
  warning: 'border-[#B45309] text-[#B45309]',
  danger:  'border-[#B91C1C] text-[#B91C1C]',
  info:    'border-[#1D4ED8] text-[#1D4ED8]',
};

const DOT_COLOR: Record<BadgeTone, string> = {
  neutral: 'bg-[#9CA3AF]',
  indigo:  'bg-[#6366F1]',
  success: 'bg-[#059669]',
  warning: 'bg-[#B45309]',
  danger:  'bg-[#B91C1C]',
  info:    'bg-[#1D4ED8]',
};

export function StatusBadge({
  tone = 'neutral',
  variant = 'soft',
  dot = false,
  icon,
  tooltip,
  className,
  children,
}: StatusBadgeProps) {
  const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap select-none';

  const variantClass =
    variant === 'soft'
      ? TONE_SOFT[tone]
      : variant === 'outline'
        ? `border ${TONE_OUTLINE[tone]}`
        : `border border-dashed ${TONE_DASHED[tone]}`;

  return (
    <span
      className={cn(base, variantClass, className)}
      title={tooltip}
      role="status"
      aria-label={tooltip || (typeof children === 'string' ? children : undefined)}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', DOT_COLOR[tone])}
          aria-hidden="true"
        />
      )}
      {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}

export default StatusBadge;
