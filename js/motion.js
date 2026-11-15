// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Motion in the style of loopsii.com, with no libraries:
// short loading screen, tile grid whose shapes slide cell to cell, rotating headline word, header that turns into a pill,
// words rising into view, sections revealing on scroll.
// Everything stops or shortens when the visitor has asked for reduced motion.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
// Timer instead of requestAnimationFrame: rAF pauses in background or throttled tabs and would freeze motion.
const later = fn => setTimeout(fn, 34);

// ---------- loader ----------
// The loading screen covers only the page's own first moment: the mark draws itself (about one second, css/site.css
// .loader-mark) and the screen slides away. It never waits for the NASA data, which keeps loading behind it and fills
// the map when it arrives; if the page itself was slow to arrive, the screen goes at once.
function runLoader(done) {
  const MARK_MS = reduced ? 0 : 1000;
  const wait = Math.max(reduced ? 0 : 150, MARK_MS - performance.now());
  setTimeout(() => {
    document.body.classList.add('is-loaded');
    document.body.classList.remove('is-loading');
    done();
  }, wait);
}

// ---------- hero tiles ----------
// Each cell is empty (_), a solid colour block, one of the ornament tiles, or the logo slot (L, the centre).
// No tile looks like the logo (no mountain with a spiral), so the logo is never mistaken for an ornament.
const T = name => ({ img: `assets/tiles/${name}.svg` });
const S = c => ({ solid: c });
// Bayasakh's figures (js/figures.js) on a solid block: cream on the strong colours, the matching strong colour on light ones.
const F = (c, fig, fc) => ({ solid: c, fig, fc });
const CREAM = '#F6F1E7';
const POOL = {
  twinPink: F('#EDD3C6', 'twin', '#B9431C'), sunGrey: F('#D7DAE0', 'sun', '#3A68BD'), cloudSage: F('#D2DBCF', 'cloud', '#2E7A57'),
  windClay: F('#B9431C', 'wind', CREAM), swirlBlue: F('#3A68BD', 'swirl', CREAM), aaruulSage: F('#D2DBCF', 'aaruul', '#2E7A57'),
  sunPink: F('#EDD3C6', 'sun', '#B9431C'), aaruulInk: F('#15213B', 'aaruul', CREAM), windSage: F('#D2DBCF', 'wind', '#2E7A57'),
  crest: T('uulen-crest'), quarter: T('ever-quarter'), horns: T('ever-pair'), seal: T('seal-hooks'), ring: T('seal-hammer'),
  meander: T('alkhan-square'), keyband: T('alkhan-band'),
  blue: S('#3A68BD'), ink: S('#15213B'), green: S('#2E7A57'), clay: S('#B9431C'), sage: S('#D2DBCF'), grey: S('#D7DAE0'), pink: S('#EDD3C6'),
};
// 11 x 3, so there is a true centre cell for the logo (like loopsii). Phones use the middle 5 columns.
const COLS = 11, PHONE_FIRST = 3, PHONE_COLS = 5;
const LAYOUT = `
  crest     twinPink quarter    _       seal    sunGrey ring   keyband   _     horns    quarter
  cloudSage meander  _          windClay quarter L      green  swirlBlue seal  _        grey
  _         blue     aaruulSage meander sunPink green   _      aaruulInk clay  windSage crest`.trim().split(/\s+/).map(k => (k === '_' ? null : k));
let gridCols = COLS;

// Each block grows from small to full out of one of its corners, in a diagonal wave (loopsii-style).
const CORNERS = [['0%', '0%'], ['100%', '0%'], ['0%', '100%'], ['100%', '100%']];
function face(item) {
  const f = document.createElement('div');
  f.className = 'tile-face' + (item.solid ? ' solid' : '') + (item.fig ? ' fig' : '');
  if (item.fig) f.innerHTML = Q.figures.svg(item.fig, item.fc);
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
function startTiles() {
  const grid = $('hero-tiles');
  if (!grid) return;
  grid.classList.add('is-in');
  startSlides(grid);
}

// ---------- tile slides (in the style of loopsii.com) ----------
// After the intro wave the shapes keep sliding, at full size, exactly one cell up, down, left or right into an empty
// neighbouring cell. Each step fills nearly every empty cell at once (a neighbour slides in; going up or down, the
// tile behind it follows, up to two in a row). Up and down are picked five times as often as left and right, and a
// tile never slides straight back where it just came from. Three steps forward, then the same three played backwards,
// so the grid always returns to its designed layout. The logo slot (L) is never entered.
// Timing: a slide takes 0.5s (ease-in-out), then 0.2s of rest; while the page scrolls, steps come faster.
// It runs only while the tiles are on screen and the tab is visible.
const SLIDE = { ms: 500, hold: 200, fastMs: 340, fastHold: 40, forward: 3, upDown: 5, run: 2, scrollMs: 250, introMs: 1600 };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
let slides = null, slideSeen = true, lastScroll = -1e9;
function startSlides(grid) {
  clearTimeout(slides && slides.timer);
  grid.classList.remove('is-live');
  slides = null;
  if (reduced) return;
  const tiles = [], blocked = new Set();
  tileCells.forEach((cell, i) => {
    const col = i % gridCols, row = Math.floor(i / gridCols);
    if (cell.classList.contains('logo-slot')) blocked.add(col + ':' + row);
    else if (cell.firstChild) tiles.push({ face: cell.firstChild, col0: col, row0: row, col, row, last: null });
  });
  slides = { grid, tiles, blocked, rows: tileCells.length / gridCols, history: [], back: false, timer: 0 };
  if (!startSlides.watching) {   // set up once; the grid element itself is kept when the layout is rebuilt
    startSlides.watching = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { slideSeen = e.isIntersecting; nextSlide(); }, { rootMargin: '120px' }).observe(grid);
    }
    document.addEventListener('visibilitychange', () => nextSlide());
    addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
  }
  const s = slides;
  s.timer = setTimeout(() => { if (slides !== s) return; s.timer = 0; grid.classList.add('is-live'); nextSlide(); }, SLIDE.introMs);
}

// Schedule the next step, unless one is already waiting, the tiles are off screen or the tab is hidden.
function nextSlide(wait = 0) {
  const s = slides;
  if (!s || s.timer || !s.grid.classList.contains('is-live') || !slideSeen || document.hidden) return;
  s.timer = setTimeout(() => {
    s.timer = 0;
    if (slides !== s || !slideSeen || document.hidden) return;
    const fast = performance.now() - lastScroll < SLIDE.scrollMs;
    s.grid.style.setProperty('--slide', (fast ? SLIDE.fastMs : SLIDE.ms) + 'ms');
    moveTiles(s, slideStep(s));
    nextSlide(fast ? SLIDE.fastMs + SLIDE.fastHold : SLIDE.ms + SLIDE.hold);
  }, wait);
}

// The moves of the next step: forward steps are planned from where the tiles are now; backward steps undo them.
function slideStep(s) {
  if (!s.back && s.history.length < SLIDE.forward) {
    const moves = planSlides(s);
    s.history.push(moves);
    if (s.history.length === SLIDE.forward) s.back = true;
    return moves;
  }
  const moves = s.history.pop().map(m => ({ tile: m.tile, col: m.fromCol, row: m.fromRow, fromCol: m.col, fromRow: m.row }));
  if (!s.history.length) { s.back = false; s.tiles.forEach(t => { t.last = null; }); }
  return moves;
}

function planSlides(s) {
  const key = (c, r) => c + ':' + r;
  const at = new Map(s.tiles.map(t => [key(t.col, t.row), t]));
  const inside = (c, r) => c >= 0 && c < gridCols && r >= 0 && r < s.rows;
  const holes = [];
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < gridCols; c++) if (!at.has(key(c, r)) && !s.blocked.has(key(c, r))) holes.push([c, r]);
  for (let i = holes.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [holes[i], holes[j]] = [holes[j], holes[i]]; }
  const used = new Set(), moves = [];
  for (const [c, r] of holes) {
    // A neighbour that can slide into this hole; [dx, dy] points from the hole to it.
    const options = DIRS.filter(([dx, dy]) => {
      const n = at.get(key(c + dx, r + dy));
      return n && !used.has(n) && !(n.last && n.last[0] === dx && n.last[1] === dy);   // not straight back
    });
    if (!options.length) continue;
    let pick = Math.random() * options.reduce((sum, [, dy]) => sum + (dy ? SLIDE.upDown : 1), 0), dir = options[0];
    for (const o of options) { pick -= o[1] ? SLIDE.upDown : 1; if (pick < 0) { dir = o; break; } }
    const [dx, dy] = dir;
    // The neighbour slides into the hole; going up or down, the tile behind it follows into its place.
    for (let k = 0, x = c + dx, y = r + dy; k < (dy ? SLIDE.run : 1) && inside(x, y); k++, x += dx, y += dy) {
      const t = at.get(key(x, y));
      if (!t || used.has(t)) break;
      used.add(t);
      moves.push({ tile: t, fromCol: x, fromRow: y, col: x - dx, row: y - dy });
    }
  }
  return moves;
}

// Each face stays in its own cell and is moved with a translate of whole cells (css: .hero-tiles.is-live .tile-face).
function moveTiles(s, moves) {
  for (const m of moves) {
    const t = m.tile;
    t.col = m.col; t.row = m.row; t.last = [m.col - m.fromCol, m.row - m.fromRow];
    t.face.style.setProperty('--x', t.col - t.col0);
    t.face.style.setProperty('--y', t.row - t.row0);
  }
}

// ---------- the logo's scroll story (in the style of loopsii.com) ----------
// Scrolling down: the logo leaves the centre of the tile grid and holds in the middle of the screen, so on the page it
// travels straight down, and grows. It then holds alone for a moment, and the glass map panel rises over it with the
// scroll while the logo, pinned behind the glass, blurs and dims. The hold and the rise follow the scroll exactly and
// play backwards when scrolling up.
// Scrolling up above the hold: the logo never flies back up. It leaves the middle at once and blooms back in its own
// tile, glued to the tiles, and the page glides back to the top, so the stretch between the tiles and the hold is never
// a place to stop. Back at the very top the trip is ready to play again.
// The trip and the tool's rise follow the scroll softly (each frame closes part of the gap, like loopsii's smooth
// scrolling), so fast scrolling never makes anything jump.
function initTraveler() {
  const t = $('travel-logo'), disc = t && t.firstElementChild, tool = $('tool'), stage = $('stage') || tool;
  const header = document.querySelector('.site-header');
  if (!t || !disc || !tool) return {};
  const clamp = v => Math.min(1, Math.max(0, v));
  const smooth = p => p * p * (3 - 2 * p);
  const easeOut = p => 1 - (1 - p) * (1 - p);
  const pageTop = el => { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y; };   // ignores transforms

  // Where the tool rests: the top of the map box 12px under the slim header. (The header is in the page flow and gets
  // shorter once you scroll, so its current height is part of the sum.)
  const toolRest = () => Math.max(0, pageTop(stage) - (header ? header.offsetHeight : 0) - 12);

  // The reveal after the trip: the logo holds alone for a moment (at most HOLD x screen height), then the glass map panel
  // (the stage) rises over it, from its top at the bottom edge of the screen (riseStart) to its resting place (riseEnd).
  // It rises faster than the page scrolls (RISE: half a screen of scrolling for a whole screen of rise), so the reveal
  // is short; it is held lower by a transform that shrinks to nothing at the resting place. Meanwhile the logo stays
  // pinned behind it, blurring and dimming. All of it follows the scroll position.
  const HOLD = 0.12, RISE = 0.5, BLUR = 16, DIM = 0.5, MAP_IN = 0.6;   // MAP_IN: the map fades in over the last 40% of the rise
  // Settled, the glass (css .stage: blur 14px, saturate 1.15) stops blurring the page; the logo carries that blur itself.
  // Two blurs add up as sqrt(16^2 + 14^2) = 21.3px, so it looks the same.
  const CALM = 'blur(21.3px) saturate(1.15)';
  function geo() {
    const slot = $('hero-logo-slot');
    if (!slot) return null;
    const r = slot.getBoundingClientRect(), vh = innerHeight, vw = innerWidth;
    const y0 = r.top + scrollY + r.height / 2, mid = vh / 2;
    const big = Math.min(vw * 0.46, vh * 0.46, 440);                  // its size once it is alone in the middle
    const leave = Math.max(vh * 0.25, 2 * (y0 - mid));                // leaves the grid at the page's speed, then holds at the middle
    const riseEnd = toolRest(), riseStart = Math.min(riseEnd - 1, riseEnd - RISE * (riseEnd - (pageTop(stage) - vh)));
    return { x: r.left + r.width / 2, y0, size0: r.width, vh, mid, big, leave, riseStart, riseEnd,
      holdStart: Math.max(leave, riseStart - vh * HOLD) };             // the logo is alone and full size from here on
  }

  // 'trip': plays the story; 'gone': after the puff; 'home': rests in its tile and scrolls with the page.
  let mode = reduced ? 'home' : 'trip';
  function setLogo(cx, cy, size, big) {   // the element is drawn at its largest size and scaled, so it stays sharp
    const k = size / big;
    t.style.width = t.style.height = big.toFixed(1) + 'px';
    t.style.transform = `translate3d(${(cx - big * k / 2).toFixed(1)}px, ${(cy - big * k / 2).toFixed(1)}px, 0) scale(${k.toFixed(4)})`;
  }

  // Logo blur and dim (the logo element only), the map fading in, and the map ignoring input until the panel is in place.
  let veiled = false, settled = null;
  function reveal(p) {
    const on = p > 0;
    if (on || veiled) {
      disc.style.filter = !on ? '' : p >= 1 ? CALM : `blur(${(BLUR * smooth(p)).toFixed(2)}px)`;
      disc.style.opacity = on ? (1 - (1 - DIM) * smooth(p)).toFixed(3) : '';
    }
    t.classList.toggle('is-veiled', on);   // no CSS transition on filter/opacity while they follow the scroll
    veiled = on;
    stage.style.setProperty('--map-in', clamp((p - MAP_IN) / (1 - MAP_IN)).toFixed(3));
    const now = p >= 1;
    if (now === settled) return;
    settled = now;
    stage.classList.toggle('is-rising', !now);
    stage.classList.toggle('is-calm', now);   // css: no live glass blur once settled
    if (now) dispatchEvent(new Event('q:panel-settled'));   // js/app.js re-fits the map
  }

  function draw(s) {
    const g = geo();
    if (!g) return;
    if (mode === 'home') {
      t.classList.add('is-home');          // position: absolute, so it moves exactly with its tile
      setLogo(g.x + scrollX, g.y0, g.size0, g.big);
    } else {
      t.classList.remove('is-home');       // position: fixed, held on screen while the page scrolls under it
      // Once the panel has settled, the logo stays behind its middle and scrolls away with it.
      const y = g.y0 + (g.mid - g.y0) * easeOut(clamp(s / g.leave)) - Math.max(0, s - g.riseEnd);
      const size = g.size0 + (g.big - g.size0) * smooth(clamp((s - g.leave * 0.4) / (g.holdStart - g.leave * 0.4)));
      setLogo(g.x, y, size, g.big);
    }
    // The panel's extra drop while it rises: at riseStart its top is at the bottom edge of the screen, at riseEnd none.
    const drop = reduced ? 0 : Math.max(0, g.riseEnd - s) * (1 / RISE - 1);
    stage.style.transform = drop > 0.5 ? `translate3d(0, ${drop.toFixed(1)}px, 0)` : '';
    if (reduced) {   // no reveal: the panel simply crossfades in once it is well into the screen
      stage.classList.add('is-calm');   // the logo stays in its tile, so there is nothing behind the glass to blur
      stage.classList.toggle('is-faded', s < g.riseStart + g.vh * 0.2);
      return;
    }
    reveal(mode === 'home' ? 0 : clamp((s - g.riseStart) / (g.riseEnd - g.riseStart)));
  }

  // Where the trip draws the logo (centre y on screen) for scroll position q.
  const tripY = (g, q) => g.y0 + (g.mid - g.y0) * easeOut(clamp(q / g.leave));
  // Switch modes without a jump: if the logo would land more than a few pixels away, hide it at once, move it, and let
  // it bloom in at its new place (the puff in reverse).
  function switchTo(next, g) {
    const before = mode === 'home' ? g.y0 - scrollY : tripY(g, shown);
    mode = next;
    const after = mode === 'home' ? g.y0 - scrollY : tripY(g, shown);
    if (Math.abs(after - before) < 6) { draw(shown); return; }
    t.classList.add('no-anim', 'is-gone');
    getComputedStyle(disc).opacity;        // apply the instant hide before moving
    draw(shown);
    getComputedStyle(t).transform;
    t.classList.remove('no-anim', 'is-gone');
  }


  // Glide: a quick, smooth scroll to y. Wheel or trackpad movement in the same direction is held back during the
  // glide and until the flick has died out, so it cannot push past the resting place; movement the other way, a key,
  // or a new touch takes over. A glide asked for while a finger is still on the screen starts when it lifts.
  let gliding = false, glideDir = 0, hold = false, holdT = 0, holdUntil = 0, touching = false, pending = null;
  // Hold for at least ms more (a catch at the tool asks for longer than the end of a glide).
  const settle = (ms = 180) => {
    holdUntil = Math.max(holdUntil, performance.now() + ms);
    clearTimeout(holdT); holdT = setTimeout(() => { hold = false; }, holdUntil - performance.now());
  };
  const takeOver = () => { gliding = false; hold = false; holdUntil = 0; };
  // A scroll by wheel, trackpad or finger (not a link, a key or a glide): only those are caught at the tool.
  let userScroll = false;
  // The tool's resting place catches the scroll: a flick that would carry past it (down from the reveal, or up from the
  // page below) stops there, with the questions, years and search in view, and the rest of that flick is held back.
  // The next scroll goes on as usual.
  const CATCH_MS = 1000;
  // Wide screens, at the tool: small wheel or trackpad movements are taken up before the page moves on (STICK px in a
  // row), so the map stays put unless the scroll is meant. Not on phones, where the result sits below the map and
  // is read by scrolling; never inside something that scrolls itself (the result card, the image dialog).
  const STICK = 260, wide = matchMedia('(min-width: 761px)');
  let stuck = 0, stuckT = 0;
  const scrollsInside = (el, dy) => {
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1
        && (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0)) return true;
    }
    return false;
  };
  function catchAt(y, dir) {
    if (touching) { pending = y; return; }   // a finger is still on the screen: settle there once it lifts
    scrollTo({ top: y, behavior: 'instant' });
    gliding = false; hold = true; glideDir = dir; settle(CATCH_MS);
  }
  function glide(y) {
    if (touching) { pending = y; return; }
    if (reduced) { scrollTo({ top: y, behavior: 'instant' }); return; }
    const from = scrollY, dist = y - from;
    if (Math.abs(dist) < 2) return;
    const start = performance.now(), ms = Math.min(700, 320 + Math.abs(dist) * 0.2);
    gliding = hold = true; glideDir = Math.sign(dist);
    const step = now => {
      if (!gliding) return;
      const p = Math.min(1, (now - start) / ms);
      scrollTo({ top: from + dist * (1 - Math.pow(1 - p, 3)), behavior: 'instant' });
      if (p < 1) requestAnimationFrame(step); else { gliding = false; settle(); }
    };
    requestAnimationFrame(step);
  }
  addEventListener('wheel', e => {
    userScroll = true;
    if (!gliding && !hold && wide.matches && !reduced && Math.abs(scrollY - toolRest()) < 2 && !scrollsInside(e.target, e.deltaY)) {
      stuck += Math.abs(e.deltaY) * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      clearTimeout(stuckT); stuckT = setTimeout(() => { stuck = 0; }, 450);   // a pause starts the count again
      if (stuck < STICK) { e.preventDefault(); return; }
    }
    if (!gliding && !hold) return;
    if (Math.sign(e.deltaY) !== glideDir) { takeOver(); return; }
    e.preventDefault();
    if (!gliding) settle();
  }, { passive: false });
  addEventListener('touchstart', () => { touching = true; takeOver(); }, { passive: true });
  addEventListener('touchmove', () => { userScroll = true; }, { passive: true });
  const lift = () => { touching = false; if (pending != null) { const y = pending; pending = null; glide(y); } else { clearTimeout(idleT); idleT = setTimeout(idle, 160); } };
  addEventListener('touchend', lift, { passive: true });
  addEventListener('touchcancel', lift, { passive: true });
  addEventListener('keydown', takeOver);

  // Follow the scroll softly; a long jump (a link, a reload) snaps. The stretch between the tiles and the hold is
  // only ever passed through, never a place to stop: stopping in it going down glides on to the hold, and going up
  // anywhere in it glides back to the top.
  let target = scrollY, shown = scrollY, raf = 0, lastY = scrollY;
  const tick = () => {
    const gap = target - shown;
    shown = Math.abs(gap) < 0.5 || Math.abs(gap) > innerHeight * 1.5 ? target : shown + gap * 0.2;
    draw(shown);
    raf = shown === target ? 0 : requestAnimationFrame(tick);
  };
  // Two places to stop above the hold: the top (the hero) and the hold. The stretch between them always ends at one.
  // The panel's rise never stops half-way either: going down it finishes (the tool in place), going up it goes back.
  let idleT = 0, lastDir = 1;
  function settleGap() {
    if (gliding || touching || pending != null) return;
    const y = scrollY, g = geo();
    if (!g) return;
    if (!reduced && y > g.riseStart + 1 && y < g.riseEnd - 2) { glide(lastDir > 0 || g.riseEnd - y < 40 ? g.riseEnd : g.holdStart); return; }
    if (reduced || y <= g.leave || y >= g.holdStart - 2) return;    // in the hero, or in the hold / reveal: fine to stop
    glide(g.holdStart - y < 40 || lastDir > 0 ? g.holdStart : 0);   // going down: the logo alone; else the top
  }
  const idle = () => { userScroll = false; settleGap(); };   // scrolling has stopped
  const follow = () => {
    let y = scrollY;
    const g = geo();
    // Passing the tool's resting place in one scroll (not a jump: a link or a reload moves further): stop there.
    if (g && userScroll && !gliding && Math.abs(y - lastY) < innerHeight) {
      const rest = g.riseEnd;
      if ((lastY < rest - 1 && y > rest + 1) || (lastY > rest + 1 && y < rest - 1)) { catchAt(rest, Math.sign(y - lastY)); y = scrollY; }
    }
    if (g && !reduced) {
      const up = y < lastY - 1, down = y > lastY;
      if (up) lastDir = -1; else if (down) lastDir = 1;
      // No trip back up, except through the hold and the reveal, which play backwards with the scroll.
      if (up && !gliding && mode !== 'home' && y < g.holdStart) switchTo('home', g);
      if (down && mode === 'home' && !gliding) {
        // Going down from its tile: pick the trip up exactly where the logo is (or bloom in if the tile is already past
        // the middle of the screen), so it never just scrolls away with the tiles.
        const e = g.y0 > g.mid ? y / (g.y0 - g.mid) : 2;
        if (e < 0.98) { shown = (1 - Math.sqrt(1 - e)) * g.leave; mode = 'trip'; }
        else { shown = y; switchTo('trip', g); }
      }
      if (y <= 2 && mode !== 'trip') { mode = 'trip'; shown = target = y; }       // back at the top: ready again (and visible)
      if (!gliding && pending == null && up && y > g.leave && y < g.holdStart - 2) glide(0);
    }
    lastY = y;
    target = y;
    clearTimeout(idleT); idleT = setTimeout(idle, 160);   // scrolling stopped in the stretch or the rise: finish the move
    if (!raf) raf = requestAnimationFrame(tick);
  };

  const refresh = () => { target = shown = lastY = scrollY; draw(shown); };
  addEventListener('scroll', follow, { passive: true });
  addEventListener('resize', refresh);
  if ('ResizeObserver' in window) new ResizeObserver(refresh).observe(document.body);
  refresh();
  return { refresh, drawAt: draw, toTool: () => glide(toolRest()) };
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

let logoDraw = null, logoToTool = null;   // logoAt: draw the logo for any scroll position (for checks); toTool: glide to the tool
function init(onReady) {
  header();
  buildTiles();
  const logo = initTraveler(), place = logo.refresh;
  logoDraw = logo.drawAt; logoToTool = logo.toTool;
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

Q.motion = { init, refresh, startRotator, countUp, observe, logoAt: s => logoDraw && logoDraw(s), toTool: () => logoToTool && logoToTool() };
})(globalThis.Q = globalThis.Q || {});
