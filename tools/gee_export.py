"""Export real data for every Mongolian soum from Google Earth Engine.

Writes:
  data/soums.geojson          soum boundaries (FAO GAUL 2025 level 2, simplified)
  data/parts/<variable>.csv   one file per variable: soum_id,variable,year,value
  data/grassland.csv          grassland area per soum (greenness is measured on grassland only)
  data/data.csv               all parts merged (what the site reads)

Only complete seasons are exported: a year is included once the source covers the whole season
(June to August for summer, December to February for winter), so the newest year is never partial.

Usage:
  pip install earthengine-api      (once; then sign in with ee.Authenticate())
  python tools/gee_export.py --project YOUR_EE_PROJECT [--only ndvi_summer,rain_summer]

The data spec (one value per soum, per year, per variable) is in README.md.
"""
import argparse, csv, json, pathlib, warnings
warnings.filterwarnings("ignore")
import ee

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PARTS = DATA / "parts"

GAUL = "FAO/GAUL/2025/level2"
MODIS_NDVI = "MODIS/061/MOD13A2"
MODIS_LC = "MODIS/061/MCD12Q1"
FLDAS = "NASA/FLDAS/NOAH01/C/GL/M/V001"
GRASSLAND = 10           # IGBP land cover class "Grasslands" (LC_Type1)
MIN_GRASS_KM2 = 10       # a soum with less grassland than this gets no greenness value


def soums_fc():
    return ee.FeatureCollection(GAUL).filter(ee.Filter.eq("ISO3_CODE", "MNG"))


def last_full_year(collection_id, last_month):
    """Latest year whose data reaches the end of last_month."""
    end = ee.Date(ee.ImageCollection(collection_id).aggregate_max("system:time_start"))
    y, m = end.get("year").getInfo(), end.get("month").getInfo()
    return y if m >= last_month else y - 1


def export_boundaries():
    fc = soums_fc().map(lambda f: ee.Feature(f.geometry().simplify(1000), {
        "soum_id": ee.Number(f.get("GAUL2_CODE")).format("%d"),
        "name_en": f.get("GAUL2_NAME"),
        "aimag": f.get("GAUL1_NAME"),
    }))
    gj = fc.getInfo()

    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 3), round(c[1], 3)]

    feats = []
    for f in gj["features"]:
        g = f["geometry"]
        if g["type"] == "GeometryCollection":   # keep only polygon parts
            polys = [p for p in g["geometries"] if p["type"] in ("Polygon", "MultiPolygon")]
            coords = []
            for p in polys:
                coords += [p["coordinates"]] if p["type"] == "Polygon" else p["coordinates"]
            g = {"type": "MultiPolygon", "coordinates": coords}
        g["coordinates"] = rnd(g["coordinates"])
        p = f["properties"]
        feats.append({"type": "Feature", "geometry": g, "properties": {
            "soum_id": p["soum_id"], "name_en": p["name_en"], "name_mn": "", "aimag": p["aimag"]}})
    feats.sort(key=lambda f: (f["properties"]["aimag"], f["properties"]["name_en"]))
    out = DATA / "soums.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "source": GAUL, "features": feats}, separators=(",", ":"), ensure_ascii=False))
    print(f"soums.geojson: {len(feats)} soums, {out.stat().st_size / 1e6:.2f} MB")


def export_aimags():
    """Aimag outlines (FAO GAUL 2025 level 1) for the overview map."""
    fc = ee.FeatureCollection("FAO/GAUL/2025/level1").filter(ee.Filter.eq("ISO3_CODE", "MNG")) \
        .map(lambda f: ee.Feature(f.geometry().simplify(1500), {"aimag": f.get("GAUL1_NAME")}))
    gj = fc.getInfo()

    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 3), round(c[1], 3)]

    feats = []
    for f in gj["features"]:
        g = f["geometry"]
        if g["type"] == "GeometryCollection":
            coords = []
            for part in g["geometries"]:
                if part["type"] == "Polygon": coords.append(part["coordinates"])
                elif part["type"] == "MultiPolygon": coords += part["coordinates"]
            g = {"type": "MultiPolygon", "coordinates": coords}
        g["coordinates"] = rnd(g["coordinates"])
        feats.append({"type": "Feature", "geometry": g, "properties": {"aimag": f["properties"]["aimag"]}})
    feats.sort(key=lambda f: f["properties"]["aimag"])
    out = DATA / "aimags.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "source": "FAO/GAUL/2025/level1", "features": feats}, separators=(",", ":"), ensure_ascii=False))
    print(f"aimags.geojson: {len(feats)} aimags, {out.stat().st_size / 1e6:.2f} MB")


def reduce_years(variable, years, image_for_year, scale, crs=None, keep=None):
    """Stack one band per year and reduce over every soum in one call. keep: soum ids to write (default all)."""
    stack = ee.Image.cat([image_for_year(y).rename(f"y{y}") for y in years])
    table = stack.reduceRegions(collection=soums_fc(), reducer=ee.Reducer.mean(), scale=scale, crs=crs, tileScale=4)
    table = table.map(lambda f: ee.Feature(None, f.toDictionary([f"y{y}" for y in years]).set("soum_id", ee.Number(f.get("GAUL2_CODE")).format("%d"))))
    feats = table.getInfo()["features"]
    rows = []
    for f in feats:
        p = f["properties"]
        if keep is not None and p["soum_id"] not in keep:
            continue
        for y in years:
            v = p.get(f"y{y}")
            if v is not None:
                rows.append((p["soum_id"], variable, y, round(v, 4)))
    PARTS.mkdir(parents=True, exist_ok=True)
    with open(PARTS / f"{variable}.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["soum_id", "variable", "year", "value"])
        w.writerows(rows)
    print(f"{variable}: {len(feats)} soums, years {years[0]}-{years[-1]}, {len(rows)} values")


def ndvi_projection():
    """The MODIS sinusoidal 1 km grid (926.6 m pixels) the NDVI product comes in."""
    return ee.ImageCollection(MODIS_NDVI).first().select("NDVI").projection()


def grassland_mask():
    """1 km NDVI pixels that are grassland: MODIS land cover (MCD12Q1, IGBP class 10) in most years 2001 onward,
    covering at least half of the pixel. The same pixels are used for every year, so a trend can never come from a
    change in which land is measured. Desert, water, forest, fields and towns are left out."""
    lc = ee.ImageCollection(MODIS_LC).select("LC_Type1")
    usual = lc.mode().setDefaultProjection(lc.first().projection())      # each 500 m pixel's most common class
    share = usual.eq(GRASSLAND).reduceResolution(ee.Reducer.mean(), maxPixels=64).reproject(ndvi_projection())
    return share.gte(0.5)


def export_grassland():
    """Land and grassland area (km2) per soum, from the same mask the greenness values use."""
    proj = ndvi_projection()
    km2 = ee.Image.pixelArea().divide(1e6)
    stack = ee.Image.cat([km2.rename("land"), km2.updateMask(grassland_mask()).rename("grass")])
    table = stack.reduceRegions(collection=soums_fc(), reducer=ee.Reducer.sum(), crs=proj, scale=proj.nominalScale().getInfo(), tileScale=4)
    table = table.map(lambda f: ee.Feature(None, {"soum_id": ee.Number(f.get("GAUL2_CODE")).format("%d"),
                                                  "land": f.get("land"), "grass": f.get("grass")}))
    rows = sorted((p["soum_id"], round(p["land"] or 0, 1), round(p["grass"] or 0, 1))
                  for p in (f["properties"] for f in table.getInfo()["features"]))
    with open(DATA / "grassland.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["soum_id", "land_km2", "grass_km2"])
        w.writerows(rows)
    print(f"grassland.csv: {len(rows)} soums, {sum(1 for r in rows if r[2] < MIN_GRASS_KM2)} with less than {MIN_GRASS_KM2} km2 of grassland")
    return {r[0] for r in rows if r[2] >= MIN_GRASS_KM2}


def ndvi_summer():
    """June to August mean NDVI over each soum's grassland only (see grassland_mask). Composites flagged as snow or
    cloud (SummaryQA 2 or 3) are dropped first."""
    col = ee.ImageCollection(MODIS_NDVI)
    last = last_full_year(MODIS_NDVI, 9)
    grass = grassland_mask()
    keep = export_grassland()
    def clear(i):
        return i.select("NDVI").updateMask(i.select("SummaryQA").lte(1))
    def img(y):
        return col.filterDate(f"{y}-06-01", f"{y}-09-01").map(clear).mean().multiply(0.0001).updateMask(grass)
    # 1 km product: real soum-level values.
    proj = ndvi_projection()
    reduce_years("ndvi_summer", list(range(2001, last + 1)), img, proj.nominalScale().getInfo(), crs=proj, keep=keep)


def fldas(band):
    return ee.ImageCollection(FLDAS).select(band)


def month(band, y, m):
    return fldas(band).filterDate(ee.Date.fromYMD(y, m, 1), ee.Date.fromYMD(y, m, 1).advance(1, "month")).first()


def rain_summer():
    last = last_full_year(FLDAS, 8)
    secs = {6: 30 * 86400, 7: 31 * 86400, 8: 31 * 86400}
    def img(y):   # kg/m2/s -> mm per month, summed over June to August
        return ee.Image.cat([month("Rainf_f_tavg", y, m).multiply(s) for m, s in secs.items()]).reduce(ee.Reducer.sum())
    reduce_years("rain_summer", list(range(1982, last + 1)), img, 1000)


def temp_summer():
    last = last_full_year(FLDAS, 8)
    def img(y):
        return ee.Image.cat([month("Tair_f_tavg", y, m) for m in (6, 7, 8)]).reduce(ee.Reducer.mean()).subtract(273.15)
    reduce_years("temp_summer", list(range(1982, last + 1)), img, 1000)


def temp_winter():
    last = last_full_year(FLDAS, 2)
    def img(y):   # December of y-1 plus January and February of y, labelled y
        return ee.Image.cat([month("Tair_f_tavg", y - 1, 12), month("Tair_f_tavg", y, 1), month("Tair_f_tavg", y, 2)]) \
            .reduce(ee.Reducer.mean()).subtract(273.15)
    reduce_years("temp_winter", list(range(1983, last + 1)), img, 1000)


def merge():
    rows = []
    for part in sorted(PARTS.glob("*.csv")):
        with open(part) as fh:
            rows += list(csv.reader(fh))[1:]
    with open(DATA / "data.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["soum_id", "variable", "year", "value"])
        w.writerows(rows)
    print(f"data.csv: {len(rows)} rows from {len(list(PARTS.glob('*.csv')))} variables")
    from build_data import build
    build(DATA)


TASKS = {"boundaries": export_boundaries, "aimags": export_aimags, "ndvi_summer": ndvi_summer, "rain_summer": rain_summer,
         "temp_summer": temp_summer, "temp_winter": temp_winter}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--only", default=",".join(TASKS))
    a = ap.parse_args()
    ee.Initialize(project=a.project)
    for name in a.only.split(","):
        TASKS[name]()
    merge()
