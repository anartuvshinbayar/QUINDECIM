// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// One entry per variable id used in data/data.csv.
// display: 'percent' shows the rate as % of the period average per decade; 'absolute' shows units per decade.
// level: 'soum' = genuinely soum-level data; 'regional' = coarse model cells shared by nearby soums.
const VARIABLES = [
  {
    id: 'ndvi_summer', display: 'percent', unit: 'NDVI', decimals: 3,
    level: 'soum', source: 'NASA MODIS MOD13A2 (1 km)',
    name: { en: 'Summer greenness', mn: 'Зуны ногоорол' },
    question: { en: 'Is it getting greener or browner?', mn: 'Ногоорч байна уу, шарлаж байна уу?' },
    season: { en: 'June to August average', mn: '6–8 сарын дундаж' },
    up: { en: 'greener', mn: 'ногоорсон' }, down: { en: 'browner', mn: 'шарласан' },
  },
  {
    id: 'rain_summer', display: 'percent', unit: 'mm', decimals: 0,
    level: 'regional', source: 'NASA FLDAS land model',
    name: { en: 'Summer rainfall', mn: 'Зуны хур тунадас' },
    question: { en: 'Is it getting wetter or drier?', mn: 'Чийглэг болж байна уу, хуурайшиж байна уу?' },
    season: { en: 'June to August total', mn: '6–8 сарын нийлбэр' },
    up: { en: 'wetter', mn: 'чийглэг болсон' }, down: { en: 'drier', mn: 'хуурайшсан' },
  },
  {
    id: 'temp_summer', display: 'absolute', unit: '°C', decimals: 1,
    level: 'regional', source: 'NASA FLDAS land model',
    name: { en: 'Summer temperature', mn: 'Зуны агаарын температур' },
    question: { en: 'Are summers getting hotter?', mn: 'Зун халуун болж байна уу?' },
    season: { en: 'June to August average', mn: '6–8 сарын дундаж' },
    up: { en: 'hotter', mn: 'дулаарсан' }, down: { en: 'cooler', mn: 'сэрүүссэн' },
  },
  {
    id: 'temp_winter', display: 'absolute', unit: '°C', decimals: 1,
    level: 'regional', source: 'NASA FLDAS land model',
    name: { en: 'Winter temperature', mn: 'Өвлийн агаарын температур' },
    question: { en: 'Are winters getting colder or milder?', mn: 'Өвөл хүйтэн болж байна уу, зөөлөрч байна уу?' },
    season: { en: 'December to February average, labelled by the January year', mn: '12–2 сарын дундаж, 1 сарын оноор' },
    up: { en: 'milder', mn: 'зөөлөрсөн' }, down: { en: 'colder', mn: 'хүйтэрсэн' },
  },
  {
    id: 'first_frost', display: 'absolute', unit: 'days', decimals: 0,
    level: 'point', source: 'NASA POWER (soum centre)',
    name: { en: 'First autumn frost', mn: 'Намрын анхны хяруу' },
    question: { en: 'Is the first frost coming later?', mn: 'Анхны хяруу хойшилж байна уу?' },
    season: { en: 'First day after 1 July below 0 °C (day of year)', mn: '7 сарын 1-ээс хойш 0 °C-аас доош орсон анхны өдөр' },
    up: { en: 'later', mn: 'хойшилсон' }, down: { en: 'earlier', mn: 'урагшилсан' },
    unitName: { en: 'days', mn: 'хоног' },
  },
];

const byId = Object.fromEntries(VARIABLES.map(v => [v.id, v]));

Q.variables = { VARIABLES, byId };
})(globalThis.Q = globalThis.Q || {});

// Mongolian names of the aimags (FAO GAUL spelling -> Cyrillic). Anu: please check.
(function (Q) {
  Q.variables.AIMAG_MN = {
    'Arkhangai': 'Архангай', 'Bayan-Ölgii': 'Баян-Өлгий', 'Bayankhongor': 'Баянхонгор', 'Bulgan': 'Булган',
    'Darkhan-Uul': 'Дархан-Уул', 'Dornod': 'Дорнод', 'Dornogovi': 'Дорноговь', 'Dundgovi': 'Дундговь',
    'Govi-Altai': 'Говь-Алтай', 'Govisümber': 'Говьсүмбэр', 'Khentii': 'Хэнтий', 'Khovd': 'Ховд',
    'Khövsgöl': 'Хөвсгөл', 'Orkhon': 'Орхон', 'Selenge': 'Сэлэнгэ', 'Sükhbaatar': 'Сүхбаатар', 'Töv': 'Төв',
    'Ulaanbaatar': 'Улаанбаатар', 'Uvs': 'Увс', 'Zavkhan': 'Завхан', 'Ömnögovi': 'Өмнөговь', 'Övörkhangai': 'Өвөрхангай',
  };
})(globalThis.Q);
