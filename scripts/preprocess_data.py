#!/usr/bin/env python3
"""
Pre-process the Bengaluru GeoJSON data into a smaller, optimized format
for the 2D map landing page.

Output: /home/z/my-project/public/data/map-buildings.json

The output contains:
  - aoi: bounding box
  - roads: simplified LineStrings (just coordinates + name)
  - buildings: all 38,882 footprints with key properties, polygons
    simplified to max 8 vertices for performance
  - demoBuildings: subset of named apartment buildings (the clickable
    ones that open the 3D viewer)
"""

import json
import os
from shapely.geometry import Polygon, LineString

SRC = '/home/z/my-project/upload/extracted/3D-ULPIN-Bengaluru/public/data'
DST = '/home/z/my-project/public/data'
os.makedirs(DST, exist_ok=True)


def simplify_polygon(coords, tolerance=0.00005):
    """Simplify a polygon's coordinates using Douglas-Peucker."""
    try:
        if len(coords) < 4:
            return coords
        poly = Polygon(coords)
        simplified = poly.simplify(tolerance, preserve_topology=False)
        if simplified.is_empty or len(simplified.exterior.coords) < 4:
            return coords
        return list(simplified.exterior.coords)
    except Exception:
        return coords


def process():
    # AOI
    with open(f'{SRC}/aoi.geojson') as f:
        aoi = json.load(f)
    aoi_props = aoi['features'][0]['properties']
    aoi_box = {
        'west': aoi_props['west'],
        'south': aoi_props['south'],
        'east': aoi_props['east'],
        'north': aoi_props['north'],
        'center': [(aoi_props['west'] + aoi_props['east']) / 2,
                   (aoi_props['south'] + aoi_props['north']) / 2],
    }
    print(f'AOI: {aoi_box}')

    # Roads — simplify + extract just coords + name + highway type
    with open(f'{SRC}/roads.geojson') as f:
        roads = json.load(f)
    road_list = []
    for feat in roads['features']:
        coords = feat['geometry']['coordinates']
        # Simplify long roads
        if len(coords) > 20:
            try:
                ls = LineString(coords)
                simplified = ls.simplify(0.00005, preserve_topology=False)
                coords = list(simplified.coords)
            except Exception:
                pass
        road_list.append({
            'c': coords,
            'n': feat['properties'].get('name'),
            'h': feat['properties'].get('highway'),
        })
    print(f'Roads: {len(road_list)}')

    # Buildings — extract + simplify polygons
    with open(f'{SRC}/buildings.geojson') as f:
        buildings = json.load(f)
    building_list = []
    demo_list = []
    for i, feat in enumerate(buildings['features']):
        p = feat['properties']
        geom_type = feat['geometry']['type']
        coords_list = feat['geometry']['coordinates']

        # Handle both Polygon and MultiPolygon geometries
        if geom_type == 'Polygon':
            rings = [coords_list[0]]  # outer ring only
        elif geom_type == 'MultiPolygon':
            rings = [poly[0] for poly in coords_list]  # outer ring of each polygon
        else:
            continue  # skip non-polygon geometries

        # Use the largest ring as the primary footprint
        primary_ring = max(rings, key=len) if rings else []
        if not primary_ring or len(primary_ring) < 4:
            continue

        # Simplify polygon (reduces vertices from ~20 to ~6-8)
        simplified = simplify_polygon(primary_ring)

        # Compute centroid
        try:
            poly = Polygon(primary_ring)
            centroid = [poly.centroid.x, poly.centroid.y]
        except Exception:
            centroid = [sum(c[0] for c in primary_ring) / len(primary_ring),
                        sum(c[1] for c in primary_ring) / len(primary_ring)]

        b = {
            'id': i,
            'c': simplified,  # polygon coordinates (simplified, rounded to 5 decimal places)
            'ce': centroid,   # centroid [lng, lat]
            'h': round(p.get('height_m') or 0, 1),
            'f': p.get('floors', 0),
            'n': p.get('name'),
            't': p.get('building'),  # type: apartments, house, etc.
            'pc': p.get('parent_parcel_code'),  # parcel code (ULPIN-like)
        }
        # Round coordinates to 5 decimal places (~1m precision) to reduce file size
        b['c'] = [[round(c[0], 5), round(c[1], 5)] for c in b['c']]
        b['ce'] = [round(centroid[0], 5), round(centroid[1], 5)]

        # Only include buildings that are:
        # - Named (any type), OR
        # - ≥3 floors (tall enough to be visible on the map), OR
        # - Apartment/commercial type
        include = (p.get('name') is not None
                   or p.get('floors', 0) >= 3
                   or p.get('building') in ('apartments', 'commercial', 'retail', 'office', 'hotel', 'school', 'hospital', 'church', 'temple', 'mosque', 'industrial'))

        if not include:
            continue

        building_list.append(b)

        # Demo candidate: named apartment building with ≥5 floors
        if (p.get('building') == 'apartments'
            and p.get('floors', 0) >= 5
            and p.get('name')):
            demo_list.append(b)

    # Sort demo buildings by floors (tallest first)
    demo_list.sort(key=lambda b: b['f'], reverse=True)

    # Write output — two files:
    # 1. demo-buildings.json — just the 57 demo buildings (loads instantly)
    # 2. all-buildings.json — all buildings + roads (lazy-loaded for context)
    demo_output = {
        'aoi': aoi_box,
        'demoBuildings': demo_list,
        'stats': {
            'totalBuildings': len(building_list),
            'demoBuildings': len(demo_list),
            'roads': len(road_list),
        },
    }
    demo_path = f'{DST}/demo-buildings.json'
    with open(demo_path, 'w') as f:
        json.dump(demo_output, f, separators=(',', ':'))
    demo_size = os.path.getsize(demo_path) / 1024
    print(f'Demo output: {demo_path} ({demo_size:.0f} KB)')

    all_output = {
        'aoi': aoi_box,
        'roads': road_list,
        'buildings': building_list,
    }
    all_path = f'{DST}/all-buildings.json'
    with open(all_path, 'w') as f:
        json.dump(all_output, f, separators=(',', ':'))
    all_size = os.path.getsize(all_path) / 1024 / 1024
    print(f'All output: {all_path} ({all_size:.1f} MB)')
    print(f'Buildings: {len(building_list)}, Demo: {len(demo_list)}, Roads: {len(road_list)}')


if __name__ == '__main__':
    process()
