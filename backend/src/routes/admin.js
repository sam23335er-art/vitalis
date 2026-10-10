// Админ-панель: статистика, заявки, пользователи, CRUD рецептов и продуктов
import { Router } from 'express';
import crypto from 'node:crypto';
import { hashPassword } from '../auth.js';
import { ah, badRequest, clean, notFound, num } from '../util.js';
import { SLOTS } from '../services/nutrition.js';

const RECIPE_TAGS = ['fiber', 'heart', 'quick', 'lowCarb', 'highProtein', 'iron', 'vitD', 'sugar', 'local', 'redMeat', 'fattyMeat', 'organ', 'fish', 'vegetarian', 'fried', 'salty'];
const LEAD_STATUSES = ['new', 'called', 'client', 'rejected'];

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'item';

export default function adminRoutes({ db, requireAdmin }) {
  const r = Router();
  r.use(requireAdmin);

  r.get('/stats', (req, res) => {
    res.json({
      users: db.all('users').length,
      leads: db.all('leads').length,
      newLeads: db.find('leads', (l) => (l.status || 'new') === 'new').length,
      subscribers: db.all('subscribers').length,
      recipes: db.all('recipes').length,
      ingredients: db.all('ingredients').length,
      sessions: db.all('sessions').length,
      mealsEaten: db.find('meals', (m) => m.eaten).length,
    });
  });

  // ---------- Заявки ----------
  r.get('/leads', (req, res) => res.json(db.all('leads').slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))));

  r.patch(
    '/leads/:id',
    ah(async (req, res) => {
      if (!db.get('leads', req.params.id)) throw notFound('Заявка');
      const patch = {};
      if ('status' in req.body) {
        if (!LEAD_STATUSES.includes(req.body.status)) throw badRequest('Неизвестный статус');
        patch.status = req.body.status;
      }
      if ('comment' in req.body) patch.comment = clean(req.body.comment, 500);
      res.json(db.update('leads', req.params.id, patch));
    })
  );

  r.delete(
    '/leads/:id',
    ah(async (req, res) => {
      if (!db.remove('leads', req.params.id)) throw notFound('Заявка');
      res.json({ ok: true });
    })
  );

  r.get('/subscribers', (req, res) => res.json(db.all('subscribers')));

  r.get('/users', (req, res) => {
    res.json(
      db.all('users').map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        goal: u.profile?.goal || null,
      }))
    );
  });

  // Сброс пароля: письма не нужны — админ выдаёт временный пароль лично или в Telegram
  r.post(
    '/users/:id/reset-password',
    ah(async (req, res) => {
      const u = db.get('users', req.params.id);
      if (!u) throw notFound('Пользователь');
      if (u.id === req.user.id) throw badRequest('Свой пароль меняйте в профиле');
      const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
      const password = Array.from(crypto.randomBytes(10), (b) => abc[b % abc.length]).join('');
      db.update('users', u.id, { password: hashPassword(password), tokenVersion: (u.tokenVersion || 0) + 1 });
      res.json({ password });
    })
  );

  r.patch(
    '/users/:id',
    ah(async (req, res) => {
      const u = db.get('users', req.params.id);
      if (!u) throw notFound('Пользователь');
      if (!['admin', 'user'].includes(req.body?.role)) throw badRequest('Неизвестная роль');
      if (u.id === req.user.id && req.body.role !== 'admin') throw badRequest('Нельзя снять права администратора с самого себя');
      db.update('users', u.id, { role: req.body.role });
      res.json({ ok: true, role: req.body.role });
    })
  );

  // ---------- Продукты ----------
  const parseIngredient = (b) => {
    const errors = {};
    const name = clean(b.name, 80);
    if (name.length < 2) errors.name = 'Укажите название';
    const out = { name, category: clean(b.category || 'Прочее', 40) };
    for (const [k, max] of [['kcal', 900], ['p', 100], ['f', 100], ['c', 100], ['price', 10_000_000]]) {
      const v = num(b[k], { min: 0, max });
      if (v === null || Number.isNaN(v)) errors[k] = `от 0 до ${max}`;
      else out[k] = v;
    }
    if (Object.keys(errors).length) throw badRequest('Проверьте поля продукта', errors);
    return out;
  };

  r.post(
    '/ingredients',
    ah(async (req, res) => {
      const data = parseIngredient(req.body || {});
      let id = clean(req.body.id, 40) || slugify(data.name);
      while (db.get('ingredients', id)) id = `${id}-${Math.floor(Math.random() * 1000)}`;
      res.status(201).json(db.insert('ingredients', { id, ...data }));
    })
  );

  r.put(
    '/ingredients/:id',
    ah(async (req, res) => {
      if (!db.get('ingredients', req.params.id)) throw notFound('Продукт');
      res.json(db.update('ingredients', req.params.id, parseIngredient(req.body || {})));
    })
  );

  r.delete(
    '/ingredients/:id',
    ah(async (req, res) => {
      const used = db.find('recipes', (x) => (x.ingredients || []).some((i) => i.id === req.params.id));
      if (used.length) throw badRequest(`Продукт используется в рецептах: ${used.map((x) => x.title).join(', ')}`);
      if (!db.remove('ingredients', req.params.id)) throw notFound('Продукт');
      res.json({ ok: true });
    })
  );

  // ---------- Рецепты ----------
  const parseRecipe = (b) => {
    const errors = {};
    const title = clean(b.title, 100);
    if (title.length < 3) errors.title = 'Укажите название';
    const slots = Array.isArray(b.slots) ? b.slots.filter((s) => SLOTS.includes(s)) : [];
    if (!slots.length) errors.slots = 'Выберите хотя бы один приём пищи';
    const time = num(b.time, { min: 1, max: 600, int: true });
    if (time === null || Number.isNaN(time)) errors.time = 'от 1 до 600 минут';
    const ingredients = (Array.isArray(b.ingredients) ? b.ingredients : [])
      .map((i) => ({ id: String(i.id), g: num(i.g, { min: 1, max: 2000, int: true }) }))
      .filter((i) => db.get('ingredients', i.id) && i.g && !Number.isNaN(i.g));
    if (!ingredients.length) errors.ingredients = 'Добавьте хотя бы один продукт';
    const steps = (Array.isArray(b.steps) ? b.steps : []).map((s) => clean(s, 500)).filter(Boolean);
    if (!steps.length) errors.steps = 'Добавьте хотя бы один шаг';
    if (Object.keys(errors).length) throw badRequest('Проверьте поля рецепта', errors);
    return {
      title,
      slots,
      time,
      tags: (Array.isArray(b.tags) ? b.tags : []).filter((t) => RECIPE_TAGS.includes(t)),
      ingredients,
      steps,
    };
  };

  r.get('/recipe-tags', (req, res) => res.json(RECIPE_TAGS));

  r.post(
    '/recipes',
    ah(async (req, res) => {
      const data = parseRecipe(req.body || {});
      let id = slugify(data.title);
      while (db.get('recipes', id)) id = `${id}-${Math.floor(Math.random() * 1000)}`;
      res.status(201).json(db.insert('recipes', { id, ...data }));
    })
  );

  r.put(
    '/recipes/:id',
    ah(async (req, res) => {
      if (!db.get('recipes', req.params.id)) throw notFound('Рецепт');
      res.json(db.update('recipes', req.params.id, parseRecipe(req.body || {})));
    })
  );

  r.delete(
    '/recipes/:id',
    ah(async (req, res) => {
      if (!db.remove('recipes', req.params.id)) throw notFound('Рецепт');
      res.json({ ok: true });
    })
  );

  return r;
}
