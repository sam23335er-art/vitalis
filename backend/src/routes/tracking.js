// Дневник: вес, вода, сессии ИИ-тренера
import { Router } from 'express';
import { ah, badRequest, clean, isDate, notFound, num, todayStr } from '../util.js';

const own = (db, col, id, userId) => {
  const doc = db.get(col, id);
  if (!doc || doc.userId !== userId) throw notFound();
  return doc;
};

const rangeFilter = (req) => {
  const { from, to } = req.query;
  return (x) => (!isDate(from) || x.date >= from) && (!isDate(to) || x.date <= to);
};

export function weightRoutes({ db, requireAuth }) {
  const r = Router();
  r.use(requireAuth);

  const parse = (body, partial = false) => {
    const errors = {};
    const out = {};
    if (!partial || 'date' in body) {
      if (!isDate(body.date)) errors.date = 'Укажите дату';
      else if (body.date > todayStr()) errors.date = 'Дата не может быть в будущем';
      else out.date = body.date;
    }
    if (!partial || 'weight' in body) {
      const w = num(body.weight, { min: 30, max: 300 });
      if (w === null || Number.isNaN(w)) errors.weight = 'Вес от 30 до 300 кг';
      else out.weight = Math.round(w * 10) / 10;
    }
    if ('note' in body) out.note = clean(body.note, 200);
    if (Object.keys(errors).length) throw badRequest('Проверьте поля', errors);
    return out;
  };

  // Синхронизируем вес в профиле с самой свежей записью
  const syncProfile = (user) => {
    const list = db.find('weights', (w) => w.userId === user.id).sort((a, b) => a.date.localeCompare(b.date));
    if (list.length) db.update('users', user.id, { profile: { ...user.profile, weight: list[list.length - 1].weight } });
  };

  r.get('/', (req, res) => {
    const list = db.find('weights', (w) => w.userId === req.user.id).filter(rangeFilter(req)).sort((a, b) => a.date.localeCompare(b.date));
    res.json(list);
  });

  r.post(
    '/',
    ah(async (req, res) => {
      const data = parse(req.body || {});
      // Одна запись на дату: повторный ввод обновляет значение
      const existing = db.findOne('weights', (w) => w.userId === req.user.id && w.date === data.date);
      const doc = existing ? db.update('weights', existing.id, data) : db.insert('weights', { userId: req.user.id, ...data });
      syncProfile(req.user);
      res.status(existing ? 200 : 201).json(doc);
    })
  );

  r.put(
    '/:id',
    ah(async (req, res) => {
      own(db, 'weights', req.params.id, req.user.id);
      const doc = db.update('weights', req.params.id, parse(req.body || {}, true));
      syncProfile(req.user);
      res.json(doc);
    })
  );

  r.delete(
    '/:id',
    ah(async (req, res) => {
      own(db, 'weights', req.params.id, req.user.id);
      db.remove('weights', req.params.id);
      res.json({ ok: true });
    })
  );

  return r;
}

export function waterRoutes({ db, requireAuth }) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', (req, res) => {
    res.json(db.find('water', (w) => w.userId === req.user.id).filter(rangeFilter(req)).sort((a, b) => a.date.localeCompare(b.date)));
  });

  r.put(
    '/:date',
    ah(async (req, res) => {
      const { date } = req.params;
      if (!isDate(date)) throw badRequest('Некорректная дата');
      const ml = num(req.body?.ml, { min: 0, max: 10000, int: true });
      if (ml === null || Number.isNaN(ml)) throw badRequest('Количество воды от 0 до 10 000 мл', { ml: 'от 0 до 10 000 мл' });
      const existing = db.findOne('water', (w) => w.userId === req.user.id && w.date === date);
      const doc = existing ? db.update('water', existing.id, { ml }) : db.insert('water', { userId: req.user.id, date, ml });
      res.json(doc);
    })
  );

  r.delete(
    '/:date',
    ah(async (req, res) => {
      db.removeWhere('water', (w) => w.userId === req.user.id && w.date === req.params.date);
      res.json({ ok: true });
    })
  );

  return r;
}

const SESSION_EXERCISES = ['dips', 'pushups', 'squats', 'pullups', 'curls'];

export function sessionRoutes({ db, requireAuth }) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', (req, res) => {
    res.json(
      db
        .find('sessions', (s) => s.userId === req.user.id)
        .filter(rangeFilter(req))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  });

  r.post(
    '/',
    ah(async (req, res) => {
      const b = req.body || {};
      const errors = {};
      if (!SESSION_EXERCISES.includes(b.exercise)) errors.exercise = 'Неизвестное упражнение';
      const good = num(b.goodReps, { min: 0, max: 1000, int: true });
      const bad = num(b.badReps, { min: 0, max: 1000, int: true });
      const dur = num(b.durationSec, { min: 0, max: 4 * 3600, int: true });
      if (good === null || Number.isNaN(good)) errors.goodReps = 'Некорректно';
      if (bad === null || Number.isNaN(bad)) errors.badReps = 'Некорректно';
      if (Object.keys(errors).length) throw badRequest('Проверьте данные подхода', errors);
      const doc = db.insert('sessions', {
        userId: req.user.id,
        date: isDate(b.date) ? b.date : todayStr(),
        exercise: b.exercise,
        goodReps: good,
        badReps: bad,
        durationSec: Number.isNaN(dur) || dur === null ? 0 : dur,
        strict: Boolean(b.strict),
        target: num(b.target, { min: 0, max: 1000, int: true }) || null,
      });
      res.status(201).json(doc);
    })
  );

  r.delete(
    '/:id',
    ah(async (req, res) => {
      own(db, 'sessions', req.params.id, req.user.id);
      db.remove('sessions', req.params.id);
      res.json({ ok: true });
    })
  );

  return r;
}

export { own };
