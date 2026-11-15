// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Discover: "Stories from the steppe". Two kinds of card in the same rows:
//   tips: short articles for herders, each opening its article on discover.html (Ganaa's text, verbatim in English).
//         type 'large' has the quote slot (only Amraa's card has a real quote); 'small' has none.
//         The photo is a placeholder until a real, credited photo is chosen.
//   data cards: a place and a question; the number comes from the data, like every result, and "Read" opens that
//         result in the tool. Titles and places are from Bayasakh's mockup.
// MN text of the tips is a DRAFT translation for Anu to check.
const TIPS = [
  { id: 'amraa', type: 'large', colour: '#2E7A57', figure: 'aaruul',
    tag: { en: 'Meet a herder', mn: 'Малчинтай танилц' },
    chip: { en: '0 animals lost', mn: '0 мал хорогдоогүй' },
    title: { en: 'Meet Amraa, the herder who lost nothing', mn: 'Нэг ч мал алдаагүй малчин Амраатай танилц' },
    teaser: { en: 'The last dzud killed more than 7 million animals. His herd came through whole. Find out what he does differently, all year round.',
      mn: 'Сүүлийн зуд 7 сая гаруй малыг хорооллоо. Түүний сүрэг бүтэн үлдсэн. Тэр жилийн турш юуг өөрөөр хийдгийг мэдэж ав.' },
    quote: { en: '“A good herder doesn’t lose his animals, even in a dzud.”', mn: '“Сайн малчин зудад ч малаа алддаггүй.”' },
    source: { en: 'Amraa, State Best Herder · Pulitzer Center', mn: 'Амраа, Улсын сайн малчин · Pulitzer Center' } },
  { id: 'sell-early', type: 'small', colour: '#B9431C', figure: 'sun',
    tag: { en: 'Before winter', mn: 'Өвлийн өмнө' },
    chip: { en: 'Sell early', mn: 'Эрт борлуул' },
    title: { en: 'Sell in autumn, save the herd in spring', mn: 'Намар борлуулж, хавар сүргээ авар' },
    teaser: { en: 'Why do some families go into a dzud with full hay stores? See how selling a few animals early paid for the feed that saved the rest.',
      mn: 'Яагаад зарим айл зудад өвс тэжээлээ бүрэн бэлдсэн байдаг вэ? Цөөн малаа эрт борлуулсан нь үлдсэнийг нь аварсан тэжээлийн мөнгө болсныг хар.' },
    source: { en: 'FAO, 2018', mn: 'FAO, 2018' } },
  { id: 'dzud-map', type: 'small', colour: '#3A68BD', figure: 'cloud',
    tag: { en: 'Every November', mn: 'Жил бүрийн 11-р сар' },
    chip: { en: '1 map', mn: '1 зураг' },
    title: { en: 'The map every herder should check', mn: 'Малчин бүрийн харах ёстой зураг' },
    teaser: { en: 'NAMEM publishes a dzud risk map each November. Learn how to read it, and how 2,000 families used an early warning to buy hay before prices jumped.',
      mn: 'УЦУОШГ жил бүрийн 11-р сард зудын эрсдэлийн зураг гаргадаг. Түүнийг хэрхэн уншихыг, мөн 2,000 өрх эрт сэрэмжлүүлгийг ашиглан үнэ өсөхөөс өмнө өвс авсныг мэдэж ав.' },
    source: { en: 'Mongolian Red Cross study, 2022', mn: 'Монголын Улаан загалмайн судалгаа, 2022' } },
  { id: 'insurance', type: 'small', colour: '#15213B', figure: 'twin',
    tag: { en: 'Money and risk', mn: 'Мөнгө ба эрсдэл' },
    chip: { en: 'All 21 aimags', mn: '21 аймаг бүгд' },
    title: { en: 'Insurance that pays when your soum is hit', mn: 'Сумандаа хохирол гарахад төлдөг даатгал' },
    teaser: { en: 'You don’t have to prove a single loss. Find out how livestock insurance works in Mongolia, and why insured herders rebuild faster.',
      mn: 'Нэг ч хорогдлоо нотлох шаардлагагүй. Монголд малын даатгал хэрхэн ажилладгийг, даатгалтай малчид яагаад хурдан сэргэдгийг мэдэж ав.' },
    source: { en: 'CDKN', mn: 'CDKN' } },
];
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
// The two drifting rows: a tip, then data cards, so each row mixes both kinds ('t' + index into TIPS, 's' + into STORIES).
const ROWS = [['t0', 's1', 't1', 's2', 's3', 's0'], ['t2', 's4', 't3', 's5', 's6', 's7']];
Q.stories = STORIES;
Q.tips = TIPS;
Q.storyRows = ROWS;
})(globalThis.Q = globalThis.Q || {});
