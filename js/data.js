// Loads data/soums.geojson and data/data.csv (formats in README.md).

export async function loadData(base = 'data/') {
  const [geo, csvText] = await Promise.all([
    fetch(base + 'soums.geojson').then(r => { if (!r.ok) throw new Error('soums.geojson ' + r.status); return r.json(); }),
    fetch(base + 'data.csv').then(r => { if (!r.ok) throw new Error('data.csv ' + r.status); return r.text(); }),
  ]);

  const soums = geo.features.map(f => ({
    id: String(f.properties.soum_id),
    name_en: f.properties.name_en || String(f.properties.soum_id),
    name_mn: f.properties.name_mn || f.properties.name_en || String(f.properties.soum_id),
    aimag: f.properties.aimag || '',
    geometry: f.geometry,
  }));

  // series[variable][soum_id] = { years: [], values: [] }, sorted by year.
  const series = {};
  const lines = csvText.split(/\r?\n/);
  const header = lines[0].split(',').map(s => s.trim());
  const col = name => header.indexOf(name);
  const iS = col('soum_id'), iV = col('variable'), iY = col('year'), iX = col('value');
  if ([iS, iV, iY, iX].includes(-1)) throw new Error('data.csv needs columns soum_id,variable,year,value');
  for (let k = 1; k < lines.length; k++) {
    const line = lines[k];
    if (!line) continue;
    const p = line.split(',');
    const v = p[iV].trim(), s = p[iS].trim();
    const year = Number(p[iY]), value = p[iX] === '' ? NaN : Number(p[iX]);
    ((series[v] ||= {})[s] ||= { years: [], values: [] });
    series[v][s].years.push(year);
    series[v][s].values.push(value);
  }
  const yearRange = {};
  for (const [v, bySoum] of Object.entries(series)) {
    let lo = Infinity, hi = -Infinity;
    for (const s of Object.values(bySoum)) {
      const order = s.years.map((y, i) => i).sort((a, b) => s.years[a] - s.years[b]);
      s.years = order.map(i => s.years[i]);
      s.values = order.map(i => s.values[i]);
      lo = Math.min(lo, s.years[0]); hi = Math.max(hi, s.years[s.years.length - 1]);
    }
    yearRange[v] = [lo, hi];
  }

  return { soums, soumById: Object.fromEntries(soums.map(s => [s.id, s])), series, yearRange, sample: geo.sample === true };
}

// Cut a series to [from, to].
export function slice(s, from, to) {
  const years = [], values = [];
  if (!s) return { years, values };
  s.years.forEach((y, i) => { if (y >= from && y <= to) { years.push(y); values.push(s.values[i]); } });
  return { years, values };
}
