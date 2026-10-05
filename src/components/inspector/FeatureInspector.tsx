'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import {
  Building2, Box, Layers, ArrowLeft, Search, Check,
  AlertTriangle, ExternalLink, ShieldCheck, Database, FileSpreadsheet
} from 'lucide-react';
import {
  InspectorHeader, InfoCard, StatTile, KeyValueRow,
  CopyableCode, ConfidenceBar, EmptyState, SectionLabel
} from './index';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  LEGAL_STATUS_LABELS, MATCH_STATUS_LABELS, HEIGHT_SOURCE_LABELS,
  FLOORS_SOURCE_LABELS, DATA_SOURCE_LABELS, CATEGORY_LABELS,
  FIELD_LABELS, formatValue, isEmptyValue
} from '@/lib/labels';

interface FeatureInspectorProps {
  selected: {
    layer: string;
    properties: Record<string, any>;
    geometry: any;
  } | null;
  activeColony?: any;
  floors?: any[];
  floorsLoading?: boolean;
  parcelBuildings?: any[];
  parcelBuildingsLoading?: boolean;
  previousParcel?: any;
  onClose: () => void;
  onBackToParcel?: () => void;
  onSelectBuilding?: (building: any) => void;
  onSelectParcelByCode?: (parcelCode: string) => void;
  onOpen3D?: (feature: any) => void;
  onDownloadGeoJSON?: (data: any, filename: string) => void;
}

export function FeatureInspector({
  selected,
  activeColony,
  floors = [],
  floorsLoading = false,
  parcelBuildings = [],
  parcelBuildingsLoading = false,
  previousParcel,
  onClose,
  onBackToParcel,
  onSelectBuilding,
  onSelectParcelByCode,
  onOpen3D,
  onDownloadGeoJSON,
}: FeatureInspectorProps) {
  const [propSearch, setPropSearch] = useState('');
  const [showEmptyProps, setShowEmptyProps] = useState(false);

  const p = selected?.properties || {};

  // Filtered raw properties
  const allProps = useMemo(() => {
    return Object.entries(p)
      .filter(([k]) => {
        if (!propSearch) return true;
        const label = FIELD_LABELS[k] || k;
        return (
          k.toLowerCase().includes(propSearch.toLowerCase()) ||
          label.toLowerCase().includes(propSearch.toLowerCase()) ||
          String(p[k]).toLowerCase().includes(propSearch.toLowerCase())
        );
      })
      .filter(([, v]) => showEmptyProps || !isEmptyValue(v));
  }, [p, propSearch, showEmptyProps]);

  if (!selected) {
    return (
      <div className="flex-1 flex flex-col justify-center">
        <EmptyState
          icon={<Building2 className="w-6 h-6 text-[#9CA3AF]" />}
          title="No selection"
          description={
            activeColony
              ? 'Click a building or parcel on the map to inspect properties.'
              : 'Select a colony or click on the map to start inspecting features.'
          }
        />
      </div>
    );
  }

  const isBuilding = selected.layer === 'Building';
  const isParcel = selected.layer === 'Parcel';

  // Format display code / title
  const displayCode = p.display_code || p.object_uuid || 'Unknown Feature';
  const subtitle = [
    activeColony?.name,
    p.name || p.osm_name,
    p.building || p.osm_building_type,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F6F7F9]">
      {/* Top Header */}
      <InspectorHeader
        typeLabel={isBuilding ? 'Building' : isParcel ? 'Cadastral Parcel' : selected.layer}
        typeTone={isBuilding ? 'indigo' : isParcel ? 'neutral' : 'info'}
        title={displayCode}
        subtitle={subtitle}
        onClose={onClose}
        onDownload={
          onDownloadGeoJSON
            ? () =>
                onDownloadGeoJSON(
                  { type: 'Feature', geometry: selected.geometry, properties: p },
                  `${(selected.layer || 'feature').toLowerCase()}_${displayCode}.geojson`
                )
            : undefined
        }
        honestNote="Internal prototype ID, not an official ULPIN"
      />

      {/* Scrollable Cards Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scroll">
        {/* Back to Parcel Link (when viewing building from parcel) */}
        {isBuilding && previousParcel && onBackToParcel && (
          <button
            onClick={onBackToParcel}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#6366F1] text-xs font-medium text-[#4F46E5] shadow-xs transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Parent Parcel
            </span>
            <span className="font-mono-nums text-[11px] text-[#6B7280]">
              {previousParcel.properties?.display_code}
            </span>
          </button>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* BUILDING CARDS */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {isBuilding && (
          <>
            {/* 1. Key Figures (2x2 StatTile grid) */}
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="Height (est.)"
                value={p.height_m ? Number(p.height_m).toFixed(1) : '—'}
                unit="m"
                badge={{ text: 'Estimated', tone: 'warning' }}
              />
              <StatTile
                label="Floors (est.)"
                value={p.floors ? Math.round(Number(p.floors)) : '—'}
                badge={{ text: 'Estimated', tone: 'warning' }}
              />
              <StatTile
                label="Ground Elev."
                value={p.ground_elevation_m ? Number(p.ground_elevation_m).toFixed(1) : '—'}
                unit="m"
              />
              <StatTile
                label="Confidence"
                value={p.confidence_score ? `${Math.round(p.confidence_score * 100)}` : '—'}
                unit="%"
                badge={{
                  text: (p.confidence_score || 0) >= 0.7 ? 'High' : 'Moderate',
                  tone: (p.confidence_score || 0) >= 0.7 ? 'success' : 'warning',
                }}
              />
            </div>

            {/* 2. Identity & Legal Status */}
            <InfoCard
              icon={<Building2 className="w-4 h-4" />}
              title="Identity & Status"
              badge={
                p.legal_status ? (
                  <StatusBadge
                    tone={LEGAL_STATUS_LABELS[p.legal_status]?.tone || 'warning'}
                    variant="soft"
                  >
                    {LEGAL_STATUS_LABELS[p.legal_status]?.label || p.legal_status}
                  </StatusBadge>
                ) : undefined
              }
            >
              <div className="space-y-1">
                <KeyValueRow label="Display Code" copyValue={p.display_code} mono />
                <KeyValueRow label="Object UUID" copyValue={p.object_uuid} mono />
                {p.parent_parcel_code && (
                  <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-[#F3F4F6]">
                    <span className="text-xs text-[#6B7280]">Parent Parcel</span>
                    <button
                      onClick={() => onSelectParcelByCode?.(p.parent_parcel_code)}
                      className="text-xs font-mono-nums text-[#4F46E5] hover:underline flex items-center gap-1"
                    >
                      {p.parent_parcel_code}
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <KeyValueRow label="OSM Building Type" value={p.building || p.osm_building_type || 'yes'} />
                <KeyValueRow label="OSM Name" value={p.name || p.osm_name} />
              </div>
            </InfoCard>

            {/* 3. Parcel Match */}
            <InfoCard
              icon={<ShieldCheck className="w-4 h-4" />}
              title="Cadastral Match"
              badge={
                p.match_status ? (
                  <StatusBadge
                    tone={MATCH_STATUS_LABELS[p.match_status]?.tone || 'warning'}
                    variant="soft"
                  >
                    {MATCH_STATUS_LABELS[p.match_status]?.label || p.match_status}
                  </StatusBadge>
                ) : undefined
              }
            >
              <div className="space-y-2.5">
                {p.overlap_percent !== undefined && (
                  <ConfidenceBar
                    value={p.overlap_percent}
                    label="Footprint Overlap with Parcel"
                  />
                )}
                <div className="space-y-1 pt-1">
                  <KeyValueRow
                    label="Overlap Area"
                    value={p.overlap_area_m2 ? `${Number(p.overlap_area_m2).toFixed(1)} m²` : undefined}
                  />
                  <KeyValueRow label="Match Method" value={p.match_method || 'Spatial intersection'} />
                </div>
              </div>
            </InfoCard>

            {/* 4. Height & Floors Source */}
            <InfoCard
              icon={<Layers className="w-4 h-4" />}
              title="Height & Floor Lineage"
            >
              <div className="space-y-1.5">
                <KeyValueRow
                  label="Height Source"
                  value={
                    <span className="flex items-center gap-1.5">
                      <span>{HEIGHT_SOURCE_LABELS[p.height_source]?.label || p.height_source || '3D-GloBFP ML estimate (ref. 2020)'}</span>
                      <StatusBadge tone="warning" variant="outline">ML</StatusBadge>
                    </span>
                  }
                />
                <KeyValueRow
                  label="Floors Source"
                  value={FLOORS_SOURCE_LABELS[p.floors_source]?.label || 'Height-derived estimate (3.5m / floor)'}
                />
                {p.floors_confidence !== undefined && (
                  <ConfidenceBar
                    value={p.floors_confidence}
                    label="Floor Count Confidence"
                    className="pt-1"
                  />
                )}
                <KeyValueRow
                  label="Ground Elevation"
                  value={
                    <span className="flex items-center gap-1.5">
                      <span>Copernicus GLO-30 DSM</span>
                      <span className="text-[11px] text-[#6B7280]" title="Digital Surface Model includes roofs and canopy; bare-earth DTM requires aerial LiDAR">
                        (DSM caveat)
                      </span>
                    </span>
                  }
                />
              </div>
            </InfoCard>

            {/* 5. Vertical Stack (Derived) & 3D Action */}
            <InfoCard
              icon={<Box className="w-4 h-4" />}
              title="Vertical Stack (Derived)"
              badge={<StatusBadge tone="warning" variant="outline">Estimated</StatusBadge>}
            >
              <div className="space-y-2">
                <p className="text-[11px] text-[#6B7280] leading-relaxed">
                  Floor divisions are derived estimates from height model. No official floor plans in Phase 1.
                </p>

                {floorsLoading ? (
                  <div className="py-4 text-center text-xs text-[#6B7280] font-mono-nums animate-pulse">
                    Calculating vertical strata…
                  </div>
                ) : floors.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scroll">
                    {floors
                      .slice()
                      .reverse()
                      .map((f: any) => (
                        <div
                          key={f.floor_number}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-[#EEF2FF] text-[#4F46E5] font-semibold text-xs flex items-center justify-center font-mono-nums">
                              {f.floor_number}
                            </span>
                            <div>
                              <div className="text-xs font-medium text-[#0F172A]">
                                {f.floor_label || `Floor ${f.floor_number}`} · {f.elevation_m?.toFixed(1)}m
                              </div>
                              {f.floor_display_code && (
                                <div className="text-[11px] font-mono-nums text-[#6B7280]">
                                  {f.floor_display_code}
                                </div>
                              )}
                            </div>
                          </div>
                          <StatusBadge tone="warning" variant="soft">EST</StatusBadge>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="py-2 text-xs text-[#6B7280]">No vertical divisions generated.</div>
                )}

                {/* Primary Action Button: Open 3D */}
                {onOpen3D && (
                  <button
                    onClick={() => onOpen3D(selected)}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold shadow-sm transition-all focus-ring cursor-pointer"
                  >
                    <Box className="w-4 h-4" />
                    Open 3D Vertical Property Map
                  </button>
                )}
              </div>
            </InfoCard>
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* PARCEL CARDS */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {isParcel && (
          <>
            {/* D-2 Anomaly Warning */}
            {p.source_ulpin && p.source_ulpin !== 'None' && (
              <div className="p-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#B45309]" />
                  D-2 ULPIN Character Length Check
                </div>
                <p className="text-[11px] leading-relaxed text-[#92400E]">
                  Source ULPIN column has <strong className="font-mono-nums">{String(p.source_ulpin).length} characters</strong> (&quot;{String(p.source_ulpin).slice(0, 16)}…&quot;). Official DoLR standard specifies 14 alphanumeric characters. <em>Unverified whether this is a state-level cadastral ID.</em>
                </p>
              </div>
            )}

            {/* Key Figures */}
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="Legal Status"
                value="Unverified"
                badge={{ text: 'Open Data', tone: 'warning' }}
              />
              <StatTile
                label="Category"
                value={p.Category || 'Parcel'}
                badge={{ text: 'Cadastral', tone: 'neutral' }}
              />
            </div>

            {/* Identity & Cadastral Records */}
            <InfoCard
              icon={<Database className="w-4 h-4" />}
              title="Cadastral Identity"
            >
              <div className="space-y-1">
                <KeyValueRow label="Display Code" copyValue={p.display_code} mono />
                <KeyValueRow label="Object UUID" copyValue={p.object_uuid} mono />
                <KeyValueRow label="Source ULPIN Field" copyValue={p.source_ulpin} mono />
                <KeyValueRow label="KGIS Cadastral ID" copyValue={p.kgis_cadastral_id} mono />
                <KeyValueRow label="Bhucode" value={p.bhucode} mono />
                <KeyValueRow label="Survey Number" value={p.surveynumberi || p.Surveynumber_Old} mono />
                <KeyValueRow label="Hissa Number" value={p.HissaNo} mono />
                <KeyValueRow label="LGD Village Code" value={p.LGD_VillageCode} mono />
              </div>
            </InfoCard>

            {/* Buildings on Parcel */}
            <InfoCard
              icon={<Building2 className="w-4 h-4" />}
              title="Co-located Buildings"
              badge={
                <StatusBadge tone="neutral" variant="soft">
                  {parcelBuildings.length} footprints
                </StatusBadge>
              }
            >
              <div className="space-y-2">
                {parcelBuildingsLoading ? (
                  <div className="py-4 text-center text-xs text-[#6B7280] font-mono-nums animate-pulse">
                    Querying co-located footprints…
                  </div>
                ) : parcelBuildings && parcelBuildings.length > 0 ? (
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scroll">
                    {parcelBuildings.map((b: any, i: number) => {
                      const bp = b.properties || {};
                      return (
                        <button
                          key={i}
                          onClick={() => onSelectBuilding?.(b)}
                          className="w-full flex items-center justify-between p-2 rounded-lg bg-[#F9FAFB] hover:bg-[#EEF2FF] hover:border-[#C7D2FE] border border-[#E5E7EB] text-left transition-colors cursor-pointer group"
                        >
                          <span className="text-xs font-mono-nums text-[#0F172A] group-hover:text-[#4F46E5] truncate">
                            {bp.display_code || bp.object_uuid?.slice(0, 14)}
                          </span>
                          <span className="text-xs font-mono-nums text-[#6B7280] ml-2 shrink-0">
                            {bp.height_m ? `${Number(bp.height_m).toFixed(1)}m` : '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#6B7280] py-1">No building footprints detected on this parcel.</p>
                )}
              </div>
            </InfoCard>
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* ALL PROPERTIES ACCORDION */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <InfoCard
          icon={<FileSpreadsheet className="w-4 h-4" />}
          title="All Raw Attributes"
          collapsible
          defaultOpen={false}
          badge={
            <StatusBadge tone="neutral" variant="soft">
              {allProps.length} fields
            </StatusBadge>
          }
        >
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="Filter attributes…"
                  value={propSearch}
                  onChange={(e) => setPropSearch(e.target.value)}
                  className="w-full pl-8 pr-2 py-1 text-xs rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] focus:bg-white focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
              <button
                onClick={() => setShowEmptyProps((v) => !v)}
                className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${
                  showEmptyProps
                    ? 'border-[#4F46E5] text-[#4F46E5] bg-[#EEF2FF]'
                    : 'border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
                }`}
              >
                {showEmptyProps ? 'Hide empty' : 'Show empty'}
              </button>
            </div>

            <div className="border border-[#E5E7EB] rounded-lg overflow-hidden divide-y divide-[#F3F4F6] max-h-60 overflow-y-auto custom-scroll">
              {allProps.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 px-2.5 py-1.5 bg-white text-xs">
                  <span className="font-mono-nums text-[#6B7280] shrink-0 text-[11px] select-all">
                    {FIELD_LABELS[k] || k}
                  </span>
                  <span className="font-mono-nums text-[#0F172A] text-right break-all select-all text-[11px]">
                    {formatValue(k, v, { showEmpty: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </InfoCard>
      </div>
    </div>
  );
}
