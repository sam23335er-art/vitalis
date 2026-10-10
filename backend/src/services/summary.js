// Сводка для личного кабинета: все персональные цифры в одном месте
import { calcBudget, calcNutrition, calcProgress, calcWater, isProfileComplete } from './health.js';
import { computeRecipe, expandMeal, generatePlan, indexBy } from './nutrition.js';
import { addDays, daysInMonth, todayStr } from '../util.js';

export function latestWeight(db, userId) {
  const list = db.find('weights', (w) => w.userId === userId).sort((a, b) => a.date.localeCompare(b.date));
  return list.length ? list[list.length - 1].weight : null;
}

// Серия активных дней подряд (вода, отмеченная еда, тренировка или ИИ-сессия)
export function activityStreak(db, userId, today = todayStr()) {
  const days = new Set();
  db.find('water', (w) => w.userId === userId && w.ml > 0).forEach((w) => days.add(w.date));
  db.find('meals', (m) => m.userId === userId && m.eaten).forEach((m) => days.add(m.date));
  db.find('training', (t) => t.userId === userId && t.done).forEach((t) => days.add(t.date));
  db.find('sessions', (s) => s.userId === userId).forEach((s) => days.add(s.date));
  let streak = 0;
  let d = days.has(today) ? today : addDays(today, -1);
  while (days.has(d)) {
    streak += 1;
    d = addDays(d, -1);
  }
  return { streak, activeToday: days.has(today) };
}

// Стоимость питания за месяц: по сохранённому плану, а если его нет — по прогнозу
export function monthFoodCost(db, user, month) {
  const recipes = db.all('recipes');
  const ingIndex = indexBy(db.all('ingredients'));
  const recipeIndex = indexBy(recipes);
  let meals = db.find('meals', (m) => m.userId === user.id && m.date.startsWith(month));
  let estimated = false;
  if (!meals.length) {
    meals = generatePlan({ userId: user.id, profile: user.profile, month, recipes, ingredients: db.all('ingredients') });
    estimated = true;
  }
  const total = meals.reduce((s, m) => s + expandMeal(m, recipeIndex, ingIndex).nutrition.cost, 0);
  // Если план заполнен не на весь месяц — экстраполируем на число дней
  const planned = new Set(meals.map((m) => m.date)).size || 1;
  const full = Math.round((total / planned) * daysInMonth(month));
  return { cost: full, estimated, plannedDays: planned };
}

export function buildMetrics(db, user, today = todayStr()) {
  const p = user.profile || {};
  if (!isProfileComplete(p)) return null;
  const weight = latestWeight(db, user.id) ?? p.weight;
  const profile = { ...p, weight };
  return {
    nutrition: calcNutrition(profile),
    water: calcWater(profile, new Date(`${today}T12:00:00Z`)),
    progress: calcProgress(p, weight),
  };
}

export function buildSummary(db, user, today = todayStr()) {
  const metrics = buildMetrics(db, user, today);
  if (!metrics) return { complete: false };

  const month = today.slice(0, 7);
  const recipeIndex = indexBy(db.all('recipes'));
  const ingIndex = indexBy(db.all('ingredients'));

  const todayMeals = db
    .find('meals', (m) => m.userId === user.id && m.date === today)
    .map((m) => expandMeal(m, recipeIndex, ingIndex));
  const eaten = todayMeals
    .filter((m) => m.eaten)
    .reduce((s, m) => ({ kcal: s.kcal + m.nutrition.kcal, p: s.p + m.nutrition.p, f: s.f + m.nutrition.f, c: s.c + m.nutrition.c }), { kcal: 0, p: 0, f: 0, c: 0 });

  const water = db.findOne('water', (w) => w.userId === user.id && w.date === today);
  const workout = db.findOne('training', (t) => t.userId === user.id && t.date === today);
  const nextWorkout = db
    .find('training', (t) => t.userId === user.id && t.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;

  const food = monthFoodCost(db, user, month);

  const weights = db
    .find('weights', (w) => w.userId === user.id)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  return {
    complete: true,
    today,
    ...metrics,
    todayMeals,
    eaten,
    waterMl: water?.ml || 0,
    workout,
    nextWorkout,
    budget: { ...calcBudget(user.profile, food.cost), estimated: food.estimated },
    streak: activityStreak(db, user.id, today),
    weights,
    hasMealPlan: db.find('meals', (m) => m.userId === user.id && m.date.startsWith(month)).length > 0,
    hasTrainingPlan: db.find('training', (t) => t.userId === user.id && t.date.startsWith(month)).length > 0,
  };
}

// Контекст для встроенного помощника: личные цифры, меню и тренировка на сегодня
const SLOT_RU = { breakfast: 'завтрак', lunch: 'обед', dinner: 'ужин', snack: 'перекус' };

export function assistantContext(db, user, today = todayStr()) {
  const recipeIndex = indexBy(db.all('recipes'));
  const ingIndex = indexBy(db.all('ingredients'));
  const meals = db
    .find('meals', (x) => x.userId === user.id && x.date === today)
    .map((x) => `${SLOT_RU[x.slot]} — ${expandMeal(x, recipeIndex, ingIndex).title}${x.eaten ? ' ✓' : ''}`);
  const w = db.findOne('training', (t) => t.userId === user.id && t.date === today);
  const next = db
    .find('training', (t) => t.userId === user.id && t.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return {
    name: user.name,
    goal: user.profile?.goal,
    metrics: buildMetrics(db, user, today),
    todayMenu: meals.length ? meals.join('; ') : null,
    workout: w ? `сегодня — «${w.title}»${w.done ? ' (выполнена ✓)' : ''}` : next ? `сегодня отдых, следующая — ${next.date.slice(8)}.${next.date.slice(5, 7)}: «${next.title}»` : null,
  };
}

export { computeRecipe };
