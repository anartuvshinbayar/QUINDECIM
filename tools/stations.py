"""Seasonal temperatures at Mongolian weather stations, to check the NASA FLDAS land model against.

Usage: python3 tools/stations.py      (then node tools/static_pages.js)

Downloads daily temperatures for ten stations across the country from NOAA's Global Historical Climatology Network
(GHCN-Daily, https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily) and
writes data/stations.csv: one row per station and year with the summer (June to August) and winter (December to
February, labelled by the January year) mean temperature, the same seasons the site uses. A season counts only when at
least 80 of its days have a value. Each station is matched to the soum it stands in (data/soums.geojson), so
tools/static_pages.js can compare the station with FLDAS for that soum on methods.html.
"""
import csv, datetime, io, json, pathlib, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
STATIONS = [  # GHCN-Daily id, name: west, north, centre, Gobi and east
    ("MG000044212", "Ulaangom"), ("MG000044218", "Khovd"), ("MG000044231", "Mörön"), ("MG000044272", "Uliastai"),
    ("MG000044288", "Arvaikheer"), ("MGM00044292", "Ulaanbaatar (airport)"), ("MG000044341", "Mandalgovi"),
    ("MG000044373", "Dalanzadgad"), ("MGM00044354", "Sainshand"), ("MG000044259", "Choibalsan"),
]
URL = ("https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations={id}"
       "&dataTypes=TAVG,TMAX,TMIN&startDate=1981-12-01&endDate=2026-08-31&format=csv&units=metric&includeStationLocation=1")
MIN_DAYS = 80


def rings(g):
    return g["coordinates"] if g["type"] == "Polygon" else [r for poly in g["coordinates"] for r in poly]


def inside(lon, lat, g):
    hit = False
    for r in rings(g):
        for i in range(len(r)):
            (x1, y1), (x2, y2) = r[i - 1], r[i]
            if (y1 > lat) != (y2 > lat) and lon < x1 + (lat - y1) * (x2 - x1) / (y2 - y1):
                hit = not hit
    return hit


soums = json.loads((ROOT / "data/soums.geojson").read_text())["features"]
rows = []
for sid, name in STATIONS:
    text = urllib.request.urlopen(URL.format(id=sid), timeout=120).read().decode()
    days = list(csv.DictReader(io.StringIO(text)))
    lat, lon = float(days[0]["LATITUDE"]), float(days[0]["LONGITUDE"])
    soum = next(f["properties"] for f in soums if inside(lon, lat, f["geometry"]))
    temp = {}
    for d in days:
        t = d.get("TAVG") or ""
        if not t and d.get("TMAX") and d.get("TMIN"):
            t = (float(d["TMAX"]) + float(d["TMIN"])) / 2
        if t != "":
            temp[d["DATE"]] = float(t)
    for year in range(1982, 2027):
        summer = [v for k, v in temp.items() if k.startswith(str(year)) and k[5:7] in ("06", "07", "08")]
        winter = [v for k, v in temp.items() if (k.startswith(str(year - 1)) and k[5:7] == "12")
                  or (k.startswith(str(year)) and k[5:7] in ("01", "02"))]
        rows.append({"station_id": sid, "station": name, "lat": lat, "lon": lon, "soum_id": soum["soum_id"],
                     "soum": soum["name_en"], "aimag": soum["aimag"], "year": year,
                     "summer_temp": round(sum(summer) / len(summer), 2) if len(summer) >= MIN_DAYS else "",
                     "winter_temp": round(sum(winter) / len(winter), 2) if len(winter) >= MIN_DAYS else "",
                     "summer_days": len(summer), "winter_days": len(winter)})
    print(f"{name:24s} {sid}  in {soum['name_en']}, {soum['aimag']}:",
          sum(1 for r in rows if r["station_id"] == sid and r["summer_temp"] != ""), "summers,",
          sum(1 for r in rows if r["station_id"] == sid and r["winter_temp"] != ""), "winters")

out = ROOT / "data/stations.csv"
with out.open("w", newline="") as f:
    f.write(f"# Seasonal mean temperature (°C) at weather stations, from NOAA GHCN-Daily, downloaded {datetime.date.today()}.\n")
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)
print("wrote", out.relative_to(ROOT), len(rows), "rows")
