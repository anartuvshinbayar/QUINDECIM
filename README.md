# Quindecim

NASA Space Apps Challenge 2026, "Be An Earth System Trend Detective". Team Quindecim, Ulaanbaatar.

Scroll down (about one screen): the logo drops out of the tiles into the middle, and the map tool rises over it.
Pick one of the five questions above the map. The map shows the 22 aimags, coloured by the direction and size of
their trend (filled = real trend, striped = possible, pale = not proven); beside it, the whole country in one
sentence ("In 117 of 333 soums, summer greenness has really risen since 2001."), the count of each verdict and the
largest real changes. Tap an aimag: it zooms in, its soums appear in the same colours, and its result shows. Tap a soum
for its own result:
one plain sentence ("Summer greenness in this soum has risen about 20% since 2001. This is very unlikely to be chance."),
the yearly data, the trend, and an honest verdict (**real trend**, **possible trend** or **not proven**).
The small arrow goes back to all aimags. **Share as image** makes a picture of the result (a soum's or aimag's chart,
or the country's map) in the language chosen on the site, for Facebook and Messenger.
The site opens in English; MN in the header switches to Mongolian, and a shared link keeps the choice (`lang=mn`).
Built for students and teachers in Mongolia, in Mongolian and English. Open source under the MIT License (`LICENSE`, linked in the footer).

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
| `index.html` | The page: hero (fits one screen), scroll room for the logo's trip, map tool, Glossary. Meta tags and structured data (JSON-LD) in the head |
| `404.html` | Custom not-found page (GitHub Pages serves it automatically) |
| `css/site.css` | All styles, from nyd's design. Palette and font are tokens at the top |
| `js/motion.js` | Animation, in the style of loopsii.com: a one-second loader that never waits for the data, tile grow-in wave and reshuffle, the logo's short scroll trip (straight down, grows; the tool rises over it at twice the scroll speed; the scroll is caught where the tool rests, so a flick never carries past its settings), rotating headline with colour fades, pill header, scroll reveals. Respects reduced motion |
| `js/stats.js` | Mann-Kendall with the Hamed & Rao correction, Sen's slope, linear fit with effective sample size, t-test, 95% CI and band, Benjamini-Hochberg false discovery rate. No DOM, testable in node |
| `js/app.js` | State and flow (country, aimag, soum), nationwide check, map shades, country summary, plain-language sentence, question tabs, result panel, breadcrumb, URL sharing, CSV downloads (one place, or every soum), no-shift language switch |
| `js/map.js` | Two-level SVG map: aimags shaded by their trend, smooth zoom into one aimag and its soums, stripes for possible trends, label placement |
| `js/share.js` | Share as image: draws a 1080 x 1350 card (the place's sentence, verdict and chart, or the country's map and key) on a canvas, in the site's language |
| `js/chart.js` | Yearly chart as plain SVG with the 95% confidence band |
| `js/variables.js` | The five questions: names, units, sources, wording |
| `js/i18n.js` | All text in Mongolian and English, plus the glossary |
| `assets/brand/`, `assets/tiles/` | The Quindecim logo (mark and header lockup, traced to SVG from the new logo) and nyd's ornament tiles (originals in `design/nyd/`) |
| `favicon.svg`, `favicon.ico` | Site icon |
| `assets/brand/quindecim-og.png` | Social preview image (1200 x 630), made by `tools/og_card.html` |
| `robots.txt`, `llms.txt` | Crawler rules and a plain-text summary for AI assistants |
| `data/soums.geojson` | Real soum boundaries (FAO GAUL 2025, 337 soums) |
| `data/aimags.geojson` | Aimag outlines (FAO GAUL 2025 level 1, 21 aimags and Ulaanbaatar) |
| `data/data.csv` | Real values, one row per soum per year per variable |
| `data/data.js` | Compact copy of the files above (0.8 MB, about 250 KB compressed); this is what the page loads, in parallel with the page so it never holds it up |
| `data/grassland.csv` | Land and grassland area per soum (km²), from the mask the greenness values use |
| `data/parts/` | One CSV per variable (merged into `data.csv`) |
| `data/sample/` | Invented test data in the same format |
| `tools/build_data.py` | Rebuilds `data/data.js` |
| `tools/bump_version.py` | New `?v=` number on CSS and JS links, so updates are never hidden by the browser cache |
| `tools/gee_export.py` | Earth Engine export for soum and aimag boundaries, greenness, rain, temperature |
| `tools/power_frost.py` | First autumn frost from the NASA POWER API |
| `tools/check_stats.py` | Checks `js/stats.js` against scipy, an independent Python version and (if installed) pymannkendall |
| `tools/og_card.html` | The social preview card; the command to render it is at the top of the file |
| `tools/make_sample.py` | Rebuilds the sample data |
| `design/nyd/` | nyd's brand files and mockups |

## Data format

`data/soums.geojson`: one feature per soum, properties `soum_id`, `name_en`, `name_mn`, `aimag`.
`name_mn` holds the Cyrillic names (`tools/soum_names_mn.py`, list in `data/soum_names_mn.csv`); where it is empty the site falls back to English. If the top-level object has `"sample": true`,
the site shows a SAMPLE DATA banner.

`data/data.csv`, long format:

```
soum_id,variable,year,value
129714,ndvi_summer,2001,0.2141
```

| variable | Source | Season | Years | Level |
|---|---|---|---|---|
| `ndvi_summer` | NASA MODIS MOD13A2 NDVI, 1 km, grassland only (see below) | June to August mean | 2001 to 2026 | Soum |
| `rain_summer` | NASA FLDAS Noah, `Rainf_f_tavg` → mm | June to August total | 1982 to 2026 | Regional (model cells ~10 km) |
| `temp_summer` | NASA FLDAS Noah, `Tair_f_tavg` → °C | June to August mean | 1982 to 2026 | Regional |
| `temp_winter` | NASA FLDAS Noah, `Tair_f_tavg` → °C | December to February mean, labelled by the January year | 1983 to 2026 | Regional |
| `first_frost` | NASA POWER daily `T2M_MIN` at the soum centre | First day on or after 1 July below 0 °C, as day of year | 1981 to 2026 | Point (MERRA-2 grid ~50 km) |

Only complete seasons are exported. The newest year, 2026, is the full June to August 2026 for the summer questions,
December 2025 to February 2026 for winter, and for first frost a year counts only once its frost has come
(the export scripts check that the source covers the whole season first).

**Greenness is measured on grassland only.** A whole-soum average mixes in desert, water, forest, fields and towns.
`tools/gee_export.py` keeps the 1 km NDVI pixels that MODIS land cover (MCD12Q1, IGBP class 10 "Grasslands") calls
grassland in most years since 2001, over at least half of the pixel, and uses the same pixels for every year, so a
trend can never come from a change in which land is measured. Composites flagged as snow or cloud (SummaryQA 2, 3)
are dropped. Soums with less than 10 km² of grassland get no greenness value (Bayangol in Ulaanbaatar, and Noyon,
Khanbogd and Shinejinst in the Gobi); the site says why, and shows every other soum's grassland share.

## Statistics

An aimag's result uses the average of its soums for each year (years where at least half the soums have a value).

Same rules for every series:

- One value per year (the season average or total), so there is no seasonal cycle to remove.
- At least 20 years, otherwise the site says "not enough data".
- **Mann-Kendall** (with tie correction) gives the direction and the p value, with the **Hamed & Rao (1998)**
  correction for year-to-year correlation: a dry year is often followed by another, and such runs make the plain
  test find too many trends. Sen's trend is removed, the significant autocorrelations of the ranks widen the variance
  of S. The correction is only ever used to make the test stricter (a factor below 1 keeps the plain test).
- **Nationwide check.** With 337 soums, about 17 would pass p < 0.05 by pure chance. Every soum (and every aimag)
  also gets a **Benjamini-Hochberg false discovery rate** q value among all soums (or all aimags) for the same
  question and years. Verdict: **real** if q < 0.05, **possible** if p < 0.10 but not real, otherwise **not proven**.
  The map and the result panel use the same verdicts.
- **Map shades.** Each aimag's or soum's change along the trend line over the chosen years (the same number as its
  plain sentence) falls in one of three steps per direction, set per question in `js/variables.js` (`steps`: greenness 15%
  and 30%, rain 20% and 30%, summer temperature 1 and 2 °C, winter 0.5 and 1 °C, first frost 7 and 14 days).
  Real trends are filled with their shade, possible ones striped with it, not proven ones pale: a big change that
  could be chance is never shown as a strong colour.
- **Sen's slope** gives the rate. Greenness and rain are shown as % of the period average per decade,
  temperature in °C per decade, frost in days per decade.
- **Linear fit** gives a second opinion with a t-test p value and a 95% confidence interval, using the
  effective sample size n(1 - r1)/(1 + r1) from the residuals' lag-1 autocorrelation (Santer et al. 2000; only a
  positive r1 counts). If the two tests disagree, the site says so.
- **In plain words.** Every result starts with one sentence: the change along Sen's trend line from the first year to
  the last (percent of the line's first-year value for greenness and rain, °C for temperature, days for frost), and
  whether it could be chance, worded from the verdict.

`python tools/check_stats.py` runs 15 test series (ties, an extreme year, strongly correlated years, alternating
years, a gap in the years) through `js/stats.js` and independent Python code (scipy for the distributions and the
false discovery rate, pymannkendall's Hamed-Rao test if it is installed) and prints the largest difference.
Current result: all match to within 1e-7.

## Rebuild the real data

```bash
pip install earthengine-api
python -c "import ee; ee.Authenticate()"
python tools/gee_export.py --project YOUR_EE_PROJECT
python3 tools/power_frost.py
```

## Known limits

- Straight-line trends only.
- The year-to-year correlation corrections and the false discovery rate make the verdicts stricter, not perfect.
  Neighbouring soums share weather (and FLDAS and POWER cells), so their results are not independent.
- FLDAS winter temperatures look 3 to 4 °C milder than station records in cold basins, probably because the model misses
  winter cold-air inversions. Trends need checking against station data before quoting absolute winter values.
- A trend is not a cause.

## Before hosting

| Check | Status |
|---|---|
| Vite / React leftovers | None: plain HTML, CSS and JS |
| Meta description, Open Graph tags | Done in `index.html` and `404.html`; `og:image` is `assets/brand/quindecim-og.png`, URL https://quindecim-theta.vercel.app/ |
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

Still open: a `Sitemap:` line in `robots.txt`, and a check of the Mongolian text and soum names by a native speaker.
