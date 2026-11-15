// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Bayasakh's six hand-drawn figures (aaruul, swirl, wind, cloud, sun, twin): each one thick round-capped stroke on a
// 120-unit grid. Used on the hero tiles and on the story cards.
const PATHS = {
  aaruul: ['M47.25 62.75A8.12 8.12 0 0 0 31 62.75A16.25 16.25 0 0 0 63.5 62.75A24.38 24.38 0 0 0 14.75 62.75A18.75 18.75 0 0 0 33.5 81.5L94.75 81.5A10.62 10.62 0 0 0 94.75 60.25A21.25 21.25 0 0 0 59.1 48.77'],
  swirl: ['M56 56A7 7 0 0 0 42 56A14 14 0 0 0 70 56A21 21 0 0 0 28 56A21 21 0 0 0 49 77L100 77'],
  wind: ['M52 90A7 7 0 0 0 38 90A14 14 0 0 0 66 90L66 44A12 12 0 0 0 42 44A6 6 0 0 0 54 44', 'M66 66A12 12 0 0 1 90 66A6 6 0 0 1 78 66'],
  cloud: ['M70 44A6 6 0 0 0 58 44A12 12 0 0 0 82 44A18 18 0 0 0 46 44L46 100', 'M64 11A33 33 0 0 0 31 44L31 86', 'M16 54L16 74'],
  sun: ['M60 39A21 21 0 1 1 59.99 39', 'M60 21L60 12', 'M60 99L60 108', 'M21 60L12 60', 'M99 60L108 60'],
  twin: ['M84 34A6 6 0 0 0 72 34A12 12 0 0 0 96 34A18 18 0 0 0 60 34L60 86A18 18 0 0 1 24 86A12 12 0 0 1 48 86A6 6 0 0 1 36 86'],
};
const DOTS = { sun: [[60, 60, 7]] }, ROT = { twin: 35 };
const NAMES = Object.keys(PATHS);

function svg(name, colour, width = 9) {
  const rot = ROT[name] ? ` transform="rotate(${ROT[name]} 60 60)"` : '';
  const dots = (DOTS[name] || []).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${colour}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="${colour}" `
    + `stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${rot}>`
    + PATHS[name].map(d => `<path d="${d}"/>`).join('') + dots + '</g></svg>';
}

Q.figures = { svg, NAMES };
})(globalThis.Q = globalThis.Q || {});
