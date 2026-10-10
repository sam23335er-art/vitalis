// Тренировки: библиотека упражнений, шаблоны и генерация расписания на месяц
import { monthDates, weekday } from '../util.js';

// camera — упражнение, которое умеет проверять ИИ-тренер через камеру
export const EXERCISES = {
  squats: { name: 'Приседания', muscle: 'Ноги, ягодицы', camera: 'squats', tip: 'Колени по направлению носков, спина прямая, бедро до параллели с полом.' },
  pushups: { name: 'Отжимания', muscle: 'Грудь, трицепс', camera: 'pushups', tip: 'Тело — прямая линия от головы до пяток, грудь почти касается пола.' },
  dips: { name: 'Отжимания на брусьях', muscle: 'Трицепс, грудь', camera: 'dips', tip: 'Опускайся до угла в локтях 90°, наверху полностью выпрями руки.' },
  pullups: { name: 'Подтягивания', muscle: 'Спина, бицепс', camera: 'pullups', tip: 'Подбородок выше перекладины, внизу руки выпрямлены полностью.' },
  curls: { name: 'Сгибания на бицепс', muscle: 'Бицепс', camera: 'curls', tip: 'Локти прижаты к корпусу, не раскачивайся.' },
  lunges: { name: 'Выпады', muscle: 'Ноги, ягодицы', tip: 'Колено задней ноги почти касается пола, корпус вертикально.' },
  deadlift: { name: 'Румынская тяга', muscle: 'Задняя поверхность бедра, спина', tip: 'Спина прямая, гриф скользит по ногам.' },
  bench: { name: 'Жим лёжа', muscle: 'Грудь, плечи', tip: 'Лопатки сведены, гриф опускается на низ груди.' },
  row: { name: 'Тяга гантели в наклоне', muscle: 'Спина', tip: 'Тяни локтем к поясу, не скручивай корпус.' },
  press: { name: 'Жим гантелей сидя', muscle: 'Плечи', tip: 'Не прогибай поясницу, гантели над плечами.' },
  plank: { name: 'Планка', muscle: 'Пресс, кор', tip: 'Таз не проваливается и не поднимается.', unit: 'сек' },
  crunch: { name: 'Скручивания', muscle: 'Пресс', tip: 'Поднимай лопатки, а не тяни шею руками.' },
  burpees: { name: 'Бёрпи', muscle: 'Всё тело, кардио', tip: 'Держи темп, приземляйся мягко.' },
  cardio: { name: 'Кардио (дорожка, велосипед)', muscle: 'Сердце, выносливость', tip: 'Пульс 60–70% от максимума — можно говорить, но не петь.', unit: 'мин' },
  stretch: { name: 'Растяжка', muscle: 'Мобильность', tip: 'Без рывков, по 30 секунд на позицию.', unit: 'мин' },
};

const TEMPLATES = {
  fullA: { title: 'Всё тело A', ex: ['squats', 'pushups', 'row', 'plank'] },
  fullB: { title: 'Всё тело B', ex: ['lunges', 'dips', 'pullups', 'crunch'] },
  fullC: { title: 'Всё тело C', ex: ['deadlift', 'bench', 'curls', 'plank'] },
  hiit: { title: 'Кардио и пресс', ex: ['burpees', 'squats', 'crunch', 'cardio'] },
  upper: { title: 'Верх тела', ex: ['bench', 'pullups', 'press', 'dips', 'curls'] },
  lower: { title: 'Низ тела', ex: ['squats', 'deadlift', 'lunges', 'plank'] },
  push: { title: 'Жимовой день', ex: ['bench', 'pushups', 'press', 'dips'] },
  pull: { title: 'Тяговый день', ex: ['pullups', 'row', 'curls', 'crunch'] },
  legs: { title: 'Ноги и кор', ex: ['squats', 'lunges', 'deadlift', 'plank'] },
};

const SPLITS = {
  1: ['fullA'],
  2: ['fullA', 'fullB'],
  3: ['fullA', 'fullB', 'fullC'],
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['push', 'pull', 'legs', 'upper', 'hiit'],
  6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
  7: ['push', 'pull', 'legs', 'hiit', 'upper', 'lower', 'fullA'],
};

function dose(goal, level, exKey) {
  const ex = EXERCISES[exKey];
  const minus = level === 'beginner' ? 1 : 0;
  if (ex.unit === 'мин') return { sets: 1, reps: exKey === 'cardio' ? (goal === 'lose' ? 25 : 15) : 10 };
  if (ex.unit === 'сек') return { sets: 3 - minus, reps: level === 'beginner' ? 30 : 45 };
  if (goal === 'gain') return { sets: 4 - minus, reps: '6–10' };
  if (goal === 'lose') return { sets: 3, reps: '12–15' };
  return { sets: 3 - minus, reps: '10–12' };
}

export function buildWorkout(templateKey, profile) {
  const t = TEMPLATES[templateKey];
  const exercises = t.ex.map((key) => ({
    key,
    name: EXERCISES[key].name,
    camera: EXERCISES[key].camera || null,
    unit: EXERCISES[key].unit || 'повт.',
    ...dose(profile.goal, profile.level, key),
  }));
  // Для похудения добавляем короткое кардио в конце
  if (profile.goal === 'lose' && !t.ex.includes('cardio')) {
    exercises.push({ key: 'cardio', name: EXERCISES.cardio.name, camera: null, unit: 'мин', sets: 1, reps: 15 });
  }
  exercises.push({ key: 'stretch', name: EXERCISES.stretch.name, camera: null, unit: 'мин', sets: 1, reps: 5 });
  return { template: templateKey, title: t.title, exercises };
}

export function generateTraining({ userId, profile, month, fromDate = null }) {
  const days = (profile.trainingDays || [0, 2, 4]).filter((d) => d >= 0 && d <= 6).sort();
  const split = SPLITS[days.length] || SPLITS[3];
  const out = [];
  let i = 0;
  for (const date of monthDates(month)) {
    if (!days.includes(weekday(date))) continue;
    const key = split[i % split.length];
    i += 1;
    if (fromDate && date < fromDate) continue;
    out.push({ userId, date, ...buildWorkout(key, profile), done: false });
  }
  return out;
}
