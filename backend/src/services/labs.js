// Разбор анализов и подбор пищевого профиля.
// Это не диагностика: отклонения подсвечиваются, при значимых — рекомендация врача.
// Референсные значения — типовые для взрослых; у конкретной лаборатории они могут отличаться.

export const MARKERS = [
  { key: 'glucose', label: 'Глюкоза натощак', unit: 'ммоль/л', min: 3.9, max: 5.5, critHigh: 7.0, critLow: 3.0, high: ['lowSugar'], group: 'Углеводный обмен' },
  { key: 'hba1c', label: 'Гликированный гемоглобин HbA1c', unit: '%', max: 5.6, critHigh: 6.5, high: ['lowSugar'], group: 'Углеводный обмен' },
  { key: 'cholesterol', label: 'Холестерин общий', unit: 'ммоль/л', max: 5.2, critHigh: 7.5, high: ['heart'], group: 'Липиды' },
  { key: 'ldl', label: 'ЛПНП («плохой» холестерин)', unit: 'ммоль/л', max: 3.0, critHigh: 4.9, high: ['heart'], group: 'Липиды' },
  { key: 'hdl', label: 'ЛПВП («хороший» холестерин)', unit: 'ммоль/л', min: { m: 1.0, f: 1.2 }, low: ['heart'], group: 'Липиды' },
  { key: 'triglycerides', label: 'Триглицериды', unit: 'ммоль/л', max: 1.7, critHigh: 5.6, high: ['heart', 'lowSugar'], group: 'Липиды' },
  { key: 'hemoglobin', label: 'Гемоглобин', unit: 'г/л', min: { m: 130, f: 120 }, max: { m: 170, f: 150 }, critLow: 100, low: ['ironRich'], group: 'Кровь' },
  { key: 'ferritin', label: 'Ферритин', unit: 'нг/мл', min: { m: 30, f: 15 }, max: { m: 400, f: 150 }, low: ['ironRich'], group: 'Кровь' },
  { key: 'vitaminD', label: 'Витамин D (25-OH)', unit: 'нг/мл', min: 30, max: 100, critLow: 12, low: ['vitD'], group: 'Витамины' },
  { key: 'b12', label: 'Витамин B12', unit: 'пг/мл', min: 200, max: 900, low: ['b12'], group: 'Витамины' },
  { key: 'uricAcid', label: 'Мочевая кислота', unit: 'мкмоль/л', max: { m: 420, f: 360 }, high: ['lowPurine'], group: 'Почки и печень' },
  { key: 'creatinine', label: 'Креатинин', unit: 'мкмоль/л', min: { m: 62, f: 53 }, max: { m: 115, f: 97 }, high: ['moderateProtein'], doctorHigh: true, group: 'Почки и печень' },
  { key: 'alt', label: 'АЛТ', unit: 'Ед/л', max: { m: 41, f: 33 }, critHighMult: 3, high: ['liver'], group: 'Почки и печень' },
  { key: 'tsh', label: 'ТТГ (щитовидная железа)', unit: 'мМЕ/л', min: 0.4, max: 4.0, doctorAny: true, group: 'Гормоны' },
  { key: 'systolic', label: 'Давление верхнее', unit: 'мм рт. ст.', min: 90, max: 129, critHigh: 160, high: ['lowSalt', 'heart'], group: 'Давление' },
  { key: 'diastolic', label: 'Давление нижнее', unit: 'мм рт. ст.', min: 60, max: 84, critHigh: 100, high: ['lowSalt', 'heart'], group: 'Давление' },
];

// Что означает каждый флаг для меню
export const FLAG_RULES = {
  lowSugar: {
    title: 'Контроль сахара',
    avoidTags: ['sugar'],
    preferTags: ['fiber', 'lowCarb'],
    prefer: ['овощи', 'бобовые', 'гречка, булгур, овсянка', 'цельнозерновой хлеб', 'яйца, птица, рыба'],
    limit: ['сахар, мёд, сладости', 'сладкие напитки и соки', 'белый хлеб и выпечка', 'курага, изюм, бананы — небольшими порциями'],
  },
  heart: {
    title: 'Здоровье сердца и сосудов',
    avoidTags: ['fattyMeat', 'organ'],
    preferTags: ['fish', 'heart', 'fiber'],
    prefer: ['рыба 2–3 раза в неделю', 'оливковое масло', 'овсянка', 'бобовые', 'орехи 20–30 г в день'],
    limit: ['жирная баранина, курдючный жир', 'колбасы и копчёности', 'жареное во фритюре', 'сливочное масло'],
  },
  ironRich: {
    title: 'Поддержка уровня железа',
    preferTags: ['iron'],
    prefer: ['говядина, печень', 'гречка', 'чечевица, маш, фасоль', 'шпинат', 'лимон и овощи с витамином C к блюдам'],
    limit: ['чай и кофе сразу после еды — пить через 1–2 часа', 'молочные продукты в один приём с железосодержащими'],
  },
  vitD: {
    title: 'Витамин D',
    preferTags: ['vitD', 'fish'],
    prefer: ['жирная рыба (лосось)', 'яйца', 'грибы'],
    limit: [],
    note: 'Из еды витамина D получить сложно — дозировку добавок назначает врач.',
  },
  b12: {
    title: 'Витамин B12',
    preferTags: ['fish'],
    prefer: ['говядина, печень', 'рыба', 'яйца, молочные продукты'],
    limit: [],
    note: 'При дефиците B12 обратитесь к врачу — часто нужны добавки.',
  },
  lowPurine: {
    title: 'Снижение мочевой кислоты',
    avoidTags: ['organ', 'fattyMeat'],
    softAvoidTags: ['redMeat'],
    preferTags: ['vegetarian'],
    prefer: ['молочные продукты', 'овощи и крупы', 'вода 2+ литра в день'],
    limit: ['субпродукты (печень)', 'красное мясо — не чаще 2–3 раз в неделю', 'крепкие бульоны', 'алкоголь, особенно пиво'],
  },
  liver: {
    title: 'Бережное питание для печени',
    avoidTags: ['fattyMeat', 'fried'],
    preferTags: ['heart', 'fiber'],
    prefer: ['овощи, крупы', 'нежирная птица и рыба', 'запекание и варка вместо жарки'],
    limit: ['алкоголь — полностью', 'жирное и жареное', 'сладкие газировки'],
  },
  moderateProtein: {
    title: 'Умеренный белок',
    avoidTags: ['organ'],
    prefer: ['овощи и крупы', 'белок — около 1 г на кг веса'],
    limit: ['спортивные протеиновые добавки без согласования с врачом', 'большие порции мяса'],
    note: 'Повышенный креатинин — повод обратиться к врачу до увеличения нагрузок.',
  },
  lowSalt: {
    title: 'Меньше соли',
    preferTags: ['heart'],
    prefer: ['свежие овощи и зелень', 'специи и лимон вместо соли', 'домашняя еда'],
    limit: ['соль — до 5 г в день (1 чайная ложка)', 'соленья, консервы, колбасы', 'фастфуд и чипсы'],
  },
};

const pick = (v, sex) => (v && typeof v === 'object' ? v[sex] : v);
const fmt = (n) => String(n).replace('.', ',');

export function analyzeLabs(values = {}, sex = 'm') {
  const findings = [];
  const flags = new Set();
  let doctor = false;

  for (const m of MARKERS) {
    const raw = values[m.key];
    if (raw === undefined || raw === null || raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;

    const min = pick(m.min, sex);
    const max = pick(m.max, sex);
    let status = 'normal';
    let message = 'В пределах нормы.';

    if (min !== undefined && value < min) {
      status = 'low';
      message = 'Ниже нормы.';
      (m.low || []).forEach((f) => flags.add(f));
      if (m.critLow !== undefined && value < m.critLow) status = 'critical';
    } else if (max !== undefined && value > max) {
      status = 'high';
      message = 'Выше нормы.';
      (m.high || []).forEach((f) => flags.add(f));
      if (m.critHigh !== undefined && value >= m.critHigh) status = 'critical';
      if (m.critHighMult && value >= max * m.critHighMult) status = 'critical';
      if (m.doctorHigh) doctor = true;
    }

    if (status !== 'normal' && m.doctorAny) {
      message += ' Покажите результат эндокринологу.';
      doctor = true;
    }
    if (status === 'critical') {
      message = 'Значительное отклонение — обязательно обратитесь к врачу, не меняйте питание самостоятельно.';
      doctor = true;
    }

    const range =
      min !== undefined && max !== undefined ? `${fmt(min)}–${fmt(max)}` : min !== undefined ? `от ${fmt(min)}` : `до ${fmt(max)}`;

    findings.push({ key: m.key, label: m.label, group: m.group, unit: m.unit, value, range, status, message });
  }

  return { findings, flags: [...flags], doctor, diet: dietProfile([...flags]) };
}

export function dietProfile(flags = []) {
  const avoidTags = new Set();
  const softAvoidTags = new Set();
  const preferTags = new Set();
  const prefer = [];
  const limit = [];
  const notes = [];
  const sections = [];

  for (const f of flags) {
    const r = FLAG_RULES[f];
    if (!r) continue;
    (r.avoidTags || []).forEach((t) => avoidTags.add(t));
    (r.softAvoidTags || []).forEach((t) => softAvoidTags.add(t));
    (r.preferTags || []).forEach((t) => preferTags.add(t));
    prefer.push(...r.prefer);
    limit.push(...r.limit);
    if (r.note) notes.push(r.note);
    sections.push({ flag: f, title: r.title, prefer: r.prefer, limit: r.limit, note: r.note || null });
  }

  return {
    avoidTags: [...avoidTags],
    softAvoidTags: [...softAvoidTags],
    preferTags: [...preferTags],
    prefer: [...new Set(prefer)],
    limit: [...new Set(limit)],
    notes,
    sections,
  };
}
