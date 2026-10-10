import { LangSwitch, t } from '../i18n.jsx';
import { BrandMark } from '../components/ui.jsx';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context.jsx';
import { Btn, Field, Icon } from '../app/ui.jsx';

// Те же правила, что и на сервере — подсказываем заранее, а не после ошибки
const WEAK = new Set(['12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', 'password', 'qwertyui', 'qwerty123', 'йцукенгш', 'password1', 'iloveyou']);
const isWeak = (p) => WEAK.has(p.toLowerCase()) || /^(.)\1+$/.test(p);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ name: '', email: loc.state?.email || '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null); // { text, action }
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [forgot, setForgot] = useState(false);

  if (user) return <Navigate to={loc.state?.from || '/app'} replace />;

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
    setError(null);
  };

  const email = form.email.trim().toLowerCase();
  const pwLong = form.password.length >= 8;
  const pwStrong = pwLong && !isWeak(form.password);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const local = {};
    if (!isLogin && form.name.trim().length < 2) local.name = t('Укажите имя');
    if (!EMAIL_RE.test(email)) local.email = t('Введите e-mail в формате name@mail.uz');
    if (isLogin && !form.password) local.password = t('Введите пароль');
    if (!isLogin && !pwLong) local.password = t('Минимум 8 символов');
    else if (!isLogin && !pwStrong) local.password = t('Слишком простой пароль — его легко подобрать');
    setErrors(local);
    if (Object.keys(local).length) return;

    setBusy(true);
    try {
      const payload = { email, password: form.password, ...(isLogin ? {} : { name: form.name.trim() }) };
      const u = await (isLogin ? login(payload) : register(payload));
      const complete = ['sex', 'age', 'height', 'weight', 'activity', 'goal'].every((k) => u.profile?.[k] !== undefined && u.profile?.[k] !== null);
      nav(isLogin ? loc.state?.from || '/app' : complete ? '/app' : '/app/profile?welcome=1', { replace: true });
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      // Подсказываем следующий шаг, а не только показываем ошибку
      let action = null;
      if (!isLogin && err.status === 409) action = { to: '/login', label: t('Войти с этим e-mail') };
      if (isLogin && err.status === 401 && err.fields?.email) action = { to: '/register', label: t('Зарегистрироваться с этим e-mail') };
      if (isLogin && err.status === 401 && err.fields?.password) action = { forgot: true, label: t('Забыли пароль?') };
      setError({ text: err.message, action });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-side" aria-hidden="true">
        <div className="auth-glow" />
        <Link to="/" className="logo auth-logo">
          <BrandMark />
          <span>VITALIS</span>
        </Link>
        <h2>
          {t('Твой тренер,')}
          <br />
          {t('диетолог и')} <span className="accent">{t('ИИ')}</span>
          <br />
          {t('в одном кабинете')}
        </h2>
        <ul>
          <li>
            <Icon name="camera" /> {t('ИИ-тренер считает только правильные повторения')}
          </li>
          <li>
            <Icon name="calendar" /> {t('Меню на месяц с рецептами и ценами в сумах')}
          </li>
          <li>
            <Icon name="flask" /> {t('Питание под твои анализы')}
          </li>
          <li>
            <Icon name="chat" /> {t('Ответы на любые вопросы о здоровье и спорте')}
          </li>
        </ul>
      </div>

      <div className="auth-main">
        <form className="auth-card" onSubmit={submit} noValidate>
          <div className="auth-top">
            <Link to="/" className="auth-back">
              <Icon name="arrowLeft" size={16} /> {t('На сайт')}
            </Link>
            <LangSwitch />
          </div>
          <h1>{isLogin ? t('Вход в кабинет') : t('Создать кабинет')}</h1>
          <p className="muted">{isLogin ? t('Рады видеть снова!') : t('Бесплатно. Займёт 30 секунд.')}</p>

          {!isLogin && (
            <Field label={t('Имя')} error={errors.name}>
              <input value={form.name} onChange={set('name')} autoComplete="name" maxLength={60} placeholder={t('Как к тебе обращаться')} />
            </Field>
          )}
          <Field label="E-mail" error={errors.email}>
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck="false" placeholder="you@mail.uz" />
          </Field>
          <Field label={t('Пароль')} error={errors.password}>
            <div className="pass-wrap">
              <input
                type={show ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                placeholder="••••••••"
              />
              <button type="button" className="link-btn" onClick={() => setShow((v) => !v)}>
                {show ? t('Скрыть') : t('Показать')}
              </button>
            </div>
          </Field>

          {!isLogin && (
            <ul className="pw-rules" aria-live="polite">
              <li className={pwLong ? 'is-ok' : ''}>
                <Icon name={pwLong ? 'check' : 'x'} size={14} /> {t('Минимум 8 символов')}
              </li>
              <li className={pwStrong ? 'is-ok' : ''}>
                <Icon name={pwStrong ? 'check' : 'x'} size={14} /> {t('Не простой (не 12345678, не qwertyui)')}
              </li>
            </ul>
          )}

          {error && (
            <div className="alert alert-error">
              <Icon name="alert" size={18} />
              <span>{error.text}</span>
              {error.action &&
                (error.action.forgot ? (
                  <button type="button" className="link-btn" onClick={() => setForgot(true)}>
                    {error.action.label}
                  </button>
                ) : (
                  <Link className="link-btn" to={error.action.to} state={{ email }}>
                    {error.action.label}
                  </Link>
                ))}
            </div>
          )}

          <Btn type="submit" loading={busy} className="abtn-block abtn-lg">
            {isLogin ? t('Войти') : t('Зарегистрироваться')}
          </Btn>

          {isLogin && (
            <button type="button" className="link-btn auth-forgot" onClick={() => setForgot((v) => !v)}>
              {t('Забыли пароль?')}
            </button>
          )}
          {forgot && (
            <div className="alert alert-info">
              <Icon name="info" size={18} />
              <span>{t('Напишите администратору клуба (Telegram или телефон на главной) — он сбросит пароль и выдаст временный. Потом смените его в профиле.')}</span>
            </div>
          )}

          <p className="auth-switch">
            {isLogin ? t('Нет аккаунта? ') : t('Уже есть аккаунт? ')}
            <Link to={isLogin ? '/register' : '/login'} state={{ email }}>
              {isLogin ? t('Зарегистрироваться') : t('Войти')}
            </Link>
          </p>
          {!isLogin && <p className="fine">{t('Регистрируясь, вы соглашаетесь на обработку персональных данных для работы личного кабинета.')}</p>}
        </form>
      </div>
    </div>
  );
}
