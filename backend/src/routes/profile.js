import { Router } from 'express';
import { publicUser } from '../auth.js';
import { ACTIVITY } from '../services/health.js';
import { FLAG_RULES } from '../services/labs.js';
import { buildSummary } from '../services/summary.js';
import { ah, badRequest, num } from '../util.js';

const RESTRICTIONS = ['vegetarian', 'noFish', 'noDairy', 'noRedMeat'];

export function validateProfile(body, current = {}) {
  const errors = {};
  const out = { ...current };
  const setNum = (key, opts, label) => {
    if (!(key in body)) return;
    const v = num(body[key], opts);
    if (Number.isNaN(v)) errors[key] = `${label}: от ${opts.min} до ${opts.max}`;
    else out[key] = v;
  };

  if ('sex' in body) {
    if (!['m', 'f'].includes(body.sex)) errors.sex = 'Выберите пол';
    else out.sex = body.sex;
  }
  setNum('age', { min: 14, max: 90, int: true }, 'Возраст');
  setNum('height', { min: 120, max: 230 }, 'Рост');
  setNum('weight', { min: 35, max: 250 }, 'Вес');
  setNum('goalWeight', { min: 35, max: 250 }, 'Целевой вес');
  setNum('sessionMinutes', { min: 15, max: 240, int: true }, 'Длительность тренировки');
  setNum('budget', { min: 0, max: 1_000_000_000, int: true }, 'Бюджет');
  setNum('membership', { min: 0, max: 100_000_000, int: true }, 'Абонемент');

  if ('activity' in body) {
    if (!ACTIVITY[String(Number(body.activity))]) errors.activity = 'Выберите уровень активности';
    else out.activity = Number(body.activity);
  }
  if ('goal' in body) {
    if (!['lose', 'keep', 'gain'].includes(body.goal)) errors.goal = 'Выберите цель';
    else out.goal = body.goal;
  }
  if ('level' in body) {
    if (!['beginner', 'intermediate', 'advanced'].includes(body.level)) errors.level = 'Выберите уровень';
    else out.level = body.level;
  }
  if ('trainingDays' in body) {
    const d = Array.isArray(body.trainingDays) ? [...new Set(body.trainingDays.map(Number))].filter((x) => Number.isInteger(x) && x >= 0 && x <= 6) : [];
    if (!d.length) errors.trainingDays = 'Выберите хотя бы один день';
    else out.trainingDays = d.sort();
  }
  if ('restrictions' in body) {
    out.restrictions = Array.isArray(body.restrictions) ? body.restrictions.filter((x) => RESTRICTIONS.includes(x)) : [];
  }
  if ('dietFlags' in body) {
    out.dietFlags = Array.isArray(body.dietFlags) ? body.dietFlags.filter((x) => FLAG_RULES[x]) : [];
  }

  return { profile: out, errors };
}

export default function profileRoutes({ db, requireAuth }) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', (req, res) => res.json({ profile: req.user.profile || {} }));

  r.put(
    '/',
    ah(async (req, res) => {
      const { profile, errors } = validateProfile(req.body || {}, req.user.profile || {});
      if (Object.keys(errors).length) throw badRequest('Проверьте поля профиля', errors);
      const user = db.update('users', req.user.id, { profile });
      res.json({ user: publicUser(user) });
    })
  );

  r.get('/summary', (req, res) => res.json(buildSummary(db, req.user)));

  return r;
}
