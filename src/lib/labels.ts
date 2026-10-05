/**
 * labels.ts
 *
 * Maps raw backend enum values and field names to human-readable labels,
 * badge tones, and tooltip descriptions for the inspector UI.
 */

export type BadgeTone = 'neutral' | 'indigo' | 'success' | 'warning' | 'danger' | 'info';

export interface LabelDef {
  label: string;
  tone: BadgeTone;
  description: string;
}

// ── Legal status ────────────────────────────────────────────────────────
export const LEGAL_STATUS_LABELS: Record<string, LabelDef> = {
  OFFICIALLY_VERIFIED: {
    label: 'Officially verified',
    tone: 'success',
    description: 'Record has been verified by an official government authority.',
  },
  PROVISIONAL_ESTIMATE: {
    label: 'Provisional estimate',
    tone: 'warning',
    description: 'Value is derived from open data; not officially verified. Phase 1 prototype only.',
  },
  UNVERIFIED: {
    label: 'Unverified',
    tone: 'warning',
    description: 'Legal status of this record has not been verified against official records.',
  },
};

// ── Match status ────────────────────────────────────────────────────────
export const MATCH_STATUS_LABELS: Record<string, LabelDef> = {
  MATCHED_STRONG: {
    label: 'Strong match',
    tone: 'success',
    description: 'Building centroid is inside the matched parcel with >70% overlap.',
  },
  MATCHED_WEAK: {
    label: 'Weak match',
    tone: 'success',
    description: 'Building matches a parcel with 40–70% overlap.',
  },
  MATCHED_MARGINAL: {
    label: 'Marginal match',
    tone: 'warning',
    description: 'Building partially overlaps a parcel. Verify boundary alignment.',
  },
  CROSSES_MULTIPLE_PARCELS: {
    label: 'Crosses multiple parcels',
    tone: 'warning',
    description: 'Building footprint spans two or more cadastral parcels.',
  },
  OUTSIDE_ALL_PARCELS: {
    label: 'Outside all parcels',
    tone: 'danger',
    description: 'No cadastral parcel found for this building. Check data coverage.',
  },
};

// ── Height source ───────────────────────────────────────────────────────
export const HEIGHT_SOURCE_LABELS: Record<string, LabelDef> = {
  GLOBFP_ESTIMATE: {
    label: '3D-GloBFP ML estimate',
    tone: 'warning',
    description: 'Height estimated by the 3D Global Building Footprints ML model (ref. 2020). Not a survey measurement.',
  },
  OSM_TAG: {
    label: 'OSM height tag',
    tone: 'info',
    description: 'Height from OpenStreetMap community tag. Community data, not ground truth.',
  },
  NONE: {
    label: 'No height data',
    tone: 'danger',
    description: 'Building falls outside the 3D-GloBFP tile coverage (~6.8% of buildings in the AOI).',
  },
};

// ── Floors source ───────────────────────────────────────────────────────
export const FLOORS_SOURCE_LABELS: Record<string, LabelDef> = {
  HEIGHT_DERIVED: {
    label: 'Height-derived estimate',
    tone: 'warning',
    description: 'Floor count estimated from building height ÷ assumed floor height (3.5 m). ~98% of Phase 1 buildings use this method.',
  },
  OSM_LEVELS_TAG: {
    label: 'OSM building:levels tag',
    tone: 'info',
    description: 'Floor count from OpenStreetMap building:levels tag. Available for ~1.7% of buildings.',
  },
  OFFICIAL: {
    label: 'Official record',
    tone: 'success',
    description: 'Floor count from an official government or RERA record.',
  },
};

// ── Data source type ────────────────────────────────────────────────────
export const DATA_SOURCE_LABELS: Record<string, LabelDef> = {
  CADASTRAL: {
    label: 'BBMP Cadastral (KSRSAC)',
    tone: 'info',
    description: 'Karnataka State Remote Sensing Applications Centre cadastral data via OpenCity. Legal status unverified.',
  },
  OSM: {
    label: 'OpenStreetMap',
    tone: 'info',
    description: 'Community-contributed building footprints (ODbL licence). Not official boundaries.',
  },
  GLOBFP_ESTIMATE: {
    label: '3D-GloBFP (ML estimate)',
    tone: 'warning',
    description: 'ML-estimated heights from the 3D Global Building Footprints dataset, CC BY 4.0, reference year 2020.',
  },
  COPERNICUS_DSM: {
    label: 'Copernicus GLO-30 DSM',
    tone: 'info',
    description: '~30 m Digital Surface Model (includes roofs and trees). Not a bare-earth DTM.',
  },
  HEIGHT_DERIVED_ESTIMATE: {
    label: 'Height-derived estimate',
    tone: 'warning',
    description: 'Floor count derived from estimated height. Not an official record.',
  },
};

// ── Category (cadastral) ────────────────────────────────────────────────
export const CATEGORY_LABELS: Record<string, LabelDef> = {
  Parcel:     { label: 'Land parcel', tone: 'indigo', description: 'Cadastral land parcel (Category = Parcel).' },
  Stream:     { label: 'Stream', tone: 'info', description: 'Water stream feature (non-parcel).' },
  Road:       { label: 'Road', tone: 'neutral', description: 'Road feature (non-parcel).' },
  Tank:       { label: 'Tank / pond', tone: 'info', description: 'Water body feature.' },
  Settlement: { label: 'Settlement', tone: 'neutral', description: 'Settlement feature.' },
  Canal:      { label: 'Canal', tone: 'info', description: 'Canal feature.' },
  Rail:       { label: 'Rail', tone: 'neutral', description: 'Rail infrastructure.' },
  River:      { label: 'River', tone: 'info', description: 'River feature.' },
  Others:     { label: 'Other feature', tone: 'neutral', description: 'Other non-parcel feature.' },
};

// ── Severity (validation issues) ───────────────────────────────────────
export const SEVERITY_LABELS: Record<string, LabelDef> = {
  ERROR:   { label: 'Error',   tone: 'danger',  description: 'Critical data quality issue.' },
  WARNING: { label: 'Warning', tone: 'warning', description: 'Potential data quality concern.' },
  INFO:    { label: 'Info',    tone: 'info',    description: 'Informational note.' },
};

// ── Field display names ─────────────────────────────────────────────────
export const FIELD_LABELS: Record<string, string> = {
  object_uuid:             'Object UUID',
  display_code:            'Display code',
  parent_parcel_uuid:      'Parent parcel UUID',
  parent_parcel_code:      'Parent parcel code',
  source_ulpin:            'Source ULPIN-labelled field',
  kgis_cadastral_id:       'KGIS cadastral ID',
  bhucode:                 'Bhucode',
  surveynumberi:           'Survey number',
  Surveynumber_Old:        'Survey number (old)',
  HissaNo:                 'Hissa number',
  LGD_VillageCode:         'LGD village code',
  height_m:                'Height (est.)',
  height_source:           'Height source',
  height_match_status:     'Height match status',
  height_overlap_percent:  'Height overlap',
  ground_elevation_m:      'Ground elevation (DSM)',
  ground_elevation_source: 'Ground elevation source',
  floors:                  'Floors (est.)',
  floors_source:           'Floors source',
  floors_confidence:       'Floors confidence',
  match_status:            'Parcel match status',
  overlap_percent:         'Parcel overlap',
  overlap_area_m2:         'Overlap area',
  match_method:            'Match method',
  confidence_score:        'Confidence score',
  data_source_type:        'Data source',
  is_ai_generated:         'AI-generated',
  legal_status:            'Legal status',
  osm_building_type:       'OSM building type',
  osm_name:                'OSM name',
  Category:                'Category',
};

// ── formatValue util ────────────────────────────────────────────────────
export function formatValue(
  key: string,
  value: unknown,
  opts?: { showEmpty?: boolean }
): string {
  if (value === null || value === undefined || value === '' || value === 'None') {
    return opts?.showEmpty ? '—' : '';
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    // Area
    if (key.includes('area_m2')) return `${value.toLocaleString('en-IN', { maximumFractionDigits: 1 })} m²`;
    // Percent
    if (key.includes('percent') || key.includes('confidence')) return `${(value * (value <= 1 ? 100 : 1)).toFixed(1)}%`;
    // Height / elevation
    if (key.includes('height') || key.includes('elevation')) return `${value.toFixed(2)} m`;
    // Integer floor count
    if (key === 'floors') return String(Math.round(value));
    return Number.isInteger(value) ? String(value) : value.toFixed(3);
  }
  return String(value);
}

/** Returns true if the value should be hidden in default (non-empty) mode */
export function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === '' || value === 'None';
}
