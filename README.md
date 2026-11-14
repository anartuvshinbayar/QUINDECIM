# Quindecim · Is it real?

NASA Space Apps Challenge 2026, "Be An Earth System Trend Detective". Team Quindecim, Ulaanbaatar.

Pick a question, a soum and a range of years. Guess what happened, then see the yearly data,
the trend, and an honest verdict: **real trend**, **possible trend** or **not proven**.
Built for students and teachers in Mongolia, in Mongolian and English.

## Run it

Double-click `index.html` to open it in Chrome, Safari or Firefox. No server and no build step are needed:
the data is packed into `data/data.js`, and the scripts are plain (no modules).

A local server also works (`python3 -m http.server 8765`, then http://localhost:8765), and so does GitHub Pages.

After changing `data/soums.geojson` or `data/data.csv` by hand, run `python3 tools/build_data.py` to rebuild
`data/data.js`. The export scripts do this automatically.

## Files

| Path | What it is |
|---|---|
| `index.html` | Page structure. Every block has an id and a class for styling |
| `css/base.css` | Bare layout only. Colours and fonts are tokens at the top |
| `js/stats.js` | Mann-Kendall, Sen's slope, linear fit, t-test, 95% CI. No DOM, testable in node |
| `js/app.js` | State, rendering, guess step, URL sharing, CSV download |
| `js/map.js` | Soum map drawn as plain SVG from `data/soums.geojson` |
| `js/chart.js` | Yearly chart as plain SVG |
| `js/variables.js` | The five questions: names, units, sources, wording |
| `js/i18n.js` | All text in English and Mongolian, plus the glossary |
| `data/soums.geojson` | Real soum boundaries (FAO GAUL 2025, 337 soums) |
| `data/data.csv` | Real values, one row per soum per year per variable |
| `data/data.js` | The two files above packed into one script; this is what the page loads |
| `tools/build_data.py` | Rebuilds `data/data.js` |
| `data/parts/` | One CSV per variable (merged into `data.csv`) |
| `data/sample/` | Invented test data in the same format |
| `tools/gee_export.py` | Earth Engine export for boundaries, greenness, rain, temperature |
| `tools/power_frost.py` | First autumn frost from the NASA POWER API |
| `tools/check_stats.py` | Checks `js/stats.js` against scipy |
| `tools/make_sample.py` | Rebuilds the sample data |

## Data format

`data/soums.geojson`: one feature per soum, properties `soum_id`, `name_en`, `name_mn`, `aimag`.
`name_mn` is empty for now; the site falls back to English. If the top-level object has `"sample": true`,
the site shows a SAMPLE DATA banner.

`data/data.csv`, long format:

```
soum_id,variable,year,value
129714,ndvi_summer,2001,0.2141
```

| variable | Source | Season | Years | Level |
|---|---|---|---|---|
| `ndvi_summer` | NASA MODIS MOD13A2 NDVI, 1 km | June to August mean | 2001 to 2026 | Soum |
| `rain_summer` | NASA FLDAS Noah, `Rainf_f_tavg` → mm | June to August total | 1982 to 2026 | Regional (model cells ~10 km) |
| `temp_summer` | NASA FLDAS Noah, `Tair_f_tavg` → °C | June to August mean | 1982 to 2026 | Regional |
| `temp_winter` | NASA FLDAS Noah, `Tair_f_tavg` → °C | December to February mean, labelled by the January year | 1983 to 2026 | Regional |
| `first_frost` | NASA POWER daily `T2M_MIN` at the soum centre | First day on or after 1 July below 0 °C, as day of year | 1981 to 2026 | Point (MERRA-2 grid ~50 km) |

## Statistics

Same rules for every series:

- One value per year (the season average or total), so there is no seasonal cycle to remove.
- At least 20 years, otherwise the site says "not enough data".
- **Mann-Kendall** (with tie correction) gives the direction and the p value. The verdict follows it:
  p < 0.05 real, 0.05 to 0.10 possible, otherwise not proven.
- **Sen's slope** gives the rate. Greenness and rain are shown as % of the period average per decade,
  temperature in °C per decade, frost in days per decade.
- **Linear fit** gives a second opinion with a t-test p value and a 95% confidence interval.
  If the two tests disagree, the site says so.

`python tools/check_stats.py` runs 8 test series (including ties and an extreme year) through both
`js/stats.js` and scipy and prints the largest difference. Current result: all match to within 1e-7.

## Rebuild the real data

```bash
pip install earthengine-api
python -c "import ee; ee.Authenticate()"
python tools/gee_export.py --project YOUR_EE_PROJECT
python3 tools/power_frost.py
```

## Known limits

- Straight-line trends only. Years that depend on each other (a dry year after a dry year) make p values look better than they are.
- With 337 soums and five questions, about 1 test in 20 looks "real" by chance alone.
- FLDAS winter temperatures look 3 to 4 °C milder than station records in cold basins, probably because the model misses
  winter cold-air inversions. Trends need checking against station data before quoting absolute winter values.
- A trend is not a cause.

## Use of AI

Code in this repository was written with Claude (Anthropic) under the team's direction. The team chose the questions,
the datasets and the statistical rules, and checks the results.
