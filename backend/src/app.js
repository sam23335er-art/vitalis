// Сборка Express-приложения. Вынесено отдельно от server.js, чтобы запускать в тестах.
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createDb } from './db.js';
import { authMiddleware } from './auth.js';
import { HttpError } from './util.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import { weightRoutes, waterRoutes, sessionRoutes } from './routes/tracking.js';
import mealRoutes from './routes/meals.js';
import trainingRoutes from './routes/training.js';
import labRoutes from './routes/labs.js';
import aiRoutes from './routes/ai.js';
import adminRoutes from './routes/admin.js';
import teachRoutes from './routes/teach.js';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// Секрет для подписи токенов: из .env, иначе генерируется один раз и хранится рядом с базой
function resolveSecret(dataDir) {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) return process.env.JWT_SECRET;
  const file = path.join(dataDir, '.secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

// Код администратора: из .env (ADMIN_CODE), иначе создаётся один раз и печатается при запуске
function resolveAdminCode(dataDir) {
  if (process.env.ADMIN_CODE && process.env.ADMIN_CODE.trim().length >= 6) return process.env.ADMIN_CODE.trim();
  const file = path.join(dataDir, '.admin-code');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from(crypto.randomBytes(8), (b) => abc[b % abc.length]).join('');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, code, { mode: 0o600 });
  return code;
}

export function createApp({ dataDir, seedDir, contentFile, distDir = null, notify = () => {} }) {
  const db = createDb(path.join(dataDir, 'db.json'), {
    recipes: readJson(path.join(seedDir, 'recipes.json')),
    ingredients: readJson(path.join(seedDir, 'ingredients.json')),
    knowledge: readJson(path.join(seedDir, 'knowledge.json')).map((k) => ({ ...k, enabled: true, hits: 0 })),
  });
  const secret = resolveSecret(dataDir);
  const { requireAuth, requireAdmin } = authMiddleware(db, secret);
  const adminCode = resolveAdminCode(dataDir);
  const deps = { db, secret, adminCode, requireAuth, requireAdmin, contentFile, notify };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const origin = process.env.CORS_ORIGIN || '*';
  app.use(cors({ origin: origin === '*' ? true : origin.split(',').map((s) => s.trim()) }));
  // Импорт базы знаний может быть большим — для обучения лимит выше
  app.use('/api/admin/teach', express.json({ limit: '3mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Камера нужна ИИ-тренеру только на нашем же домене
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    next();
  });

  app.use('/api', publicRoutes(deps));
  app.use('/api/auth', authRoutes(deps));
  app.use('/api/profile', profileRoutes(deps));
  app.use('/api/weights', weightRoutes(deps));
  app.use('/api/water', waterRoutes(deps));
  app.use('/api/sessions', sessionRoutes(deps));
  app.use('/api/meals', mealRoutes(deps));
  app.use('/api/training', trainingRoutes(deps));
  app.use('/api/labs', labRoutes(deps));
  app.use('/api/ai', aiRoutes(deps));
  app.use('/api/admin/teach', teachRoutes(deps));
  app.use('/api/admin', adminRoutes(deps));
  app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Не найдено' }));

  if (distDir) {
    app.use(express.static(distDir, { maxAge: '7d', index: false }));
    app.get('*', (req, res) => {
      const index = path.join(distDir, 'index.html');
      if (fs.existsSync(index)) return res.sendFile(index);
      // Сайт не собран — показываем понятную подсказку вместо «Cannot GET /»
      res
        .status(503)
        .type('html')
        .send(
          '<!doctype html><meta charset="utf-8"><title>VITALIS — сайт не собран</title>' +
            '<body style="font-family:system-ui;background:#0a0b09;color:#f4f6fa;display:grid;place-items:center;min-height:100vh;margin:0">' +
            '<div style="max-width:520px;padding:32px;border:1px solid #c6ff3d;border-radius:20px">' +
            '<h1 style="margin-top:0">Сервер работает, но сайт ещё не собран</h1>' +
            '<p>Остановите сервер (Ctrl + C) и выполните в папке проекта:</p>' +
            '<pre style="background:#181b15;padding:14px;border-radius:10px">npm run build\nnpm start</pre>' +
            '<p style="color:#8b93a3">Если сборка не запускается — сначала <code>npm run install:all</code></p></div>'
        );
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ ok: false, error: 'Некорректный запрос' });
    if (err.type === 'entity.too.large') return res.status(413).json({ ok: false, error: 'Слишком большой запрос' });
    if (err instanceof HttpError) return res.status(err.status).json({ ok: false, error: err.message, errors: err.fields });
    console.error(err);
    res.status(500).json({ ok: false, error: 'Внутренняя ошибка сервера' });
  });

  return { app, db, adminCode };
}
