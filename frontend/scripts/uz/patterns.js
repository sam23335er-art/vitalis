
// Шаблоны для фраз с числами и вложенным текстом (порядок важен: первое совпадение)
const tr = (s) => (UZ[s] !== undefined ? UZ[s] : s);
export const UZ_PATTERNS = [
  [/^Хорошо! (\d+)$/, (n) => `Yaxshi! ${n}`],
  [/^Не засчитано: (.+)$/, (r) => `Hisoblanmadi: ${tr(r)}`],
  [/^Подход выполнен: (\d+) правильных повторений!$/, (n) => `Yondashuv bajarildi: ${n} ta toʻgʻri takror!`],
  [
    /^Твои тренировки длятся (\d+) мин( и сейчас жаркий сезон)?: на тренировке можно пить изотоник — 400–800 мл в час небольшими глотками, начиная с 30–40-й минуты\. В остальное время — обычная вода\.$/,
    (m, hot) =>
      `Mashgʻulotlaring ${m} daqiqa davom etadi${hot ? ' va hozir issiq mavsum' : ''}: mashgʻulotda izotonik ichish mumkin — 30–40-daqiqadan boshlab kichik qultumlarda soatiga 400–800 ml. Qolgan vaqtda — oddiy suv.`,
  ],
  [/^([\d.,]+)–([\d.,]+) кг\/нед$/, (a, b) => `${a}–${b} kg/hafta`],
  [/^(.+) не найдена$/, (x) => `${tr(x)} topilmadi`],
  [/^(.+): от (.+) до (.+)$/, (x, a, b) => `${tr(x)}: ${a} dan ${b} gacha`],
  [/^от (\S+) до (\S+)$/, (a, b) => `${a} dan ${b} gacha`],
  [/^Некорректное значение: (.+)$/, (x) => `Notoʻgʻri qiymat: ${tr(x)}`],
  [/^Продукт используется в рецептах: (.+)$/, (x) => `Mahsulot retseptlarda ishlatiladi: ${x}`],
  [/^Ошибка (\d+)$/, (n) => `Xato ${n}`],
];
