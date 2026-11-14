// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
const { analyze } = Q.stats;
const { loadData, slice } = Q.data;
const { createMap } = Q.map;
const { drawChart } = Q.chart;
const { VARIABLES, byId, AIMAG_MN } = Q.variables;
const { STRINGS, GLOSSARY } = Q.i18n;
const motion = Q.motion;

const $ = id => document.getElementById(id);

// Flow: overview of aimags -> click an aimag (zoom, result panel slides in, soums appear) -> click a soum.
const DEFAULT_VAR = 'ndvi_summer';
const state = { lang: 'mn', varId: DEFAULT_VAR, aimag: null, soumId: null, from: null, to: null };
let DATA, map, lastResultKey = '';

const t = key => STRINGS[state.lang][key];
const tr = obj => obj[state.lang];
const aimagName = a => (state.lang === 'mn' ? AIMAG_MN[a] || a : a);
const soumName = s => (state.lang === 'mn' ? s.name_mn : s.name_en);
const soumLabel = s => `${soumName(s)}, ${aimagName(s.aimag)}`;
const make = (tag, props = {}) => Object.assign(document.createElement(tag), props);

// ---------- URL state: #v=ndvi_summer&a=Dundgovi&s=12345&from=2001&to=2025&lang=en ----------

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('lang') === 'en') state.lang = 'en';
  if (byId[p.get('v')]) state.varId = p.get('v');
  if (p.get('a') && DATA.aimagByName[p.get('a')]) state.aimag = p.get('a');
  if (p.get('s') && DATA.soumById[p.get('s')]) { state.soumId = p.get('s'); state.aimag = DATA.soumById[state.soumId].aimag; }
  if (p.get('from')) state.from = +p.get('from');
  if (p.get('to')) state.to = +p.get('to');
}

function writeHash() {
  const p = new URLSearchParams();
  p.set('v', state.varId);
  if (state.aimag) p.set('a', state.aimag);
  if (state.soumId) p.set('s', state.soumId);
  p.set('from', state.from); p.set('to', state.to);
  if (state.lang !== 'mn') p.set('lang', state.lang);
  history.replaceState(null, '', '#' + p.toString());
}

// ---------- formatting ----------

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const fmtP = p => (p < 0.001 ? '< 0.001' : p.toFixed(3));
const signed = (v, d) => (v > 0 ? '+' : '') + fmt(v, d);
const perDecade = (v, r, slope) => (v.display === 'percent' ? (slope * 10 / r.mean) * 100 : slope * 10);
const rateUnit = v => (v.display === 'percent' ? '%' : ' ' + (v.unitName ? tr(v.unitName) : v.unit));

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
const resultFor = s => { const part = slice(s, state.from, state.to); return analyze(part.years, part.values); };


// ---------- no layout shift when switching language ----------
// Every piece of text that changes with the language gets room for its longer version (width for
// buttons and labels, height for text that can wrap), so nothing moves when you press MN or EN.
const LANGS = ['mn', 'en'];
function legendTexts(l) {
  const v = byId[state.varId], S = STRINGS[l];
  return { 'legend-real-up': `${S.real}: ${v.up[l]}`, 'legend-possible-up': `${S.possibleShort}: ${v.up[l]}`, 'legend-not-proven': S.notProven,
    'legend-possible-down': `${S.possibleShort}: ${v.down[l]}`, 'legend-real-down': `${S.real}: ${v.down[l]}` };
}
function lockSizes() {
  // Each item: the box to size, which dimension, and how to write its text in a given language.
  const items = [];
  const add = (box, dim, set) => box && items.push({ box, dim, set });
  const i18nText = el => l => { el.textContent = STRINGS[l][el.dataset.i18n]; };
  document.querySelectorAll('.main-nav [data-i18n], .header-cta, .year-label, .glossary-title').forEach(el => add(el, 'width', i18nText(el)));
  const big = document.querySelector('.hero .button-big'), bigText = big && big.querySelector('[data-i18n]');
  if (big) { add(big, 'width', i18nText(bigText)); add(big, 'height', i18nText(bigText)); }   // it can wrap on small phones
  document.querySelectorAll('.variable-button').forEach(el => add(el, 'width', l => { el.textContent = byId[el.dataset.var].name[l]; }));
  document.querySelectorAll('.glossary-term').forEach(el => add(el, 'width', l => { el.textContent = GLOSSARY[+el.dataset.i][l][0]; }));
  document.querySelectorAll('[data-pick]').forEach(el => add(el, 'height', l => { el.textContent = byId[el.dataset.pick].question[l]; }));
  document.querySelectorAll('.hero-sub, .hero-title, #map-hint').forEach(el => add(el, 'height', i18nText(el)));
  add($('glossary-def'), 'height', l => { const [term, def] = GLOSSARY[glossaryIndex][l]; $('glossary-def').replaceChildren(make('b', { textContent: term }), ': ' + def); });
  const legendSet = l => { for (const [id, text] of Object.entries(legendTexts(l))) $(id).textContent = text; };
  add($('map-legend'), 'width', legendSet);
  add($('map-legend'), 'height', legendSet);
  document.querySelectorAll('.site-footer [data-i18n]').forEach(el => add(el, 'height', i18nText(el)));

  // Widths first (they decide how text wraps), then heights. Each item ends back in the current language.
  for (const dim of ['width', 'height']) {
    const prop = dim === 'width' ? 'minWidth' : 'minHeight';
    const group = items.filter(i => i.dim === dim);
    group.forEach(i => { i.box.style[prop] = ''; });
    for (const i of group) {
      let max = 0;
      for (const l of LANGS) {
        i.set(l);
        const r = i.box.getBoundingClientRect();
        max = Math.max(max, dim === 'width' ? r.width : r.height);
      }
      i.set(state.lang);
      i.box.style[prop] = Math.ceil(max) + 'px';
    }
  }
  // The hero title and other split headings rise word by word: split them again after measuring.
  motion.refresh();
}

// ---------- glossary: a row of terms, one meaning shown at a time ----------
let glossaryIndex = 0;
function renderGlossary() {
  $('glossary-terms').replaceChildren(...GLOSSARY.map((g, i) => {
    const b = make('button', { type: 'button', className: 'glossary-term', textContent: g[state.lang][0] });
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', i === glossaryIndex);
    b.dataset.i = i;
    b.addEventListener('click', () => { glossaryIndex = i; renderGlossary(); lockSizes(); });
    return b;
  }));
  const [term, def] = GLOSSARY[glossaryIndex][state.lang];
  $('glossary-def').replaceChildren(make('b', { textContent: term }), ': ' + def);
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
  $('soum-search').placeholder = t('searchSoum');
  $('map-back').setAttribute('aria-label', t('back'));
  $('map-back').title = t('back');
  $('limits-list').replaceChildren(...t('limits').map(s => make('li', { textContent: s })));
  renderGlossary();
  $('soum-list').replaceChildren(
    ...DATA.aimags.map(a => make('option', { value: aimagName(a.name) })),
    ...DATA.soums.map(s => make('option', { value: soumLabel(s) })));

  $('variable-buttons').replaceChildren(...VARIABLES.filter(v => DATA.series[v.id]).map(v => {
    const b = make('button', { type: 'button', className: 'variable-button', title: `${tr(v.question)} ${tr(v.season)}`, textContent: tr(v.name) });
    b.dataset.var = v.id;
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => selectVariable(v.id));
    return b;
  }));

  motion.startRotator(t('rotWords'), t('rotBefore'), t('rotAfter'));
  motion.refresh();
  lockSizes();
  lastResultKey = '';
}

function render() {
  const v = byId[state.varId];
  document.querySelectorAll('.variable-button').forEach(b => {
    const on = b.dataset.var === state.varId;
    b.classList.toggle('is-selected', on);
    b.setAttribute('aria-checked', on);
  });

  const [lo, hi] = DATA.yearRange[v.id];
  // Year pickers: a list of every year of this question's record, plus one-year arrows.
  for (const [id, val, min, max] of [['year-from', state.from, lo, state.to], ['year-to', state.to, state.from, hi]]) {
    const sel = $(id);
    if (sel.dataset.range !== `${lo}-${hi}`) {
      sel.replaceChildren(...Array.from({ length: hi - lo + 1 }, (_, i) => make('option', { value: lo + i, textContent: lo + i })));
      sel.dataset.range = `${lo}-${hi}`;
    }
    for (const o of sel.options) o.disabled = +o.value < min || +o.value > max;   // keep from <= to
    sel.value = val;
  }
  document.querySelectorAll('.year-step').forEach(b => {
    const which = b.dataset.which, step = +b.dataset.step;
    const next = (which === 'from' ? state.from : state.to) + step;
    b.disabled = which === 'from' ? next < lo || next > state.to : next < state.from || next > hi;
  });

  // Map colours: every aimag (average of its soums); soums only for the open aimag.
  const aimagVerdicts = {}, soumVerdicts = {};
  for (const a of DATA.aimags) aimagVerdicts[a.name] = verdictKey(resultFor(DATA.aimagSeries(v.id, a.name)));
  if (state.aimag) for (const id of DATA.aimagByName[state.aimag].soumIds) soumVerdicts[id] = verdictKey(resultFor(DATA.series[v.id][id]));
  const panel = Boolean(state.aimag);
  map.update({ aimag: state.aimag, soumId: state.soumId, panel, aimagVerdicts, soumVerdicts });
  $('stage').classList.toggle('has-panel', panel);
  $('map-back').hidden = false;
  $('result-panel').hidden = false;
  $('result-panel').inert = !panel;
  $('result-extras').hidden = !panel;

  for (const [id, text] of Object.entries(legendTexts(state.lang))) $(id).textContent = text;

  if (panel) renderResult(v);
  if (!$('soum-search').matches(':focus')) {
    $('soum-search').value = state.soumId ? soumLabel(DATA.soumById[state.soumId]) : state.aimag ? aimagName(state.aimag) : '';
  }
  writeHash();
}

function renderResult(v) {
  const soum = state.soumId && DATA.soumById[state.soumId];
  const series = soum ? DATA.series[v.id][soum.id] : DATA.aimagSeries(v.id, state.aimag);
  const r = resultFor(series);
  const key = [v.id, state.aimag, state.soumId, state.from, state.to, state.lang].join('|');
  const changed = key !== lastResultKey;
  lastResultKey = key;
  if (!changed) return;

  // Breadcrumb: Mongolia › Aimag › Soum (earlier steps are buttons).
  const crumbs = [[t('mapRegion'), goOverview], [aimagName(state.aimag), soum ? () => selectAimag(state.aimag) : null]];
  if (soum) crumbs.push([soumName(soum), null]);
  $('breadcrumb').querySelector('ol').replaceChildren(...crumbs.map(([label, fn]) => {
    const li = make('li');
    li.append(fn ? Object.assign(make('button', { type: 'button', textContent: label }), { onclick: fn }) : label);
    return li;
  }));
  $('result-title').textContent = soum ? soumName(soum) : aimagName(state.aimag);

  const badge = $('verdict-badge');
  $('too-short').hidden = r.ok;
  $('result-body').hidden = !r.ok;
  if (!r.ok) {
    $('too-short').textContent = `${t('tooShort')} ${r.n} ${t('years')}.`;
    badge.hidden = true;
    return;
  }

  const vk = verdictKey(r);
  const short = { real: t('real'), possible: t('possibleShort'), 'not-proven': t('notProven') }[r.level];
  badge.hidden = false;
  badge.className = 'pill ' + ({ 'real-up': 'pill-real', 'possible-up': 'pill-possible', 'real-down': 'pill-real-down',
    'possible-down': 'pill-possible-down' }[vk] || 'pill-not-proven');
  badge.textContent = vk === 'not-proven' ? short : `${short} · ${tr(v[r.direction === 'up' ? 'up' : 'down'])}`;
  badge.style.animation = 'none'; void badge.offsetWidth; badge.style.animation = '';

  const unit = v.unitName ? tr(v.unitName) : v.unit;
  drawChart($('chart'), r, { decimals: v.decimals, unit, labels: { title: `${tr(v.name)}, ${$('result-title').textContent}` } });

  const levelText = { real: t('real'), possible: t('possible'), 'not-proven': t('notProven') }[r.level];
  const levelP = { real: t('realP'), possible: t('possibleP'), 'not-proven': t('notProvenP') }[r.level];
  $('v-speed').replaceChildren(speedNode(v, r));
  $('v-speed').querySelectorAll('.num[data-value]').forEach(motion.countUp);
  $('v-real').textContent = `${levelText}: ${levelP} (p = ${fmtP(r.mk.p)})`;
  $('v-meaning').textContent = { real: t('meaningReal'), possible: t('meaningPossible'), 'not-proven': t('meaningNotProven') }[r.level];
  $('verdict').querySelectorAll(':scope > div').forEach(d => { d.style.animation = 'none'; void d.offsetWidth; d.style.animation = ''; });

  const scope = soum ? (v.level === 'regional' ? t('regional') : v.level === 'point' ? t('point') : '') : t('aimagAverage');
  $('source-line').textContent = `${t('sourceLine')}: ${v.source}. ${tr(v.season)}. ${scope}`.trim();
  $('disagree-note').hidden = !r.testsDisagree;

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
  const place = soum ? `${soum.name_en}, ${soum.aimag}` : `${state.aimag} (average of its soums)`;
  const lines = [
    `# ${v.name.en} (${v.unit}), ${place}`,
    `# Source: ${v.source}. ${v.season.en}.`,
    `# Mann-Kendall p = ${r.mk.p.toFixed(4)}, Sen's slope = ${r.sen.slope.toPrecision(4)} ${v.unit}/year, ` +
      `linear slope = ${r.lin.slope.toPrecision(4)} ${v.unit}/year (95% CI ${r.lin.ciLow.toPrecision(4)} to ${r.lin.ciHigh.toPrecision(4)}), linear p = ${r.lin.p.toFixed(4)}`,
    DATA.sample ? '# SAMPLE DATA: invented numbers, not real results' : '',
    'year,value',
    ...r.x.map((yr, i) => `${yr},${+r.y[i].toFixed(4)}`),
  ].filter(Boolean);
  const a = make('a', { download: `${v.id}_${soum ? soum.id : state.aimag}_${r.first}-${r.last}.csv` });
  a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- actions ----------

function selectVariable(id) {
  if (state.varId !== id) { state.varId = id; [state.from, state.to] = DATA.yearRange[id]; }
  render();
  lockSizes();
}
// On phones the result appears under the map, so bring it into view after the zoom.
function showResultOnPhone() {
  if (innerWidth >= 760) return;
  setTimeout(() => {
    const top = $('result-panel').getBoundingClientRect().top + scrollY - 70;
    if (top > scrollY + innerHeight * 0.5) scrollTo({ top, behavior: 'smooth' });
  }, 900);
}
function selectAimag(name) { state.aimag = name; state.soumId = null; render(); }
function selectSoum(id) {
  // Clicking the selected soum again unselects it and shows the aimag's result.
  if (state.soumId === id) { selectAimag(state.aimag); return; }
  state.aimag = DATA.soumById[id].aimag; state.soumId = id; render(); showResultOnPhone();
}
function goOverview() { state.aimag = null; state.soumId = null; render(); }

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

  $('map-back').addEventListener('click', goOverview);
  addEventListener('keydown', e => { if (e.key === 'Escape' && state.aimag) goOverview(); });

  $('soum-search').addEventListener('change', e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return;
    const a = DATA.aimags.find(x => [x.name, AIMAG_MN[x.name] || ''].some(n => n.toLowerCase() === q));
    if (a) { selectAimag(a.name); return; }
    const hit = DATA.soums.find(s => soumLabel(s).toLowerCase() === q)
      || DATA.soums.find(s => [s.name_en, s.name_mn].some(n => n && n.toLowerCase().startsWith(q)));
    if (hit) selectSoum(hit.id);
  });

  const setYears = (from, to) => {
    const [lo, hi] = DATA.yearRange[state.varId];
    from = Math.max(lo, Math.min(from, hi)); to = Math.max(lo, Math.min(to, hi));
    if (from > to) return;
    state.from = from; state.to = to;
    render();
  };
  $('year-from').addEventListener('change', e => setYears(+e.target.value, state.to));
  $('year-to').addEventListener('change', e => setYears(state.from, +e.target.value));
  document.querySelectorAll('.year-step').forEach(b => b.addEventListener('click', () => {
    const step = +b.dataset.step;
    if (b.dataset.which === 'from') setYears(state.from + step, state.to); else setYears(state.from, state.to + step);
  }));

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
    if (!DATA.aimags.length) throw new Error('no aimag outlines in data/data.js (run tools/gee_export.py --only aimags, then tools/build_data.py)');
  } catch (err) {
    $('load-error').hidden = false;
    $('load-error').textContent = 'Could not load data: ' + err.message;
    motion.init();
    return;
  }
  $('sample-banner').hidden = !DATA.sample;
  readHash();
  if (state.from == null || state.to == null) [state.from, state.to] = DATA.yearRange[state.varId];
  map = createMap($('stage'), {
    soums: DATA.soums, aimags: DATA.aimags,
    onAimag: selectAimag, onSoum: selectSoum,
    aimagLabel: name => aimagName(name),
    soumLabel: id => soumName(DATA.soumById[id]),
  });
  renderStatic();
  wire();
  render();
  motion.init();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(lockSizes);
  let lockT;
  addEventListener('resize', () => { clearTimeout(lockT); lockT = setTimeout(lockSizes, 200); });
})();
})(globalThis.Q = globalThis.Q || {});
