"""Make SAMPLE data in the agreed format, so the site runs before the real export exists.

Writes data/soums.geojson (grid cells inside a rough outline of Mongolia, NOT real soums)
and data/data.csv (invented values). The GeoJSON carries "sample": true, which makes the
site show a SAMPLE DATA banner. Real files from Earth Engine do not have that flag.

Usage: python3 tools/make_sample.py   (standard library only)
"""
import csv, json, math, pathlib, random

ROOT = pathlib.Path(__file__).resolve().parent.parent
random.seed(7)

# Rough outline of Mongolia (lon, lat), from memory. Only used to place sample cells.
OUTLINE = [(87.8, 49.2), (89.5, 49.9), (91.0, 50.4), (92.4, 50.8), (94.5, 50.0), (97.3, 49.8),
           (98.2, 50.4), (97.9, 51.0), (98.7, 52.1), (100.0, 51.7), (102.1, 51.3), (102.3, 50.5),
           (103.7, 50.1), (105.9, 50.4), (107.0, 50.0), (108.0, 49.6), (110.7, 49.1), (112.9, 49.5),
           (114.4, 50.2), (116.7, 49.85), (115.5, 48.1), (117.5, 47.7), (118.5, 47.9), (119.7, 47.2),
           (119.9, 46.7), (117.4, 46.6), (116.0, 45.7), (113.6, 44.8), (111.9, 45.1), (111.3, 44.4),
           (111.8, 43.7), (110.4, 42.8), (107.5, 42.4), (105.0, 41.6), (100.8, 42.6), (96.4, 42.7),
           (95.3, 44.2), (93.5, 45.0), (90.9, 45.3), (90.6, 46.3), (91.0, 47.0), (90.3, 47.7),
           (88.9, 48.1)]

def inside(lon, lat):
    hit = False
    for (x1, y1), (x2, y2) in zip(OUTLINE, OUTLINE[1:] + OUTLINE[:1]):
        if (y1 > lat) != (y2 > lat) and lon < x1 + (lat - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit

DLON, DLAT = 1.0, 0.65
cells = []
lat = 41.6
while lat < 52.2:
    lon = 87.8
    while lon < 120.0:
        if inside(lon + DLON / 2, lat + DLAT / 2):
            cells.append((lon, lat))
        lon += DLON
    lat += DLAT

AIMAGS = "ABCDEFGHJKLMNPRSTUVWXY"
features = []
for i, (lon, lat) in enumerate(cells, 1):
    aimag = AIMAGS[min(int((lon - 87.8) / 1.5), len(AIMAGS) - 1)]
    features.append({
        "type": "Feature",
        "properties": {"soum_id": str(10000 + i), "name_en": f"Sample soum {i:03d}",
                       "name_mn": f"Жишээ сум {i:03d}", "aimag": f"Sample aimag {aimag}"},
        "geometry": {"type": "Polygon", "coordinates": [[
            [round(lon, 3), round(lat, 3)], [round(lon + DLON, 3), round(lat, 3)],
            [round(lon + DLON, 3), round(lat + DLAT, 3)], [round(lon, 3), round(lat + DLAT, 3)],
            [round(lon, 3), round(lat, 3)]]]},
    })

OUT = ROOT / "data" / "sample"   # real data lives in data/; to test with sample data, copy these two files there
OUT.mkdir(parents=True, exist_ok=True)
with open(OUT / "soums.geojson", "w") as f:
    json.dump({"type": "FeatureCollection", "sample": True, "features": features}, f, separators=(",", ":"))

DZUD = {2000, 2001, 2002, 2010, 2024}   # winters to make harsher in the sample
rows = []
for i, (lon, lat) in enumerate(cells, 1):
    sid = str(10000 + i)
    north = (lat - 41.6) / 10.5          # 0 in the south Gobi, 1 in the north
    east = (lon - 87.8) / 32
    # Each sample soum gets its own invented trend, so the map shows a mix of verdicts.
    k = random.gauss(0, 1)
    for y in range(2001, 2026):
        base = 0.08 + 0.5 * north ** 1.3 + 0.08 * east
        v = base * (1 + 0.012 * k * (y - 2013)) + random.gauss(0, 0.03 + 0.04 * north)
        rows.append((sid, "ndvi_summer", y, round(max(v, 0.03), 4)))
    for y in range(1982, 2026):
        rain = (60 + 260 * north) * (1 + 0.004 * k * (y - 2003)) * random.lognormvariate(0, 0.25)
        rows.append((sid, "rain_summer", y, round(rain, 1)))
        ts = 24 - 9 * north + 0.03 * (y - 2003) + 0.01 * k * (y - 2003) + random.gauss(0, 0.8)
        rows.append((sid, "temp_summer", y, round(ts, 2)))
        tw = -12 - 14 * north + 0.02 * (y - 2003) + random.gauss(0, 2.2) - (3 if y in DZUD else 0)
        rows.append((sid, "temp_winter", y, round(tw, 2)))
    for y in range(1981, 2026):
        ff = 255 - 25 * north + 0.15 * (y - 2003) + random.gauss(0, 7)
        rows.append((sid, "first_frost", y, int(round(ff))))

with open(OUT / "data.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["soum_id", "variable", "year", "value"])
    w.writerows(rows)

print(f"{len(features)} sample soums, {len(rows)} rows")
from build_data import build
build(OUT)
