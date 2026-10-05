#!/usr/bin/env python3
"""Create an optimized buildings.geojson with simplified geometry + essential properties only."""
import json, os
from shapely.geometry import Polygon

SRC = "/home/z/my-project/public/data/buildings.geojson"
DST = "/home/z/my-project/public/data/buildings-opt.geojson"

ESSENTIAL_KEYS = {
    'object_uuid', 'display_code', 'parent_parcel_uuid', 'parent_parcel_code',
    'parent_parcel_seq', 'building_seq', 'match_status', 'match_method',
    'overlap_percent', 'overlap_area_m2', 'height_m', 'height_source',
    'height_overlap_percent', 'height_match_status', 'ground_elevation_m',
    'ground_elevation_source', 'floors', 'floors_source', 'floors_estimated',
    'floors_confidence', 'data_source_type', 'confidence_score',
    'is_ai_generated', 'legal_status', 'building', 'name',
    'building:levels', 'addr:housenumber', 'addr:street'
}

print("Loading buildings.geojson...")
with open(SRC) as f:
    fc = json.load(f)

print(f"Total features: {len(fc['features'])}")
print("Processing...")

compact = []
errors = 0
for feat in fc['features']:
    p = feat['properties']
    geo = feat['geometry']
    
    try:
        if geo['type'] == 'Polygon':
            coords = geo['coordinates'][0]
        elif geo['type'] == 'MultiPolygon':
            # Use the largest polygon
            coords = max(geo['coordinates'], key=lambda p: len(p[0]))[0]
        else:
            continue
        
        # Simplify if many vertices
        if len(coords) > 7:
            try:
                poly = Polygon(coords)
                simp = poly.simplify(0.00005, preserve_topology=False)
                if not simp.is_empty and len(simp.exterior.coords) >= 4:
                    coords = list(simp.exterior.coords)
            except:
                pass
        
        # Round coordinates — handle various types
        rounded = []
        for pt in coords:
            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                x, y = float(pt[0]), float(pt[1])
                rounded.append([round(x, 5), round(y, 5)])
        
        if len(rounded) < 4:
            continue
        
        # Close the ring if needed
        if rounded[0] != rounded[-1]:
            rounded.append(rounded[0])
        
        props = {k: v for k, v in p.items() if k in ESSENTIAL_KEYS}
        
        compact.append({
            'type': 'Feature',
            'geometry': {'type': 'Polygon', 'coordinates': [rounded]},
            'properties': props
        })
    except Exception as e:
        errors += 1

print(f"Processed: {len(compact)}, Errors: {errors}")
print("Writing...")

out = {'type': 'FeatureCollection', 'features': compact}
with open(DST, 'w') as f:
    json.dump(out, f, separators=(',', ':'))

orig = os.path.getsize(SRC) / 1024 / 1024
opt = os.path.getsize(DST) / 1024 / 1024
print(f"Original: {orig:.1f} MB, Optimized: {opt:.1f} MB ({opt/orig*100:.0f}%)")
