// Авторизация: пароли — scrypt с солью, токены — подпись HMAC-SHA256 (формат как у JWT)
import crypto from 'node:crypto';
import { HttpError } from './util.js';

const TOKEN_TTL_SEC = 30 * 24 * 3600; // 30 дней

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = crypto.scryptSync(password, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

export function signToken(payload, secret) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC });
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verifyToken(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function authMiddleware(db, secret) {
  const requireAuth = (req, res, next) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = token && verifyToken(token, secret);
    const user = payload && db.get('users', payload.uid);
    // Токен перестаёт действовать после смены пароля (tv — версия токена)
    if (!user || (user.tokenVersion || 0) !== (payload.tv || 0)) {
      return next(new HttpError(401, 'Требуется вход в аккаунт'));
    }
    req.user = user;
    next();
  };

  const requireAdmin = (req, res, next) =>
    requireAuth(req, res, (err) => {
      if (err) return next(err);
      if (req.user.role !== 'admin') return next(new HttpError(403, 'Доступ только для администратора'));
      next();
    });

  return { requireAuth, requireAdmin };
}

export function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    profile: u.profile || {},
    createdAt: u.createdAt,
  };
}
