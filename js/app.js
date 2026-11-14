import { analyze } from './stats.js';
import { loadData, slice } from './data.js';
import { drawMap } from './map.js';
import { drawChart } from './chart.js';
import { VARIABLES, byId } from './variables.js';
import { STRINGS, GLOSSARY } from './i18n.js';

const $ = id => document.getElementById(id);

// "Guess first" step: off until the team decides. When false, results and map colours show immediately.
const GUESS_STEP = false;

const state = { lang: 'en', varId: null, soumId: null, from: null, to: null, guess: null, revealed: false };
let DATA, map;

const t = key => STRINGS[state.lang][key];
const tr = obj => obj[state.lang];
const soumName = s => (state.lang === 'mn' ? s.name_mn : s.name_en);
const soumLabel = s => `${soumName(s)}${s.aimag ? ', ' + s.aimag : ''}`;

// ---------- URL state: #v=ndvi_summer&s=12345&from=2001&to=2025&lang=mn ----------

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('lang') === 'mn') state.lang = 'mn';
  if (byId[p.get('v')]) state.varId = p.get('v');
  if (p.get('s') && DATA.soumById[p.get('s')]) state.soumId = p.get('s');
  if (p.get('from')) state.from = +p.get('from');
  if (p.get('to')) state.to = +p.get('to');
  // A shared link opens straight on the result.
  if (state.varId && state.soumId) state.revealed = true;
}

function writeHash() {
  const p = new URLSearchParams();
  if (state.varId) p.set('v', state.varId);
  if (state.soumId) p.set('s', state.soumId);
  if (state.from) p.set('from', state.from);
  if (state.to) p.set('to', state.to);
  if (state.lang !== 'en') p.set('lang', state.lang);
  history.replaceState(null, '', '#' + p.toString());
}

// ---------- formatting ----------

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const fmtP = p => (p < 0.001 ? '< 0.001' : p.toFixed(3));
const signed = (v, d) => (v > 0 ? '+' : '') + fmt(v, d);

// Rate per decade in display units: % of the period average, or units.
function perDecade(v, r, slope) {
  return v.display === 'percent' ? (slope * 10 / r.mean) * 100 : slope * 10;
}
function rateUnit(v) {
  if (v.display === 'percent') return '%';
  return v.unitName ? ' ' + tr(v.unitName) : ' ' + v.unit;
}

function speedText(v, r) {
  const rate = perDecade(v, r, r.sen.slope);
  const d = v.display === 'percent' ? 1 : v.id === 'first_frost' ? 1 : 2;
  if (r.direction === 'flat') return `${t('noChange')} (${r.first}–${r.last})`;
  const word = v.id === 'first_frost'
    ? (r.direction === 'up' ? t('frostLater') : t('frostEarlier'))
    : (r.direction === 'up' ? t('rose') : t('fell'));
  const since = state.lang === 'mn' ? `${r.first} ${t('since')}` : `${t('since')} ${r.first}`;
  return `${word} ${fmt(Math.abs(rate), d)}${rateUnit(v)} ${t('perDecade')}, ${since}`;
}

function verdictKey(r) {
  if (!r.ok) return 'no-data';
  if (r.level === 'not-proven' || r.direction === 'flat') return 'not-proven';
  return `${r.level}-${r.direction}`;
}

// ---------- rendering ----------

function renderStatic() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  $('lang-toggle').textContent = t('lang');
  $('soum-search').placeholder = t('searchSoum');
  $('limits-list').replaceChildren(...t('limits').map(s => Object.assign(document.createElement('li'), { textContent: s })));
  $('glossary-list').replaceChildren(...GLOSSARY.flatMap(g => {
    const [term, def] = g[state.lang];
    return [Object.assign(document.createElement('dt'), { textContent: term }),
      Object.assign(document.createElement('dd'), { textContent: def })];
  }));
  $('soum-list').replaceChildren(...DATA.soums.map(s => Object.assign(document.createElement('option'), { value: soumLabel(s) })));

  $('variable-buttons').replaceChildren(...VARIABLES.filter(v => DATA.series[v.id]).map(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'variable-button';
    b.dataset.var = v.id;
    b.setAttribute('role', 'radio');
    b.innerHTML = '<span class="variable-question"></span><span class="variable-name"></span>';
    b.querySelector('.variable-question').textContent = tr(v.question);
    b.querySelector('.variable-name').textContent = `${tr(v.name)} · ${tr(v.season)}`;
    b.addEventListener('click', () => selectVariable(v.id));
    return b;
  }));
}

function render() {
  const v = state.varId && byId[state.varId];
  const soum = state.soumId && DATA.soumById[state.soumId];

  document.querySelectorAll('.variable-button').forEach(b => {
    const on = b.dataset.var === state.varId;
    b.classList.toggle('is-selected', on);
    b.setAttribute('aria-checked', on);
  });
  if (soum && document.activeElement !== $('soum-search')) $('soum-search').value = soumLabel(soum);

  // Year sliders follow the chosen variable's record.
  if (v) {
    const [lo, hi] = DATA.yearRange[v.id];
    for (const id of ['year-from', 'year-to']) { $(id).min = lo; $(id).max = hi; $(id).disabled = false; }
    $('year-from').value = state.from; $('year-to').value = state.to;
    $('year-from-out').textContent = state.from; $('year-to-out').textContent = state.to;
  } else {
    $('year-from').disabled = $('year-to').disabled = true;
  }

  const ready = Boolean(v && soum);
  const shown = state.revealed || !GUESS_STEP;
  $('pick-first').hidden = ready;
  $('guess').hidden = !GUESS_STEP || !ready || shown;
  $('result').hidden = !ready || !shown;
  if (v) { $('guess-up').textContent = cap(tr(v.up)); $('guess-down').textContent = cap(tr(v.down)); }

  // With the guess step on, map colours wait for the reveal so they do not give the answer away.
  let verdicts = null;
  if (v && shown) {
    verdicts = {};
    for (const s of DATA.soums) {
      const part = slice(DATA.series[v.id][s.id], state.from, state.to);
      verdicts[s.id] = verdictKey(analyze(part.years, part.values));
    }
  }
  map.update({ selectedId: state.soumId, verdicts });
  $('map-legend').hidden = !verdicts;
  if (v) {
    $('legend-real-up').textContent = `${t('real')}: ${tr(v.up)}`;
    $('legend-possible-up').textContent = `${t('possible')}: ${tr(v.up)}`;
    $('legend-not-proven').textContent = t('notProven');
    $('legend-possible-down').textContent = `${t('possible')}: ${tr(v.down)}`;
    $('legend-real-down').textContent = `${t('real')}: ${tr(v.down)}`;
  }

  if (ready && shown) renderResult(v, soum);
  writeHash();
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function renderResult(v, soum) {
  const part = slice(DATA.series[v.id][soum.id], state.from, state.to);
  const r = analyze(part.years, part.values);
  $('result').dataset.verdict = verdictKey(r);

  $('too-short').hidden = r.ok;
  $('result-body').hidden = !r.ok;
  if (!r.ok) {
    $('too-short').textContent = `${t('tooShort')} ${r.n} ${t('years')}.`;
    $('guess-feedback').textContent = '';
    return;
  }

  const unit = v.unitName ? tr(v.unitName) : v.unit;
  drawChart($('chart'), r, { decimals: v.decimals, unit, labels: { title: `${tr(v.name)}, ${soumName(soum)}` } });

  const levelText = { real: t('real'), possible: t('possible'), 'not-proven': t('notProven') }[r.level];
  const levelP = { real: t('realP'), possible: t('possibleP'), 'not-proven': t('notProvenP') }[r.level];
  $('v-what').textContent = `${tr(v.name)}, ${soumLabel(soum)} (${r.first}–${r.last})`;
  $('v-speed').textContent = speedText(v, r);
  $('v-real').textContent = `${levelText}: ${levelP} (p = ${fmtP(r.mk.p)})`;
  $('v-real').dataset.level = r.level;
  $('v-meaning').textContent = { real: t('meaningReal'), possible: t('meaningPossible'), 'not-proven': t('meaningNotProven') }[r.level];
  $('disagree-note').hidden = !r.testsDisagree;
  $('level-note').textContent = v.level === 'regional' ? t('regional') : v.level === 'point' ? t('point') : '';
  $('level-note').hidden = v.level === 'soum';

  // Guess feedback.
  const said = r.level === 'not-proven' || r.direction === 'flat' ? 'flat' : r.direction;
  const saidText = said === 'flat' ? t('notProven') : `${levelText}: ${tr(v[said])}`;
  if (state.guess && state.guess !== 'skip') {
    const guessText = state.guess === 'flat' ? t('guessFlat') : cap(tr(v[state.guess]));
    $('guess-feedback').textContent =
      `${t('youGuessed')}: ${guessText}. ${t('dataSays')}: ${saidText}. ${state.guess === said ? t('guessRight') : t('guessWrong')}`;
    $('guess-feedback').dataset.match = state.guess === said;
  } else {
    $('guess-feedback').textContent = '';
    delete $('guess-feedback').dataset.match;
  }

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
    const tr_ = document.createElement('tr');
    tr_.append(Object.assign(document.createElement('th'), { textContent: k, scope: 'row' }),
      Object.assign(document.createElement('td'), { textContent: val }));
    return tr_;
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
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
  a.download = `${v.id}_${soum.id}_${r.first}-${r.last}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- actions ----------

function selectVariable(id) {
  if (state.varId !== id) {
    state.varId = id;
    [state.from, state.to] = DATA.yearRange[id];
    state.revealed = false; state.guess = null;
  }
  render();
}

function selectSoum(id) {
  if (state.soumId !== id) { state.soumId = id; state.revealed = false; state.guess = null; }
  render();
}

function wire() {
  $('lang-toggle').addEventListener('click', () => { state.lang = state.lang === 'en' ? 'mn' : 'en'; renderStatic(); render(); });

  $('soum-search').addEventListener('change', e => {
    const q = e.target.value.trim().toLowerCase();
    const hit = DATA.soums.find(s => soumLabel(s).toLowerCase() === q)
      || DATA.soums.find(s => [s.name_en, s.name_mn, s.aimag].some(n => n.toLowerCase().startsWith(q)));
    if (hit) selectSoum(hit.id);
  });

  const onYears = which => e => {
    let from = +$('year-from').value, to = +$('year-to').value;
    if (from > to) { if (which === 'from') to = from; else from = to; }
    state.from = from; state.to = to;
    render();
  };
  $('year-from').addEventListener('input', onYears('from'));
  $('year-to').addEventListener('input', onYears('to'));

  document.querySelectorAll('[data-guess]').forEach(b => b.addEventListener('click', () => {
    state.guess = b.dataset.guess; state.revealed = true; render();
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  $('share').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); $('share').textContent = t('copied'); }
    catch { /* clipboard blocked: the address bar already holds the link */ }
    setTimeout(() => { $('share').textContent = t('share'); }, 1500);
  });
}

// ---------- start ----------

(async function start() {
  try {
    DATA = await loadData();
  } catch (err) {
    $('load-error').hidden = false;
    $('load-error').textContent = 'Could not load data: ' + err.message +
      '. Open the site through a web server (see README), not as a file.';
    return;
  }
  $('sample-banner').hidden = !DATA.sample;
  readHash();
  if (state.varId && (state.from == null || state.to == null)) [state.from, state.to] = DATA.yearRange[state.varId];
  map = drawMap($('map'), DATA.soums, { onSelect: selectSoum, label: soumLabel });
  renderStatic();
  wire();
  render();
})();
