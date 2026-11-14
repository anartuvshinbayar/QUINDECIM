// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Time series chart as plain SVG: one dot per year, Sen's slope trend line,
// dashed straight-line fit, dotted period average. Classes only, CSS sets colours.

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
  const W = 720, H = 340, m = { l: 64, r: 16, t: 16, b: 40 };
  const { x, y } = result;
  const yMin = Math.min(...y), yMax = Math.max(...y), pad = (yMax - yMin) * 0.12 || 1;
  const x0 = x[0] - 0.5, x1 = x[x.length - 1] + 0.5, y0 = yMin - pad, y1 = yMax + pad;
  const sx = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r);
  const sy = v => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img' });
  svg.appendChild(el('title', {}, labels.title));

  const grid = el('g', { class: 'chart-grid' });
  for (const t of niceTicks(y0, y1)) {
    grid.appendChild(el('line', { x1: m.l, x2: W - m.r, y1: sy(t), y2: sy(t) }));
    grid.appendChild(el('text', { x: m.l - 8, y: sy(t) + 4, 'text-anchor': 'end', class: 'chart-tick' }, t.toFixed(Math.max(0, decimals))));
  }
  const step = x.length > 30 ? 10 : 5;
  for (let yr = Math.ceil(x[0] / step) * step; yr <= x[x.length - 1]; yr += step) {
    grid.appendChild(el('text', { x: sx(yr), y: H - m.b + 22, 'text-anchor': 'middle', class: 'chart-tick' }, yr));
  }
  grid.appendChild(el('text', { x: 14, y: m.t + (H - m.t - m.b) / 2, class: 'chart-unit', 'text-anchor': 'middle',
    transform: `rotate(-90 14 ${m.t + (H - m.t - m.b) / 2})` }, unit));
  svg.appendChild(grid);

  const avg = result.mean;
  svg.appendChild(el('line', { class: 'chart-mean', x1: m.l, x2: W - m.r, y1: sy(avg), y2: sy(avg) }));

  const { lin, sen } = result;
  svg.appendChild(el('line', { class: 'chart-linear', x1: sx(x[0]), x2: sx(x[x.length - 1]),
    y1: sy(lin.intercept + lin.slope * x[0]), y2: sy(lin.intercept + lin.slope * x[x.length - 1]) }));
  svg.appendChild(el('line', { class: 'chart-trend', 'data-level': result.level, x1: sx(x[0]), x2: sx(x[x.length - 1]),
    y1: sy(sen.intercept + sen.slope * x[0]), y2: sy(sen.intercept + sen.slope * x[x.length - 1]) }));

  const dots = el('g', { class: 'chart-dots' });
  x.forEach((yr, i) => {
    const c = el('circle', { cx: sx(yr), cy: sy(y[i]), r: 4.5, class: y[i] >= avg ? 'above' : 'below' });
    c.appendChild(el('title', {}, `${yr}: ${y[i].toFixed(decimals)} ${unit}`));
    dots.appendChild(c);
  });
  svg.appendChild(dots);

  container.replaceChildren(svg);
}

Q.chart = { drawChart };
})(globalThis.Q = globalThis.Q || {});
