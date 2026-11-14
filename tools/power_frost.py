"""First autumn frost per soum from the NASA POWER daily API (no account needed).

For each soum centre: daily minimum air temperature at 2 m (T2M_MIN), and for every year the
first day on or after 1 July with a minimum below 0 C, stored as day of year.
POWER's daily temperature comes from the MERRA-2 model on a roughly 0.5 x 0.625 degree grid,
so this is a point estimate that nearby soums share.

Writes data/parts/first_frost.csv, then re-merges data/data.csv.
Usage: python3 tools/power_frost.py   (standard library only)
"""
import csv, datetime as dt, json, pathlib, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
START, END = 1981, dt.date.today().year
URL = ("https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MIN&community=AG"
       "&longitude={lon:.4f}&latitude={lat:.4f}&start={start}0101&end={end}1231&format=JSON")


def centroid(geom):
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    a_sum = cx = cy = 0.0
    for poly in polys:
        ring = poly[0]
        for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
            c = x1 * y2 - x2 * y1
            a_sum += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c
    if abs(a_sum) < 1e-12:
        xs = [p[0] for poly in polys for p in poly[0]]; ys = [p[1] for poly in polys for p in poly[0]]
        return sum(xs) / len(xs), sum(ys) / len(ys)
    return cx / (3 * a_sum), cy / (3 * a_sum)


def fetch(lon, lat):
    for attempt in range(5):
        try:
            with urllib.request.urlopen(URL.format(lon=lon, lat=lat, start=START, end=END), timeout=120) as r:
                return json.load(r)["properties"]["parameter"]["T2M_MIN"]
        except Exception:
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"POWER failed at {lon},{lat}")


def first_frost(daily):
    out, last_day = {}, max(k for k, v in daily.items() if v > -900)
    for y in range(START, END + 1):
        for k in sorted(k for k in daily if k.startswith(str(y)) and k[4:] >= "0701"):
            v = daily[k]
            if -900 < v < 0:
                out[y] = dt.date(y, int(k[4:6]), int(k[6:])).timetuple().tm_yday
                break
        # A year with no frost yet only counts if the record already reaches the end of that year.
        if y not in out and last_day < f"{y}1231":
            continue
    return out


def main():
    feats = json.load(open(DATA / "soums.geojson"))["features"]
    pts = [(f["properties"]["soum_id"], *centroid(f["geometry"])) for f in feats]
    cache = {}   # soums in the same POWER grid cell share one download

    def job(p):
        sid, lon, lat = p
        key = (round(lat * 2) / 2, round(lon / 0.625) * 0.625)
        if key not in cache:
            cache[key] = first_frost(fetch(lon, lat))
        return sid, cache[key]

    rows = []
    with ThreadPoolExecutor(4) as ex:
        for i, (sid, ff) in enumerate(ex.map(job, pts), 1):
            rows += [(sid, "first_frost", y, d) for y, d in sorted(ff.items())]
            if i % 25 == 0:
                print(f"{i}/{len(pts)} soums", flush=True)
    (DATA / "parts").mkdir(parents=True, exist_ok=True)
    with open(DATA / "parts" / "first_frost.csv", "w", newline="") as fh:
        w = csv.writer(fh); w.writerow(["soum_id", "variable", "year", "value"]); w.writerows(rows)
    print(f"first_frost: {len(pts)} soums, {len(rows)} values")

    merged = []
    for part in sorted((DATA / "parts").glob("*.csv")):
        merged += list(csv.reader(open(part)))[1:]
    with open(DATA / "data.csv", "w", newline="") as fh:
        w = csv.writer(fh); w.writerow(["soum_id", "variable", "year", "value"]); w.writerows(merged)
    print(f"data.csv: {len(merged)} rows")
    from build_data import build
    build(DATA)


if __name__ == "__main__":
    main()
