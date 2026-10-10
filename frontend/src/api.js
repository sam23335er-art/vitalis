// Клиент API с авторизацией. Токен хранится в localStorage.
import fallbackContent from './data/content.json';
import fallbackContentUz from './data/content.uz.json';
import { getLang, t } from './i18n.jsx';

const BASE = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'vitalis_token';

let token = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  token = null;
}

export function setToken(t) {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* приватный режим браузера — токен живёт до закрытия вкладки */
  }
}

export const getToken = () => token;

export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || null;
  }
}

export async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(t('Нет связи с сервером. Проверьте, что сайт запущен (npm start), и попробуйте ещё раз.'), 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event('vitalis:logout'));
    }
    const fields = data?.errors ? Object.fromEntries(Object.entries(data.errors).map(([k, v]) => [k, t(v)])) : null;
    throw new ApiError(t(data?.error || `Ошибка ${res.status}`), res.status, fields);
  }
  return data;
}

export const api = {
  get: (p, opts) => request(p, opts),
  post: (p, body) => request(p, { method: 'POST', body: body ?? {} }),
  put: (p, body) => request(p, { method: 'PUT', body: body ?? {} }),
  patch: (p, body) => request(p, { method: 'PATCH', body: body ?? {} }),
  del: (p) => request(p, { method: 'DELETE' }),
};

// ---------- Лендинг ----------
export const localContent = () => (getLang() === 'uz' ? fallbackContentUz : fallbackContent);

export async function getContent() {
  try {
    const data = await request(`/api/content?lang=${getLang()}`);
    return data && Array.isArray(data.programs) ? data : localContent();
  } catch {
    return localContent();
  }
}

export const sendLead = (payload) => api.post('/api/leads', payload);
export const subscribe = (email) => api.post('/api/subscribe', { email });

export { fallbackContent, fallbackContentUz };
