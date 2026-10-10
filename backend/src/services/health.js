// Расчёты здоровья: калории, БЖУ, вода, идеальный вес, сроки результата.
// Формулы — общепринятые (Миффлин — Сан Жеор, рекомендации ВОЗ по ИМТ),
// результат ориентировочный и не заменяет консультацию врача.

export const ACTIVITY = {
  1.2: 'Минимальная',
  1.375: 'Лёгкая',
  1.55: 'Средняя',
  1.725: 'Высокая',
  1.9: 'Очень высокая',
};

export const REQUIRED_PROFILE = ['sex', 'age', 'height', 'weight', 'activity', 'goal'];

export function isProfileComplete(p = {}) {
  return REQUIRED_PROFILE.every((k) => p[k] !== undefined && p[k] !== null && p[k] !== '');
}

const round = (n, step = 1) => Math.round(n / step) * step;

export function bmiInfo(weight, height) {
  const bmi = weight / Math.pow(height / 100, 2);
  let label = 'Норма';
  let tone = 'ok';
  if (bmi < 18.5) [label, tone] = ['Недостаток веса', 'warn'];
  else if (bmi >= 30) [label, tone] = ['Ожирение', 'bad'];
  else if (bmi >= 25) [label, tone] = ['Избыточный вес', 'warn'];
  const h2 = Math.pow(height / 100, 2);
  return {
    bmi: Math.round(bmi * 10) / 10,
    label,
    tone,
    idealMin: Math.round(18.5 * h2 * 10) / 10,
    idealMax: Math.round(24.9 * h2 * 10) / 10,
  };
}

export function calcNutrition(p) {
  const { sex, age, height, weight, activity, goal } = p;
  const flags = new Set(p.dietFlags || []);
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'm' ? 5 : -161);
  const tdee = bmr * Number(activity);

  let kcal = tdee;
  if (goal === 'lose') kcal = tdee * 0.82;
  if (goal === 'gain') kcal = tdee * 1.1;
  // Безопасный минимум: не ниже базового обмена и не ниже 1200/1500 ккал
  const floor = Math.max(bmr, sex === 'm' ? 1500 : 1200);
  kcal = round(Math.max(kcal, floor), 10);

  let proteinPerKg = goal === 'keep' ? 1.5 : 1.8;
  if (flags.has('moderateProtein')) proteinPerKg = 1.0;
  const protein = Math.round(weight * proteinPerKg);

  let fat = Math.round(Math.max(weight * 0.9, (kcal * 0.25) / 9));
  let carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);

  // При повышенном сахаре ограничиваем углеводы до 40% калорийности
  if (flags.has('lowSugar')) {
    const maxCarbs = Math.round((kcal * 0.4) / 4);
    if (carbs > maxCarbs) {
      carbs = maxCarbs;
      fat = Math.round((kcal - protein * 4 - carbs * 4) / 9);
    }
  }

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    kcal,
    protein,
    fat,
    carbs: Math.max(carbs, 0),
    fiber: sex === 'm' ? 30 : 25,
  };
}

const HOT_MONTHS = new Set([5, 6, 7, 8, 9]); // май — сентябрь в Узбекистане

export function calcWater(p, date = new Date()) {
  const w = Number(p.weight);
  const minutes = Number(p.sessionMinutes) || 60;
  const hot = HOT_MONTHS.has(date.getMonth() + 1);
  const base = round(w * 32, 50);
  const workoutExtra = round((minutes / 60) * 600, 50);
  const heatExtra = hot ? 500 : 0;
  const restDay = base + heatExtra;
  const trainingDay = restDay + workoutExtra;

  // Спортивные напитки нужны только при длительной или очень интенсивной нагрузке
  const needSports = minutes > 75 || (hot && minutes >= 60);
  return {
    restDayMl: restDay,
    trainingDayMl: trainingDay,
    glassMl: 250,
    hot,
    sportsDrink: needSports
      ? {
          needed: true,
          text:
            `Твои тренировки длятся ${minutes} мин${hot ? ' и сейчас жаркий сезон' : ''}: на тренировке можно пить изотоник — ` +
            '400–800 мл в час небольшими глотками, начиная с 30–40-й минуты. В остальное время — обычная вода.',
        }
      : {
          needed: false,
          text: 'При тренировке до 60–75 минут спортивные напитки не нужны: пей воду по 150–250 мл каждые 15–20 минут. Изотоник — только для долгих и очень жарких тренировок.',
        },
  };
}

export function calcProgress(p, latestWeight) {
  const weight = Number(latestWeight ?? p.weight);
  const info = bmiInfo(weight, Number(p.height));
  let target = Number(p.goalWeight) || null;
  if (!target) {
    if (info.bmi >= 25) target = info.idealMax;
    else if (info.bmi < 18.5) target = info.idealMin;
  }

  const diff = target ? Math.round((weight - target) * 10) / 10 : 0;
  let eta = null;

  if (p.goal === 'lose' && diff > 0) {
    // Безопасный темп — 0,5–0,9% массы тела в неделю
    const fast = weight * 0.009;
    const slow = weight * 0.005;
    eta = { weeksMin: Math.ceil(diff / fast), weeksMax: Math.ceil(diff / slow), pace: `${slow.toFixed(1)}–${fast.toFixed(1)} кг/нед` };
  } else if (p.goal === 'gain') {
    const toGain = diff < 0 ? -diff : 4;
    const lvl = p.level || 'beginner';
    const perWeek = lvl === 'beginner' ? [0.25, 0.5] : lvl === 'intermediate' ? [0.15, 0.3] : [0.1, 0.2];
    eta = { weeksMin: Math.ceil(toGain / perWeek[1]), weeksMax: Math.ceil(toGain / perWeek[0]), pace: `${perWeek[0]}–${perWeek[1]} кг/нед` };
  }

  return {
    weight,
    target,
    diff,
    bmi: info,
    eta,
    milestones: [
      { weeks: '2–3 нед.', text: 'Больше энергии, лучше сон, проходит «ватность» после нагрузки.' },
      { weeks: '4–6 нед.', text: 'Заметно растут силовые и выносливость, уходят первые сантиметры в талии.' },
      { weeks: '8–12 нед.', text: 'Изменения видны в зеркале и окружающим, одежда сидит иначе.' },
      { weeks: '6–12 мес.', text: 'Устойчивый результат: новая форма тела и привычки, которые держатся сами.' },
    ],
  };
}

export function calcBudget(p, foodMonthCost) {
  const budget = Number(p.budget) || 0;
  const membership = Number(p.membership) || 0;
  const total = Math.round(foodMonthCost + membership);
  return {
    budget,
    food: Math.round(foodMonthCost),
    membership,
    total,
    left: budget ? budget - total : null,
  };
}
