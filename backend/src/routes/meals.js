// План питания: генерация на месяц, CRUD приёмов пищи, отметка «съел», список покупок
import { Router } from 'express';
import { isProfileComplete } from '../services/health.js';
import { candidatesFor, computeRecipe, expandMeal, generatePlan, indexBy, portionFactor, shoppingList, SLOTS } from '../services/nutrition.js';
import { calcNutrition } from '../services/health.js';
import { ah, badRequest, clean, HttpError, isDate, isMonth, notFound, num, todayStr } from '../util.js';

const SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };

export function regenerateMeals(db, user, month, fromDate = null) {
  db.removeWhere('meals', (m) => m.userId === user.id && m.date.startsWith(month) && (!fromDate || m.date >= fromDate) && !m.eaten && !m.custom);
  const keep = new Set(db.find('meals', (m) => m.userId === user.id && m.date.startsWith(month)).map((m) => `${m.date}:${m.slot}`));
  const plan = generatePlan({
    userId: user.id,
    profile: user.profile,
    month,
    recipes: db.all('recipes'),
    ingredients: db.all('ingredients'),
    fromDate,
  }).filter((m) => !keep.has(`${m.date}:${m.slot}`));
  return db.insertMany('meals', plan);
}

export default function mealRoutes({ db, requireAuth }) {
  const r = Router();
  r.use(requireAuth);

  const ctx = () => ({ recipeIndex: indexBy(db.all('recipes')), ingIndex: indexBy(db.all('ingredients')) });
  const own = (id, uid) => {
    const m = db.get('meals', id);
    if (!m || m.userId !== uid) throw notFound('Приём пищи');
    return m;
  };
  const needProfile = (user) => {
    if (!isProfileComplete(user.profile)) throw new HttpError(409, 'Сначала заполните профиль: пол, возраст, рост, вес, активность и цель');
  };

  r.get('/', (req, res) => {
    const { from, to } = req.query;
    const { recipeIndex, ingIndex } = ctx();
    const list = db
      .find('meals', (m) => m.userId === req.user.id && (!isDate(from) || m.date >= from) && (!isDate(to) || m.date <= to))
      .sort((a, b) => a.date.localeCompare(b.date) || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot))
      .map((m) => expandMeal(m, recipeIndex, ingIndex));
    res.json(list);
  });

  r.post(
    '/generate',
    ah(async (req, res) => {
      needProfile(req.user);
      const month = req.body?.month;
      if (!isMonth(month)) throw badRequest('Укажите месяц в формате ГГГГ-ММ');
      const today = todayStr();
      // По умолчанию прошедшие дни не трогаем
      const fromDate = req.body?.fromToday === false ? null : month === today.slice(0, 7) ? today : null;
      const created = regenerateMeals(db, req.user, month, fromDate);
      res.status(201).json({ created: created.length });
    })
  );

  r.get('/shopping', (req, res) => {
    const { from, to } = req.query;
    if (!isDate(from) || !isDate(to)) throw badRequest('Укажите период from и to');
    const { recipeIndex, ingIndex } = ctx();
    const meals = db.find('meals', (m) => m.userId === req.user.id && m.date >= from && m.date <= to && (req.query.includeEaten === '1' || !m.eaten));
    res.json({ from, to, ...shoppingList(meals, recipeIndex, ingIndex) });
  });

  // Варианты замены блюда, подходящие пользователю
  r.get(
    '/:id/alternatives',
    ah(async (req, res) => {
      const meal = own(req.params.id, req.user.id);
      const { ingIndex } = ctx();
      const target = isProfileComplete(req.user.profile) ? calcNutrition(req.user.profile).kcal * SHARE[meal.slot] : 500;
      const list = candidatesFor(meal.slot, db.all('recipes'), req.user.profile || {})
        .filter((x) => x.id !== meal.recipeId)
        .map((x) => {
          const factor = portionFactor(x, ingIndex, target);
          const n = computeRecipe(x, ingIndex, factor);
          return { id: x.id, title: x.title, time: x.time, tags: x.tags, factor, kcal: n.kcal, p: n.p, cost: n.cost };
        });
      res.json(list);
    })
  );

  r.post(
    '/',
    ah(async (req, res) => {
      const b = req.body || {};
      if (!isDate(b.date)) throw badRequest('Укажите дату', { date: 'Укажите дату' });
      if (!SLOTS.includes(b.slot)) throw badRequest('Укажите приём пищи', { slot: 'Укажите приём пищи' });
      const doc = { userId: req.user.id, date: b.date, slot: b.slot, eaten: Boolean(b.eaten) };

      if (b.recipeId) {
        const recipe = db.get('recipes', b.recipeId);
        if (!recipe) throw badRequest('Блюдо не найдено');
        const f = num(b.factor, { min: 0.25, max: 4 });
        doc.recipeId = recipe.id;
        doc.factor = f && !Number.isNaN(f) ? f : 1;
      } else {
        const c = b.custom || {};
        const title = clean(c.title, 100);
        if (title.length < 2) throw badRequest('Укажите название блюда', { title: 'Укажите название' });
        const n = (k, max) => {
          const v = num(c[k], { min: 0, max });
          return v && !Number.isNaN(v) ? Math.round(v) : 0;
        };
        doc.custom = { title, kcal: n('kcal', 5000), p: n('p', 500), f: n('f', 500), c: n('c', 1000), cost: n('cost', 10_000_000) };
      }
      const created = db.insert('meals', doc);
      const { recipeIndex, ingIndex } = ctx();
      res.status(201).json(expandMeal(created, recipeIndex, ingIndex));
    })
  );

  r.patch(
    '/:id',
    ah(async (req, res) => {
      const meal = own(req.params.id, req.user.id);
      const b = req.body || {};
      const patch = {};
      if ('eaten' in b) {
        patch.eaten = Boolean(b.eaten);
        patch.eatenAt = patch.eaten ? new Date().toISOString() : null;
      }
      if ('recipeId' in b) {
        const recipe = db.get('recipes', b.recipeId);
        if (!recipe || !(recipe.slots || []).includes(meal.slot)) throw badRequest('Это блюдо не подходит для этого приёма пищи');
        patch.recipeId = recipe.id;
        patch.custom = undefined;
        const { ingIndex } = ctx();
        const target = isProfileComplete(req.user.profile) ? calcNutrition(req.user.profile).kcal * SHARE[meal.slot] : 500;
        patch.factor = portionFactor(recipe, ingIndex, target);
      }
      if ('factor' in b) {
        const f = num(b.factor, { min: 0.25, max: 4 });
        if (f === null || Number.isNaN(f)) throw badRequest('Размер порции от 0,25 до 4');
        patch.factor = f;
      }
      const updated = db.update('meals', meal.id, patch);
      if (patch.recipeId) delete updated.custom;
      const { recipeIndex, ingIndex } = ctx();
      res.json(expandMeal(updated, recipeIndex, ingIndex));
    })
  );

  r.delete(
    '/:id',
    ah(async (req, res) => {
      own(req.params.id, req.user.id);
      db.remove('meals', req.params.id);
      res.json({ ok: true });
    })
  );

  // Очистить план за месяц
  r.delete(
    '/',
    ah(async (req, res) => {
      const { month } = req.query;
      if (!isMonth(month)) throw badRequest('Укажите месяц');
      const removed = db.removeWhere('meals', (m) => m.userId === req.user.id && m.date.startsWith(month));
      res.json({ removed });
    })
  );

  return r;
}
