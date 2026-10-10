// Публичные маршруты: контент лендинга, заявки, подписка, база рецептов
import { Router } from 'express';
import fsp from 'node:fs/promises';
import { computeRecipe, indexBy, recipeKinds } from '../services/nutrition.js';
import { ah, badRequest, clean, isEmail, normalizePhone, notFound, rateLimit } from '../util.js';

export default function publicRoutes({ db, contentFile, notify }) {
  const r = Router();

  r.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  r.get(
    '/content',
    ah(async (req, res) => {
      // ?lang=uz — узбекская версия (content.uz.json рядом с content.json)
      const file = req.query.lang === 'uz' ? contentFile.replace(/\.json$/, '.uz.json') : contentFile;
      const content = JSON.parse(await fsp.readFile(file, 'utf8').catch(() => fsp.readFile(contentFile, 'utf8')));
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json(content);
    })
  );

  r.post(
    '/leads',
    rateLimit(5, 10 * 60_000),
    ah(async (req, res) => {
      const { name, phone, program, message, website } = req.body || {};
      if (website) return res.json({ ok: true }); // ловушка для ботов
      const errors = {};
      const cleanName = clean(name, 80);
      const cleanPhone = normalizePhone(phone);
      if (cleanName.length < 2) errors.name = 'Укажите имя';
      if (!cleanPhone) errors.phone = 'Номер в формате +998 XX XXX XX XX';
      if (Object.keys(errors).length) throw badRequest('Проверьте поля', errors);
      const lead = db.insert('leads', {
        name: cleanName,
        phone: cleanPhone,
        program: clean(program, 120),
        message: clean(message, 1000),
        status: 'new',
      });
      notify(
        `🏋️ <b>Новая заявка VITALIS</b>\nИмя: ${lead.name}\nТелефон: ${lead.phone}` +
          (lead.program ? `\nПрограмма: ${lead.program}` : '') +
          (lead.message ? `\nКомментарий: ${lead.message}` : '')
      );
      res.status(201).json({ ok: true, id: lead.id });
    })
  );

  r.post(
    '/subscribe',
    rateLimit(5, 10 * 60_000),
    ah(async (req, res) => {
      const email = clean(req.body?.email, 120).toLowerCase();
      if (!isEmail(email)) throw badRequest('Некорректный e-mail');
      if (db.findOne('subscribers', (s) => s.email === email)) return res.json({ ok: true, already: true });
      db.insert('subscribers', { email });
      res.status(201).json({ ok: true });
    })
  );

  r.get('/ingredients', (req, res) => res.json(db.all('ingredients')));

  r.get('/recipes', (req, res) => {
    const ingIndex = indexBy(db.all('ingredients'));
    const { slot } = req.query;
    res.json(
      db
        .all('recipes')
        .filter((x) => !slot || (x.slots || []).includes(slot))
        .map((x) => {
          const n = computeRecipe(x, ingIndex, 1);
          return { id: x.id, title: x.title, slots: x.slots, time: x.time, tags: x.tags, ...recipeKinds(x), kcal: n.kcal, p: n.p, f: n.f, c: n.c, cost: n.cost };
        })
    );
  });

  r.get('/recipes/:id', (req, res) => {
    const recipe = db.get('recipes', req.params.id);
    if (!recipe) throw notFound('Рецепт');
    const factor = Math.min(Math.max(Number(req.query.factor) || 1, 0.25), 4);
    res.json({ ...recipe, factor, nutrition: computeRecipe(recipe, indexBy(db.all('ingredients')), factor) });
  });

  return r;
}
