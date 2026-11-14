// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Reads window.QUINDECIM_DATA, written by data/data.js (built by tools/build_data.py).
// Format 2: { soums: [[id, name_en, name_mn, aimag, geometry]], series: { variable: { id: [firstYear, v, v, ...] } } }

async function loadData() {
  const raw = globalThis.QUINDECIM_DATA;
  if (!raw || raw.format !== 2) throw new Error('data/data.js is missing or old. Run: python3 tools/build_data.py');

  const soums = raw.soums.map(([id, name_en, name_mn, aimag, geometry]) => ({
    id, name_en: name_en || id, name_mn: name_mn || name_en || id, aimag, geometry,
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
  return { soums, soumById: Object.fromEntries(soums.map(s => [s.id, s])), series, yearRange, sample: raw.sample === true };
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
