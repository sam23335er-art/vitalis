// Встроенный помощник VITALIS. Работает полностью на сервере сайта —
// без внешних API, ключей и оплаты. Знания хранятся в базе (коллекция knowledge)
// и пополняются администратором на странице «Обучение».

// ---------- Нормализация текста ----------

export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9ўқғҳ\s-]/gi, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokens = (norm) => norm.split(' ').filter((t) => t.length >= 2);

// Корень слова для подсказок администратору: «тренировки» → «тренир»
export function stemOf(word) {
  const w = normalize(word);
  if (w.length <= 3) return w;
  if (w.length === 4) return /[аеиоуыэюяь]$/.test(w) ? w.slice(0, 3) : w;
  const cut = w.replace(/(иями|ями|ами|ого|его|ому|ему|ыми|ими|ых|их|ой|ей|ий|ый|ая|яя|ое|ее|ую|юю|ам|ям|ах|ях|ом|ем|ов|ев|ть|ся|сь|ет|ют|ит|ат|ят|а|я|о|е|ы|и|у|ю|ь)$/, '');
  return cut.length >= 3 ? cut : w;
}

const STOP = new Set(
  'как что это мне меня мой моя мои для при или когда сколько можно нужно надо если чтобы где какой какая какие почему зачем есть ли без про над под после перед через очень уже еще тоже только так там тут вот было будет быть'.split(' ')
);

export function suggestKeywords(question) {
  const seen = new Set();
  for (const t of tokens(normalize(question))) {
    if (t.length < 4 || STOP.has(t)) continue;
    seen.add(stemOf(t));
  }
  return [...seen].slice(0, 6);
}

// ---------- Поиск подходящей темы ----------

function scoreEntry(entry, norm, toks) {
  let score = 0;
  const matched = [];
  for (const raw of entry.keywords || []) {
    const kw = normalize(raw);
    if (!kw) continue;
    if (kw.includes(' ')) {
      if (` ${norm} `.includes(` ${kw}`) || norm.includes(kw)) {
        score += 2 + kw.length * 0.08;
        matched.push(raw);
      }
    } else if (kw.length <= 2 ? toks.includes(kw) : toks.some((t) => t.startsWith(kw))) {
      score += 1 + kw.length * 0.05;
      matched.push(raw);
    }
  }
  // Точное совпадение с названием темы — почти гарантированный выбор
  const title = normalize(entry.title);
  if (title && norm.includes(title)) score += 5;
  return { score, matched };
}

export const MIN_SCORE = 1;

// Сколько значимых слов названия темы встречается в вопросе
function titleOverlap(title, toks) {
  return tokens(normalize(title)).filter((t) => t.length >= 4 && !STOP.has(t) && toks.some((q) => q.startsWith(stemOf(t)))).length;
}

export function findAnswer(message, knowledge) {
  const norm = normalize(message);
  const toks = tokens(norm);
  const ranked = knowledge
    .filter((k) => k.enabled !== false)
    .map((entry) => ({ entry, ...scoreEntry(entry, norm, toks) }))
    .filter((r) => r.score > 0)
    .map((r) => ({ ...r, titleHits: titleOverlap(r.entry.title, toks) }))
    .sort((a, b) => b.score - a.score || b.titleHits - a.titleHits);

  const best = ranked[0] && ranked[0].score >= MIN_SCORE ? ranked[0] : null;
  const suggestions = ranked
    .filter((r) => r !== best && r.score >= MIN_SCORE && (!best || r.score >= best.score * 0.5))
    .slice(0, 3)
    .map((r) => r.entry.title);

  return {
    best: best ? { id: best.entry.id, title: best.entry.title, score: Math.round(best.score * 100) / 100, matched: best.matched } : null,
    entry: best?.entry || null,
    suggestions,
    candidates: ranked.slice(0, 5).map((r) => ({ id: r.entry.id, title: r.entry.title, score: Math.round(r.score * 100) / 100, matched: r.matched })),
  };
}

// ---------- Подстановка личных цифр ----------

const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n)).replace(/ /g, ' ');
const GOAL = { lose: 'похудеть', keep: 'держать форму', gain: 'набрать массу' };

export const PLACEHOLDERS = [
  ['name', 'Имя пользователя'],
  ['kcal', 'Норма калорий'],
  ['protein', 'Белки, г'],
  ['fat', 'Жиры, г'],
  ['carbs', 'Углеводы, г'],
  ['fiber', 'Клетчатка, г'],
  ['water_rest', 'Вода в день отдыха, мл'],
  ['water_train', 'Вода в день тренировки, мл'],
  ['glasses', 'Количество стаканов воды'],
  ['sports_drink', 'Совет про изотоники'],
  ['weight', 'Текущий вес'],
  ['goal', 'Цель (похудеть / форма / масса)'],
  ['bmi', 'Индекс массы тела'],
  ['bmi_label', 'Оценка ИМТ'],
  ['ideal_min', 'Здоровый вес от'],
  ['ideal_max', 'Здоровый вес до'],
  ['diff', 'Сколько до цели'],
  ['eta', 'Срок до цели'],
  ['sweet_kcal', '10% калорий на сладкое'],
  ['today_menu', 'Меню на сегодня'],
  ['workout', 'Тренировка на сегодня'],
];

const PERSONAL = new Set(PLACEHOLDERS.map(([k]) => k).filter((k) => k !== 'name'));

// ctx: { name, metrics, todayMenu, workout } — metrics может отсутствовать
export function buildVars(ctx) {
  const v = { name: ctx.name || 'друг' };
  const m = ctx.metrics;
  if (!m) return v;
  const { nutrition: n, water: w, progress: p } = m;
  Object.assign(v, {
    kcal: fmt(n.kcal),
    protein: n.protein,
    fat: n.fat,
    carbs: n.carbs,
    fiber: n.fiber,
    water_rest: fmt(w.restDayMl),
    water_train: fmt(w.trainingDayMl),
    glasses: `${Math.ceil(w.restDayMl / 250)}–${Math.ceil(w.trainingDayMl / 250)}`,
    sports_drink: w.sportsDrink.text,
    weight: String(p.weight).replace('.', ','),
    goal: GOAL[ctx.goal] || 'держать форму',
    bmi: String(p.bmi.bmi).replace('.', ','),
    bmi_label: p.bmi.label.toLowerCase(),
    ideal_min: String(p.bmi.idealMin).replace('.', ','),
    ideal_max: String(p.bmi.idealMax).replace('.', ','),
    diff: p.target
      ? p.diff > 0
        ? `сбросить ${String(p.diff).replace('.', ',')} кг (цель — ${p.target} кг)`
        : p.diff < 0
          ? `набрать ${String(-p.diff).replace('.', ',')} кг (цель — ${p.target} кг)`
          : 'цель уже достигнута 🎉'
      : 'вес в норме — главное держать форму',
    eta: p.eta ? `${p.eta.weeksMin}–${p.eta.weeksMax} недель (темп ${p.eta.pace})` : 'при цели «держать форму» срок не нужен — следи, чтобы вес был в коридоре ±1,5 кг',
    sweet_kcal: fmt(Math.round(n.kcal * 0.1 / 10) * 10),
    today_menu: ctx.todayMenu || 'меню на сегодня ещё не составлено — нажми «Составить меню» в разделе «Питание»',
    workout: ctx.workout || 'составь план в разделе «Тренировки»',
  });
  return v;
}

export function renderAnswer(template, vars) {
  let missing = false;
  const text = String(template).replace(/\{([a-z_]+)\}/g, (all, key) => {
    if (vars[key] !== undefined && vars[key] !== null && vars[key] !== '') return String(vars[key]);
    if (PERSONAL.has(key)) {
      missing = true;
      return '—';
    }
    return all;
  });
  return missing ? `${text}\n\nЗаполни профиль в кабинете (рост, вес, возраст, цель) — и вместо «—» здесь появятся твои личные цифры.` : text;
}

export const FALLBACK =
  'Пока не знаю точного ответа на этот вопрос — я передал его тренерам, и они меня научат.\n\nПопробуй спросить по-другому или выбери тему:\n- сколько пить воды\n- сколько калорий мне нужно\n- как похудеть / как набрать массу\n- что есть до и после тренировки\n- техника брусьев, отжиманий, приседаний, подтягиваний\n- болят мышцы, сон, нет мотивации\n- цены, расписание, адрес клуба';
