// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Time series chart as plain SVG: one dot per year, Sen's slope trend line, and the
// 95% confidence band of the straight-line fit. Classes only; CSS sets colours and motion.

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, text) {
  const e = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

function niceTicks(lo, hi, count = 5) {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

function drawChart(container, result, { decimals = 2, unit = '', labels }) {
  const W = 720, H = 360, m = { l: 56, r: 12, t: 28, b: 36 };
  const { x, y, lin, sen } = result;
  const xa = x[0], xb = x[x.length - 1];
  const bandAt = xv => lin.band(xv);
  const fit = xv => lin.intercept + lin.slope * xv;
  const lows = [...y, fit(xa) - bandAt(xa), fit(xb) - bandAt(xb)];
  const highs = [...y, fit(xa) + bandAt(xa), fit(xb) + bandAt(xb)];
  const yMin = Math.min(...lows), yMax = Math.max(...highs), pad = (yMax - yMin) * 0.08 || 1;
  const x0 = xa - 0.6, x1 = xb + 0.6, y0 = yMin - pad, y1 = yMax + pad;
  const sx = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r);
  const sy = v => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': labels.title });
  svg.appendChild(el('title', {}, labels.title));

  const grid = el('g', { class: 'chart-grid' });
  for (const tk of niceTicks(y0, y1)) {
    grid.appendChild(el('line', { x1: m.l, x2: W - m.r, y1: sy(tk), y2: sy(tk) }));
    grid.appendChild(el('text', { x: m.l - 10, y: sy(tk) + 4, 'text-anchor': 'end', class: 'chart-tick' }, tk.toFixed(Math.max(0, decimals))));
  }
  const step = x.length > 30 ? 10 : 5;
  for (let yr = Math.ceil(xa / step) * step; yr <= xb; yr += step) {
    grid.appendChild(el('text', { x: sx(yr), y: H - m.b + 24, 'text-anchor': 'middle', class: 'chart-tick' }, yr));
  }
  grid.appendChild(el('text', { x: m.l, y: 14, class: 'chart-unit' }, unit));
  svg.appendChild(grid);

  // Confidence band of the straight-line fit, sampled along the years.
  const pts = [];
  for (let i = 0; i <= 24; i++) { const xv = xa + (xb - xa) * i / 24; pts.push([xv, fit(xv) + bandAt(xv)]); }
  for (let i = 24; i >= 0; i--) { const xv = xa + (xb - xa) * i / 24; pts.push([xv, fit(xv) - bandAt(xv)]); }
  svg.appendChild(el('path', { class: 'chart-band', d: 'M' + pts.map(([a, b]) => `${sx(a).toFixed(1)},${sy(b).toFixed(1)}`).join('L') + 'Z' }));

  const tx1 = sx(xa), ty1 = sy(sen.intercept + sen.slope * xa), tx2 = sx(xb), ty2 = sy(sen.intercept + sen.slope * xb);
  const len = Math.hypot(tx2 - tx1, ty2 - ty1).toFixed(1);
  const trend = el('line', { class: 'chart-trend' + (result.level === 'not-proven' ? '' : ' draw'), 'data-level': result.level,
    x1: tx1, y1: ty1, x2: tx2, y2: ty2, style: `--len:${len}` });

  const dots = el('g', { class: 'chart-dots' });
  x.forEach((yr, i) => {
    const c = el('circle', { cx: sx(yr).toFixed(1), cy: sy(y[i]).toFixed(1), r: 4.5, style: `--d:${(i * 0.025).toFixed(3)}s` });
    c.appendChild(el('title', {}, `${yr}: ${y[i].toFixed(decimals)} ${unit}`));
    dots.appendChild(c);
  });
  svg.appendChild(dots);
  svg.appendChild(trend);

  const fig = container.closest('.chart') || container;
  fig.classList.remove('is-drawn');
  container.replaceChildren(svg);
  // Next frame: start the draw-in animation.
  setTimeout(() => fig.classList.add('is-drawn'), 34);
}

Q.chart = { drawChart };
})(globalThis.Q = globalThis.Q || {});
