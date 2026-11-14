// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Motion in the style of loopsii.com, with no libraries:
// loading counter, tile grid that reshuffles, rotating headline word, header that turns into a pill,
// words rising into view, sections revealing on scroll, connector lines drawing themselves.
// Everything stops or shortens when the visitor has asked for reduced motion.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
// Timer instead of requestAnimationFrame: rAF pauses in background or throttled tabs and would freeze motion.
const later = fn => setTimeout(fn, 34);

// ---------- loader ----------
function runLoader(done) {
  const num = $('loader-num');
  // Timer based (not requestAnimationFrame) so it always finishes, even in a background tab.
  const start = Date.now(), duration = reduced ? 100 : 1700;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    num.textContent = '100';
    document.body.classList.add('is-loaded');
    document.body.classList.remove('is-loading');
    done();
  };
  const timer = setInterval(() => {
    const p = Math.min(1, (Date.now() - start) / duration);
    num.textContent = String(Math.round((1 - Math.pow(1 - p, 3)) * 100)).padStart(3, '0');
    if (p >= 1) setTimeout(finish, reduced ? 0 : 250);
  }, 30);
  setTimeout(finish, duration + 1500);   // safety net
}

// ---------- hero tiles ----------
// Each cell is empty, a solid colour block, or one of nyd's ornament tiles.
const T = name => ({ img: `assets/tiles/${name}.svg` });
const S = c => ({ solid: c });
const POOL = [T('uulen-blue'), T('ever-quarter'), T('uul-line'), T('seal-hooks'), T('alkhan-square'), T('uulen-red'),
  T('ever-pair'), T('uul-fill'), T('seal-hammer'), T('alkhan-band'),
  S('#1D4FA8'), S('#15213B'), S('#2E7A57'), S('#B9431C'), S('#D2DBCF'), S('#D7DAE0'), S('#EDD3C6')];
// 12 x 3 layout from the mockup (null = empty cell, number = index in POOL).
const LAYOUT = [
  null, 0, 1, 16, 2, null, 3, 9, 9, null, 6, 1,
  1, 15, 4, null, 5, 12, null, 7, 13, 8, null, 15,
  14, null, 10, 4, null, 16, null, 11, 13, null, 14, null,
];

function face(item, delay) {
  const f = document.createElement('div');
  f.className = 'tile-face' + (item.solid ? ' solid' : '');
  if (item.solid) f.style.setProperty('--c', item.solid);
  else { const im = document.createElement('img'); im.src = item.img; im.alt = ''; im.loading = 'eager'; f.appendChild(im); }
  f.style.setProperty('--d', delay + 's');
  return f;
}

function buildTiles() {
  const grid = $('hero-tiles');
  if (!grid) return;
  const narrow = matchMedia('(max-width: 760px)').matches;
  const layout = narrow ? LAYOUT.filter((_, i) => i % 12 < 6).concat(LAYOUT.filter((_, i) => i % 12 >= 6).slice(0, 6)) : LAYOUT;
  grid.replaceChildren();
  const cells = layout.map((idx, i) => {
    const cell = document.createElement('div');
    cell.className = 'tile';
    if (idx != null) cell.appendChild(face(POOL[idx], reduced ? 0 : (Math.random() * 0.9).toFixed(2)));
    grid.appendChild(cell);
    return cell;
  });
  for (const c of ['tl', 'tr', 'bl', 'br']) { const s = document.createElement('span'); s.className = 'corner ' + c; grid.appendChild(s); }
  later(() => grid.classList.add('is-in'));
  if (!reduced) setInterval(() => shuffle(cells), 2200);
}

// Swap a filled cell with a random other cell, like the loopsii hero.
function shuffle(cells) {
  if (document.hidden) return;
  const filled = cells.filter(c => c.firstChild);
  const a = filled[Math.floor(Math.random() * filled.length)];
  const b = cells[Math.floor(Math.random() * cells.length)];
  if (!a || a === b) return;
  const fa = a.firstChild, fb = b.firstChild;
  [fa, fb].forEach(f => f && f.classList.add('is-out'));
  setTimeout(() => {
    if (fa) { fa.style.setProperty('--d', '0s'); b.appendChild(fa); }
    if (fb) { fb.style.setProperty('--d', '0s'); a.appendChild(fb); }
    later(() => [fa, fb].forEach(f => f && f.classList.remove('is-out')));
  }, 550);
}

// ---------- rotating word ----------
let rotTimer = null;
function startRotator(words, before, after) {
  const word = $('rot-word'), win = word.parentElement;
  $('rot-before').textContent = before;
  $('rot-after').textContent = after;
  // English ends with "?" right after the word; Mongolian has "байна уу?" as its own word.
  $('rot-after').style.marginLeft = /^[?!.]/.test(after) ? '-0.3em' : '';
  $('rot-before').hidden = !before;
  let i = 0;
  const fit = () => { win.style.width = word.offsetWidth + 'px'; };
  word.textContent = words[0];
  fit();
  clearInterval(rotTimer);
  if (reduced) return;
  rotTimer = setInterval(() => {
    word.classList.add('is-leaving');
    setTimeout(() => {
      i = (i + 1) % words.length;
      word.classList.remove('is-leaving');
      word.classList.add('is-entering');
      word.textContent = words[i];
      fit();
      later(() => word.classList.remove('is-entering'));
    }, 450);
  }, 2400);
}

// ---------- split headings into words ----------
function split(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.replaceChildren(...text.split(/(\s+)/).map((w, i) => {
    if (/^\s+$/.test(w)) return document.createTextNode(' ');
    const outer = document.createElement('span'); outer.className = 'word'; outer.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span'); inner.textContent = w; inner.style.setProperty('--d', (i * 0.035).toFixed(3) + 's');
    outer.appendChild(inner);
    return outer;
  }));
}

// ---------- reveal on scroll ----------
// A plain position check on scroll (not IntersectionObserver): it works even when the browser
// skips rendering frames, so content can never stay hidden.
const TARGETS = '[data-reveal], [data-split], .map, #claims-diagram, .steps li';
let started = false, pending = [], checkT = null;
function check() {
  checkT = null;
  const vh = innerHeight;
  pending = pending.filter(el => {
    const r = el.getBoundingClientRect();
    if (r.top < vh * 0.92 && r.bottom > 0) {
      el.classList.add('is-in');
      if (el.id === 'claims-diagram') drawClaimLines();
      return false;
    }
    return true;
  });
}
const schedule = () => { if (!checkT) checkT = setTimeout(check, 60); };
function observe(root = document) {
  if (!started) return;   // reveals start after the loader
  const targets = [...root.querySelectorAll(TARGETS)];
  if (reduced) {
    targets.forEach(el => el.classList.add('is-in'));
    drawClaimLines();
    return;
  }
  for (const el of targets) if (!el.classList.contains('is-in') && !pending.includes(el)) pending.push(el);
  check();
}
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', schedule);

// After a language switch the text is replaced: split headings again and keep visible ones shown.
function refresh() {
  document.querySelectorAll('[data-split]').forEach(el => {
    const wasIn = el.classList.contains('is-in');
    split(el);
    if (wasIn) el.classList.add('is-in');
  });
  observe();
  layoutClaimLines();
}

// ---------- claims connector lines ----------
function layoutClaimLines() {
  const box = $('claims-diagram'), svg = $('claims-lines');
  if (!box || !svg || getComputedStyle(svg).display === 'none') return;
  const r0 = box.getBoundingClientRect();
  const hub = box.querySelector('.claims-hub').getBoundingClientRect();
  const hx1 = hub.left - r0.left, hx2 = hub.right - r0.left, hy = hub.top - r0.top + hub.height / 2;
  const paths = [];
  box.querySelectorAll('.claim').forEach(c => {
    const r = c.getBoundingClientRect();
    const x = r.right - r0.left, y = r.top - r0.top + r.height / 2, mid = (x + hx1) / 2;
    paths.push(`M${x},${y}H${mid}V${hy}H${hx1}`);
  });
  box.querySelectorAll('.claims-verdicts .pill').forEach(p => {
    const r = p.getBoundingClientRect();
    const x = r.left - r0.left, y = r.top - r0.top + r.height / 2, mid = (hx2 + x) / 2;
    paths.push(`M${hx2},${hy}H${mid}V${y}H${x}`);
  });
  svg.setAttribute('viewBox', `0 0 ${r0.width} ${r0.height}`);
  const drawn = box.classList.contains('is-in');
  // Each dashed line sits under a solid "mask" line of the background colour that slides away.
  svg.innerHTML = paths.map(d => `<path d="${d}"/><path class="mask" d="${d}"/>`).join('');
  svg.querySelectorAll('.mask').forEach(m => {
    const L = m.getTotalLength();
    m.style.strokeDasharray = L; m.style.strokeDashoffset = drawn ? -L : 0;
  });
  box.querySelectorAll('.claim, .claims-verdicts .pill').forEach((el, i) => el.style.setProperty('--d', (0.15 + (i % 3) * 0.15) + 's'));
}
function drawClaimLines() {
  layoutClaimLines();
  later(() => document.querySelectorAll('#claims-lines .mask').forEach(m => { m.style.strokeDashoffset = -m.getTotalLength(); }));
}

// ---------- header ----------
function header() {
  const h = document.querySelector('.site-header');
  const on = () => h.classList.toggle('is-scrolled', scrollY > 40);
  addEventListener('scroll', on, { passive: true });
  on();
}

// ---------- counting numbers ----------
function countUp(span) {
  const target = parseFloat(span.dataset.value), dec = +span.dataset.decimals || 0;
  if (reduced || !Number.isFinite(target)) { span.textContent = target.toFixed(dec); return; }
  const start = Date.now(), dur = 900;
  const timer = setInterval(() => {
    const p = Math.min(1, (Date.now() - start) / dur), e = 1 - Math.pow(1 - p, 3);
    span.textContent = (target * e).toFixed(dec);
    if (p >= 1) clearInterval(timer);
  }, 30);
}

function init(onReady) {
  header();
  buildTiles();
  let resizeT;
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(layoutClaimLines, 150); });
  runLoader(() => { started = true; observe(); onReady && onReady(); });
}

Q.motion = { init, refresh, startRotator, countUp, observe };
})(globalThis.Q = globalThis.Q || {});
