// Анализы: CRUD, разбор и применение пищевого профиля к плану питания
import { Router } from 'express';
import { publicUser } from '../auth.js';
import { analyzeLabs, MARKERS, FLAG_RULES } from '../services/labs.js';
import { regenerateMeals } from './meals.js';
import { isProfileComplete } from '../services/health.js';
import { ah, badRequest, clean, isDate, notFound, todayStr } from '../util.js';

function parseValues(raw = {}) {
  const values = {};
  for (const m of MARKERS) {
    const v = raw[m.key];
    if (v === undefined || v === null || v === '') continue;
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100000) throw badRequest(`Некорректное значение: ${m.label}`, { [m.key]: 'Некорректно' });
    values[m.key] = n;
  }
  if (!Object.keys(values).length) throw badRequest('Введите хотя бы один показатель');
  return values;
}

export default function labRoutes({ db, requireAuth }) {
  const r = Router();
  r.use(requireAuth);

  const own = (id, uid) => {
    const l = db.get('labs', id);
    if (!l || l.userId !== uid) throw notFound('Анализ');
    return l;
  };

  r.get('/markers', (req, res) => {
    const sex = req.user.profile?.sex || 'm';
    const pick = (v) => (v && typeof v === 'object' ? v[sex] : v);
    res.json(MARKERS.map((m) => ({ key: m.key, label: m.label, unit: m.unit, group: m.group, min: pick(m.min) ?? null, max: pick(m.max) ?? null })));
  });

  r.get('/flags', (req, res) => res.json(Object.entries(FLAG_RULES).map(([key, f]) => ({ key, title: f.title }))));

  r.get('/', (req, res) => {
    res.json(db.find('labs', (l) => l.userId === req.user.id).sort((a, b) => b.date.localeCompare(a.date)));
  });

  // Предпросмотр без сохранения
  r.post(
    '/analyze',
    ah(async (req, res) => {
      res.json(analyzeLabs(parseValues(req.body?.values), req.user.profile?.sex || 'm'));
    })
  );

  r.post(
    '/',
    ah(async (req, res) => {
      const b = req.body || {};
      const date = isDate(b.date) ? b.date : todayStr();
      const values = parseValues(b.values);
      const doc = db.insert('labs', {
        userId: req.user.id,
        date,
        values,
        note: clean(b.note, 300),
        analysis: analyzeLabs(values, req.user.profile?.sex || 'm'),
      });
      res.status(201).json(doc);
    })
  );

  r.put(
    '/:id',
    ah(async (req, res) => {
      const lab = own(req.params.id, req.user.id);
      const b = req.body || {};
      const values = b.values ? parseValues(b.values) : lab.values;
      const doc = db.update('labs', lab.id, {
        date: isDate(b.date) ? b.date : lab.date,
        note: 'note' in b ? clean(b.note, 300) : lab.note,
        values,
        analysis: analyzeLabs(values, req.user.profile?.sex || 'm'),
      });
      res.json(doc);
    })
  );

  r.delete(
    '/:id',
    ah(async (req, res) => {
      own(req.params.id, req.user.id);
      db.remove('labs', req.params.id);
      res.json({ ok: true });
    })
  );

  // Применить: флаги анализа → профиль, план питания пересобирается с сегодняшнего дня
  r.post(
    '/:id/apply',
    ah(async (req, res) => {
      const lab = own(req.params.id, req.user.id);
      const flags = lab.analysis.flags;
      const user = db.update('users', req.user.id, { profile: { ...req.user.profile, dietFlags: flags } });
      let created = 0;
      if (isProfileComplete(user.profile)) {
        const today = todayStr();
        created = regenerateMeals(db, user, today.slice(0, 7), today).length;
      }
      res.json({ user: publicUser(user), flags, regenerated: created });
    })
  );

  return r;
}
