// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
const { analyze, fdr, verdictLevel } = Q.stats;
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
const tf = (key, vars) => t(key).replace(/\{(\w+)\}/g, (_, k) => vars[k]);   // text with {placeholders}
const tr = obj => obj[state.lang];
const aimagName = a => (state.lang === 'mn' ? AIMAG_MN[a] || a : a);
const soumName = s => (state.lang === 'mn' ? s.name_mn : s.name_en);
const soumLabel = s => `${soumName(s)}, ${aimagName(s.aimag)}`;
const make = (tag, props = {}) => Object.assign(document.createElement(tag), props);

// ---------- URL state: #v=ndvi_summer&a=Dundgovi&s=12345&from=2001&to=2025&lang=en ----------

// Read in two steps: the language and question right away (the page is drawn before the data has arrived), the
// place and years once the data is there to check them against.
function readHash(withData) {
  const p = new URLSearchParams(location.hash.slice(1));
  if (!withData) {
    if (p.get('lang') === 'en') state.lang = 'en';
    if (byId[p.get('v')]) state.varId = p.get('v');
    return;
  }
  if (p.get('a') && DATA.aimagByName[p.get('a')]) state.aimag = p.get('a');
  if (p.get('s') && DATA.soumById[p.get('s')]) { state.soumId = p.get('s'); state.aimag = DATA.soumById[state.soumId].aimag; }
  // The years belong to the question in the link (a different question picked while loading starts on its full record).
  if ((p.get('v') || DEFAULT_VAR) === state.varId) {
    if (p.get('from')) state.from = +p.get('from');
    if (p.get('to')) state.to = +p.get('to');
  }
  const [lo, hi] = DATA.yearRange[state.varId];
  if (!(state.from >= lo && state.from <= hi)) state.from = lo;
  if (!(state.to >= lo && state.to <= hi)) state.to = hi;
  if (state.from > state.to) [state.from, state.to] = [lo, hi];
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
// p and q values with 3 decimals, or more where rounding would put them on the other side of 0.05 or 0.10
// (0.0497 must not read as 0.050 next to a verdict that says it is below 0.05).
function fmtP(p) {
  if (!Number.isFinite(p)) return '–';
  if (p < 0.001) return '< 0.001';
  for (let d = 3; d < 7; d++) {
    const s = p.toFixed(d);
    if ([0.05, 0.1].every(c => (p < c) === (+s < c))) return s;
  }
  return p.toFixed(7);
}
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

// ---------- every place at once, with the nationwide check ----------
// For the chosen question and years, every soum and every aimag is tested. With 337 soums, about 17 would pass
// p < 0.05 by pure chance, so each place also gets a false discovery rate q value (Benjamini-Hochberg) among all soums
// (for a soum) or all aimags (for an aimag). It is called a real trend only if q < 0.05 too: then at most about 1 in 20
// of the places shown as real is expected to be chance. The map and the result panel use the same verdicts.
const nationCache = new Map();
function checkAll(results) {
  const ok = Object.values(results).filter(r => r.ok);
  const q = fdr(ok.map(r => r.mk.p));
  ok.forEach((r, i) => { r.q = q[i]; r.tested = ok.length; r.level = verdictLevel(r.mk.p, r.q); });
}
function nation() {
  const v = state.varId, key = [v, state.from, state.to].join('|');
  if (!nationCache.has(key)) {
    if (nationCache.size > 40) nationCache.clear();
    const soums = {}, aimags = {};
    for (const s of DATA.soums) soums[s.id] = resultFor(DATA.series[v][s.id]);
    for (const a of DATA.aimags) aimags[a.name] = resultFor(DATA.aimagSeries(v, a.name));
    checkAll(soums);
    checkAll(aimags);
    nationCache.set(key, { soums, aimags });
  }
  return nationCache.get(key);
}

// ---------- the result in plain words ----------
// One sentence anyone can read: how much it changed along the trend line from the first year to the last, and whether
// that could be chance. Percent questions compare with the trend line's value in the first year.
function plainSentence(v, r, isSoum) {
  const L = state.lang, place = STRINGS[L][isSoum ? 'plainSoum' : 'plainAimag'];
  const total = r.sen.slope * (r.last - r.first);
  let amount = NaN;
  if (v.display === 'percent') {
    const start = r.sen.intercept + r.sen.slope * r.first;
    if (start > 0) amount = Math.abs(total / start * 100);
  } else amount = Math.abs(total);
  // Whole numbers, or one decimal for temperatures and for anything under 1; "barely changed" if that still rounds to 0.
  const d = v.id.startsWith('temp') || amount < 1 ? 1 : 0;
  const shown = Number.isFinite(amount) ? amount.toFixed(d) : '';
  const barely = r.direction === 'flat' || !Number.isFinite(amount) || +shown === 0;
  const vars = { place, first: r.first, x: shown, days: STRINGS[L][shown === '1' ? 'day' : 'days'] };
  const text = v.plain[barely ? 'same' : r.direction][L].replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  if (barely) return text;
  const chance = { real: 'plainReal', possible: 'plainPossible', 'not-proven': 'plainNotProven' }[r.level];
  return `${text} ${t(chance)}`;
}


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
  document.querySelectorAll('.main-nav [data-i18n], .year-label, .hero-sub').forEach(el => add(el, 'width', i18nText(el)));
  // Question tabs: each tab is as wide as its longer name, and the row as tall as its taller language (phones wrap).
  const tabNames = l => document.querySelectorAll('.q-tab').forEach(b => { b.querySelector('.q-tab-name').textContent = byId[b.dataset.var].short[l]; });
  document.querySelectorAll('.q-tab').forEach(b => add(b, 'width', l => { b.querySelector('.q-tab-name').textContent = byId[b.dataset.var].short[l]; }));
  add($('q-tabs'), 'height', tabNames);
  // Words: the term cells share one width (CSS grid), so only their height is held; the meaning card is held at
  // the tallest meaning of all terms in both languages, so picking a term moves nothing either.
  document.querySelectorAll('.glossary-term').forEach(el => add(el, 'height', l => { el.textContent = GLOSSARY[+el.dataset.i][l][0]; }));
  GLOSSARY.forEach((_, i) => add($('glossary-def'), 'height', l => showDef(i, l)));
  add($('glossary-def'), 'height', () => showDef(glossaryIndex, state.lang));
  document.querySelectorAll('.hero-sub, #map-hint').forEach(el => add(el, 'height', i18nText(el)));
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

// ---------- the five questions as tabs in the map bar ----------
const ICONS = {
  leaf: '<path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z"/><path d="M5 19l7-7"/>',
  drop: '<path d="M12 3c3.5 4.5 6 7.6 6 10.5a6 6 0 0 1-12 0C6 10.6 8.5 7.5 12 3z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  snow: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9 4.3l3 2 3-2M9 19.7l3-2 3 2"/>',
  frost: '<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 17.5v-6"/><path d="M18 4l2 2M20 4l-2 2"/>',
};
// Icon colours per question (background, line).
const SHAPES = {
  ndvi_summer: { bg: '#CFDCCB', fg: '#2E7A57', icon: 'leaf' },
  rain_summer: { bg: '#CFE0F2', fg: '#3A68BD', icon: 'drop' },
  temp_summer: { bg: '#F1D6C8', fg: '#B9431C', icon: 'sun' },
  temp_winter: { bg: '#D9DDE6', fg: '#15213B', icon: 'snow' },
  first_frost: { bg: '#EFE2C4', fg: '#8A5A1C', icon: 'frost' },
};
// Colour of each rotating headline word, in the order of rotWords (same in both languages), taken from the
// question icons: greener = green, drier = dry earth, hotter = clay, colder = winter navy.
const ROT_COLORS = ['#2E7A57', '#8A5A1C', '#B9431C', '#15213B'];
const iconSvg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
const paint = (el, sh) => { el.style.setProperty('--bg', sh.bg); el.style.setProperty('--fg', sh.fg); };

function renderQuestions() {
  const vars = VARIABLES;   // drawn before the data arrives; a question without data is hidden once it is in
  // Built once; a language switch only changes the text.
  if (!$('q-tabs').children.length) {
    $('q-tabs').replaceChildren(...vars.map(v => {
      const b = make('button', { type: 'button', className: 'q-tab' });
      b.setAttribute('role', 'radio');
      b.dataset.var = v.id;
      const ic = make('span', { className: 'q-icon' });
      paint(ic, SHAPES[v.id]);
      ic.innerHTML = iconSvg(SHAPES[v.id].icon);
      b.append(ic, make('span', { className: 'q-tab-name' }));
      b.addEventListener('click', () => selectVariable(v.id));
      return b;
    }));
  }
  // Names in the current language; the full question on hover.
  document.querySelectorAll('.q-tab').forEach(b => {
    const v = byId[b.dataset.var];
    b.title = `${tr(v.question)} ${tr(v.season)}`;
    b.querySelector('.q-tab-name').textContent = tr(v.short);
    b.hidden = Boolean(DATA) && !DATA.series[v.id];
  });
}
function showCurrentQuestion() {
  const id = state.varId;
  document.querySelectorAll('.q-tab').forEach(b => {
    b.setAttribute('aria-checked', b.dataset.var === id);
    b.tabIndex = b.dataset.var === id ? 0 : -1;   // one tab stop; arrow keys move between questions
  });
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
  showDef(glossaryIndex, state.lang);
}
// The meaning card shows only the meaning: the chosen term is already highlighted next to it.
function showDef(i, l) { $('glossary-def').textContent = GLOSSARY[i][l][1]; }

// ---------- rendering ----------

// Suggestions for the search box: every aimag and soum, in the current language.
function fillSearch() {
  if (!DATA) return;
  $('soum-list').replaceChildren(
    ...DATA.aimags.map(a => make('option', { value: aimagName(a.name) })),
    ...DATA.soums.map(s => make('option', { value: soumLabel(s) })));
}

function renderStatic() {
  document.documentElement.lang = state.lang;
  document.title = t('docTitle');
  $('hero-title').setAttribute('aria-label', t('heroAria'));   // the visible headline rotates; this is its steady name
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('.lang-button').forEach(b => {
    const on = b.dataset.lang === state.lang;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on);
  });
  $('soum-search').placeholder = t('searchSoum');
  $('map-back').setAttribute('aria-label', t('back'));
  $('map-back').title = t('back');
  $('limits-list').replaceChildren(...t('limits').map(s => make('li', { textContent: s })));
  renderGlossary();
  fillSearch();

  renderQuestions();

  motion.startRotator(t('rotWords'), t('rotBefore'), t('rotAfter'), ROT_COLORS);
  motion.refresh();
  lockSizes();
  lastResultKey = '';
}

function render() {
  const v = byId[state.varId];
  showCurrentQuestion();
  if (!DATA) return;   // still loading: the tabs show the choice, the map follows when the data is in

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

  // Map colours: every aimag (average of its soums); soums only for the open aimag. Verdicts after the nationwide check.
  const all = nation(), aimagVerdicts = {}, soumVerdicts = {};
  for (const a of DATA.aimags) aimagVerdicts[a.name] = verdictKey(all.aimags[a.name]);
  if (state.aimag) for (const id of DATA.aimagByName[state.aimag].soumIds) soumVerdicts[id] = verdictKey(all.soums[id]);
  const panel = Boolean(state.aimag);
  map.update({ aimag: state.aimag, soumId: state.soumId, panel, aimagVerdicts, soumVerdicts });
  $('stage').classList.toggle('has-panel', panel);
  $('tool').dataset.var = v.id;   // the map, legend and badge take this question's colours (css: .tool[data-var])
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
  const r = soum ? nation().soums[soum.id] : nation().aimags[state.aimag];
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

  $('result-panel').dataset.dir = r.ok ? r.direction : '';   // trend line and rate in the direction's colour
  const badge = $('verdict-badge');
  $('too-short').hidden = r.ok;
  $('result-body').hidden = !r.ok;
  if (!r.ok) {
    // A soum with almost no grassland has no greenness series at all (tools/gee_export.py, MIN_GRASS_KM2).
    const grass = soum && v.id === 'ndvi_summer' && !DATA.series[v.id][soum.id] && DATA.grass[soum.id];
    $('too-short').textContent = grass ? tf('noGrass', { km2: grass[1].toFixed(1) }) : `${t('tooShort')} ${r.n} ${t('years')}.`;
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

  $('plain-line').textContent = plainSentence(v, r, Boolean(soum));
  const levelText = { real: t('real'), possible: t('possible'), 'not-proven': t('notProven') }[r.level];
  const many = { n: r.tested, places: t(soum ? 'soumsTested' : 'aimagsTested') };
  const levelP = r.level === 'real' ? tf('realP', many)
    : r.level === 'possible' ? (r.mk.p < 0.05 ? tf('possibleAloneP', many) : t('possibleP')) : t('notProvenP');
  $('v-speed').replaceChildren(speedNode(v, r));
  $('v-speed').querySelectorAll('.num[data-value]').forEach(motion.countUp);
  $('v-real').textContent = `${levelText}: ${levelP} (p = ${fmtP(r.mk.p)}, q = ${fmtP(r.q)})`;
  $('v-meaning').textContent = { real: t('meaningReal'), possible: t('meaningPossible'), 'not-proven': t('meaningNotProven') }[r.level];
  $('verdict').querySelectorAll(':scope > div').forEach(d => { d.style.animation = 'none'; void d.offsetWidth; d.style.animation = ''; });

  const scope = soum ? (v.level === 'regional' ? t('regional') : v.level === 'point' ? t('point') : '') : t('aimagAverage');
  // Greenness: grassland only, and how much of the soum that is.
  const g = v.id === 'ndvi_summer' && soum && DATA.grass[soum.id];
  const share = g && g[0] > 0 ? Math.round(g[1] / g[0] * 100) : null;
  const grassNote = v.id !== 'ndvi_summer' ? '' : share == null ? t('grassOnly')
    : share < 1 ? t('grassShareTiny') : tf(share < 25 ? 'grassShareLow' : 'grassShare', { pct: share });
  // The newest year is always a complete season; say so, and what it covers.
  const hi = DATA.yearRange[v.id][1];
  const newest = r.last === hi ? tr(v.newest).replace(/\{y\}/g, hi).replace(/\{y0\}/g, hi - 1) : '';
  $('source-line').textContent = [`${t('sourceLine')}: ${v.source}.`, `${tr(v.season)}.`, newest, grassNote, scope].filter(Boolean).join(' ');
  $('disagree-note').hidden = !r.testsDisagree;

  const ru = rateUnit(v), dd = v.display === 'percent' ? 2 : 3;
  const rows = [
    [t('nYears'), `${r.n} (${r.first}–${r.last})`],
    [t('average'), `${fmt(r.mean, v.decimals + 1)} ${unit}`],
    [t('mkTest'), `S = ${r.mk.s}, Z = ${fmt(r.mk.z)}, ${t('tau')} = ${fmt(r.mk.tau)}, ${t('pValue')} = ${fmtP(r.mk.p)}`],
    [t('mkCorrection'), r.mk.factor > 1 ? tf('mkWidened', { f: fmt(r.mk.factor), p: fmtP(r.mk.plainP) }) : t('mkNotNeeded')],
    [t('fdrRow'), tf('fdrValue', { q: fmtP(r.q), n: r.tested, of: t(soum ? 'soumsOf' : 'aimagsOf'),
      real: Object.values(soum ? nation().soums : nation().aimags).filter(x => x.ok && x.level === 'real').length })],
    [t('senSlope'), `${signed(perDecade(v, r, r.sen.slope), dd)}${ru} ${t('perDecade')}`],
    [t('linTest'), `${t('slope')} = ${signed(perDecade(v, r, r.lin.slope), dd)}${ru} ${t('perDecade')}, ${t('pValue')} = ${fmtP(r.lin.p)}, R² = ${fmt(r.lin.r2)}`],
    [t('ci95'), `${signed(perDecade(v, r, r.lin.ciLow), dd)}${ru} … ${signed(perDecade(v, r, r.lin.ciHigh), dd)}${ru} ${t('perDecade')}`],
    [t('linCorrection'), r.lin.nEff < r.n - 1e-9 ? tf('linWidened', { r1: fmt(r.lin.r1), n: fmt(r.lin.nEff, 1), years: r.n }) : t('linNotNeeded')],
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
    v.id === 'ndvi_summer' ? '# Greenness over grassland only (MODIS land cover MCD12Q1, the same pixels every year).' : '',
    `# Mann-Kendall p = ${r.mk.p.toFixed(4)} (Hamed-Rao correction for year-to-year correlation; plain test ${r.mk.plainP.toFixed(4)}), ` +
      `false discovery rate q = ${r.q.toFixed(4)} over ${r.tested} ${soum ? 'soums' : 'aimags'}, verdict: ${r.level}`,
    `# Sen's slope = ${r.sen.slope.toPrecision(4)} ${v.unit}/year, ` +
      `linear slope = ${r.lin.slope.toPrecision(4)} ${v.unit}/year (95% CI ${r.lin.ciLow.toPrecision(4)} to ${r.lin.ciHigh.toPrecision(4)}, effective n ${r.lin.nEff.toFixed(1)}), linear p = ${r.lin.p.toFixed(4)}`,
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
  if (!DATA) { state.varId = id; showCurrentQuestion(); return; }   // still loading: remember the choice
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


  $('map-back').addEventListener('click', goOverview);
  // Links to the tool: glide to where it rests (while it rises in on scroll it is drawn a little lower).
  document.querySelectorAll('a[href="#tool"]').forEach(link => link.addEventListener('click', e => {
    e.preventDefault();
    motion.toTool();   // the same quick glide as after the logo vanishes, ending with the tool's bar under the header
    const tab = document.querySelector('.q-tab[aria-checked="true"]');
    if (tab) tab.focus({ preventScroll: true });
  }));
  // Back to top: scroll the page itself (the header is pinned, so jumping to it would not move anything).
  document.querySelectorAll('a[href="#top"]').forEach(link => link.addEventListener('click', e => {
    e.preventDefault();
    scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }));
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.aimag) goOverview();
  });

  // Question tabs: arrow keys pick the next or previous question, like any radio group.
  $('q-tabs').addEventListener('keydown', e => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const tabs = [...$('q-tabs').querySelectorAll('.q-tab')], i = tabs.findIndex(b => b.dataset.var === state.varId);
    const next = tabs[(i + step + tabs.length) % tabs.length];
    selectVariable(next.dataset.var);
    next.focus();
  });

  $('soum-search').addEventListener('change', e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q || !DATA) return;
    const a = DATA.aimags.find(x => [x.name, AIMAG_MN[x.name] || ''].some(n => n.toLowerCase() === q));
    if (a) { selectAimag(a.name); return; }
    const hit = DATA.soums.find(s => soumLabel(s).toLowerCase() === q)
      || DATA.soums.find(s => [s.name_en, s.name_mn].some(n => n && n.toLowerCase().startsWith(q)));
    if (hit && hit.id !== state.soumId) selectSoum(hit.id);   // searching the open soum again keeps it open
  });

  const setYears = (from, to) => {
    if (!DATA) return;
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
  // The page is drawn and usable before the data has arrived: the loading screen only covers the first moment, and the
  // map fills in as soon as data/data.js is in (it loads in parallel, so a slow connection only delays the map).
  readHash(false);
  renderStatic();
  wire();
  render();
  motion.init();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(lockSizes);
  let lockT;
  addEventListener('resize', () => { clearTimeout(lockT); lockT = setTimeout(lockSizes, 200); });
  try {
    DATA = await loadData();
    if (!DATA.aimags.length) throw new Error('no aimag outlines in data/data.js (run tools/gee_export.py --only aimags, then tools/build_data.py)');
  } catch (err) {
    $('tool-loading').hidden = true;
    $('load-error').hidden = false;
    $('load-error').textContent = 'Could not load data: ' + err.message;
    return;
  }
  $('sample-banner').hidden = !DATA.sample;
  readHash(true);
  map = createMap($('stage'), {
    soums: DATA.soums, aimags: DATA.aimags,
    onAimag: selectAimag, onSoum: selectSoum,
    aimagLabel: name => aimagName(name),
    soumLabel: id => soumName(DATA.soumById[id]),
  });
  $('tool-loading').hidden = true;
  fillSearch();
  renderQuestions();   // hides a question that has no data
  render();
  map.layout(false);   // the question tabs made the bar taller: fit the map under it right away
  addEventListener('q:panel-settled', () => map.layout(false));   // the glass panel has risen into place: re-fit the map
})();
})(globalThis.Q = globalThis.Q || {});
