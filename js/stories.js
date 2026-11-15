// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Discover: four tips for herders, in cards like "What is Quindecim"; each opens its article on discover.html
// (Ganaa's text, verbatim in English). Only Amraa's card has a quote.
// MN text of the tips is a DRAFT translation for Anu to check.
const TIPS = [
  { id: 'amraa', colour: '#2E7A57', figure: 'aaruul',
    tag: { en: 'Meet a herder', mn: 'Малчинтай танилц' },
    chip: { en: '0 animals lost', mn: '0 мал хорогдоогүй' },
    title: { en: 'Meet Amraa, the herder who lost nothing', mn: 'Нэг ч мал алдаагүй малчин Амраатай танилц' },
    teaser: { en: 'The last dzud killed more than 7 million animals. His herd came through whole. Find out what he does differently, all year round.',
      mn: 'Сүүлийн зуд 7 сая гаруй малыг хорооллоо. Түүний сүрэг бүтэн үлдсэн. Тэр жилийн турш юуг өөрөөр хийдгийг мэдэж ав.' },
    quote: { en: '“A good herder doesn’t lose his animals, even in a dzud.”', mn: '“Сайн малчин зудад ч малаа алддаггүй.”' },
    source: { en: 'Amraa, State Best Herder · Pulitzer Center', mn: 'Амраа, Улсын сайн малчин · Pulitzer Center' } },
  { id: 'sell-early', colour: '#B9431C', figure: 'sun',
    tag: { en: 'Before winter', mn: 'Өвлийн өмнө' },
    chip: { en: 'Sell early', mn: 'Эрт борлуул' },
    title: { en: 'Sell in autumn, save the herd in spring', mn: 'Намар борлуулж, хавар сүргээ авар' },
    teaser: { en: 'Why do some families go into a dzud with full hay stores? See how selling a few animals early paid for the feed that saved the rest.',
      mn: 'Яагаад зарим айл зудад өвс тэжээлээ бүрэн бэлдсэн байдаг вэ? Цөөн малаа эрт борлуулсан нь үлдсэнийг нь аварсан тэжээлийн мөнгө болсныг хар.' },
    source: { en: 'FAO, 2018', mn: 'FAO, 2018' } },
  { id: 'dzud-map', colour: '#3A68BD', figure: 'cloud',
    tag: { en: 'Every November', mn: 'Жил бүрийн 11-р сар' },
    chip: { en: '1 map', mn: '1 зураг' },
    title: { en: 'The map every herder should check', mn: 'Малчин бүрийн харах ёстой зураг' },
    teaser: { en: 'NAMEM publishes a dzud risk map each November. Learn how to read it, and how 2,000 families used an early warning to buy hay before prices jumped.',
      mn: 'УЦУОШГ жил бүрийн 11-р сард зудын эрсдэлийн зураг гаргадаг. Түүнийг хэрхэн уншихыг, мөн 2,000 өрх эрт сэрэмжлүүлгийг ашиглан үнэ өсөхөөс өмнө өвс авсныг мэдэж ав.' },
    source: { en: 'Mongolian Red Cross study, 2022', mn: 'Монголын Улаан загалмайн судалгаа, 2022' } },
  { id: 'insurance', colour: '#15213B', figure: 'twin',
    tag: { en: 'Money and risk', mn: 'Мөнгө ба эрсдэл' },
    chip: { en: 'All 21 aimags', mn: '21 аймаг бүгд' },
    title: { en: 'Insurance that pays when your soum is hit', mn: 'Сумандаа хохирол гарахад төлдөг даатгал' },
    teaser: { en: 'You don’t have to prove a single loss. Find out how livestock insurance works in Mongolia, and why insured herders rebuild faster.',
      mn: 'Нэг ч хорогдлоо нотлох шаардлагагүй. Монголд малын даатгал хэрхэн ажилладгийг, даатгалтай малчид яагаад хурдан сэргэдгийг мэдэж ав.' },
    source: { en: 'CDKN', mn: 'CDKN' } },
];
Q.tips = TIPS;
})(globalThis.Q = globalThis.Q || {});
