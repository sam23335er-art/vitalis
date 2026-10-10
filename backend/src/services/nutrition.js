// Питание: расчёт КБЖУ и стоимости блюд, генерация плана на месяц, список покупок
import { dietProfile } from './labs.js';
import { calcNutrition } from './health.js';
import { monthDates, seededRandom } from '../util.js';

export const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
export const SLOT_LABEL = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' };
const SLOT_SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };

const MEAT = new Set(['chicken', 'turkey', 'beef', 'lamb', 'liver']);
const RED_MEAT = new Set(['beef', 'lamb', 'liver']);
const FISH = new Set(['fish', 'salmon', 'tuna']);
const DAIRY = new Set(['cottage', 'yogurt', 'kefir', 'milk', 'cheese']);

export const indexBy = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

const r1 = (n) => Math.round(n * 10) / 10;

// КБЖУ и стоимость блюда с учётом множителя порции
export function computeRecipe(recipe, ingIndex, factor = 1) {
  let kcal = 0;
  let p = 0;
  let f = 0;
  let c = 0;
  let cost = 0;
  const ingredients = [];

  for (const item of recipe.ingredients || []) {
    const ing = ingIndex[item.id];
    if (!ing) continue;
    const g = Math.max(Math.round((item.g * factor) / 5) * 5, 1);
    const k = g / 100;
    const row = {
      id: ing.id,
      name: ing.name,
      category: ing.category,
      g,
      kcal: Math.round(ing.kcal * k),
      p: r1(ing.p * k),
      f: r1(ing.f * k),
      c: r1(ing.c * k),
      cost: Math.round((ing.price * g) / 1000),
    };
    kcal += ing.kcal * k;
    p += ing.p * k;
    f += ing.f * k;
    c += ing.c * k;
    cost += row.cost;
    ingredients.push(row);
  }

  return {
    kcal: Math.round(kcal),
    p: Math.round(p),
    f: Math.round(f),
    c: Math.round(c),
    cost: Math.round(cost / 100) * 100,
    ingredients,
  };
}

export function recipeKinds(recipe) {
  const ids = (recipe.ingredients || []).map((i) => i.id);
  return {
    hasMeat: ids.some((id) => MEAT.has(id)),
    hasRedMeat: ids.some((id) => RED_MEAT.has(id)),
    hasFish: ids.some((id) => FISH.has(id)),
    hasDairy: ids.some((id) => DAIRY.has(id)),
  };
}

// Подходит ли блюдо пользователю (ограничения + противопоказания по анализам)
export function isAllowed(recipe, profile = {}, diet = dietProfile(profile.dietFlags || [])) {
  const kinds = recipeKinds(recipe);
  const r = profile.restrictions || [];
  if (r.includes('vegetarian') && (kinds.hasMeat || kinds.hasFish)) return false;
  if (r.includes('noFish') && kinds.hasFish) return false;
  if (r.includes('noDairy') && kinds.hasDairy) return false;
  if (r.includes('noRedMeat') && kinds.hasRedMeat) return false;
  if ((recipe.tags || []).some((t) => diet.avoidTags.includes(t))) return false;
  return true;
}

function scoreRecipe(recipe, diet, recentIds) {
  const tags = recipe.tags || [];
  let s = 1;
  s += tags.filter((t) => diet.preferTags.includes(t)).length * 1.5;
  s -= tags.filter((t) => diet.softAvoidTags.includes(t)).length * 0.8;
  const lastUse = recentIds.lastIndexOf(recipe.id);
  if (lastUse !== -1) s -= 3 / (recentIds.length - lastUse); // недавно было — понижаем
  return Math.max(s, 0.05);
}

function weightedPick(list, scores, rnd) {
  const total = scores.reduce((a, b) => a + b, 0);
  let x = rnd() * total;
  for (let i = 0; i < list.length; i++) {
    x -= scores[i];
    if (x <= 0) return list[i];
  }
  return list[list.length - 1];
}

// Множитель порции под целевую калорийность приёма пищи
export function portionFactor(recipe, ingIndex, targetKcal) {
  const base = computeRecipe(recipe, ingIndex, 1).kcal || 1;
  const factor = targetKcal / base;
  return Math.round(Math.min(Math.max(factor, 0.6), 1.8) * 20) / 20;
}

export function candidatesFor(slot, recipes, profile) {
  const diet = dietProfile(profile.dietFlags || []);
  return recipes.filter((r) => (r.slots || []).includes(slot) && isAllowed(r, profile, diet));
}

// План на месяц: по одному блюду на каждый приём пищи
export function generatePlan({ userId, profile, month, recipes, ingredients, fromDate = null, slots = SLOTS }) {
  const ingIndex = indexBy(ingredients);
  const diet = dietProfile(profile.dietFlags || []);
  const target = calcNutrition(profile).kcal;
  const rnd = seededRandom(`${userId}:${month}:${(profile.dietFlags || []).join(',')}:${(profile.restrictions || []).join(',')}`);

  const recipesById = indexBy(recipes);
  const bySlot = Object.fromEntries(slots.map((s) => [s, candidatesFor(s, recipes, profile)]));
  const recent = Object.fromEntries(slots.map((s) => [s, []]));
  const plan = [];

  for (const date of monthDates(month)) {
    if (fromDate && date < fromDate) continue;
    const day = [];
    for (const slot of slots) {
      const list = bySlot[slot];
      if (!list.length) continue;
      const pickRecipe = weightedPick(
        list,
        list.map((r) => scoreRecipe(r, diet, recent[slot])),
        rnd
      );
      recent[slot].push(pickRecipe.id);
      if (recent[slot].length > 4) recent[slot].shift();
      day.push({
        userId,
        date,
        slot,
        recipeId: pickRecipe.id,
        factor: portionFactor(pickRecipe, ingIndex, target * SLOT_SHARE[slot]),
        eaten: false,
      });
    }
    // Подгоняем порции, чтобы сумма за день была близка к норме (±5%)
    const total = day.reduce((s, m) => s + computeRecipe(recipesById[m.recipeId], ingIndex, m.factor).kcal, 0);
    if (total > 0 && Math.abs(total - target) / target > 0.05) {
      const k = target / total;
      for (const m of day) m.factor = Math.round(Math.min(Math.max(m.factor * k, 0.5), 2) * 20) / 20;
    }
    plan.push(...day);
  }
  return plan;
}

// Полная информация о приёме пищи для клиента
export function expandMeal(meal, recipeIndex, ingIndex) {
  if (meal.custom) {
    return { ...meal, title: meal.custom.title, nutrition: { kcal: meal.custom.kcal || 0, p: meal.custom.p || 0, f: meal.custom.f || 0, c: meal.custom.c || 0, cost: meal.custom.cost || 0, ingredients: [] } };
  }
  const recipe = recipeIndex[meal.recipeId];
  if (!recipe) return { ...meal, title: 'Блюдо удалено из базы', nutrition: { kcal: 0, p: 0, f: 0, c: 0, cost: 0, ingredients: [] } };
  return {
    ...meal,
    title: recipe.title,
    time: recipe.time,
    tags: recipe.tags,
    nutrition: computeRecipe(recipe, ingIndex, meal.factor || 1),
  };
}

// Список покупок за период: суммируем граммы по продуктам
export function shoppingList(meals, recipeIndex, ingIndex) {
  const map = new Map();
  for (const m of meals) {
    if (m.custom) continue;
    const recipe = recipeIndex[m.recipeId];
    if (!recipe) continue;
    for (const row of computeRecipe(recipe, ingIndex, m.factor || 1).ingredients) {
      const cur = map.get(row.id) || { id: row.id, name: row.name, category: row.category, g: 0, cost: 0 };
      cur.g += row.g;
      cur.cost += row.cost;
      map.set(row.id, cur);
    }
  }
  const items = [...map.values()]
    .map((x) => ({ ...x, cost: Math.round(x.cost / 100) * 100 }))
    .sort((a, b) => a.category.localeCompare(b.category, 'ru') || a.name.localeCompare(b.name, 'ru'));
  const total = items.reduce((s, x) => s + x.cost, 0);
  return { items, total };
}
