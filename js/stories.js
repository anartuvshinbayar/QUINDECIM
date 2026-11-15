// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Stories from herders. TRIAL: these are placeholders (titles and places from Bayasakh's mockup) until she sends the real
// text and photos, so the section is only shown with ?stories=1 in the address (js/app.js: STORIES_ON).
// The number on each card is not written here: it comes from the data for that place and question, like every result.
//   place: { soum: id } or { aimag: name }; variable: the question; type: 'wide' or 'number'; colour, figure: the look.
const STORIES = [
  { place: { soum: '129839' }, variable: 'ndvi_summer', type: 'wide', colour: '#2E7A57', figure: 'swirl',
    title: { en: 'The greenest soum in Mongolia', mn: 'Монголын хамгийн ногоорсон сум' } },
  { place: { soum: '129698' }, variable: 'ndvi_summer', type: 'number', colour: '#2E7A57', figure: 'aaruul',
    title: { en: 'Grass is back where the sand was', mn: 'Элс байсан газар өвс эргэж ургасан' } },
  { place: { aimag: 'Govi-Altai' }, variable: 'rain_summer', type: 'number', colour: '#15213B', figure: 'cloud',
    title: { en: '"Not proven" is an answer too', mn: '"Батлагдаагүй" бас хариулт' } },
  { place: { aimag: 'Khövsgöl' }, variable: 'first_frost', type: 'number', colour: '#3A68BD', figure: 'twin',
    title: { en: 'When does the first frost come?', mn: 'Анхны хяруу хэзээ ордог вэ?' } },
  { place: { aimag: 'Ömnögovi' }, variable: 'temp_summer', type: 'wide', colour: '#B9431C', figure: 'sun',
    title: { en: 'Hotter summers on the Gobi', mn: 'Говийн халуун зун' } },
  { place: { aimag: 'Zavkhan' }, variable: 'temp_winter', type: 'number', colour: '#15213B', figure: 'wind',
    title: { en: 'A winter to remember', mn: 'Мартагдашгүй өвөл' } },
  { place: { aimag: 'Arkhangai' }, variable: 'rain_summer', type: 'number', colour: '#3A68BD', figure: 'cloud',
    title: { en: 'Rain at the wrong time', mn: 'Буруу цагт орсон бороо' } },
  { place: { aimag: 'Dornod' }, variable: 'ndvi_summer', type: 'wide', colour: '#2E7A57', figure: 'aaruul',
    title: { en: 'The eastern steppe greens', mn: 'Зүүн талын тал нутаг ногоорч байна' } },
];
Q.stories = STORIES;
})(globalThis.Q = globalThis.Q || {});
