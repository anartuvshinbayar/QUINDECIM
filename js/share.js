// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Share as image: one picture of the result, 1080 x 1350 (the 4:5 shape Facebook shows largest in the feed, and fine
// in Messenger). A place gets its plain sentence, verdict and chart; the whole country gets its map. Drawn on a canvas
// with no libraries; js/app.js supplies the text (in the card's language) and the colours.

const W = 1080, H = 1350, M = 72, BAND_H = 48;
const C = { milk: '#F6F1E7', ink: '#15213B', muted: '#5B6375', blue: '#3A68BD', grid: '#E4DED2', axis: '#CFC8BA' };
const FAMILY = '"Montserrat", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const font = (weight, px) => `${weight} ${px}px ${FAMILY}`;

// Logo and Alkhan band, loaded once. They are left out when the canvas may not use them (index.html opened as a file).
const IMG = {};
for (const [k, src] of [['mark', 'assets/brand/quindecim-mark.svg'], ['band', 'assets/tiles/alkhan-border.svg']]) {
  IMG[k] = new Image();
  IMG[k].src = src;
}
const usable = img => img && img.complete && img.naturalWidth > 0;

// Fonts in both scripts, so the canvas never falls back to another typeface for Mongolian.
function fontsReady() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.all([500, 600, 700].map(w => document.fonts.load(font(w, 40), 'Aa Аа Өө Үү 0123'))).catch(() => {});
}

function lines(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(test).width <= maxW) line = test;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out;
}
// Wrapped text with its top at y, at the largest of the sizes that fits in maxLines. Returns the y under it.
function block(ctx, text, x, y, maxW, { sizes, weight = 600, color = C.ink, lh = 1.24, maxLines = 3 }) {
  let size = sizes[0], ls = [];
  for (size of sizes) {
    ctx.font = font(weight, size);
    ls = lines(ctx, text, maxW);
    if (ls.length <= maxLines) break;
  }
  if (ls.length > maxLines) { ls = ls.slice(0, maxLines); ls[maxLines - 1] += '…'; }
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ls.forEach((l, i) => ctx.fillText(l, x, y + i * size * lh));
  return y + ls.length * size * lh;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// Diagonal light stripes over a colour: a "possible" trend, as on the map.
function stripes(ctx, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 14;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 14, 14);
  g.strokeStyle = 'rgba(246, 241, 231, .85)'; g.lineWidth = 4.5;
  g.beginPath();
  for (const k of [-14, 0, 14]) { g.moveTo(k, 14); g.lineTo(k + 14, 0); }
  g.stroke();
  return ctx.createPattern(c, 'repeat');
}

function start(images) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = C.milk; ctx.fillRect(0, 0, W, H);
  return { canvas, ctx, images };
}
function header(ctx, images, years) {
  if (images && usable(IMG.mark)) ctx.drawImage(IMG.mark, M, 58, 80, 80);
  ctx.textBaseline = 'middle';
  ctx.font = font(700, 42); ctx.fillStyle = C.ink;
  ctx.fillText('Quindecim', M + (images && usable(IMG.mark) ? 100 : 0), 99);
  ctx.font = font(600, 32); ctx.fillStyle = C.muted; ctx.textAlign = 'right';
  ctx.fillText(years, W - M, 99);
  ctx.textAlign = 'left';
}
// Source and address above the Alkhan band. Returns the top of the footer (the lowest y the content may use).
function footer(ctx, images, source, url) {
  const by = H - BAND_H;
  if (images && usable(IMG.band)) {
    const tw = BAND_H * 60 / 36;
    for (let x = 0; x < W; x += tw) ctx.drawImage(IMG.band, x, by, tw, BAND_H);
  } else { ctx.fillStyle = '#2E7A57'; ctx.fillRect(0, by, W, BAND_H); }
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(700, 34); ctx.fillStyle = C.blue;
  ctx.fillText(url, M, by - 36);
  ctx.font = font(500, 26); ctx.fillStyle = C.muted;
  const src = lines(ctx, source, W - 2 * M).slice(0, 2);
  src.forEach((l, i) => ctx.fillText(l, M, by - 92 - (src.length - 1 - i) * 34));
  return by - 92 - (src.length - 1) * 34 - 44;
}
// The question in blue, the place in ink. Returns the y under them.
function titles(ctx, question, place) {
  let y = block(ctx, question, M, 196, W - 2 * M, { sizes: [58, 52, 46], weight: 700, color: C.blue, maxLines: 2, lh: 1.15 });
  y = block(ctx, place, M, y + 22, W - 2 * M, { sizes: [44, 38, 34], weight: 700, maxLines: 2, lh: 1.18 });
  return y;
}
// The plain sentence with a coloured bar on its left. Returns the y under it.
function sentence(ctx, text, y, color) {
  const y1 = block(ctx, text, M + 30, y, W - 2 * M - 30, { sizes: [38, 34, 30], weight: 600, maxLines: 4, lh: 1.3 });
  ctx.fillStyle = color || C.ink;
  ctx.fillRect(M, y + 2, 8, y1 - y - 12);
  return y1;
}
// The verdict as a pill: filled (real), outlined (possible) or dashed (not proven). Returns the y under it.
function pill(ctx, p, y) {
  ctx.font = font(700, 30);
  const w = Math.min(W - 2 * M, ctx.measureText(p.label).width + 56), h = 64;
  roundRect(ctx, M, y, w, h, h / 2);
  if (p.kind === 'real') { ctx.fillStyle = p.color; ctx.fill(); }
  ctx.lineWidth = 4;
  ctx.setLineDash(p.kind === 'not-proven' ? [12, 9] : []);
  ctx.strokeStyle = p.kind === 'not-proven' ? C.ink : p.color;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = p.kind === 'real' ? p.textColor : p.kind === 'possible' ? p.textColor : C.ink;
  ctx.textBaseline = 'middle';
  ctx.fillText(p.label, M + 28, y + h / 2 + 1, w - 56);
  return y + h;
}

// The yearly values (dots on a thin line) and the trend line (Sen's slope) over them.
function chart(ctx, r, box, { color, decimals, unit }) {
  const L = box.x + 112, R = box.x + box.w - 10, T = box.y + 44, B = box.y + box.h - 56;
  const line = yr => r.sen.intercept + r.sen.slope * yr;
  const vals = [...r.y, line(r.first), line(r.last)];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.1;
  lo -= pad; hi += pad;
  const X = yr => L + (yr - r.first) / ((r.last - r.first) || 1) * (R - L);
  const Y = v => B - (v - lo) / (hi - lo) * (B - T);
  // Round numbers on the value axis: a step of 1, 2, 2.5 or 5 times a power of ten, about three of them.
  const raw = (hi - lo) / 3, pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(x => x >= raw);
  const places = Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + (String(step / pow).includes('.') ? 1 : 0));
  ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  ctx.font = font(500, 24); ctx.lineWidth = 2;
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
    const y = Y(v);
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.fillText(v.toFixed(Math.min(places, Math.max(decimals, 0) + 1)), L - 16, y);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = font(600, 24); ctx.fillStyle = C.muted;
  ctx.fillText(unit, box.x, box.y + 22);
  ctx.textBaseline = 'top';
  const years = [r.first, Math.round((r.first + r.last) / 2), r.last].filter((v, i, a) => a.indexOf(v) === i);
  years.forEach((yr, i) => {
    ctx.textAlign = i === 0 ? 'left' : i === years.length - 1 ? 'right' : 'center';
    ctx.fillText(String(yr), X(yr), B + 16);
  });
  ctx.textAlign = 'left';
  // Values.
  ctx.strokeStyle = C.axis; ctx.lineWidth = 2.5; ctx.beginPath();
  r.x.forEach((yr, i) => (i ? ctx.lineTo(X(yr), Y(r.y[i])) : ctx.moveTo(X(yr), Y(r.y[i]))));
  ctx.stroke();
  ctx.fillStyle = C.ink;
  for (let i = 0; i < r.x.length; i++) { ctx.beginPath(); ctx.arc(X(r.x[i]), Y(r.y[i]), 6, 0, Math.PI * 2); ctx.fill(); }
  // Trend.
  ctx.strokeStyle = color; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(X(r.first), Y(line(r.first))); ctx.lineTo(X(r.last), Y(line(r.last))); ctx.stroke();
  ctx.lineCap = 'butt';
}

// A soum or aimag: question, place, verdict, plain sentence, chart.
// o: { question, place, years, pill: { label, kind, color, textColor }, sentence, trendColor, r, decimals, unit, source, url }
function placeCard(o, images = true) {
  const { canvas, ctx } = start(images);
  header(ctx, images, o.years);
  const bottom = footer(ctx, images, o.source, o.url);
  let y = titles(ctx, o.question, o.place);
  y = pill(ctx, o.pill, y + 30);
  y = sentence(ctx, o.sentence, y + 38, o.trendColor);
  chart(ctx, o.r, { x: M, y: y + 28, w: W - 2 * M, h: Math.max(260, bottom - y - 28) }, { color: o.trendColor, decimals: o.decimals, unit: o.unit });
  return canvas;
}

// The whole country: question, the sentence for all soums, the map of every soum, its key and the counts.
// o: { question, place, years, sentence, trendColor, soums, aimags, fills: { id: { color, striped } }, noData,
//      legend: { title, down: [3], up: [3], ticks: [5 strings], downWord, upWord, sure: [3 labels], notProven }, counts, source, url }
function nationCard(o, images = true) {
  const { canvas, ctx } = start(images);
  header(ctx, images, o.years);
  const bottom = footer(ctx, images, o.source, o.url);
  let y = titles(ctx, o.question, o.place);
  y = sentence(ctx, o.sentence, y + 30, o.trendColor);

  // Key and counts take the bottom; the map fills what is left in between.
  const keyH = 196, mapTop = y + 30, mapBottom = bottom - keyH;
  const rings = g => (g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : []);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const a of o.aimags) for (const ring of rings(a.geometry)) for (const [x, yy] of ring) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy);
  }
  const k = Math.cos((y0 + y1) / 2 * Math.PI / 180);
  const s = Math.min((W - 2 * M) / ((x1 - x0) * k), (mapBottom - mapTop) / (y1 - y0));
  const ox = M + ((W - 2 * M) - (x1 - x0) * k * s) / 2, oy = mapTop + ((mapBottom - mapTop) - (y1 - y0) * s) / 2;
  const path = g => {
    ctx.beginPath();
    for (const ring of rings(g)) ring.forEach(([x, yy], i) => {
      const X = ox + (x - x0) * k * s, Y = oy + (y1 - yy) * s;
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    });
    ctx.closePath();
  };
  const patterns = {};
  ctx.lineJoin = 'round';
  for (const soum of o.soums) {
    const f = o.fills[soum.id] || { color: o.noData };
    path(soum.geometry);
    ctx.fillStyle = f.striped ? (patterns[f.color] = patterns[f.color] || stripes(ctx, f.color)) : f.color;
    ctx.fill('evenodd');
    ctx.strokeStyle = C.milk; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(21, 33, 59, .4)'; ctx.lineWidth = 2;
  for (const a of o.aimags) { path(a.geometry); ctx.stroke(); }

  // Key: the six shades with the change at their edges, then filled / striped / pale.
  const g = o.legend, ky = mapBottom + 20, sw = 70, sh = 26;
  ctx.textBaseline = 'alphabetic'; ctx.font = font(600, 24); ctx.fillStyle = C.ink;
  ctx.fillText(g.title, M, ky + 22);
  const shades = [...g.down.slice().reverse(), ...g.up];
  shades.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(M + i * sw, ky + 38, sw, sh); });
  ctx.font = font(500, 21); ctx.fillStyle = C.muted; ctx.textAlign = 'center';
  g.ticks.forEach((t, i) => ctx.fillText(t, M + (i + 1) * sw, ky + 38 + sh + 26));
  ctx.textAlign = 'left'; ctx.font = font(600, 22); ctx.fillStyle = C.ink;
  ctx.fillText(g.downWord, M, ky + 38 + sh + 56);
  ctx.textAlign = 'right'; ctx.fillText(g.upWord, M + 6 * sw, ky + 38 + sh + 56);
  ctx.textAlign = 'left';
  // Filled / striped / pale, on the right of the shades.
  const sx = M + 6 * sw + 56, mid = g.up[1];
  [[mid, false], [mid, true], [g.notProven, false]].forEach(([c, striped], i) => {
    const yy = ky + 38 + i * 40;
    ctx.fillStyle = striped ? stripes(ctx, c) : c;
    ctx.fillRect(sx, yy, 30, 26);
    ctx.strokeStyle = '#BDB6A8'; ctx.lineWidth = 1.5; ctx.strokeRect(sx, yy, 30, 26);
    ctx.fillStyle = C.ink; ctx.font = font(600, 23); ctx.textBaseline = 'middle';
    ctx.fillText(g.sure[i], sx + 44, yy + 14, W - M - sx - 44);
  });
  ctx.textBaseline = 'alphabetic';
  block(ctx, o.counts, M, ky + 158, W - 2 * M, { sizes: [24, 22, 20], weight: 500, color: C.muted, maxLines: 1 });
  return canvas;
}

// PNG of the card. When the canvas may not be read (index.html opened as a file, where the logo images taint it), the
// card is drawn again without the images.
function toBlob(draw) {
  const encode = canvas => new Promise((resolve, reject) => {
    try { canvas.toBlob(b => (b ? resolve(b) : reject(new Error('empty image'))), 'image/png'); } catch (err) { reject(err); }
  });
  return encode(draw(true)).catch(() => encode(draw(false)));
}

Q.share = { placeCard, nationCard, toBlob, fontsReady };
})(globalThis.Q = globalThis.Q || {});
