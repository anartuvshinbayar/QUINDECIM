// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// One entry per variable id used in data/data.csv.
// display: 'percent' shows the rate as % of the period average per decade; 'absolute' shows units per decade.
// level: 'soum' = genuinely soum-level data; 'regional' = coarse model cells shared by nearby soums.
// newest: what the newest year covers (always a complete season). plain: the one-sentence result (js/app.js).
// resolution: what one value stands for on the ground. confidence: how far its trends can be trusted, and why
// (shown with every result and on methods.html).
// steps: the map's three shades of change along the trend line over the chosen years (in % for percent questions, else
// in units): up to steps[0], up to steps[1], more. nation: the sentence for all of Mongolia ({n} of {total} soums).
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
    resolution: { en: 'Satellite pixels of 1 km (NASA MODIS), averaged over the grassland in each soum.', mn: 'НАСА-гийн MODIS хиймэл дагуулын 1 км пиксел, сум бүрийн бэлчээр дээрх дундаж.' },
    confidence: { level: 'high', en: 'high (measured from space every 16 days, the most direct of the five)', mn: 'өндөр (16 хоног тутам сансраас хэмждэг, тавуулангаас хамгийн шууд хэмжилт)' },
    steps: [15, 30],
    nation: {
      up: { en: 'In {n} of {total} soums, summer greenness has really risen since {first}.', mn: '{total} сумаас {n} суманд зуны ногоорол {first} оноос хойш бодитоор нэмэгдсэн.' },
      down: { en: 'In {n} of {total} soums, summer greenness has really fallen since {first}.', mn: '{total} сумаас {n} суманд зуны ногоорол {first} оноос хойш бодитоор буурсан.' },
      none: { en: 'No soum shows a real change in summer greenness since {first}.', mn: '{first} оноос хойш зуны ногоорол бодитоор өөрчлөгдсөн сум алга.' },
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
    resolution: { en: 'Land-model cells of 0.1° (about 11 × 8 km, NASA FLDAS); neighbouring soums often share values.', mn: 'Газрын загварын 0.1° нүд (ойролцоогоор 11 × 8 км, НАСА FLDAS); хөрш сумд ихэвчлэн ижил утгатай.' },
    confidence: { level: 'low', en: 'lower (rainfall from a land model is the least certain of the five, so read its trends with care)', mn: 'харьцангуй бага (загвараас гаргасан хур тунадас тавуулангаас хамгийн тодорхойгүй тул чиг хандлагыг болгоомжтой уншина уу)' },
    steps: [20, 30],
    nation: {
      up: { en: 'In {n} of {total} soums, summer rainfall has really risen since {first}.', mn: '{total} сумаас {n} суманд зуны хур тунадас {first} оноос хойш бодитоор нэмэгдсэн.' },
      down: { en: 'In {n} of {total} soums, summer rainfall has really fallen since {first}.', mn: '{total} сумаас {n} суманд зуны хур тунадас {first} оноос хойш бодитоор буурсан.' },
      none: { en: 'No soum shows a real change in summer rainfall since {first}.', mn: '{first} оноос хойш зуны хур тунадас бодитоор өөрчлөгдсөн сум алга.' },
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
      up: { en: 'Summers in {place} have warmed about {x}\u00A0°C since {first}.', mn: '{place} зун {first} оноос хойш ойролцоогоор {x}\u00A0градусаар дулаарсан.' },
      down: { en: 'Summers in {place} have cooled about {x}\u00A0°C since {first}.', mn: '{place} зун {first} оноос хойш ойролцоогоор {x}\u00A0градусаар сэрүүссэн.' },
      same: { en: 'Summer temperatures in {place} have barely changed since {first}.', mn: '{place} зуны температур {first} оноос хойш бараг өөрчлөгдөөгүй.' },
    },
    resolution: { en: 'Land-model cells of 0.1° (about 11 × 8 km, NASA FLDAS); neighbouring soums often share values.', mn: 'Газрын загварын 0.1° нүд (ойролцоогоор 11 × 8 км, НАСА FLDAS); хөрш сумд ихэвчлэн ижил утгатай.' },
    confidence: { level: 'good', en: 'good (it rises and falls with ten weather stations year by year, but shows less warming than they measure, so its warming figures are cautious)', mn: 'сайн (арван цаг уурын станцтай жил бүр хамт өсч буурдаг ч тэдний хэмжсэнээс бага дулаарал харуулдаг тул дулаарлын тоо нь болгоомжтой)' },
    steps: [1, 2],
    nation: {
      up: { en: 'In {n} of {total} soums, summers have really warmed since {first}.', mn: '{total} сумаас {n} суманд зун {first} оноос хойш бодитоор дулаарсан.' },
      down: { en: 'In {n} of {total} soums, summers have really cooled since {first}.', mn: '{total} сумаас {n} суманд зун {first} оноос хойш бодитоор сэрүүссэн.' },
      none: { en: 'No soum shows a real change in summer temperature since {first}.', mn: '{first} оноос хойш зуны температур бодитоор өөрчлөгдсөн сум алга.' },
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
      up: { en: 'Winters in {place} have become about {x}\u00A0°C milder since {first}.', mn: '{place} өвөл {first} оноос хойш ойролцоогоор {x}\u00A0градусаар зөөлөрсөн.' },
      down: { en: 'Winters in {place} have become about {x}\u00A0°C colder since {first}.', mn: '{place} өвөл {first} оноос хойш ойролцоогоор {x}\u00A0градусаар хүйтэрсэн.' },
      same: { en: 'Winter temperatures in {place} have barely changed since {first}.', mn: '{place} өвлийн температур {first} оноос хойш бараг өөрчлөгдөөгүй.' },
    },
    resolution: { en: 'Land-model cells of 0.1° (about 11 × 8 km, NASA FLDAS); neighbouring soums often share values.', mn: 'Газрын загварын 0.1° нүд (ойролцоогоор 11 × 8 км, НАСА FLDAS); хөрш сумд ихэвчлэн ижил утгатай.' },
    confidence: { level: 'medium', en: 'medium (the model misses the winter inversions of cold basins, so it reads milder than weather stations, by up to 13 °C in the Uvs basin; like most stations, it shows no clear winter trend)', mn: 'дунд (загвар хүйтэн хотгорын өвлийн инверсийг алгасдаг тул цаг уурын станцаас дулаан гардаг, Увсын хотгорт 13 °C хүртэл; ихэнх станцын адил өвлийн тодорхой чиг хандлага харуулдаггүй)' },
    steps: [0.5, 1],
    nation: {
      up: { en: 'In {n} of {total} soums, winters have really become milder since {first}.', mn: '{total} сумаас {n} суманд өвөл {first} оноос хойш бодитоор зөөлөрсөн.' },
      down: { en: 'In {n} of {total} soums, winters have really become colder since {first}.', mn: '{total} сумаас {n} суманд өвөл {first} оноос хойш бодитоор хүйтэрсэн.' },
      none: { en: 'No soum shows a real change in winter temperature since {first}.', mn: '{first} оноос хойш өвлийн температур бодитоор өөрчлөгдсөн сум алга.' },
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
      up: { en: 'The first autumn frost in {place} now comes about {x}\u00A0{days} later than in {first}.', mn: '{place} намрын анхны хяруу {first} оноос хойш ойролцоогоор {x}\u00A0хоногоор хойшилсон.' },
      down: { en: 'The first autumn frost in {place} now comes about {x}\u00A0{days} earlier than in {first}.', mn: '{place} намрын анхны хяруу {first} оноос хойш ойролцоогоор {x}\u00A0хоногоор урагшилсан.' },
      same: { en: 'The first autumn frost in {place} still comes at about the same time as in {first}.', mn: '{place} намрын анхны хяруу орох хугацаа {first} оноос хойш бараг өөрчлөгдөөгүй.' },
    },
    resolution: { en: 'One NASA POWER grid cell (0.5° × 0.625°, about 55 × 47 km) at the soum centre; neighbouring soums often share it.', mn: 'Сумын төв дээрх НАСА POWER-ийн нэг нүд (0.5° × 0.625°, ойролцоогоор 55 × 47 км); хөрш сумд ихэвчлэн хуваалцана.' },
    confidence: { level: 'medium', en: 'medium (one coarse cell and a daily minimum below 0 °C give the general timing, not the exact frost day in one valley)', mn: 'дунд (нэг том нүд болон 0 °C-аас доош хамгийн бага температур ерөнхий хугацааг харуулна, нэг хөндийн яг хяруу орох өдрийг биш)' },
    steps: [7, 14],
    nation: {
      up: { en: 'In {n} of {total} soums, the first autumn frost has really moved later since {first}.', mn: '{total} сумаас {n} суманд намрын анхны хяруу {first} оноос хойш бодитоор хойшилсон.' },
      down: { en: 'In {n} of {total} soums, the first autumn frost has really moved earlier since {first}.', mn: '{total} сумаас {n} суманд намрын анхны хяруу {first} оноос хойш бодитоор урагшилсан.' },
      none: { en: 'No soum shows a real change in the date of the first autumn frost since {first}.', mn: '{first} оноос хойш намрын анхны хяруу орох хугацаа бодитоор өөрчлөгдсөн сум алга.' },
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
