// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Two-level SVG map. Overview: every soum of Mongolia, coloured by the direction and size of its trend, with the aimag
// borders on top; on wide screens it takes the left side of the stage and the result panel the right side. Tapping a
// soum zooms to its aimag and opens the soum. (The aimags stay keyboard targets: Tab + Enter opens one.)
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

function createMap(stage, { soums, aimags, onAimag, onSoum, aimagLabel, soumLabel, soumTitle }) {
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
  // Stripes for "possible" trends: the shade of the change with light lines across it. One pattern per shade; the
  // colours come from update(), and layout() keeps the lines the same size on screen at every zoom.
  const defs = el('defs'), hatches = {};
  for (const dir of ['up', 'down']) for (const step of [1, 2, 3]) {
    const pat = el('pattern', { id: `q-hatch-${dir}-${step}`, patternUnits: 'userSpaceOnUse', width: 7, height: 7 });
    const base = el('rect', { width: 7, height: 7 });
    pat.append(base, el('rect', { width: 2.6, height: 7, fill: '#F6F1E7', 'fill-opacity': '.8' }));
    defs.appendChild(pat);
    hatches[`${dir}-${step}`] = { pat, base };
  }
  svg.appendChild(defs);
  const g = el('g', { class: 'map-world' });
  const gAimags = el('g', { class: 'layer-aimags' });
  const gSoums = el('g', { class: 'layer-soums' });
  const gBorders = el('g', { class: 'layer-borders', 'aria-hidden': 'true' });
  const gRings = el('g', { class: 'layer-rings', 'aria-hidden': 'true' });
  const gLabels = el('g', { class: 'layer-labels', 'aria-hidden': 'true' });
  g.append(gAimags, gSoums, gBorders, gRings, gLabels);
  svg.appendChild(g);
  stage.prepend(svg);

  const aPaths = {}, aBoxes = {}, aGroups = {}, aBorders = {}, sPaths = {}, labels = {}, sLabels = {};
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
    // The aimag's border, drawn over its soums.
    aBorders[a.name] = gBorders.appendChild(el('path', { d: p.getAttribute('d'), class: 'aimag-border' }));

    // Label at the point deepest inside the aimag. Tiny aimags (cities) get no label; their name shows on hover.
    const lp = labelPoint(worldRings(a.geometry));
    const t = el('text', { class: 'aimag-label' + (lp.room < 9 ? ' is-tiny' : ''), x: lp.x.toFixed(1), y: lp.y.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    gLabels.appendChild(t);
    labels[a.name] = t;
    t.dataset.room = lp.room;
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
  // Overview: the outlines go above every soum and border (below the aimag names). Zoomed: see update().
  gRings.append(aHover, sHover, sSel);

  let current = { aimag: null, panel: false };
  let scale = 1;

  // Fit a box (world units) into a region of the stage (pixels).
  function fit(box, region, pad) {
    const s = Math.min((region.w - 2 * pad) / box.w, (region.h - 2 * pad) / box.h);
    const tx = region.x + (region.w - box.w * s) / 2 - box.x * s;
    const ty = region.y + (region.h - box.h * s) / 2 - box.y * s;
    return { s, tx, ty };
  }

  const bar = stage.querySelector('.stage-bar'), legend = stage.querySelector('.map-legend'), hint = stage.querySelector('.map-hint');
  const floating = e => e && getComputedStyle(e).position === 'absolute';
  function layout(animate = true) {
    const W = svg.clientWidth || stage.clientWidth, H = svg.clientHeight || stage.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const wide = W >= 760;
    const zoomed = Boolean(current.aimag);
    // On wide screens the bar floats over the top of the map, so the map fits below it.
    const top = floating(bar) ? bar.offsetHeight : 0;
    stage.style.setProperty('--bar-h', top + 'px');
    // With the result panel on a wide screen, the map keeps the left part of the stage, between the hint line at the
    // top and the legend at the bottom (both float over the map there).
    const above = !zoomed && floating(hint) ? hint.offsetHeight + 12 : 0;
    const below = floating(legend) ? legend.offsetHeight + 14 : 0;
    const region = { x: 0, y: top + above, w: wide && current.panel ? W * 0.54 : W, h: Math.max(80, H - top - above - below) };
    const box = zoomed ? aBoxes[current.aimag] : world;
    const f = fit(box, region, zoomed ? Math.min(W, H) * 0.05 : Math.min(W, H) * 0.02);
    scale = f.s;
    g.classList.toggle('no-anim', !animate);
    g.style.transform = `translate(${f.tx.toFixed(1)}px, ${f.ty.toFixed(1)}px) scale(${f.s.toFixed(4)})`;
    for (const h of Object.values(hatches)) h.pat.setAttribute('patternTransform', `rotate(45) scale(${(1 / f.s).toFixed(4)})`);
    // Labels keep a constant on-screen size.
    gLabels.style.fontSize = (11.5 / f.s).toFixed(2) + 'px';
    gSoums.style.fontSize = (10.5 / f.s).toFixed(2) + 'px';
    // Aimag names only where they have room on screen (a small map, as on phones, shows fewer).
    for (const t of Object.values(labels)) t.classList.toggle('is-cramped', t.dataset.room * f.s < 16);
    if (zoomed) for (const id of DATA_IDS(current.aimag)) {
      const L = sLabels[id];
      L.el.classList.toggle('is-hidden', L.room * f.s < (wide ? 15 : 18));   // only where the name has room
    }
    if (!animate) setTimeout(() => g.classList.remove("no-anim"), 50);
  }

  // fills: { soumId: { verdict, shade } } for every soum, where shade is 'up-2' (direction and step 1-3) or ''.
  // palette: { up: [3 colours], down: [3 colours], notProven, noData }. Real trends are filled with their shade, possible
  // ones striped with it, the rest pale.
  function update({ aimag, soumId, panel, fills, palette }) {
    const changed = aimag !== current.aimag || panel !== current.panel;
    current = { aimag, panel };
    stage.classList.toggle('is-zoomed', Boolean(aimag));
    for (const [key, h] of Object.entries(hatches)) { const [dir, step] = key.split('-'); h.base.setAttribute('fill', palette[dir][step - 1]); }
    for (const a of aimags) {
      const p = aPaths[a.name];
      p.classList.toggle('is-open', a.name === aimag);
      p.classList.toggle('is-away', Boolean(aimag) && a.name !== aimag);
      aBorders[a.name].classList.toggle('is-away', Boolean(aimag) && a.name !== aimag);
      p.setAttribute('tabindex', aimag ? '-1' : '0');
      p.firstChild.textContent = aimagLabel(a.name);
      labels[a.name].textContent = aimagLabel(a.name);
      aGroups[a.name].classList.toggle('is-active', a.name === aimag);
    }
    for (const s of soums) {
      const p = sPaths[s.id], f = fills[s.id] || { verdict: 'no-data', shade: '' };
      const [dir, step] = f.shade ? f.shade.split('-') : [];
      p.setAttribute('data-verdict', f.verdict);
      p.style.fill = f.verdict === 'no-data' ? palette.noData : !dir ? palette.notProven
        : f.verdict.startsWith('possible') ? `url(#q-hatch-${f.shade})` : palette[dir][step - 1];
      p.classList.toggle('is-selected', s.id === soumId);
      p.setAttribute('tabindex', s.aimag === aimag ? '0' : '-1');
      p.firstChild.textContent = soumTitle(s.id);
      if (s.aimag === aimag) sLabels[s.id].el.textContent = soumLabel(s.id);
    }
    // Zoomed, the soum outlines live in the open aimag's group: above its soums, below their names.
    if (changed) {
      if (aimag) { aGroups[aimag].insertBefore(sSel, firstLabel[aimag] || null); aGroups[aimag].insertBefore(sHover, firstLabel[aimag] || null); }
      else gRings.append(sHover, sSel);
      showRing(aHover, null); showRing(sHover, null);
    }
    showRing(sSel, soumId ? sPaths[soumId] : null);
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
