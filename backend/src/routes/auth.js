import { Router } from 'express';
import crypto from 'node:crypto';
import { hashPassword, verifyPassword, signToken, publicUser } from '../auth.js';
import { ah, attemptLimiter, badRequest, clean, HttpError, isEmail, passwordProblem, rateLimit } from '../util.js';

export default function authRoutes({ db, secret, adminCode, requireAuth }) {
  const r = Router();
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const loginFails = attemptLimiter(10, 15 * 60_000);
  const codeFails = attemptLimiter(5, 15 * 60_000);

  const issue = (user) => ({ token: signToken({ uid: user.id, tv: user.tokenVersion || 0 }, secret), user: publicUser(user) });

  r.post(
    '/register',
    rateLimit(30, 15 * 60_000),
    ah(async (req, res) => {
      const name = clean(req.body?.name, 60);
      const email = clean(req.body?.email, 120).toLowerCase();
      const password = String(req.body?.password || '');
      const errors = {};
      if (name.length < 2) errors.name = 'Укажите имя';
      if (!isEmail(email)) errors.email = 'Некорректный e-mail';
      const pw = passwordProblem(password);
      if (pw) errors.password = pw;
      if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0], errors);
      if (db.findOne('users', (u) => u.email === email)) {
        throw new HttpError(409, 'Этот e-mail уже зарегистрирован — просто войдите', { email: 'Уже зарегистрирован' });
      }

      const user = db.insert('users', {
        name,
        email,
        password: hashPassword(password),
        // Администраторы задаются только через ADMIN_EMAILS в .env
        role: adminEmails.includes(email) ? 'admin' : 'user',
        tokenVersion: 0,
        profile: { trainingDays: [0, 2, 4], sessionMinutes: 60, level: 'beginner', restrictions: [], dietFlags: [] },
      });
      res.status(201).json(issue(user));
    })
  );

  r.post(
    '/login',
    ah(async (req, res) => {
      const email = clean(req.body?.email, 120).toLowerCase();
      const password = String(req.body?.password || '');
      const key = `${req.ip}:${email}`;
      if (loginFails.blocked(key)) throw new HttpError(429, 'Слишком много неверных попыток. Подождите 15 минут или попросите администратора сбросить пароль.');
      const user = db.findOne('users', (u) => u.email === email);
      if (!user) {
        loginFails.fail(key);
        throw new HttpError(401, 'Аккаунт с таким e-mail не найден — зарегистрируйтесь', { email: 'Не найден' });
      }
      if (!verifyPassword(password, user.password)) {
        loginFails.fail(key);
        throw new HttpError(401, 'Неверный пароль', { password: 'Неверный пароль' });
      }
      loginFails.reset(key);
      if (adminEmails.includes(email) && user.role !== 'admin') db.update('users', user.id, { role: 'admin' });
      res.json(issue(user));
    })
  );

  // Стать администратором по секретному коду (код печатается в терминале при запуске сервера)
  r.post(
    '/admin-code',
    requireAuth,
    ah(async (req, res) => {
      if (codeFails.blocked(req.user.id)) throw new HttpError(429, 'Слишком много неверных попыток. Подождите 15 минут.');
      const code = String(req.body?.code || '').trim().toUpperCase();
      const a = Buffer.from(code);
      const b = Buffer.from(String(adminCode).toUpperCase());
      if (!code || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        codeFails.fail(req.user.id);
        throw new HttpError(403, 'Неверный код администратора');
      }
      codeFails.reset(req.user.id);
      const user = db.update('users', req.user.id, { role: 'admin' });
      res.json({ user: publicUser(user) });
    })
  );

  r.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

  r.put(
    '/me',
    requireAuth,
    ah(async (req, res) => {
      const name = clean(req.body?.name, 60);
      if (name.length < 2) throw badRequest('Укажите имя', { name: 'Укажите имя' });
      const user = db.update('users', req.user.id, { name });
      res.json({ user: publicUser(user) });
    })
  );

  r.put(
    '/password',
    requireAuth,
    ah(async (req, res) => {
      const { current, next } = req.body || {};
      if (!verifyPassword(String(current || ''), req.user.password)) throw badRequest('Текущий пароль неверный', { current: 'Неверный пароль' });
      const pw = passwordProblem(next);
      if (pw) throw badRequest(pw, { next: pw });
      const user = db.update('users', req.user.id, { password: hashPassword(String(next)), tokenVersion: (req.user.tokenVersion || 0) + 1 });
      res.json(issue(user));
    })
  );

  // Удаление аккаунта вместе со всеми персональными данными
  r.delete(
    '/me',
    requireAuth,
    ah(async (req, res) => {
      const uid = req.user.id;
      for (const c of ['weights', 'water', 'meals', 'training', 'sessions', 'labs', 'chats']) db.removeWhere(c, (x) => x.userId === uid);
      db.remove('users', uid);
      res.json({ ok: true });
    })
  );

  return r;
}
