// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Two-level SVG map. Overview: the 22 aimags fill the stage. Clicking an aimag zooms to it on the
// left side of the stage (the result panel takes the right side) and shows its soums.
// The zoom is a CSS transform on one group, so it animates smoothly; strokes keep their width.
// Shapes never move or grow on hover or click: only colour and outline change.

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

function rings(g) {
  if (g.type === 'Polygon') return g.coordinates;
  if (g.type === 'MultiPolygon') return g.coordinates.flat();
  return [];
}

// Best label point: the sampled point inside the shape that is farthest from its edges.
function labelPoint(polys) {   // polys: array of rings in world units [[x, y], ...]
  let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
  for (const r of polys) for (const [x, y] of r) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); }
  const inside = (x, y) => { let hit = false; for (const r of polys) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < xi + (y - yi) * (xj - xi) / (yj - yi)) hit = !hit; } return hit; };
  const edgeDist = (x, y) => { let m = Infinity; for (const r of polys) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [x1, y1] = r[j], [x2, y2] = r[i], dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L)); m = Math.min(m, Math.hypot(x - x1 - t * dx, y - y1 - t * dy)); } return m; };
  let best = [(a + b) / 2, (c + d) / 2], bestD = -1;
  const N = 18;
  for (let i = 1; i < N; i++) for (let j = 1; j < N; j++) {
    const x = a + (b - a) * i / N, y = c + (d - c) * j / N;
    if (!inside(x, y)) continue;
    const dd = edgeDist(x, y);
    if (dd > bestD) { bestD = dd; best = [x, y]; }
  }
  return { x: best[0], y: best[1], room: bestD };
}

function createMap(stage, { soums, aimags, onAimag, onSoum, aimagLabel, soumLabel }) {
  // Projection to "world units": equirectangular with x stretched by cos(mid latitude).
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const a of aimags) for (const r of rings(a.geometry)) for (const [x, y] of r) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const k = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
  const U = 1000 / ((maxX - minX) * k);
  const px = x => (x - minX) * k * U, py = y => (maxY - y) * U;
  // Borders are softened with one pass of corner cutting (Chaikin): every corner is replaced by two points
  // a quarter of the way along its two sides. Shapes keep their outline; sharp spikes become gentle bends.
  const smooth = ring => {
    const pts = ring.map(([x, y]) => [px(x), py(y)]);
    if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
    if (pts.length < 4) return pts;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      out.push([x1 * 0.75 + x2 * 0.25, y1 * 0.75 + y2 * 0.25], [x1 * 0.25 + x2 * 0.75, y1 * 0.25 + y2 * 0.75]);
    }
    return out;
  };
  const pathOf = g => rings(g).map(r => 'M' + smooth(r).map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2)).join('L') + 'Z').join('');
  const bboxOf = g => {
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    for (const r of rings(g)) for (const [x, y] of r) { const X = px(x), Y = py(y); a = Math.min(a, X); b = Math.max(b, X); c = Math.min(c, Y); d = Math.max(d, Y); }
    return { x: a, y: c, w: b - a, h: d - c };
  };
  const world = { x: 0, y: 0, w: 1000, h: (maxY - minY) * U };
  const worldRings = g => rings(g).map(r => r.map(([x, y]) => [px(x), py(y)]));

  const svg = el('svg', { class: 'map-svg', role: 'group' });
  const g = el('g', { class: 'map-world' });
  const gAimags = el('g', { class: 'layer-aimags' });
  const gSoums = el('g', { class: 'layer-soums' });
  const gLabels = el('g', { class: 'layer-labels', 'aria-hidden': 'true' });
  g.append(gAimags, gSoums, gLabels);
  svg.appendChild(g);
  stage.prepend(svg);

  const aPaths = {}, aBoxes = {}, aGroups = {}, sPaths = {}, labels = {}, sLabels = {};
  const keyActivate = fn => e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  // Hover and selection outlines are separate lines drawn above all shapes (below the names). Drawn on the
  // shape itself, half of the line would hide under the neighbouring shapes and look patchy.
  const ring = cls => el('path', { class: 'ring ' + cls, 'aria-hidden': 'true' });
  const aHover = ring('ring-hover'), sHover = ring('ring-hover'), sSel = ring('ring-selected');
  const showRing = (r, p) => { if (p) r.setAttribute('d', p.getAttribute('d')); r.classList.toggle('is-on', Boolean(p)); };
  const hoverable = (p, r) => {
    const on = () => showRing(r, p), off = () => { if (r.getAttribute('d') === p.getAttribute('d')) showRing(r, null); };
    p.addEventListener('pointerenter', on); p.addEventListener('focus', on);
    p.addEventListener('pointerleave', off); p.addEventListener('blur', off);
  };

  for (const a of aimags) {
    const p = el('path', { d: pathOf(a.geometry), class: 'aimag', tabindex: '0', role: 'button', 'data-aimag': a.name });
    p.appendChild(el('title'));
    p.addEventListener('click', () => onAimag(a.name));
    p.addEventListener('keydown', keyActivate(() => onAimag(a.name)));
    hoverable(p, aHover);
    gAimags.appendChild(p);
    aPaths[a.name] = p;
    aBoxes[a.name] = bboxOf(a.geometry);

    const sg = el('g', { class: 'soum-group', 'data-aimag': a.name });
    gSoums.appendChild(sg);
    aGroups[a.name] = sg;

    // Label at the point deepest inside the aimag. Tiny aimags (cities) get no label; their name shows on hover.
    const lp = labelPoint(worldRings(a.geometry));
    const t = el('text', { class: 'aimag-label' + (lp.room < 9 ? ' is-tiny' : ''), x: lp.x.toFixed(1), y: lp.y.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    gLabels.appendChild(t);
    labels[a.name] = t;
  }
  for (const s of soums) {
    const p = el('path', { d: pathOf(s.geometry), class: 'soum', tabindex: '-1', role: 'button', 'data-id': s.id });
    p.appendChild(el('title'));
    p.addEventListener('click', () => onSoum(s.id));
    p.addEventListener('keydown', keyActivate(() => onSoum(s.id)));
    hoverable(p, sHover);
    (aGroups[s.aimag] || gSoums).appendChild(p);
    sPaths[s.id] = p;
    const lp = labelPoint(worldRings(s.geometry));
    const t = el('text', { class: 'soum-label', x: lp.x.toFixed(2), y: lp.y.toFixed(2), 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'aria-hidden': 'true' });
    sLabels[s.id] = { el: t, room: lp.room, aimag: s.aimag };
  }
  // Soum labels go on top of all soum shapes of their aimag. firstLabel marks where the shapes end.
  const firstLabel = {};
  for (const s of soums) {
    (aGroups[s.aimag] || gSoums).appendChild(sLabels[s.id].el);
    if (!firstLabel[s.aimag]) firstLabel[s.aimag] = sLabels[s.id].el;
  }
  gAimags.appendChild(aHover);   // after every aimag shape; aimag names are in a later layer

  let current = { aimag: null, panel: false };
  let scale = 1;

  // Fit a box (world units) into a region of the stage (pixels).
  function fit(box, region, pad) {
    const s = Math.min((region.w - 2 * pad) / box.w, (region.h - 2 * pad) / box.h);
    const tx = region.x + (region.w - box.w * s) / 2 - box.x * s;
    const ty = region.y + (region.h - box.h * s) / 2 - box.y * s;
    return { s, tx, ty };
  }

  const bar = stage.querySelector('.stage-bar');
  function layout(animate = true) {
    const W = svg.clientWidth || stage.clientWidth, H = svg.clientHeight || stage.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const wide = W >= 760;
    const zoomed = Boolean(current.aimag);
    // On wide screens the bar floats over the top of the map, so the map fits below it.
    const top = bar && getComputedStyle(bar).position === 'absolute' ? bar.offsetHeight : 0;
    stage.style.setProperty('--bar-h', top + 'px');
    // With the result panel open on a wide screen, the map keeps the left part of the stage.
    const region = zoomed && wide && current.panel ? { x: 0, y: top, w: W * 0.54, h: H - top } : { x: 0, y: top, w: W, h: H - top };
    const box = zoomed ? aBoxes[current.aimag] : world;
    const f = fit(box, region, zoomed ? Math.min(W, H) * 0.06 : Math.min(W, H) * 0.03);
    scale = f.s;
    g.classList.toggle('no-anim', !animate);
    g.style.transform = `translate(${f.tx.toFixed(1)}px, ${f.ty.toFixed(1)}px) scale(${f.s.toFixed(4)})`;
    // Labels keep a constant on-screen size.
    gLabels.style.fontSize = (11.5 / f.s).toFixed(2) + 'px';
    gSoums.style.fontSize = (10.5 / f.s).toFixed(2) + 'px';
    if (zoomed) for (const id of DATA_IDS(current.aimag)) {
      const L = sLabels[id];
      L.el.classList.toggle('is-hidden', L.room * f.s < (wide ? 15 : 18));   // only where the name has room
    }
    if (!animate) setTimeout(() => g.classList.remove("no-anim"), 50);
  }

  // aimagVerdicts: { name: verdictKey }, soumVerdicts: { id: verdictKey } (only for the open aimag)
  function update({ aimag, soumId, panel, aimagVerdicts, soumVerdicts }) {
    const changed = aimag !== current.aimag || panel !== current.panel;
    current = { aimag, panel };
    stage.classList.toggle('is-zoomed', Boolean(aimag));
    for (const a of aimags) {
      const p = aPaths[a.name];
      p.setAttribute('data-verdict', aimagVerdicts[a.name] || 'no-data');
      p.classList.toggle('is-open', a.name === aimag);
      p.classList.toggle('is-away', Boolean(aimag) && a.name !== aimag);
      p.setAttribute('tabindex', aimag ? '-1' : '0');
      p.firstChild.textContent = aimagLabel(a.name);
      labels[a.name].textContent = aimagLabel(a.name);
      aGroups[a.name].classList.toggle('is-active', a.name === aimag);
    }
    if (aimag) {
      for (const id of DATA_IDS(aimag)) {
        const p = sPaths[id];
        p.setAttribute('data-verdict', soumVerdicts[id] || 'no-data');
        p.classList.toggle('is-selected', id === soumId);
        p.setAttribute('tabindex', '0');
        p.firstChild.textContent = soumLabel(id);
        sLabels[id].el.textContent = soumLabel(id);
      }
      // The outlines live in the open aimag's group: above its soums, below their names.
      if (changed) {
        aGroups[aimag].insertBefore(sSel, firstLabel[aimag] || null);
        aGroups[aimag].insertBefore(sHover, firstLabel[aimag] || null);
      }
    }
    if (changed) { showRing(aHover, null); showRing(sHover, null); }
    showRing(sSel, aimag && soumId ? sPaths[soumId] : null);
    for (const s of soums) if (s.aimag !== aimag) sPaths[s.id].setAttribute('tabindex', '-1');
    if (changed) layout(true);
  }
  const byAimag = Object.fromEntries(aimags.map(a => [a.name, a.soumIds]));
  const DATA_IDS = name => byAimag[name] || [];

  let rt;
  const relayout = () => { clearTimeout(rt); rt = setTimeout(() => layout(false), 120); };
  addEventListener('resize', relayout);
  if (bar && 'ResizeObserver' in window) new ResizeObserver(relayout).observe(bar);
  layout(false);

  return { update, layout };
}

Q.map = { createMap };
})(globalThis.Q = globalThis.Q || {});
