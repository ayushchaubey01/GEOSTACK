/**
 * design-tokens.ts
 *
 * Single source of truth for design tokens used in JS contexts:
 * - MapLibre paint expressions
 * - Three.js material colours
 * - Recharts palette
 *
 * Mirrors globals.css :root values. Update both together.
 */

// ── Surfaces ──────────────────────────────────────────────────────────────
export const COLOR_CANVAS   = '#F6F7F9';
export const COLOR_SURFACE  = '#FFFFFF';
export const COLOR_SUBTLE   = '#F9FAFB';

// ── Text ──────────────────────────────────────────────────────────────────
export const COLOR_TEXT       = '#0F172A';
export const COLOR_TEXT_MUTED = '#6B7280';

// ── Borders ───────────────────────────────────────────────────────────────
export const COLOR_BORDER       = '#E5E7EB';
export const COLOR_BORDER_STRONG = '#D1D5DB';

// ── Primary: Indigo ───────────────────────────────────────────────────────
export const COLOR_PRIMARY_50  = '#EEF2FF';
export const COLOR_PRIMARY_100 = '#E0E7FF';
export const COLOR_PRIMARY_200 = '#C7D2FE';
export const COLOR_PRIMARY_500 = '#6366F1';
export const COLOR_PRIMARY_600 = '#4F46E5';
export const COLOR_PRIMARY_700 = '#4338CA';
export const COLOR_PRIMARY_900 = '#312E81';

// ── Semantic ──────────────────────────────────────────────────────────────
export const COLOR_SUCCESS     = '#059669';
export const COLOR_SUCCESS_BG  = '#ECFDF5';
export const COLOR_WARNING     = '#B45309';
export const COLOR_WARNING_BG  = '#FFFBEB';
export const COLOR_DANGER      = '#B91C1C';
export const COLOR_DANGER_BG   = '#FEF2F2';
export const COLOR_INFO        = '#1D4ED8';
export const COLOR_INFO_BG     = '#EFF6FF';

// ── Building height colour ramp (single-hue indigo) ──────────────────────
// Use in MapLibre paint expressions
export const HEIGHT_RAMP = [
  0,   COLOR_PRIMARY_100,   // flat / near-ground
  5,   '#A5B4FC',           // indigo-300
  10,  '#818CF8',           // indigo-400
  20,  COLOR_PRIMARY_500,   // indigo-500
  40,  COLOR_PRIMARY_600,   // indigo-600
  70,  COLOR_PRIMARY_700,   // indigo-700
  100, COLOR_PRIMARY_900,   // indigo-900
] as const;

// ── Floor count ramp ─────────────────────────────────────────────────────
export const FLOORS_RAMP = [
  1,  COLOR_PRIMARY_100,
  3,  '#A5B4FC',
  6,  COLOR_PRIMARY_500,
  12, COLOR_PRIMARY_700,
  20, COLOR_PRIMARY_900,
] as const;

// ── Match status colours (semantic) ──────────────────────────────────────
export const MATCH_STATUS_COLORS: Record<string, string> = {
  MATCHED_STRONG:           COLOR_SUCCESS,
  MATCHED_WEAK:             '#16A34A',
  MATCHED_MARGINAL:         COLOR_WARNING,
  CROSSES_MULTIPLE_PARCELS: '#EA580C',
  OUTSIDE_ALL_PARCELS:      '#9CA3AF',
};

// ── Recharts palette ─────────────────────────────────────────────────────
export const CHART_COLORS = [
  COLOR_PRIMARY_600,
  COLOR_SUCCESS,
  COLOR_WARNING,
  COLOR_DANGER,
  COLOR_INFO,
  COLOR_PRIMARY_700,
];

// ── Severity colours (issues) ────────────────────────────────────────────
export const SEVERITY_COLORS: Record<string, string> = {
  ERROR:   COLOR_DANGER,
  WARNING: COLOR_WARNING,
  INFO:    COLOR_INFO,
};

// ── Three.js 3D scene colours ────────────────────────────────────────────
export const SCENE = {
  bg:            COLOR_CANVAS,
  ground:        '#EBEBED',
  groundGrid:    COLOR_BORDER,
  concreteFacade:'#F3F4F6',
  slabEdge:      '#D1D5DB',
  soffit:        '#9CA3AF',
  basement:      '#CBD5E1',
  glass:         '#C7D2FE',
  glassMetal:    0.25,
  mullion:       '#94A3B8',
  railing:       '#94A3B8',
  balconyTile:   '#E5E7EB',
  parapet:       '#F3F4F6',
  foliage:       '#86EFAC',
  trunk:         '#A3A3A3',
  canopy:        '#C7D2FE',
  pavement:      '#F3F4F6',
  pathway:       '#E5E7EB',
  waterTank:     '#CBD5E1',
  mech:          '#9CA3AF',
  /** Selected floor indigo-500 at 25% */
  selectedFloor: COLOR_PRIMARY_500,
  /** Hover floor indigo-200 */
  hoverFloor:    COLOR_PRIMARY_200,
  /** X-ray outline */
  xrayEdge:      COLOR_PRIMARY_900,
  /** X-ray facade fill (near transparent) */
  xrayFacade:    COLOR_PRIMARY_100,
  /** Accent emissive (selection beam) */
  accentEmissive:COLOR_PRIMARY_500,
  /** Demo vehicles & parking tokens */
  carBodyBase:    COLOR_PRIMARY_900, // #312E81
  carBodyAlt1:    '#3730A3',         // indigo-700
  carBodyAlt2:    '#1E1B4B',         // indigo-950
  carGlass:       COLOR_PRIMARY_200, // #C7D2FE
  carWheels:      '#1E293B',         // slate-800
  parkingStripe:  '#CBD5E1',         // slate-300
  parkingAisle:   '#F9FAFB',
  parkingRamp:    '#E2E8F0',
} as const;
