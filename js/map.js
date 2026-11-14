// Plain SVG map of soums. No library, no tiles: works offline.
// Every soum is a <path class="soum" data-id=".." data-verdict=".."> so CSS decides the colours.

const SVG_NS = 'http://www.w3.org/2000/svg';

function rings(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

export function drawMap(container, soums, { onSelect, label }) {
  // Equirectangular projection, x stretched by cos(mid latitude) so Mongolia keeps its shape.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of soums) for (const r of rings(s.geometry)) for (const [x, y] of r) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const k = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
  const W = 1000, scale = W / ((maxX - minX) * k), H = (maxY - minY) * scale;
  const px = x => ((x - minX) * k * scale).toFixed(1);
  const py = y => ((maxY - y) * scale).toFixed(1);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H.toFixed(0)}`);
  svg.setAttribute('class', 'map-svg');
  svg.setAttribute('role', 'group');

  const paths = {};
  for (const s of soums) {
    const d = rings(s.geometry).map(r => 'M' + r.map(([x, y]) => px(x) + ',' + py(y)).join('L') + 'Z').join('');
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', 'soum');
    p.setAttribute('data-id', s.id);
    p.setAttribute('tabindex', '0');
    p.setAttribute('role', 'button');
    const title = document.createElementNS(SVG_NS, 'title');
    p.appendChild(title);
    p.addEventListener('click', () => onSelect(s.id));
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); } });
    svg.appendChild(p);
    paths[s.id] = p;
  }
  container.replaceChildren(svg);

  return {
    // verdicts: { soum_id: 'real-up' | 'real-down' | 'possible-up' | 'possible-down' | 'not-proven' | 'no-data' } or null
    update({ selectedId, verdicts }) {
      for (const s of soums) {
        const p = paths[s.id];
        p.classList.toggle('is-selected', s.id === selectedId);
        if (verdicts) p.setAttribute('data-verdict', verdicts[s.id] || 'no-data');
        else p.removeAttribute('data-verdict');
        p.firstChild.textContent = label(s);
      }
      // Draw the selected soum last so its outline sits on top.
      if (selectedId && paths[selectedId]) svg.appendChild(paths[selectedId]);
    },
  };
}
