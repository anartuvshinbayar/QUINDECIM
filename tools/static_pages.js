// Write everything a reader without JavaScript needs (search engines, AI assistants, screen readers, slow phones),
// computed with the site's own code (js/stats.js, js/data.js), so it always matches the interactive tool.
//
// Usage: node tools/static_pages.js      (tools/bump_version.py runs it before every deploy)
//
// Writes:
//   data/results.csv   the trend test result for every soum, aimag and question (full record), with its plain sentence
//   index.html         English text into every empty data-i18n element, and the summary in <section id="about">
//   methods.html       the tables between the "static:" markers (questions, findings, weather stations, in brief)
//   llms.txt           a plain-text summary for AI assistants
//   sitemap.xml        the two pages
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => { fs.writeFileSync(path.join(ROOT, f), s); console.log('wrote', f); };
globalThis.window = globalThis;
for (const f of ['js/stats.js', 'js/variables.js', 'js/i18n.js', 'js/data.js', 'data/data.js']) eval(read(f));
const { analyze, fdr, verdictLevel } = Q.stats, { VARIABLES } = Q.variables, { STRINGS, GLOSSARY } = Q.i18n;
const EN = STRINGS.en, SITE = 'https://quindecim-theta.vercel.app/';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const between = (text, name, inner) => {
  const re = new RegExp(`(<!-- static:${name}:start -->)[\\s\\S]*?(<!-- static:${name}:end -->)`);
  if (!re.test(text)) throw new Error(`marker static:${name} not found`);
  return text.replace(re, `$1\n${inner}\n$2`);
};
const LINKS = {   // the NASA dataset behind each question
  ndvi_summer: ['MODIS MOD13A2 v061', 'https://lpdaac.usgs.gov/products/mod13a2v061/'],
  rain_summer: ['FLDAS Noah, monthly 0.1°', 'https://disc.gsfc.nasa.gov/datasets/FLDAS_NOAH01_C_GL_M_001/summary'],
  temp_summer: ['FLDAS Noah, monthly 0.1°', 'https://disc.gsfc.nasa.gov/datasets/FLDAS_NOAH01_C_GL_M_001/summary'],
  temp_winter: ['FLDAS Noah, monthly 0.1°', 'https://disc.gsfc.nasa.gov/datasets/FLDAS_NOAH01_C_GL_M_001/summary'],
  first_frost: ['NASA POWER daily, T2M_MIN', 'https://power.larc.nasa.gov/'],
};

// ---------- the same numbers as the site (js/app.js: changeOf, perDecade, plainSentence, verdictKey) ----------
function changeOf(v, r) {
  const total = r.sen.slope * (r.last - r.first);
  if (v.display !== 'percent') return total;
  const start = r.sen.intercept + r.sen.slope * r.first;
  return start > 0 ? total / start * 100 : NaN;
}
const perDecade = (v, r) => (v.display === 'percent' ? r.sen.slope * 10 / r.mean * 100 : r.sen.slope * 10);
const verdictKey = r => (!r.ok ? 'no-data' : r.level === 'not-proven' || r.direction === 'flat' ? 'not-proven' : `${r.level}-${r.direction}`);
function plain(v, r, place) {
  const amount = Math.abs(changeOf(v, r));
  const d = v.id.startsWith('temp') || amount < 1 ? 1 : 0;
  const shown = Number.isFinite(amount) ? amount.toFixed(d) : '';
  const barely = r.direction === 'flat' || !Number.isFinite(amount) || +shown === 0;
  const vars = { place, first: r.first, x: shown, days: EN[shown === '1' ? 'day' : 'days'] };
  const text = v.plain[barely ? 'same' : r.direction].en.replace(/\{(\w+)\}/g, (_, k) => vars[k]).replace(/ /g, ' ');
  return barely ? text : `${text} ${EN[{ real: 'plainReal', possible: 'plainPossible', 'not-proven': 'plainNotProven' }[r.level]]}`;
}
const unitOf = v => (v.display === 'percent' ? '%' : v.unitName ? v.unitName.en : v.unit);

(async () => {
  const D = await Q.data.loadData();
  const today = new Date().toISOString().slice(0, 10);

  // ---------- every area, every question, full record, with the check for chance (as js/app.js nation()) ----------
  const runs = [];
  for (const v of VARIABLES) {
    if (!D.series[v.id]) continue;
    const [lo, hi] = D.yearRange[v.id];
    const test = s => { const p = Q.data.slice(s, lo, hi); return analyze(p.years, p.values); };
    const soums = {}, aimags = {};
    for (const s of D.soums) soums[s.id] = test(D.series[v.id][s.id]);
    for (const a of D.aimags) aimags[a.name] = test(D.aimagSeries(v.id, a.name));
    for (const group of [soums, aimags]) {
      const ok = Object.values(group).filter(r => r.ok), q = fdr(ok.map(r => r.mk.p));
      ok.forEach((r, i) => { r.q = q[i]; r.level = verdictLevel(r.mk.p, r.q); });
    }
    const count = k => Object.values(soums).filter(r => verdictKey(r) === k).length;
    const tested = Object.values(soums).filter(r => r.ok).length;
    const reals = Object.values(soums).filter(r => verdictKey(r).startsWith('real')).map(r => changeOf(v, r)).sort((a, b) => a - b);
    runs.push({ v, lo, hi, soums, aimags, tested, median: reals.length ? reals[Math.floor(reals.length / 2)] : NaN,
      c: { realUp: count('real-up'), realDown: count('real-down'), possible: count('possible-up') + count('possible-down'),
           possibleUp: count('possible-up'), possibleDown: count('possible-down'), notProven: count('not-proven') } });
  }

  // ---------- data/results.csv ----------
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const rows = ['level,id,name_en,name_mn,aimag,question,variable,first_year,last_year,years,change,change_unit,'
    + 'sen_slope_per_decade,rate_unit,mann_kendall_p,fdr_q,verdict,sentence'];
  for (const { v, soums, aimags } of runs) {
    const unit = unitOf(v), rate = v.display === 'percent' ? '% of average per decade' : `${unit} per decade`;
    const line = (level, id, en, mn, aimag, r, place) => rows.push(!r.ok
      ? [level, id, q(en), q(mn), q(aimag), q(v.name.en), v.id, '', '', r.n, '', '', '', '', '', '', 'not enough data', ''].join(',')
      : [level, id, q(en), q(mn), q(aimag), q(v.name.en), v.id, r.first, r.last, r.n, changeOf(v, r).toFixed(2), q(unit),
         perDecade(v, r).toFixed(3), q(rate), r.mk.p.toFixed(4), r.q.toFixed(4), verdictKey(r), q(plain(v, r, place))].join(','));
    for (const s of D.soums) line('soum', s.id, s.name_en, s.name_mn, s.aimag, soums[s.id], s.name_en);
    for (const a of D.aimags) line('aimag', a.name, a.name, Q.variables.AIMAG_MN[a.name] || a.name, a.name, aimags[a.name], `${a.name} aimag`);
  }
  write('data/results.csv', `# Quindecim: trend test result for every soum (and Ulaanbaatar district), aimag and question, over each `
    + `question's full record. Built ${today} by tools/static_pages.js with js/stats.js. Verdict: real if the false discovery `
    + `rate q < 0.05 (Benjamini-Hochberg across all soums, or all aimags), possible if p < 0.10, otherwise not proven. `
    + `p: Mann-Kendall with the Hamed-Rao correction. change: along Sen's trend line, first year to last. Method: ${SITE}methods.html\n`
    + rows.join('\n') + '\n');

  // ---------- weather stations against FLDAS (data/stations.csv, from tools/stations.py) ----------
  let stations = null;
  if (fs.existsSync(path.join(ROOT, 'data/stations.csv'))) {
    const lines = read('data/stations.csv').split('\n').filter(l => l && !l.startsWith('#'));
    const head = lines.shift().split(',');
    const recs = lines.map(l => Object.fromEntries(l.split(',').map((x, i) => [head[i], x])));
    const pearson = (a, b) => { const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
      let num = 0, da = 0, db = 0; a.forEach((x, i) => { num += (x - ma) * (b[i] - mb); da += (x - ma) ** 2; db += (b[i] - mb) ** 2; });
      return num / Math.sqrt(da * db); };
    const compare = (sid, season, variable) => {
      const st = recs.filter(r => r.station_id === sid && r[`${season}_temp`] !== '');
      const model = D.series[variable][st[0].soum_id], at = new Map(model.years.map((y, i) => [y, model.values[i]]));
      const years = st.map(r => +r.year).filter(y => Number.isFinite(at.get(y)));
      const sv = years.map(y => +st.find(r => +r.year === y)[`${season}_temp`]), mv = years.map(y => at.get(y));
      const ts = analyze(years, sv), tm = analyze(years, mv);
      return { n: years.length, first: years[0], last: years[years.length - 1], r: pearson(sv, mv),
        bias: mv.reduce((s, x, i) => s + x - sv[i], 0) / years.length,
        station: { rate: ts.sen.slope * 10, p: ts.mk.p }, model: { rate: tm.sen.slope * 10, p: tm.mk.p } };
    };
    const ids = [...new Set(recs.map(r => r.station_id))];
    stations = ids.map(id => { const r0 = recs.find(r => r.station_id === id);
      return { id, name: r0.station, soum: r0.soum, aimag: r0.aimag, summer: compare(id, 'summer', 'temp_summer'), winter: compare(id, 'winter', 'temp_winter') }; });
  }
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const f1 = x => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(1), f2 = x => x.toFixed(2);
  let stationSummary = '';
  if (stations) {
    const S = stations.map(s => s.summer), W = stations.map(s => s.winter);
    const warmBoth = S.filter(x => x.station.rate > 0 && x.model.rate > 0).length;
    const lessWarm = S.filter(x => x.model.rate < x.station.rate).length;
    const winterClear = W.filter(x => x.station.p < 0.05).length, winterModelClear = W.filter(x => x.model.p < 0.05).length;
    const rng = (a, f) => `${f(Math.min(...a))} to ${f(Math.max(...a))}`;
    stationSummary = `Summer: FLDAS rises and falls with the stations year by year (correlation ${rng(S.map(x => x.r), f2)}, `
      + `median ${f2(med(S.map(x => x.r)))}) and, like them, warms at ${warmBoth} of ${S.length}; but it warms less at ${lessWarm} of `
      + `${S.length} (FLDAS ${rng(S.map(x => x.model.rate), f1)} °C per decade, stations ${rng(S.map(x => x.station.rate), f1)}), `
      + `so the site's summer warming figures are cautious. Winter: FLDAS reads milder than the stations, by up to `
      + `${Math.max(...W.map(x => x.bias)).toFixed(1)} °C in the cold western basins where winter inversions trap cold air `
      + `(median ${f1(med(W.map(x => x.bias)))} °C); FLDAS shows a clear winter trend at ${winterModelClear} of ${W.length} stations and `
      + `the stations themselves at ${winterClear}, which matches the site's "not proven" for winters.`;
  }

  // ---------- shared pieces ----------
  const verdictWord = { real: 'real trend', possible: 'possible trend', 'not-proven': 'not proven' };
  const findingsRows = runs.map(({ v, lo, hi, tested, c }) => ({ v, lo, hi, tested, c,
    text: `${v.name.en}: ${c.realUp} ${v.up.en}, ${c.realDown} ${v.down.en} (real trends of ${tested} areas, ${lo}–${hi}); `
      + `${c.possible} possible, ${c.notProven} not proven.` }));
  const headline = run => {
    const { v, c, tested, lo, median } = run, dir = c.realUp >= c.realDown ? 'up' : 'down', n = dir === 'up' ? c.realUp : c.realDown;
    const s = (n ? v.nation[dir].en : v.nation.none.en).replace(/\{(\w+)\}/g, (_, k) => ({ n, total: tested, first: lo })[k]);
    return Number.isFinite(median) && n && v.id === 'temp_summer' ? s.replace(/\.$/, `, by about ${Math.abs(median).toFixed(1)} °C in a typical one.`) : s;
  };
  const findingsTable = `    <div class="table"><table>
      <thead><tr><th>Question</th><th>Years</th><th class="num">Areas tested</th><th class="num">Real trend</th><th class="num">Possible</th><th class="num">Not proven</th></tr></thead>
      <tbody>
${findingsRows.map(({ v, lo, hi, tested, c }) => `        <tr><td>${esc(v.name.en)}</td><td>${lo}–${hi}</td><td class="num">${tested}</td>`
  + `<td class="num">${c.realUp} ${esc(v.up.en)}, ${c.realDown} ${esc(v.down.en)}</td><td class="num">${c.possible}</td><td class="num">${c.notProven}</td></tr>`).join('\n')}
      </tbody>
    </table></div>`;

  // ---------- methods.html ----------
  let m = read('methods.html');
  m = between(m, 'brief', `      <ul>
${runs.map(r => `        <li>${esc(headline(r))}</li>`).join('\n')}
        <li>Every result comes from a Mann-Kendall test corrected for year-to-year correlation and a check for chance across all 337 areas (false discovery rate), and is said in one plain sentence.</li>
        <li>The statistics match independent Python code to within 0.0000001${stations ? ', and the summer temperature data follow ten weather stations closely' : ''}.</li>
      </ul>`);
  m = between(m, 'questions', `    <div class="table"><table>
      <thead><tr><th>Question</th><th>NASA data</th><th>Season</th><th>Years</th><th>What one value covers</th><th>Data confidence</th></tr></thead>
      <tbody>
${runs.map(({ v, lo, hi }) => `        <tr><td><strong>${esc(v.name.en)}</strong><br><code>${v.id}</code></td><td><a href="${LINKS[v.id][1]}">${esc(LINKS[v.id][0])}</a></td>`
  + `<td>${esc(v.season.en)}</td><td>${lo}–${hi}</td><td>${esc(v.resolution.en)}</td><td>${esc(v.confidence.en[0].toUpperCase() + v.confidence.en.slice(1))}</td></tr>`).join('\n')}
      </tbody>
    </table></div>`);
  m = between(m, 'findings', findingsTable + `
    <p>${runs.map(r => esc(headline(r))).join(' ')}</p>
    <p class="note">Counts are for the 337 soums and districts (333 for greenness: four have too little grassland). Every number here is in <a href="data/results.csv"><code>data/results.csv</code></a>, and the map on the site shows them place by place.</p>`);
  m = between(m, 'stations', !stations ? '    <p>Not yet run: <code>python3 tools/stations.py</code>.</p>' : `    <p>A land model is only as good as its match with what thermometers measure. We compared FLDAS with ten weather stations across Mongolia (NOAA GHCN-Daily), each against the area it stands in, using the same seasons (a season counts when at least 80 of its days have a value).</p>
    <p>${esc(stationSummary)}</p>
    <div class="table"><table>
      <thead><tr><th>Station</th><th>Area</th><th>Years</th><th class="num">Summer correlation</th><th class="num">Summer trend, station</th><th class="num">Summer trend, FLDAS</th><th class="num">Winter correlation</th><th class="num">Winter difference, FLDAS − station</th></tr></thead>
      <tbody>
${stations.map(s => `        <tr><td>${esc(s.name)}</td><td>${esc(s.soum)}, ${esc(s.aimag)}</td><td>${s.summer.first}–${s.summer.last}</td>`
  + `<td class="num">${f2(s.summer.r)}</td><td class="num">${f1(s.summer.station.rate)} °C/decade</td><td class="num">${f1(s.summer.model.rate)} °C/decade</td>`
  + `<td class="num">${f2(s.winter.r)}</td><td class="num">${f1(s.winter.bias)} °C</td></tr>`).join('\n')}
      </tbody>
    </table></div>
    <p class="note">Correlation of the yearly values (1 = they rise and fall together). Trend: Sen's slope over the same years. The station data are in <a href="data/stations.csv"><code>data/stations.csv</code></a> (built by <code>tools/stations.py</code>).</p>`);
  write('methods.html', m);

  // ---------- index.html: English text in the HTML, and the summary for readers without JavaScript ----------
  let h = read('index.html');
  h = h.replace(/(<(\w+)\b[^>]*\bdata-i18n="(\w+)"[^>]*>)([^<]*)(<\/\2>)/g, (all, open, tag, key, inner, close) =>
    (typeof EN[key] === 'string' ? `${open}${esc(EN[key])}${close}` : all));
  h = between(h, 'summary', `      <h2 id="about-title">Quindecim in brief</h2>
      <p>Quindecim is a bilingual (English and Mongolian) web tool that answers one question for each of Mongolia's 337 soums and districts: is the climate really changing there, or is it just a few unusual years? It turns 25 to 45 years of NASA data into five questions and gives every place an honest verdict in one plain sentence. Built by Team Quindecim, Ulaanbaatar, for the NASA Space Apps Challenge 2026, "Be An Earth System Trend Detective".</p>
      <h3>What it found</h3>
      <ul>
${runs.map(r => `        <li>${esc(headline(r))}</li>`).join('\n')}
      </ul>
      <h3>How each verdict is made</h3>
      <ul>
        <li>One value per year per area, complete seasons only, at least 20 years.</li>
        <li>Mann-Kendall trend test with the Hamed and Rao (1998) correction for year-to-year correlation; Sen's slope for the rate; a straight-line fit with an effective sample size (Santer et al. 2000) as a second opinion.</li>
        <li>Benjamini-Hochberg false discovery rate across all areas: a real trend if q &lt; 0.05, possible if p &lt; 0.10, otherwise not proven.</li>
        <li>Statistics checked against SciPy and an independent Python version (agreement within 0.0000001).</li>
${stations ? `        <li>Checked against ten weather stations (NOAA GHCN-Daily). ${esc(stationSummary)}</li>\n` : ''}      </ul>
      <h3>Data</h3>
      <ul>
${runs.map(({ v, lo, hi }) => `        <li>${esc(v.name.en)}: ${esc(LINKS[v.id][0])}, ${esc(v.season.en)}, ${lo}–${hi}. ${esc(v.resolution.en)} Data confidence: ${esc(v.confidence.en)}.</li>`).join('\n')}
        <li>Areas: ${esc(EN.areasNote.replace(/^Areas: /, ''))}</li>
      </ul>
      <h3>Features</h3>
      <ul>
        <li>A map of the 22 aimags shaded by the direction and size of their trend; tap an aimag to see its soums, tap a soum for its chart and tests.</li>
        <li>A summary of the whole country, with the largest real changes.</li>
        <li>Share any result as a link or as an image for Facebook and Messenger; download the numbers as CSV.</li>
        <li>Works on phones and slow connections; the page is usable before the data has arrived.</li>
      </ul>
      <h3>Limits</h3>
      <p>Straight-line trends only. Neighbouring areas share model cells, so their results are not independent. Rainfall from a land model is the least certain question. A trend is not a cause.</p>
      <h3>Read more</h3>
      <ul>
        <li><a href="methods.html">Methods and data</a>: the full method, the findings and the station check.</li>
        <li><a href="data/results.csv">data/results.csv</a>: every area's result for every question, with its plain sentence.</li>
        <li><a href="data/data.csv">data/data.csv</a>: every yearly value.</li>
        <li><a href="llms.txt">llms.txt</a>: this summary as plain text.</li>
      </ul>
      <h3>Glossary</h3>
      <dl>
${GLOSSARY.map(g => `        <dt>${esc(g.en[0])}</dt><dd>${esc(g.en[1])}</dd>`).join('\n')}
      </dl>`);
  write('index.html', h);

  // ---------- llms.txt ----------
  write('llms.txt', `# Quindecim: is the climate in your soum really changing?

> A bilingual (English and Mongolian) web tool that tests whether climate and vegetation are really changing in each of Mongolia's 337 soums and districts, using 25 to 45 years of NASA data. Built by Team Quindecim (Ulaanbaatar) for the NASA Space Apps Challenge 2026, "Be An Earth System Trend Detective". Live: ${SITE}

## What it found (each area's full record, after the check for chance across all areas)

${runs.map(r => `- ${headline(r)}`).join('\n')}

${findingsRows.map(r => `- ${r.text}`).join('\n')}

## How a verdict is made

- One value per year per area (season mean or total), complete seasons only, at least 20 years.
- Mann-Kendall trend test with the Hamed and Rao (1998) correction for year-to-year correlation.
- Benjamini-Hochberg false discovery rate across all areas: real trend if q < 0.05, possible if p < 0.10, otherwise not proven.
- Sen's slope for the rate; a straight-line fit with an effective sample size (Santer et al. 2000) as a second opinion.
- Every result is also given as one plain sentence, for example: "Summers in this soum have warmed about 1.8 °C since 1982. This is very unlikely to be chance."
- The statistics agree with SciPy and an independent Python version to within 0.0000001.
${stations ? `- Checked against ten weather stations (NOAA GHCN-Daily). ${stationSummary}\n` : ''}
## Data

${runs.map(({ v, lo, hi }) => `- ${v.name.en} (\`${v.id}\`): ${LINKS[v.id][0]} (${LINKS[v.id][1]}), ${v.season.en}, ${lo}-${hi}. ${v.resolution.en} Data confidence: ${v.confidence.en}.`).join('\n')}
- Areas: ${EN.areasNote.replace(/^Areas: /, '')}

## Look up any place

- [Every result as CSV](${SITE}data/results.csv): one row per area (soum, district or aimag) and question, with the change, p, q, verdict and the plain sentence.
- [Every yearly value as CSV](${SITE}data/data.csv): soum_id, variable, year, value.
- [Weather station check](${SITE}data/stations.csv)
- [Methods and data](${SITE}methods.html): the full method, findings and limits, readable without JavaScript.
- A link to one place: ${SITE}#v=temp_summer&s=129615 (question \`v\`, soum id \`s\` from results.csv; \`lang=mn\` for Mongolian).

## Limits

Straight-line trends only. Neighbouring areas share model cells (FLDAS about 11 x 8 km, POWER about 55 x 47 km), so their results are not independent. Rainfall from a land model is the least certain question. Winter model temperatures differ from stations in cold basins. A trend is not a cause.
`);

  // ---------- sitemap.xml ----------
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}</loc><lastmod>${today}</lastmod></url>
  <url><loc>${SITE}methods.html</loc><lastmod>${today}</lastmod></url>
</urlset>
`);
  if (stations) for (const s of stations) console.log(s.name.padEnd(22), 'summer r', f2(s.summer.r), 'rates', f1(s.summer.station.rate), f1(s.summer.model.rate), '| winter r', f2(s.winter.r), 'bias', f1(s.winter.bias));
})().catch(err => { console.error(err); process.exit(1); });
