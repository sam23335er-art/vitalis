import { t } from './i18n.jsx';
// Глобальные контексты: пользователь и всплывающие уведомления
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthCtx = createContext(null);
const ToastCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api
      .get('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('vitalis:logout', onLogout);
    return () => window.removeEventListener('vitalis:logout', onLogout);
  }, []);

  const auth = useCallback(async (mode, payload) => {
    const d = await api.post(`/api/auth/${mode}`, payload);
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      login: (p) => auth('login', p),
      register: (p) => auth('register', p),
      logout: () => {
        setToken(null);
        setUser(null);
      },
      applyToken: (token, u) => {
        setToken(token);
        setUser(u);
      },
    }),
    [user, loading, auth]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((text, type = 'ok') => {
    const id = ++idRef.current;
    setItems((list) => [...list.slice(-3), { id, text, type }]);
    setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), 3800);
  }, []);

  const toast = useMemo(
    () => ({
      ok: (msg) => push(msg, 'ok'),
      error: (msg) => push(msg?.message || msg, 'error'),
      info: (msg) => push(msg, 'info'),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((it) => (
          <div key={it.id} className={`toast toast-${it.type}`}>
            {t(it.text)}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// Загрузка данных с повторной загрузкой по запросу
export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get(path, { signal: ctrl.signal })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState((s) => ({ ...s, loading: false, error }));
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const setData = useCallback((fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })), []);
  return { ...state, reload, setData };
}
