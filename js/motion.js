// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Motion in the style of loopsii.com, with no libraries:
// loading counter, tile grid that reshuffles, rotating headline word, header that turns into a pill,
// words rising into view, sections revealing on scroll.
// Everything stops or shortens when the visitor has asked for reduced motion.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
// Timer instead of requestAnimationFrame: rAF pauses in background or throttled tabs and would freeze motion.
const later = fn => setTimeout(fn, 34);

// ---------- loader ----------
function runLoader(done) {
  const num = $('loader-num');
  // Timer based (not requestAnimationFrame) so it always finishes, even in a background tab.
  const start = Date.now(), duration = reduced ? 100 : 1000;
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
    if (p >= 1) setTimeout(finish, reduced ? 0 : 120);
  }, 30);
  setTimeout(finish, duration + 1200);   // safety net
}

// ---------- hero tiles ----------
// Each cell is empty, a solid colour block, one of nyd's ornament tiles, or the logo slot ('L', the centre).
const T = name => ({ img: `assets/tiles/${name}.svg` });
const S = c => ({ solid: c });
const POOL = [T('uulen-blue'), T('ever-quarter'), T('uul-line'), T('seal-hooks'), T('alkhan-square'), T('uulen-red'),
  T('ever-pair'), T('uul-fill'), T('seal-hammer'), T('alkhan-band'),
  S('#3A68BD'), S('#15213B'), S('#2E7A57'), S('#B9431C'), S('#D2DBCF'), S('#D7DAE0'), S('#EDD3C6')];
// 11 x 3, so there is a true centre cell for the logo (like loopsii). Phones use the middle 5 columns.
const COLS = 11, PHONE_FIRST = 3, PHONE_COLS = 5;
const LAYOUT = [
  0, 16, 1, null, 2, 15, 3, 9, null, 6, 1,
  14, 4, null, 13, 5, 'L', 7, 10, 8, null, 15,
  null, 10, 14, 4, 16, 12, null, 11, 13, 14, 2,
];
let gridCols = COLS;

// Each block grows from small to full out of one of its corners, in a diagonal wave (loopsii-style).
const CORNERS = [['0%', '0%'], ['100%', '0%'], ['0%', '100%'], ['100%', '100%']];
function face(item) {
  const f = document.createElement('div');
  f.className = 'tile-face' + (item.solid ? ' solid' : '');
  if (item.solid) f.style.setProperty('--c', item.solid);
  else { const im = document.createElement('img'); im.src = item.img; im.alt = ''; im.loading = 'eager'; f.appendChild(im); }
  const [ox, oy] = CORNERS[Math.floor(Math.random() * 4)];
  f.style.setProperty('--ox', ox); f.style.setProperty('--oy', oy);
  return f;
}

let tileCells = [];
function buildTiles() {
  const grid = $('hero-tiles');
  if (!grid) return;
  const narrow = matchMedia('(max-width: 760px)').matches;
  const layout = narrow ? LAYOUT.filter((_, i) => i % COLS >= PHONE_FIRST && i % COLS < PHONE_FIRST + PHONE_COLS) : LAYOUT;
  gridCols = narrow ? PHONE_COLS : COLS;
  grid.replaceChildren();
  tileCells = layout.map((idx, i) => {
    const cell = document.createElement('div');
    cell.className = 'tile';
    if (idx === 'L') { cell.id = 'hero-logo-slot'; cell.classList.add('logo-slot'); }
    else if (idx != null) {
      const f = face(POOL[idx]);
      const col = i % gridCols, row = Math.floor(i / gridCols);
      f.style.setProperty('--d', reduced ? '0s' : ((col + row) * 0.055 + Math.random() * 0.08).toFixed(3) + 's');
      cell.appendChild(f);
    }
    grid.appendChild(cell);
    return cell;
  });
  for (const c of ['tl', 'tr', 'bl', 'br']) { const s = document.createElement('span'); s.className = 'corner ' + c; grid.appendChild(s); }
}
// Called once the loading screen has gone, so the wave is seen.
let shuffleTimer = null;
function startTiles() {
  const grid = $('hero-tiles');
  if (!grid) return;
  grid.classList.add('is-in');
  clearInterval(shuffleTimer);
  if (!reduced) shuffleTimer = setInterval(() => shuffle(tileCells.filter(c => !c.classList.contains('logo-slot'))), 2400);
}

// Swap a filled cell with another cell: both shrink into a corner, change places, grow back.
function shuffle(cells) {
  if (document.hidden) return;
  const filled = cells.filter(c => c.firstChild);
  const a = filled[Math.floor(Math.random() * filled.length)];
  const b = cells[Math.floor(Math.random() * cells.length)];
  if (!a || a === b) return;
  const fa = a.firstChild, fb = b.firstChild;
  [fa, fb].forEach(f => { if (f) { f.style.setProperty('--d', '0s'); f.classList.add('is-out'); } });
  setTimeout(() => {
    if (fa) b.appendChild(fa);
    if (fb) a.appendChild(fb);
    later(() => [fa, fb].forEach(f => f && f.classList.remove('is-out')));
  }, 600);
}

// ---------- the logo's scroll story (in the style of loopsii.com) ----------
// The logo starts in the centre of the tile grid. As you scroll it leaves the grid and holds in the middle of the
// screen, so on the page it travels straight down; it grows, then dissolves into a soft blur just before the tool
// rises over that spot. Everything is tied to the scroll and runs backwards when you scroll up. The motion trails
// the scroll slightly and settles, like loopsii's smooth scrolling, so fast scrolling never makes anything jump.
function initTraveler() {
  const t = $('travel-logo'), disc = t && t.firstElementChild, tool = $('tool');
  if (!t || !disc || !tool) return {};
  const clamp = v => Math.min(1, Math.max(0, v));
  const smooth = p => p * p * (3 - 2 * p);
  const easeOut = p => 1 - (1 - p) * (1 - p);
  const pageTop = el => { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y; };   // ignores transforms

  // Draw everything for a (smoothed) scroll position s.
  function draw(s) {
    const slot = $('hero-logo-slot');
    if (!slot) return;
    const r = slot.getBoundingClientRect(), vh = innerHeight, vw = innerWidth;
    const x = r.left + r.width / 2, y0 = r.top + scrollY + r.height / 2, size0 = r.width;   // the slot, at scroll 0
    const toolTop = pageTop(tool);
    const mid = vh / 2;
    const leave = Math.max(vh * 0.25, 2 * (y0 - mid));   // leaves the grid at the page's speed, then slows to a hold at the middle
    const gone = toolTop - vh * 0.5;                     // fully dissolved when the tool's top edge reaches the middle
    const fadeFrom = gone - vh * 0.45;                   // dissolving starts here
    const big = Math.min(vw * 0.46, vh * 0.46, 440);     // its size just before it dissolves

    let y, size, k = 1, blur = 0, alpha = 1;
    if (reduced) { y = y0 - s; size = size0; }           // no trip: it simply scrolls away with the tiles
    else {
      y = y0 + (mid - y0) * easeOut(clamp(s / leave));
      size = size0 + (big - size0) * smooth(clamp((s - leave * 0.4) / (fadeFrom - leave * 0.4)));
      const d = clamp((s - fadeFrom) / (gone - fadeFrom));
      k = 1 + 0.7 * smooth(d); blur = 22 * d; alpha = 1 - smooth(d);
    }
    // The element is drawn at its largest size and scaled down, so it stays sharp and only the transform changes.
    t.style.width = t.style.height = big.toFixed(1) + 'px';
    const scale = (size / big) * k;
    t.style.transform = `translate3d(${(x - big * scale / 2).toFixed(1)}px, ${(y - big * scale / 2).toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
    disc.style.opacity = alpha.toFixed(3);
    disc.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : '';
    t.style.visibility = alpha <= 0.001 ? 'hidden' : '';

    // The tool rises into place as the logo goes: from its top at the bottom edge to just over the middle.
    if (reduced) return;
    const rise = clamp((s - (toolTop - vh)) / (vh * 0.55));
    tool.style.opacity = rise >= 1 ? '' : (0.15 + 0.85 * smooth(rise)).toFixed(3);
    tool.style.transform = rise >= 1 ? '' : `translateY(${((1 - easeOut(rise)) * 90).toFixed(1)}px)`;
  }

  // Follow the scroll softly: each frame closes a part of the gap; a long jump (a link, a reload) snaps.
  let target = scrollY, shown = scrollY, raf = 0;
  const tick = () => {
    const gap = target - shown;
    shown = Math.abs(gap) < 0.5 || Math.abs(gap) > innerHeight * 1.5 ? target : shown + gap * 0.14;
    draw(shown);
    raf = shown === target ? 0 : requestAnimationFrame(tick);
  };
  const follow = () => { target = scrollY; if (!raf) raf = requestAnimationFrame(tick); };
  const refresh = () => { target = shown = scrollY; draw(shown); };
  addEventListener('scroll', follow, { passive: true });
  addEventListener('resize', refresh);
  if ('ResizeObserver' in window) new ResizeObserver(refresh).observe(document.body);
  refresh();
  return { refresh, drawAt: draw };
}

// ---------- rotating word ----------
let rotTimer = null, rotSwap = null;
// colors[i] is the colour of words[i]; the whole headline fades smoothly into the next colour as the words swap.
function startRotator(words, before, after, colors = []) {
  const word = $('rot-word'), win = word.parentElement, title = $('hero-title');
  $('rot-before').textContent = before;
  $('rot-after').textContent = after;
  // Two lines in both languages: English "Is it getting / greener?" ("?" sticks to the word);
  // Mongolian "Ногоорч / байна уу?" ("байна уу?" is its own line).
  $('rot-after').classList.toggle('is-line', !/^[?!.]/.test(after));
  $('rot-before').hidden = !before;
  let i = 0;
  const fit = () => { win.style.width = word.offsetWidth + 'px'; };
  // Stop the old rotation completely (also a word swap already on its way), or after a language switch
  // a word from the other language could still slide in.
  clearInterval(rotTimer); clearTimeout(rotSwap);
  word.classList.remove('is-leaving', 'is-entering');
  word.textContent = words[0];
  title.style.color = colors[0] || '';
  fit();
  if (reduced) return;
  rotTimer = setInterval(() => {
    word.classList.add('is-leaving');
    title.style.color = colors[(i + 1) % words.length] || '';   // the colour turns while the old word leaves
    rotSwap = setTimeout(() => {
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
const TARGETS = '[data-reveal], [data-split]';
let started = false, pending = [], checkT = null;
function check() {
  checkT = null;
  const vh = innerHeight;
  pending = pending.filter(el => {
    const r = el.getBoundingClientRect();
    if (r.top < vh - 8 && r.bottom > 0) {   // anything visible on screen, even at the very bottom
      el.classList.add('is-in');
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

let logoDraw = null;   // for checking the logo at any scroll position from the console
function init(onReady) {
  header();
  buildTiles();
  const logo = initTraveler(), place = logo.refresh;
  logoDraw = logo.drawAt;
  // Rebuild the grid only when switching between the phone and desktop layouts.
  let rt, wasNarrow = matchMedia('(max-width: 760px)').matches;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => {
    const narrow = matchMedia('(max-width: 760px)').matches;
    if (narrow !== wasNarrow) { wasNarrow = narrow; buildTiles(); if (started) startTiles(); }
    place && place();
  }, 250); });
  runLoader(() => {
    started = true; observe(); onReady && onReady();
    // The tile wave and the logo start once the loading screen has slid away.
    setTimeout(() => { startTiles(); document.body.classList.add('logo-in'); }, reduced ? 0 : 300);
    // Layout can still settle (fonts, sizes) just after loading: check again so nothing on screen stays hidden.
    [250, 700, 1500, 3000].forEach(ms => setTimeout(() => { check(); place && place(); }, ms));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(() => { check(); place && place(); }, 50));
  });
}

Q.motion = { init, refresh, startRotator, countUp, observe, logoAt: s => logoDraw && logoDraw(s) };
})(globalThis.Q = globalThis.Q || {});
