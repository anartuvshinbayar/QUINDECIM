// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// A worked example for each glossary term (js/i18n.js GLOSSARY, by its English name): one line from real Quindecim
// results, and for most terms a small picture. The numbers are Sergelen (Dornod), summer greenness 2001-2026, as on the
// site: change +54%, Sen's slope +0.072 NDVI per decade, p = 0.001, q = 0.014. Bayasakh's idea; Mongolian: Anu, please check.
const TEXT = {
  'Soum': ['Sergelen is one of the 14 soums of Dornod aimag.', 'Сэргэлэн бол Дорнод аймгийн 14 сумын нэг.'],
  'Aimag': ['Dornod averages its 14 soums each year: its summer greenness rose about 36% since 2001.', 'Дорнод 14 сумынхаа жил бүрийн дунджийг ашигладаг: зуны ногоорол нь 2001 оноос хойш ойролцоогоор 36 хувиар нэмэгдсэн.'],
  'Time series': ['Sergelen\'s summer greenness, 2001 to 2026: one dot per year, 26 dots.', 'Сэргэлэнгийн зуны ногоорол, 2001–2026: жил бүр нэг цэг, нийт 26.'],
  'Trend': ['The line through those dots goes up: about +54% since 2001.', 'Тэдгээр цэгийг дайрсан шугам өгсөж байна: 2001 оноос хойш ойролцоогоор +54%.'],
  'NDVI': ['Bare sand is near 0.1, thick summer grass near 0.6. Sergelen ranged from 0.24 to 0.56.', 'Нүцгэн элс 0.1 орчим, өтгөн зуны өвс 0.6 орчим. Сэргэлэн 0.24-өөс 0.56 хооронд хэлбэлзсэн.'],
  'Mann-Kendall test': ['Sergelen: comparing every year with every later one, "greener" wins by 149 pairs, so the trend counts.', 'Сэргэлэн: жил бүрийг дараагийн жил бүртэй харьцуулахад "илүү ногоон" нь 149 хосоор давсан тул чиг хандлага тооцогдоно.'],
  "Sen's slope": ['Sergelen: +0.072 NDVI every 10 years.', 'Сэргэлэн: 10 жилд +0.072 NDVI.'],
  't-test': ['A second check with a straight line. If it disagrees with Mann-Kendall, the site says so.', 'Шулуун шугамаар хийх хоёр дахь шалгалт. Манн-Кендаллтай зөрвөл сайт үүнийг хэлнэ.'],
  'p value': ['Sergelen has p = 0.001: about 1 chance in 1,000 that this is luck.', 'Сэргэлэнгийн p = 0.001: энэ нь азаар гарах магадлал 1000-д 1 орчим.'],
  'Significant': ['p = 0.03 is significant. p = 0.2 is not.', 'p = 0.03 бол ач холбогдолтой. p = 0.2 бол биш.'],
  'q value': ['Sergelen: q = 0.014, still below 0.05, so the trend is real.', 'Сэргэлэн: q = 0.014, 0.05-аас бага хэвээр тул чиг хандлага бодит.'],
  'Autocorrelation': ['A dry summer is often followed by another dry summer.', 'Хуурай зуны дараа дахиад хуурай зун ирэх нь элбэг.'],
  'Confidence interval': ['The light band around the trend line in a soum\'s chart.', 'Сумын график дээрх чиг хандлагын шугамыг тойрсон цайвар зурвас.'],
};

const INK = '#15213B', GREY = '#D9DDE6', MUTED = '#5B6375';
const label = (x, y, text, fill = MUTED, anchor = 'start') => `<text x="${x}" y="${y}" fill="${fill}" text-anchor="${anchor}">${text}</text>`;
function dots(c, line, band, dashed) {
  const ys = [62, 54, 66, 50, 58, 44, 52, 40, 48, 34, 42, 30, 38, 26];
  return `<svg viewBox="0 0 260 84" aria-hidden="true">`
    + (band ? `<path d="M10 70 L250 22 L250 42 L10 86Z" fill="${c}" opacity=".16"/>` : '')
    + (line ? `<line x1="10" y1="${band ? 78 : 68}" x2="250" y2="${band ? 32 : 26}" stroke="${c}" stroke-width="3" stroke-linecap="round"${dashed ? ' stroke-dasharray="7 5"' : ''}/>` : '')
    + ys.map((y, i) => `<circle cx="${14 + i * 17.5}" cy="${y}" r="4.5" fill="${INK}"/>`).join('') + '</svg>';
}
const tufts = (pts, colour, w) => pts.map(([x, y]) => `<path d="M${x} ${y}l-3-9M${x} ${y}l0-11M${x} ${y}l3-9" stroke="${colour}" stroke-width="${w}" stroke-linecap="round"/>`).join('');
const PIC = {
  'NDVI': (c, L) => `<svg viewBox="0 0 260 112" aria-hidden="true"><rect width="124" height="88" rx="8" fill="#EBD9BF"/>`
    + tufts([[20, 70], [52, 58], [90, 74], [104, 40], [34, 36]], '#8DB46F', 2.4)
    + `<rect x="136" width="124" height="88" rx="8" fill="#9CC48A"/>`
    + tufts(Array.from({ length: 40 }, (_, i) => [146 + (i % 8) * 14 + (Math.floor(i / 8) % 2) * 7, 22 + Math.floor(i / 8) * 15]), '#2E6B35', 1.8)
    + label(62, 106, `NDVI 0.1 · ${L === 'mn' ? 'сийрэг' : 'sparse'}`, MUTED, 'middle') + label(198, 106, `NDVI 0.6 · ${L === 'mn' ? 'өтгөн өвс' : 'thick grass'}`, MUTED, 'middle') + '</svg>',
  'Time series': c => dots(c, false, false),
  'Trend': c => dots(c, true, false),
  'Confidence interval': c => dots(c, true, true),
  't-test': c => dots(c, true, false, true),
  "Sen's slope": (c, L) => `<svg viewBox="0 0 260 96" aria-hidden="true"><line x1="20" y1="76" x2="240" y2="26" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`
    + `<path d="M130 51 H174 V41" fill="none" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="4 3"/>` + label(180, 52, `+0.072 / 10 ${L === 'mn' ? 'жил' : 'yr'}`, INK) + '</svg>',
  'Mann-Kendall test': (c, L) => `<svg viewBox="0 0 260 72" aria-hidden="true">`
    + '↑↑↓↑↑↑↓↑↑↑↑↓↑↑'.split('').map((a, i) => `<text x="${10 + i * 17.5}" y="34" font-size="22" font-weight="800" fill="${a === '↑' ? c : '#B7BCC8'}">${a}</text>`).join('')
    + label(10, 62, L === 'mn' ? 'өсөлт нь бууралтаас олон' : 'more ups than downs') + '</svg>',
  'p value': (c, L) => `<svg viewBox="0 0 260 74" aria-hidden="true">`
    + Array.from({ length: 100 }, (_, i) => `<rect x="${8 + (i % 25) * 10}" y="${4 + Math.floor(i / 25) * 10}" width="7" height="7" rx="2" fill="${i === 37 ? c : GREY}"/>`).join('')
    + label(8, 64, L === 'mn' ? '100-аас 1: p = 0.01' : '1 square in 100: p = 0.01') + '</svg>',
  'q value': (c, L) => `<svg viewBox="0 0 260 74" aria-hidden="true">`
    + Array.from({ length: 48 }, (_, i) => `<circle cx="${12 + (i % 16) * 15.5}" cy="${10 + Math.floor(i / 16) * 15}" r="5" fill="${[3, 17, 29, 40].includes(i) ? c : GREY}"/>`).join('')
    + label(8, 66, L === 'mn' ? 'олон сум шалгасан тул босго өндөр' : 'many soums tested, so the bar is set higher') + '</svg>',
  'Significant': c => `<svg viewBox="0 0 260 72" aria-hidden="true"><rect x="10" y="22" width="240" height="12" rx="6" fill="#E3E6ED"/><rect x="10" y="22" width="22" height="12" rx="6" fill="${c}"/>`
    + `<line x1="32" y1="14" x2="32" y2="42" stroke="${MUTED}" stroke-width="1.5"/>` + label(36, 14, '0.05', INK)
    + `<circle cx="24" cy="28" r="5" fill="#fff" stroke="${c}" stroke-width="2.5"/>` + label(10, 62, 'p = 0.03 ✓', INK)
    + `<circle cx="58" cy="28" r="5" fill="#fff" stroke="#8A93A8" stroke-width="2.5"/>` + label(96, 62, 'p = 0.2 ✗') + '</svg>',
  'Autocorrelation': (c, L) => `<svg viewBox="0 0 260 84" aria-hidden="true">`
    + [6, 5, 6, 2, 1.5, 1, 1.8, 5, 6, 5.5, 2, 1, 1.5, 6, 5].map((h, i) => `<rect x="${10 + i * 16}" y="${62 - h * 9}" width="11" height="${h * 9}" rx="2" fill="${h < 3 ? '#B9431C' : c}"/>`).join('')
    + label(10, 80, L === 'mn' ? 'хуурай жилүүд (улаан) дараалж ирдэг' : 'dry years (red) come in runs') + '</svg>',
};

// The example for a term in language L, with the picture in colour c: { text, svg } (svg may be '').
function example(term, L, c) {
  const t = TEXT[term];
  return t ? { text: t[L === 'mn' ? 1 : 0], svg: PIC[term] ? PIC[term](c, L) : '' } : null;
}
Q.examples = { example };
})(globalThis.Q = globalThis.Q || {});
