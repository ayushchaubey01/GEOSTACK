#!/usr/bin/env python3
"""
Pre-process the Bengaluru data into a 3-level hierarchy:
  24 areas (colonies) → parcels → buildings

For each colony:
  - Find all parcels whose centroid falls inside the colony polygon
  - For each parcel, find all buildings with parent_parcel_code == parcel display_code

Output: /home/z/my-project/public/data/colony-indexed.json
  {
    "colonies": [
      { "id": "c01", "name": "HAL 2nd Stage", "coords": [...], "center": [...] },
      ...
    ],
    "areas": {
      "c01": {
        "parcels": [
          { "code": "BLR-P-000191", "coords": [...], "centroid": [...], "buildingCount": 6 },
          ...
        ]
      },
      ...
    },
    "buildings": {
      "BLR-P-000191": [
        { "id": 1234, "coords": [...], "h": 20.6, "f": 6, "n": "Gopalan...", ... },
        ...
      ],
      ...
    }
  }
"""

import json
import os
from shapely.geometry import Polygon, Point

SRC = '/home/z/my-project/upload/extracted/3D-ULPIN-Bengaluru/public/data'
DST = '/home/z/my-project/public/data'
os.makedirs(DST, exist_ok=True)

# Load colonies
with open(f'{DST}/colonies.json') as f:
    colonies = json.load(f)

# Build colony polygons
colony_polys = {}
for c in colonies:
    coords = c['coords']
    # Ensure closed ring
    if coords[0] != coords[-1]:
        coords = coords + [coords[0]]
    c['coords'] = coords
    colony_polys[c['id']] = Polygon(coords)

print(f'Loaded {len(colonies)} colonies')

# Load parcels
with open(f'{SRC}/parcels.geojson') as f:
    parcels_fc = json.load(f)

# Assign each parcel to a colony (by centroid containment)
parcels_by_colony = {c['id']: [] for c in colonies}
unassigned_parcels = 0

for feat in parcels_fc['features']:
    props = feat['properties']
    code = props.get('display_code', '')
    geom = feat['geometry']

    # Get the outer ring of the polygon
    if geom['type'] == 'Polygon':
        ring = geom['coordinates'][0]
    elif geom['type'] == 'MultiPolygon':
        # Use the largest polygon
        ring = max(geom['coordinates'], key=lambda p: len(p[0]))[0]
    else:
        continue

    if len(ring) < 4:
        continue

    # Simplify the ring (reduce vertices for performance)
    try:
        poly = Polygon(ring)
        simplified = poly.simplify(0.00003, preserve_topology=False)
        if not simplified.is_empty and len(simplified.exterior.coords) >= 4:
            ring = list(simplified.exterior.coords)
        centroid = [poly.centroid.x, poly.centroid.y]
    except Exception:
        centroid = [sum(c[0] for c in ring) / len(ring),
                    sum(c[1] for c in ring) / len(ring)]

    # Round coords
    ring = [[round(c[0], 5), round(c[1], 5)] for c in ring]
    centroid = [round(centroid[0], 5), round(centroid[1], 5)]

    # Find which colony contains this parcel's centroid
    pt = Point(centroid)
    assigned = False
    for cid, cpoly in colony_polys.items():
        if cpoly.contains(pt):
            parcels_by_colony[cid].append({
                'code': code,
                'c': ring,
                'ce': centroid,
            })
            assigned = True
            break

    if not assigned:
        unassigned_parcels += 1

print(f'Parcels assigned: {sum(len(v) for v in parcels_by_colony.values())}, unassigned: {unassigned_parcels}')

# Load buildings
with open(f'{SRC}/buildings.geojson') as f:
    buildings_fc = json.load(f)

# Index buildings by parent_parcel_code
buildings_by_parcel = {}
building_id_counter = 0

for feat in buildings_fc['features']:
    props = feat['properties']
    pcode = props.get('parent_parcel_code')
    if not pcode:
        continue  # skip buildings not matched to a parcel

    geom = feat['geometry']
    if geom['type'] == 'Polygon':
        ring = geom['coordinates'][0]
    elif geom['type'] == 'MultiPolygon':
        ring = max(geom['coordinates'], key=lambda p: len(p[0]))[0]
    else:
        continue

    if len(ring) < 4:
        continue

    # Simplify
    try:
        poly = Polygon(ring)
        simplified = poly.simplify(0.00003, preserve_topology=False)
        if not simplified.is_empty and len(simplified.exterior.coords) >= 4:
            ring = list(simplified.exterior.coords)
        centroid = [poly.centroid.x, poly.centroid.y]
    except Exception:
        centroid = [sum(c[0] for c in ring) / len(ring),
                    sum(c[1] for c in ring) / len(ring)]

    ring = [[round(c[0], 5), round(c[1], 5)] for c in ring]
    centroid = [round(centroid[0], 5), round(centroid[1], 5)]

    b = {
        'id': building_id_counter,
        'c': ring,
        'ce': centroid,
        'h': round(props.get('height_m') or 0, 1),
        'f': props.get('floors', 0),
        'n': props.get('name'),
        't': props.get('building'),
    }
    building_id_counter += 1

    if pcode not in buildings_by_parcel:
        buildings_by_parcel[pcode] = []
    buildings_by_parcel[pcode].append(b)

print(f'Buildings indexed by parcel: {len(buildings_by_parcel)} parcels have buildings')
print(f'Total buildings with parcel: {sum(len(v) for v in buildings_by_parcel.values())}')

# Build the final output: for each colony, list its parcels with building counts
areas = {}
for cid in parcels_by_colony:
    area_parcels = []
    for p in parcels_by_colony[cid]:
        bldgs = buildings_by_parcel.get(p['code'], [])
        area_parcels.append({
            'code': p['code'],
            'c': p['c'],
            'ce': p['ce'],
            'bc': len(bldgs),  # building count
        })
    areas[cid] = {'parcels': area_parcels}

# Also save buildings per parcel (separate file to keep the main file small)
# Only include parcels that have buildings
buildings_output = {code: bldgs for code, bldgs in buildings_by_parcel.items() if bldgs}

# Colony metadata (for the overview map)
colony_meta = [{
    'id': c['id'],
    'name': c['name'],
    'bbox': c['bbox'],
    'center': c['center'],
    'coords': c['coords'],
    'parcelCount': len(areas[c['id']]['parcels']),
    'buildingCount': sum(p['bc'] for p in areas[c['id']]['parcels']),
} for c in colonies]

# Main index file (small — just colony + parcel metadata, no building coords)
index_output = {
    'colonies': colony_meta,
    'areas': areas,
}

index_path = f'{DST}/colony-index.json'
with open(index_path, 'w') as f:
    json.dump(index_output, f, separators=(',', ':'))
index_size = os.path.getsize(index_path) / 1024
print(f'Index: {index_path} ({index_size:.0f} KB)')

# Buildings file (larger — all building coords, indexed by parcel code)
bldg_path = f'{DST}/buildings-by-parcel.json'
with open(bldg_path, 'w') as f:
    json.dump(buildings_output, f, separators=(',', ':'))
bldg_size = os.path.getsize(bldg_path) / 1024 / 1024
print(f'Buildings: {bldg_path} ({bldg_size:.1f} MB)')

# Print colony summary
print('\nColony summary:')
for c in colony_meta:
    print(f"  {c['id']}: {c['name']} — {c['parcelCount']} parcels, {c['buildingCount']} buildings")
