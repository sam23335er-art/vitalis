// Расписание тренировок: генерация на месяц и CRUD
import { Router } from 'express';
import { EXERCISES, generateTraining } from '../services/training.js';
import { isProfileComplete } from '../services/health.js';
import { ah, badRequest, clean, HttpError, isDate, isMonth, notFound, num, todayStr } from '../util.js';

export default function trainingRoutes({ db, requireAuth }) {
  const r = Router();
  r.use(requireAuth);

  const own = (id, uid) => {
    const t = db.get('training', id);
    if (!t || t.userId !== uid) throw notFound('Тренировка');
    return t;
  };

  const parseExercises = (list) => {
    if (!Array.isArray(list) || !list.length || list.length > 20) throw badRequest('Добавьте от 1 до 20 упражнений');
    return list.map((e) => {
      const key = EXERCISES[e.key] ? e.key : null;
      const name = clean(e.name || (key && EXERCISES[key].name), 80);
      if (name.length < 2) throw badRequest('У каждого упражнения должно быть название');
      const sets = num(e.sets, { min: 1, max: 20, int: true });
      return {
        key,
        name,
        camera: key ? EXERCISES[key].camera || null : null,
        unit: clean(e.unit || (key && EXERCISES[key].unit) || 'повт.', 10),
        sets: sets && !Number.isNaN(sets) ? sets : 3,
        reps: clean(e.reps ?? '10', 10),
      };
    });
  };

  r.get('/', (req, res) => {
    const { from, to } = req.query;
    res.json(
      db
        .find('training', (t) => t.userId === req.user.id && (!isDate(from) || t.date >= from) && (!isDate(to) || t.date <= to))
        .sort((a, b) => a.date.localeCompare(b.date))
    );
  });

  r.get('/exercises', (req, res) => res.json(Object.entries(EXERCISES).map(([key, e]) => ({ key, ...e }))));

  r.post(
    '/generate',
    ah(async (req, res) => {
      if (!isProfileComplete(req.user.profile)) throw new HttpError(409, 'Сначала заполните профиль');
      const month = req.body?.month;
      if (!isMonth(month)) throw badRequest('Укажите месяц в формате ГГГГ-ММ');
      const today = todayStr();
      const fromDate = month === today.slice(0, 7) ? today : null;
      // Выполненные тренировки сохраняем, остальные пересоздаём
      db.removeWhere('training', (t) => t.userId === req.user.id && t.date.startsWith(month) && !t.done && (!fromDate || t.date >= fromDate));
      const busy = new Set(db.find('training', (t) => t.userId === req.user.id && t.date.startsWith(month)).map((t) => t.date));
      const plan = generateTraining({ userId: req.user.id, profile: req.user.profile, month, fromDate }).filter((t) => !busy.has(t.date));
      db.insertMany('training', plan);
      res.status(201).json({ created: plan.length });
    })
  );

  r.post(
    '/',
    ah(async (req, res) => {
      const b = req.body || {};
      if (!isDate(b.date)) throw badRequest('Укажите дату', { date: 'Укажите дату' });
      const title = clean(b.title, 80);
      if (title.length < 2) throw badRequest('Укажите название', { title: 'Укажите название' });
      const doc = db.insert('training', {
        userId: req.user.id,
        date: b.date,
        template: 'custom',
        title,
        exercises: parseExercises(b.exercises),
        done: false,
        note: clean(b.note, 300),
      });
      res.status(201).json(doc);
    })
  );

  r.patch(
    '/:id',
    ah(async (req, res) => {
      own(req.params.id, req.user.id);
      const b = req.body || {};
      const patch = {};
      if ('done' in b) {
        patch.done = Boolean(b.done);
        patch.doneAt = patch.done ? new Date().toISOString() : null;
      }
      if ('note' in b) patch.note = clean(b.note, 300);
      if ('title' in b) {
        const t = clean(b.title, 80);
        if (t.length < 2) throw badRequest('Укажите название');
        patch.title = t;
      }
      if ('date' in b) {
        if (!isDate(b.date)) throw badRequest('Некорректная дата');
        patch.date = b.date;
      }
      if ('exercises' in b) patch.exercises = parseExercises(b.exercises);
      res.json(db.update('training', req.params.id, patch));
    })
  );

  r.delete(
    '/:id',
    ah(async (req, res) => {
      own(req.params.id, req.user.id);
      db.remove('training', req.params.id);
      res.json({ ok: true });
    })
  );

  return r;
}
