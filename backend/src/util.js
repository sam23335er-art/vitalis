// Общие помощники: ошибки, валидация, ограничение частоты запросов

export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const badRequest = (message, fields) => new HttpError(400, message, fields);
export const notFound = (what = 'Запись') => new HttpError(404, `${what} не найдена`);

// Обёртка для async-маршрутов: ошибки уходят в общий обработчик
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const clean = (v, max = 500) =>
  String(v ?? '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max);

export function num(v, { min = -Infinity, max = Infinity, int = false } = {}) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return NaN;
  return int ? Math.round(n) : n;
}

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const isMonth = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return null;
}

// Даты в формате YYYY-MM-DD без влияния часового пояса сервера
export function todayStr(tz = process.env.TZ_OFFSET_HOURS) {
  const offset = Number(tz ?? 5); // по умолчанию Ташкент, UTC+5
  const d = new Date(Date.now() + offset * 3600_000);
  return d.toISOString().slice(0, 10);
}

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthDates(month) {
  const n = daysInMonth(month);
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

// День недели: 0 = понедельник … 6 = воскресенье
export const weekday = (dateStr) => (new Date(`${dateStr}T00:00:00Z`).getUTCDay() + 6) % 7;

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Детерминированный генератор случайных чисел (одинаковый план при одинаковых данных)
export function seededRandom(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const hits = new Map();
export function rateLimit(max, windowMs) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const e = hits.get(key) || { count: 0, start: now };
    if (now - e.start > windowMs) {
      e.count = 0;
      e.start = now;
    }
    e.count += 1;
    hits.set(key, e);
    if (e.count > max) return next(new HttpError(429, 'Слишком много запросов. Попробуйте через несколько минут.'));
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.start > 3600_000) hits.delete(k);
}, 600_000).unref();

// Счётчик только НЕУДАЧНЫХ попыток (неверный пароль и т.п.) — честные пользователи не блокируются
export function attemptLimiter(max, windowMs) {
  const map = new Map();
  const get = (key) => {
    const now = Date.now();
    const e = map.get(key);
    if (!e || now - e.start > windowMs) return { count: 0, start: now };
    return e;
  };
  return {
    blocked(key) {
      if (process.env.NODE_ENV === 'test') return false;
      return get(key).count >= max;
    },
    fail(key) {
      const e = get(key);
      e.count += 1;
      map.set(key, e);
    },
    reset(key) {
      map.delete(key);
    },
  };
}

// Слишком простые пароли, которые подбирают первыми
const WEAK = new Set(['12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', 'password', 'qwertyui', 'qwerty123', 'йцукенгш', 'password1', 'iloveyou']);

export function passwordProblem(password) {
  const p = String(password || '');
  if (p.length < 8) return 'Минимум 8 символов';
  if (p.length > 128) return 'Слишком длинный пароль';
  if (WEAK.has(p.toLowerCase()) || /^(.)\1+$/.test(p)) return 'Слишком простой пароль — его легко подобрать';
  return null;
}
