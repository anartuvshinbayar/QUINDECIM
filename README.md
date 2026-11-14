# Quindecim

NASA Space Apps Challenge 2026, "Be An Earth System Trend Detective". Team Quindecim, Ulaanbaatar.

Scroll down: the logo drops straight down out of the tiles, grows and dissolves, and the map tool rises in. Pick one of the five questions above the map, then tap an aimag. The aimag zooms in, its soums appear, and the result slides in:
the yearly data, the trend, and an honest verdict (**real trend**, **possible trend** or **not proven**).
Tap any soum for its own result; the small arrow goes back to all aimags.
Built for students and teachers in Mongolia, in Mongolian and English.

## Run it

Double-click `index.html` to open it in Chrome, Safari or Firefox. No server and no build step are needed:
the data is packed into `data/data.js`, and the scripts are plain (no modules).

A local server also works (`python3 -m http.server 8765`, then http://localhost:8765), and so does GitHub Pages.

After changing `data/soums.geojson` or `data/data.csv` by hand, run `python3 tools/build_data.py` to rebuild
`data/data.js`. The export scripts do this automatically.

Before each deploy, run `python3 tools/bump_version.py`. It gives the CSS and JS links a new `?v=` number so
visitors' browsers load the new files instead of an old cached copy.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page: hero (fits one screen), scroll room for the logo's trip, map tool, Words. Meta tags and structured data (JSON-LD) in the head |
| `404.html` | Custom not-found page (GitHub Pages serves it automatically) |
| `css/site.css` | All styles, from nyd's design. Palette and font are tokens at the top |
| `js/motion.js` | Animation, in the style of loopsii.com: loader, tile grow-in wave and reshuffle, the logo's scroll trip (straight down, grows, dissolves, the tool rises in), rotating headline with colour fades, pill header, scroll reveals. Respects reduced motion |
| `js/stats.js` | Mann-Kendall, Sen's slope, linear fit, t-test, 95% CI and band. No DOM, testable in node |
| `js/app.js` | State and flow (question, aimag, soum), question tabs, result panel, breadcrumb, URL sharing, CSV download, no-shift language switch |
| `js/map.js` | Two-level SVG map: aimag overview, smooth zoom into one aimag and its soums, label placement |
| `js/chart.js` | Yearly chart as plain SVG with the 95% confidence band |
| `js/variables.js` | The five questions: names, units, sources, wording |
| `js/i18n.js` | All text in Mongolian and English, plus the glossary |
| `assets/brand/`, `assets/tiles/` | The Quindecim logo (mark and header lockup, traced to SVG from the new logo) and nyd's ornament tiles (originals in `design/nyd/`) |
| `favicon.svg`, `favicon.ico` | Site icon |
| `robots.txt`, `llms.txt` | Crawler rules and a plain-text summary for AI assistants |
| `data/soums.geojson` | Real soum boundaries (FAO GAUL 2025, 337 soums) |
| `data/aimags.geojson` | Aimag outlines (FAO GAUL 2025 level 1, 21 aimags and Ulaanbaatar) |
| `data/data.csv` | Real values, one row per soum per year per variable |
| `data/data.js` | Compact copy of the two files above (0.8 MB, about 250 KB compressed); this is what the page loads |
| `data/parts/` | One CSV per variable (merged into `data.csv`) |
| `data/sample/` | Invented test data in the same format |
| `tools/build_data.py` | Rebuilds `data/data.js` |
| `tools/bump_version.py` | New `?v=` number on CSS and JS links, so updates are never hidden by the browser cache |
| `tools/gee_export.py` | Earth Engine export for soum and aimag boundaries, greenness, rain, temperature |
| `tools/power_frost.py` | First autumn frost from the NASA POWER API |
| `tools/check_stats.py` | Checks `js/stats.js` against scipy |
| `tools/make_sample.py` | Rebuilds the sample data |
| `design/nyd/` | nyd's brand files and mockups |

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

An aimag's result uses the average of its soums for each year (years where at least half the soums have a value).

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

## Before hosting

| Check | Status |
|---|---|
| Vite / React leftovers | None: plain HTML, CSS and JS |
| Meta description, Open Graph tags | Done in `index.html` and `404.html` |
| Custom 404 page | `404.html` |
| Breadcrumbs | Result panel (Mongolia › aimag › soum, the first two clickable) and the 404 page |
| Alt text on images | All images have `alt`; decorative tiles use an empty `alt` |
| Page source | Semantic sections, `lang` follows the language switch, one `h1` |
| Console errors | None (checked in Chrome at 1440 px, 390 px and opened as a file) |
| Structured data | JSON-LD `WebApplication` and `Dataset` |
| Production source maps | None: nothing is bundled |
| `robots.txt`, `llms.txt` | Done. Add a `Sitemap:` line once the public URL is known |
| Placeholder text | None in the site. `design/nyd/` mockups still contain nyd's `[placeholder]` marks |
| Favicon | `favicon.svg` and `favicon.ico` |
| Large JS | Data file cut from 2.55 MB to 0.83 MB (with aimag outlines); no libraries |

Still open: `og:image` and `og:url` need the final public URL, and Mongolian soum names (`name_mn`) are empty.
