// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Reads window.QUINDECIM_DATA, written by data/data.js (built by tools/build_data.py).
// Format 2: { soums: [[id, name_en, name_mn, aimag, geometry]], aimags: [[name, geometry]],
//             series: { variable: { id: [firstYear, v, v, ...] } }, grass: { id: [land_km2, grass_km2] } }

// data/data.js loads in parallel with the page (async, id="data-js" in index.html), so wait for it. If it failed
// before this ran, its onerror attribute has set QUINDECIM_DATA_ERROR; once the whole page has loaded (which includes
// async scripts) and there is still no data, it is not coming.
function dataArrived() {
  return new Promise((resolve, reject) => {
    const settle = () => {
      if (globalThis.QUINDECIM_DATA) { resolve(globalThis.QUINDECIM_DATA); return true; }
      if (globalThis.QUINDECIM_DATA_ERROR) { reject(new Error('data/data.js could not be downloaded')); return true; }
      return false;
    };
    if (settle()) return;
    const missing = () => { if (!settle()) reject(new Error('data/data.js is missing or old. Run: python3 tools/build_data.py')); };
    const tag = document.getElementById('data-js');
    if (!tag || document.readyState === 'complete') { missing(); return; }
    tag.addEventListener('load', missing);
    tag.addEventListener('error', () => { globalThis.QUINDECIM_DATA_ERROR = true; settle(); });
    addEventListener('load', missing);
  });
}

async function loadData() {
  const raw = await dataArrived();
  if (!raw || raw.format !== 2) throw new Error('data/data.js is missing or old. Run: python3 tools/build_data.py');

  const soums = raw.soums.map(([id, name_en, name_mn, aimag, geometry]) => ({
    id, name_en: name_en || id, name_mn: name_mn || name_en || id, aimag, geometry,
  }));
  const aimags = (raw.aimags || []).map(([name, geometry]) => ({
    name, geometry, soumIds: soums.filter(s => s.aimag === name).map(s => s.id),
  }));

  const series = {}, yearRange = {};
  for (const [variable, bySoum] of Object.entries(raw.series)) {
    let lo = Infinity, hi = -Infinity;
    series[variable] = {};
    for (const [id, packed] of Object.entries(bySoum)) {
      const first = packed[0], years = [], values = [];
      for (let i = 1; i < packed.length; i++) {
        years.push(first + i - 1);
        values.push(packed[i] == null ? NaN : packed[i]);
      }
      series[variable][id] = { years, values };
      lo = Math.min(lo, first); hi = Math.max(hi, first + packed.length - 2);
    }
    yearRange[variable] = [lo, hi];
  }

  // Aimag series = average of its soums for each year (only years where at least half the soums have a value).
  const aimagCache = {};
  function aimagSeries(variable, name) {
    const key = variable + '|' + name;
    if (aimagCache[key]) return aimagCache[key];
    const a = aimags.find(x => x.name === name);
    const sums = new Map(), counts = new Map();
    for (const id of a ? a.soumIds : []) {
      const s = series[variable][id];
      if (!s) continue;
      s.years.forEach((y, i) => {
        if (Number.isFinite(s.values[i])) { sums.set(y, (sums.get(y) || 0) + s.values[i]); counts.set(y, (counts.get(y) || 0) + 1); }
      });
    }
    const need = Math.max(1, Math.ceil((a ? a.soumIds.length : 1) / 2));
    const years = [...sums.keys()].sort((p, q) => p - q).filter(y => counts.get(y) >= need);
    return (aimagCache[key] = { years, values: years.map(y => sums.get(y) / counts.get(y)) });
  }

  return {
    soums, aimags, soumById: Object.fromEntries(soums.map(s => [s.id, s])),
    aimagByName: Object.fromEntries(aimags.map(a => [a.name, a])),
    series, yearRange, aimagSeries, sample: raw.sample === true,
    grass: raw.grass || {},   // soum id -> [land km2, grassland km2]; greenness is measured on grassland only
  };
}

// Cut a series to [from, to].
function slice(s, from, to) {
  const years = [], values = [];
  if (!s) return { years, values };
  s.years.forEach((y, i) => { if (y >= from && y <= to) { years.push(y); values.push(s.values[i]); } });
  return { years, values };
}

Q.data = { loadData, slice };
})(globalThis.Q = globalThis.Q || {});
