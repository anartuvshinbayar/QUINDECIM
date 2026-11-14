// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
const { analyze } = Q.stats;
const { loadData, slice } = Q.data;
const { drawMap } = Q.map;
const { drawChart } = Q.chart;
const { VARIABLES, byId } = Q.variables;
const { STRINGS, GLOSSARY } = Q.i18n;
const motion = Q.motion;

const $ = id => document.getElementById(id);

// Opens on summer greenness so the map is coloured from the start.
const DEFAULT_VAR = 'ndvi_summer';
const state = { lang: 'mn', varId: DEFAULT_VAR, soumId: null, from: null, to: null };
let DATA, map, lastResultKey = '';

const t = key => STRINGS[state.lang][key];
const tr = obj => obj[state.lang];
const soumName = s => (state.lang === 'mn' ? s.name_mn : s.name_en);
const soumLabel = s => `${soumName(s)}${s.aimag ? ', ' + s.aimag : ''}`;
const make = (tag, props = {}) => Object.assign(document.createElement(tag), props);

// ---------- URL state: #v=ndvi_summer&s=12345&from=2001&to=2025&lang=en ----------

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('lang') === 'en') state.lang = 'en';
  if (byId[p.get('v')]) state.varId = p.get('v');
  if (p.get('s') && DATA.soumById[p.get('s')]) state.soumId = p.get('s');
  if (p.get('from')) state.from = +p.get('from');
  if (p.get('to')) state.to = +p.get('to');
}

function writeHash() {
  const p = new URLSearchParams();
  if (state.varId) p.set('v', state.varId);
  if (state.soumId) p.set('s', state.soumId);
  if (state.from) p.set('from', state.from);
  if (state.to) p.set('to', state.to);
  if (state.lang !== 'mn') p.set('lang', state.lang);
  history.replaceState(null, '', '#' + p.toString());
}

// ---------- formatting ----------

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const fmtP = p => (p < 0.001 ? '< 0.001' : p.toFixed(3));
const signed = (v, d) => (v > 0 ? '+' : '') + fmt(v, d);

function perDecade(v, r, slope) {
  return v.display === 'percent' ? (slope * 10 / r.mean) * 100 : slope * 10;
}
function rateUnit(v) {
  if (v.display === 'percent') return '%';
  return v.unitName ? ' ' + tr(v.unitName) : ' ' + v.unit;
}

// "Rose by <num>% per decade, since 2001", with the number in a span that counts up.
function speedNode(v, r) {
  const node = document.createDocumentFragment();
  if (r.direction === 'flat') { node.append(`${t('noChange')} (${r.first}–${r.last})`); return node; }
  const rate = Math.abs(perDecade(v, r, r.sen.slope));
  const d = v.display === 'percent' || v.id === 'first_frost' ? 1 : 2;
  const word = v.id === 'first_frost'
    ? (r.direction === 'up' ? t('frostLater') : t('frostEarlier'))
    : (r.direction === 'up' ? t('rose') : t('fell'));
  const num = make('span', { className: 'num', textContent: rate.toFixed(d) });
  num.dataset.value = rate; num.dataset.decimals = d;
  const since = state.lang === 'mn' ? `${r.first} ${t('since')}` : `${t('since')} ${r.first}`;
  node.append(`${word} `, num, make('span', { className: 'num', textContent: rateUnit(v) }), ` ${t('perDecade')}, ${since}`);
  return node;
}

function verdictKey(r) {
  if (!r.ok) return 'no-data';
  if (r.level === 'not-proven' || r.direction === 'flat') return 'not-proven';
  return `${r.level}-${r.direction}`;
}

// ---------- rendering ----------

function renderStatic() {
  document.documentElement.lang = state.lang;
  document.title = t('docTitle');
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('.lang-button').forEach(b => {
    const on = b.dataset.lang === state.lang;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on);
  });
  document.querySelectorAll('[data-pick]').forEach(b => { b.textContent = tr(byId[b.dataset.pick].question); });
  document.querySelectorAll('[data-claim]').forEach(li => { li.textContent = t('claims')[+li.dataset.claim]; });
  $('soum-search').placeholder = t('searchSoum');
  $('limits-list').replaceChildren(...t('limits').map(s => make('li', { textContent: s })));
  $('glossary-list').replaceChildren(...GLOSSARY.map(g => {
    const [term, def] = g[state.lang];
    const row = make('div');
    row.append(make('dt', { textContent: term }), make('dd', { textContent: def }));
    return row;
  }));
  $('steps').replaceChildren(...t('steps').map(([title, text], i) => {
    const li = make('li');
    li.style.setProperty('--d', (i * 0.08) + 's');
    li.append(make('span', { className: 'step-num', textContent: `${i + 1}/${t('steps').length}` }),
      make('h3', { textContent: title }), make('p', { textContent: text }));
    return li;
  }));
  $('soum-list').replaceChildren(...DATA.soums.map(s => make('option', { value: soumLabel(s) })));

  $('variable-buttons').replaceChildren(...VARIABLES.filter(v => DATA.series[v.id]).map(v => {
    const b = make('button', { type: 'button', className: 'variable-button' });
    b.dataset.var = v.id;
    b.setAttribute('role', 'radio');
    b.append(make('span', { className: 'variable-question', textContent: tr(v.question) }),
      make('span', { className: 'variable-name', textContent: `${tr(v.name)} · ${tr(v.season)}` }));
    b.addEventListener('click', () => selectVariable(v.id));
    return b;
  }));

  motion.startRotator(t('rotWords'), t('rotBefore'), t('rotAfter'));
  motion.refresh();
  lastResultKey = '';
}

function render() {
  const v = byId[state.varId];
  const soum = state.soumId && DATA.soumById[state.soumId];

  document.querySelectorAll('.variable-button').forEach(b => {
    const on = b.dataset.var === state.varId;
    b.classList.toggle('is-selected', on);
    b.setAttribute('aria-checked', on);
  });
  if (soum && document.activeElement !== $('soum-search')) $('soum-search').value = soumLabel(soum);

  const [lo, hi] = DATA.yearRange[v.id];
  for (const id of ['year-from', 'year-to']) { $(id).min = lo; $(id).max = hi; }
  $('year-from').value = state.from; $('year-to').value = state.to;
  $('year-from-out').textContent = state.from; $('year-to-out').textContent = state.to;

  const verdicts = {};
  for (const s of DATA.soums) {
    const part = slice(DATA.series[v.id][s.id], state.from, state.to);
    verdicts[s.id] = verdictKey(analyze(part.years, part.values));
  }
  map.update({ selectedId: state.soumId, verdicts });
  $('legend-real-up').textContent = `${t('real')}: ${tr(v.up)}`;
  $('legend-possible-up').textContent = `${t('possibleShort')}: ${tr(v.up)}`;
  $('legend-not-proven').textContent = t('notProven');
  $('legend-possible-down').textContent = `${t('possibleShort')}: ${tr(v.down)}`;
  $('legend-real-down').textContent = `${t('real')}: ${tr(v.down)}`;

  $('result-empty').hidden = Boolean(soum);
  $('result').hidden = !soum;
  $('breadcrumb').hidden = !soum;
  if (!soum) $('verdict-badge').hidden = true;
  if (soum) renderResult(v, soum);
  writeHash();
}

function renderResult(v, soum) {
  const part = slice(DATA.series[v.id][soum.id], state.from, state.to);
  const r = analyze(part.years, part.values);
  const key = [v.id, soum.id, state.from, state.to, state.lang].join('|');
  const changed = key !== lastResultKey;
  lastResultKey = key;
  $('result').dataset.verdict = verdictKey(r);

  // Breadcrumb: Mongolia › aimag › soum
  $('breadcrumb').querySelector('ol').replaceChildren(
    ...[t('mapRegion'), soum.aimag, soumName(soum)].filter(Boolean).map(x => make('li', { textContent: x })));

  $('too-short').hidden = r.ok;
  $('result-body').hidden = !r.ok;
  const badge = $('verdict-badge');
  if (!r.ok) {
    $('too-short').textContent = `${t('tooShort')} ${r.n} ${t('years')}.`;
    badge.hidden = true;
    return;
  }

  const levelText = { real: t('real'), possible: t('possible'), 'not-proven': t('notProven') }[r.level];
  const vk = verdictKey(r);
  badge.hidden = false;
  badge.className = 'pill ' + ({ 'real-up': 'pill-real', 'possible-up': 'pill-possible', 'real-down': 'pill-real-down',
    'possible-down': 'pill-possible-down' }[vk] || 'pill-not-proven');
  const short = { real: t('real'), possible: t('possibleShort'), 'not-proven': t('notProven') }[r.level];
  badge.textContent = vk === 'not-proven' ? short : `${short} · ${tr(v[r.direction === 'up' ? 'up' : 'down'])}`;
  if (changed) { badge.style.animation = 'none'; void badge.offsetWidth; badge.style.animation = ''; }

  if (!changed) return;   // same result: keep the drawn chart as it is

  const unit = v.unitName ? tr(v.unitName) : v.unit;
  drawChart($('chart'), r, { decimals: v.decimals, unit, labels: { title: `${tr(v.name)}, ${soumName(soum)}` } });
  $('source-line').textContent = `${t('sourceLine')}: ${v.source}. ${tr(v.season)}.`;

  const levelP = { real: t('realP'), possible: t('possibleP'), 'not-proven': t('notProvenP') }[r.level];
  $('v-what').textContent = `${tr(v.name)}, ${soumLabel(soum)} (${r.first}–${r.last})`;
  $('v-speed').replaceChildren(speedNode(v, r));
  $('v-speed').querySelectorAll('.num[data-value]').forEach(motion.countUp);
  $('v-real').textContent = `${levelText}: ${levelP} (p = ${fmtP(r.mk.p)})`;
  $('v-meaning').textContent = { real: t('meaningReal'), possible: t('meaningPossible'), 'not-proven': t('meaningNotProven') }[r.level];
  // Restart the cell animation for a new result.
  $('verdict').querySelectorAll(':scope > div').forEach(d => { d.style.animation = 'none'; void d.offsetWidth; d.style.animation = ''; });

  $('disagree-note').hidden = !r.testsDisagree;
  $('level-note').textContent = v.level === 'regional' ? t('regional') : v.level === 'point' ? t('point') : '';
  $('level-note').hidden = v.level === 'soum';

  const ru = rateUnit(v), dd = v.display === 'percent' ? 2 : 3;
  const rows = [
    [t('nYears'), `${r.n} (${r.first}–${r.last})`],
    [t('average'), `${fmt(r.mean, v.decimals + 1)} ${unit}`],
    [t('mkTest'), `S = ${r.mk.s}, Z = ${fmt(r.mk.z)}, ${t('tau')} = ${fmt(r.mk.tau)}, ${t('pValue')} = ${fmtP(r.mk.p)}`],
    [t('senSlope'), `${signed(perDecade(v, r, r.sen.slope), dd)}${ru} ${t('perDecade')}`],
    [t('linTest'), `${t('slope')} = ${signed(perDecade(v, r, r.lin.slope), dd)}${ru} ${t('perDecade')}, ${t('pValue')} = ${fmtP(r.lin.p)}, R² = ${fmt(r.lin.r2)}`],
    [t('ci95'), `${signed(perDecade(v, r, r.lin.ciLow), dd)}${ru} … ${signed(perDecade(v, r, r.lin.ciHigh), dd)}${ru} ${t('perDecade')}`],
    [t('source'), v.source],
  ];
  $('stats-rows').replaceChildren(...rows.map(([k, val]) => {
    const row = make('tr');
    row.append(make('th', { textContent: k, scope: 'row' }), make('td', { textContent: val }));
    return row;
  }));

  $('download').onclick = () => downloadCsv(v, soum, r);
}

function downloadCsv(v, soum, r) {
  const lines = [
    `# ${v.name.en} (${v.unit}), ${soum.name_en}${soum.aimag ? ', ' + soum.aimag : ''}`,
    `# Source: ${v.source}. ${v.season.en}.`,
    `# Mann-Kendall p = ${r.mk.p.toFixed(4)}, Sen's slope = ${r.sen.slope.toPrecision(4)} ${v.unit}/year, ` +
      `linear slope = ${r.lin.slope.toPrecision(4)} ${v.unit}/year (95% CI ${r.lin.ciLow.toPrecision(4)} to ${r.lin.ciHigh.toPrecision(4)}), linear p = ${r.lin.p.toFixed(4)}`,
    DATA.sample ? '# SAMPLE DATA: invented numbers, not real results' : '',
    'year,value',
    ...r.x.map((yr, i) => `${yr},${r.y[i]}`),
  ].filter(Boolean);
  const a = make('a', { download: `${v.id}_${soum.id}_${r.first}-${r.last}.csv` });
  a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- actions ----------

function selectVariable(id) {
  if (state.varId !== id) { state.varId = id; [state.from, state.to] = DATA.yearRange[id]; }
  render();
}

function selectSoum(id) {
  state.soumId = id;
  render();
}

function wire() {
  document.querySelectorAll('.lang-button').forEach(b => b.addEventListener('click', () => {
    if (state.lang === b.dataset.lang) return;
    state.lang = b.dataset.lang;
    renderStatic(); render();
  }));

  // The four questions around the hero art jump straight into the tool.
  document.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    selectVariable(b.dataset.pick);
    $('tool').scrollIntoView({ behavior: 'smooth' });
  }));

  $('soum-search').addEventListener('change', e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return;
    const hit = DATA.soums.find(s => soumLabel(s).toLowerCase() === q)
      || DATA.soums.find(s => [s.name_en, s.name_mn, s.aimag].some(n => n && n.toLowerCase().startsWith(q)));
    if (hit) selectSoum(hit.id);
  });

  const onYears = which => () => {
    let from = +$('year-from').value, to = +$('year-to').value;
    if (from > to) { if (which === 'from') to = from; else from = to; }
    state.from = from; state.to = to;
    render();
  };
  $('year-from').addEventListener('input', onYears('from'));
  $('year-to').addEventListener('input', onYears('to'));

  $('share').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); $('share').textContent = t('copied'); }
    catch (err) { /* clipboard blocked: the address bar already holds the link */ }
    setTimeout(() => { $('share').textContent = t('share'); }, 1500);
  });
}

// ---------- start ----------

(async function start() {
  try {
    DATA = await loadData();
  } catch (err) {
    $('load-error').hidden = false;
    $('load-error').textContent = 'Could not load data: ' + err.message;
    motion.init();
    return;
  }
  $('sample-banner').hidden = !DATA.sample;
  readHash();
  if (state.from == null || state.to == null) [state.from, state.to] = DATA.yearRange[state.varId];
  map = drawMap($('map'), DATA.soums, { onSelect: selectSoum, label: soumLabel });
  renderStatic();
  wire();
  render();
  motion.init();
})();
})(globalThis.Q = globalThis.Q || {});
