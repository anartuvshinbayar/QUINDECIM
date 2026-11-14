// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// One entry per variable id used in data/data.csv.
// display: 'percent' shows the rate as % of the period average per decade; 'absolute' shows units per decade.
// level: 'soum' = genuinely soum-level data; 'regional' = coarse model cells shared by nearby soums.
// newest: what the newest year covers (always a complete season). plain: the one-sentence result (js/app.js).
const VARIABLES = [
  {
    id: 'ndvi_summer', display: 'percent', unit: 'NDVI', decimals: 3,
    level: 'soum', source: 'NASA MODIS MOD13A2 (1 km)',
    name: { en: 'Summer greenness', mn: 'Зуны ногоорол' },
    short: { en: 'Greenness', mn: 'Ногоорол' },
    question: { en: 'Is it getting greener or browner?', mn: 'Ногоорч байна уу, шарлаж байна уу?' },
    season: { en: 'June to August average', mn: '6–8 сарын дундаж' },
    up: { en: 'greener', mn: 'ногоорсон' }, down: { en: 'browner', mn: 'шарласан' },
    newest: { en: 'The newest year, {y}, is a complete June to August season.', mn: 'Хамгийн сүүлийн {y} он бол 6–8 сарын бүтэн улирал.' },
    // One plain sentence per result ({place}: "this soum" / "Энэ сумын"; {x}: the change; {first}: the first year).
    plain: {
      up: { en: 'Summer greenness in {place} has risen about {x}% since {first}.', mn: '{place} зуны ногоорол {first} оноос хойш ойролцоогоор {x} хувиар нэмэгдсэн.' },
      down: { en: 'Summer greenness in {place} has fallen about {x}% since {first}.', mn: '{place} зуны ногоорол {first} оноос хойш ойролцоогоор {x} хувиар буурсан.' },
      same: { en: 'Summer greenness in {place} has barely changed since {first}.', mn: '{place} зуны ногоорол {first} оноос хойш бараг өөрчлөгдөөгүй.' },
    },
  },
  {
    id: 'rain_summer', display: 'percent', unit: 'mm', decimals: 0,
    level: 'regional', source: 'NASA FLDAS land model',
    name: { en: 'Summer rainfall', mn: 'Зуны хур тунадас' },
    short: { en: 'Rainfall', mn: 'Хур тунадас' },
    question: { en: 'Is it getting wetter or drier?', mn: 'Чийглэг болж байна уу, хуурайшиж байна уу?' },
    season: { en: 'June to August total', mn: '6–8 сарын нийлбэр' },
    up: { en: 'wetter', mn: 'чийглэг болсон' }, down: { en: 'drier', mn: 'хуурайшсан' },
    newest: { en: 'The newest year, {y}, is a complete June to August season.', mn: 'Хамгийн сүүлийн {y} он бол 6–8 сарын бүтэн улирал.' },
    plain: {
      up: { en: 'Summer rainfall in {place} has risen about {x}% since {first}.', mn: '{place} зуны хур тунадас {first} оноос хойш ойролцоогоор {x} хувиар нэмэгдсэн.' },
      down: { en: 'Summer rainfall in {place} has fallen about {x}% since {first}.', mn: '{place} зуны хур тунадас {first} оноос хойш ойролцоогоор {x} хувиар буурсан.' },
      same: { en: 'Summer rainfall in {place} has barely changed since {first}.', mn: '{place} зуны хур тунадас {first} оноос хойш бараг өөрчлөгдөөгүй.' },
    },
  },
  {
    id: 'temp_summer', display: 'absolute', unit: '°C', decimals: 1,
    level: 'regional', source: 'NASA FLDAS land model',
    name: { en: 'Summer temperature', mn: 'Зуны агаарын температур' },
    short: { en: 'Summer temperature', mn: 'Зуны температур' },
    question: { en: 'Are summers getting hotter?', mn: 'Зун халуун болж байна уу?' },
    season: { en: 'June to August average', mn: '6–8 сарын дундаж' },
    up: { en: 'hotter', mn: 'дулаарсан' }, down: { en: 'cooler', mn: 'сэрүүссэн' },
    newest: { en: 'The newest year, {y}, is a complete June to August season.', mn: 'Хамгийн сүүлийн {y} он бол 6–8 сарын бүтэн улирал.' },
    plain: {
      up: { en: 'Summers in {place} have warmed about {x} °C since {first}.', mn: '{place} зун {first} оноос хойш ойролцоогоор {x} градусаар дулаарсан.' },
      down: { en: 'Summers in {place} have cooled about {x} °C since {first}.', mn: '{place} зун {first} оноос хойш ойролцоогоор {x} градусаар сэрүүссэн.' },
      same: { en: 'Summer temperatures in {place} have barely changed since {first}.', mn: '{place} зуны температур {first} оноос хойш бараг өөрчлөгдөөгүй.' },
    },
  },
  {
    id: 'temp_winter', display: 'absolute', unit: '°C', decimals: 1,
    level: 'regional', source: 'NASA FLDAS land model',
    name: { en: 'Winter temperature', mn: 'Өвлийн агаарын температур' },
    short: { en: 'Winter temperature', mn: 'Өвлийн температур' },
    question: { en: 'Are winters getting colder or milder?', mn: 'Өвөл хүйтэн болж байна уу, зөөлөрч байна уу?' },
    season: { en: 'December to February average, labelled by the January year', mn: '12–2 сарын дундаж, 1 сарын оноор' },
    up: { en: 'milder', mn: 'зөөлөрсөн' }, down: { en: 'colder', mn: 'хүйтэрсэн' },
    newest: { en: 'The newest year, {y}, is the complete winter from December {y0} to February {y}.', mn: 'Хамгийн сүүлийн {y} он бол {y0} оны 12 сараас {y} оны 2 сар хүртэлх бүтэн өвөл.' },
    plain: {
      up: { en: 'Winters in {place} have become about {x} °C milder since {first}.', mn: '{place} өвөл {first} оноос хойш ойролцоогоор {x} градусаар зөөлөрсөн.' },
      down: { en: 'Winters in {place} have become about {x} °C colder since {first}.', mn: '{place} өвөл {first} оноос хойш ойролцоогоор {x} градусаар хүйтэрсэн.' },
      same: { en: 'Winter temperatures in {place} have barely changed since {first}.', mn: '{place} өвлийн температур {first} оноос хойш бараг өөрчлөгдөөгүй.' },
    },
  },
  {
    id: 'first_frost', display: 'absolute', unit: 'days', decimals: 0,
    level: 'point', source: 'NASA POWER (soum centre)',
    name: { en: 'First autumn frost', mn: 'Намрын анхны хяруу' },
    short: { en: 'First frost', mn: 'Анхны хяруу' },
    question: { en: 'Is the first frost coming later?', mn: 'Анхны хяруу хойшилж байна уу?' },
    season: { en: 'First day after 1 July below 0 °C (day of year)', mn: '7 сарын 1-ээс хойш 0 °C-аас доош орсон анхны өдөр' },
    up: { en: 'later', mn: 'хойшилсон' }, down: { en: 'earlier', mn: 'урагшилсан' },
    newest: { en: 'The newest year, {y}, is complete: a year counts only once its first frost has come.', mn: 'Хамгийн сүүлийн {y} он бүрэн: тухайн оны анхны хяруу орсны дараа л тооцдог.' },
    plain: {
      up: { en: 'The first autumn frost in {place} now comes about {x} {days} later than in {first}.', mn: '{place} намрын анхны хяруу {first} оноос хойш ойролцоогоор {x} хоногоор хойшилсон.' },
      down: { en: 'The first autumn frost in {place} now comes about {x} {days} earlier than in {first}.', mn: '{place} намрын анхны хяруу {first} оноос хойш ойролцоогоор {x} хоногоор урагшилсан.' },
      same: { en: 'The first autumn frost in {place} still comes at about the same time as in {first}.', mn: '{place} намрын анхны хяруу орох хугацаа {first} оноос хойш бараг өөрчлөгдөөгүй.' },
    },
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
