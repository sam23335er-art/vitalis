import { t } from '../i18n.jsx';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useAuth, useToast } from '../context.jsx';
import { Btn, Card, Chip, ConfirmBtn, Field, Icon, PageHead } from '../app/ui.jsx';
import { todayStr, weekdays } from '../lib/format.js';

const ACTIVITY = [
  [1.2, 'Минимальная — сидячая работа, мало движения'],
  [1.375, 'Лёгкая — 1–3 тренировки в неделю'],
  [1.55, 'Средняя — 3–5 тренировок в неделю'],
  [1.725, 'Высокая — 6–7 тренировок в неделю'],
  [1.9, 'Очень высокая — спорт + физический труд'],
];

const RESTR = [
  ['vegetarian', 'Вегетарианство'],
  ['noFish', 'Без рыбы'],
  ['noDairy', 'Без молочного'],
  ['noRedMeat', 'Без красного мяса'],
];

const toForm = (p = {}) => ({
  sex: p.sex || '',
  age: p.age ?? '',
  height: p.height ?? '',
  weight: p.weight ?? '',
  goalWeight: p.goalWeight ?? '',
  activity: p.activity ?? 1.375,
  goal: p.goal || '',
  level: p.level || 'beginner',
  trainingDays: p.trainingDays || [0, 2, 4],
  sessionMinutes: p.sessionMinutes ?? 60,
  budget: p.budget ?? '',
  membership: p.membership ?? '',
  restrictions: p.restrictions || [],
  dietFlags: p.dietFlags || [],
});

function Seg({ value, onChange, items }) {
  return (
    <div className="aseg" role="radiogroup">
      {items.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'is-active' : ''} onClick={() => onChange(v)}>
          {t(l)}
        </button>
      ))}
    </div>
  );
}

export default function Profile() {
  const { user, setUser, logout, applyToken } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const flagsList = useApi('/api/labs/flags');
  const [form, setForm] = useState(() => toForm(user.profile));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');
  const [rebuild, setRebuild] = useState(false);

  useEffect(() => setForm(toForm(user.profile)), [user.profile]);

  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const toggleIn = (k, v) => setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  const regenerate = async () => {
    const month = todayStr().slice(0, 7);
    await Promise.all([api.post('/api/meals/generate', { month }), api.post('/api/training/generate', { month })]);
  };

  const save = async (e) => {
    e.preventDefault();
    const req = {};
    if (!form.sex) req.sex = t('Выберите пол');
    if (!form.goal) req.goal = t('Выберите цель');
    for (const k of ['age', 'height', 'weight']) if (form[k] === '') req[k] = t('Обязательное поле');
    if (Object.keys(req).length) {
      setErrors(req);
      toast.error(t('Заполни обязательные поля'));
      return;
    }
    setBusy('save');
    try {
      const body = { ...form };
      for (const k of ['age', 'height', 'weight', 'goalWeight', 'sessionMinutes', 'budget', 'membership']) {
        body[k] = body[k] === '' ? null : Number(String(body[k]).replace(',', '.').replace(/\s/g, ''));
      }
      const r = await api.put('/api/profile', body);
      setUser(r.user);
      if (welcome) {
        await regenerate();
        toast.ok(t('Готово! Меню и тренировки на месяц составлены'));
        nav('/app', { replace: true });
      } else {
        toast.ok(t('Профиль сохранён'));
        setRebuild(true);
      }
    } catch (err) {
      setErrors(err.fields || {});
      toast.error(err);
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <PageHead title={welcome ? t('Давай познакомимся') : t('Профиль')} text={welcome ? t('Эти данные нужны для расчёта нормы калорий, воды, меню и плана тренировок.') : t('Данные для расчётов, ограничения в питании и настройки аккаунта.')} />

      {rebuild && (
        <div className="alert alert-info">
          <Icon name="refresh" size={18} />
          <span>{t('Профиль изменён. Пересобрать меню и тренировки с сегодняшнего дня? Съеденные блюда и выполненные тренировки сохранятся.')}</span>
          <Btn
            size="sm"
            loading={busy === 'rebuild'}
            onClick={async () => {
              setBusy('rebuild');
              try {
                await regenerate();
                toast.ok(t('Меню и тренировки обновлены'));
                setRebuild(false);
              } catch (e) {
                toast.error(e);
              } finally {
                setBusy('');
              }
            }}
          >
            {t('Пересобрать')}
          </Btn>
        </div>
      )}

      <form onSubmit={save} className="stack" noValidate>
        <Card title={t('Тело и цель')} icon="target">
          <div className="form-grid cols-3">
            <Field label={t('Пол')} error={errors.sex}>
              <Seg value={form.sex} onChange={set('sex')} items={[['m', t('Мужской')], ['f', t('Женский')]]} />
            </Field>
            <Field label={t('Возраст, лет')} error={errors.age}>
              <input inputMode="numeric" value={form.age} onChange={set('age')} />
            </Field>
            <Field label={t('Рост, см')} error={errors.height}>
              <input inputMode="decimal" value={form.height} onChange={set('height')} />
            </Field>
            <Field label={t('Вес, кг')} error={errors.weight}>
              <input inputMode="decimal" value={form.weight} onChange={set('weight')} />
            </Field>
            <Field label={t('Желаемый вес, кг')} error={errors.goalWeight} hint={t('Необязательно')}>
              <input inputMode="decimal" value={form.goalWeight} onChange={set('goalWeight')} />
            </Field>
            <Field label={t('Активность')} error={errors.activity}>
              <select value={form.activity} onChange={(e) => set('activity')(Number(e.target.value))}>
                {ACTIVITY.map(([v, l]) => (
                  <option key={v} value={v}>
                    {t(l)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="form-grid">
            <Field label={t('Цель')} error={errors.goal}>
              <Seg value={form.goal} onChange={set('goal')} items={[['lose', t('Похудеть')], ['keep', t('Держать форму')], ['gain', t('Набрать массу')]]} />
            </Field>
            <Field label={t('Уровень подготовки')}>
              <Seg value={form.level} onChange={set('level')} items={[['beginner', t('Новичок')], ['intermediate', t('Средний')], ['advanced', t('Опытный')]]} />
            </Field>
          </div>
        </Card>

        <Card title={t('Тренировки')} icon="dumbbell">
          <Field label={t('Дни тренировок')} error={errors.trainingDays} hint={t('{n} в неделю. Новичкам оптимально 3 дня через день.', { n: form.trainingDays.length })}>
            <div className="chips">
              {weekdays().map((d, i) => (
                <Chip key={d} active={form.trainingDays.includes(i)} onClick={() => toggleIn('trainingDays', i)}>
                  {d}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label={t('Длительность тренировки, мин')} error={errors.sessionMinutes} className="narrow">
            <input inputMode="numeric" value={form.sessionMinutes} onChange={set('sessionMinutes')} />
          </Field>
        </Card>

        <Card title={t('Питание')} icon="food">
          <Field label={t('Ограничения')}>
            <div className="chips">
              {RESTR.map(([v, l]) => (
                <Chip key={v} active={form.restrictions.includes(v)} onClick={() => toggleIn('restrictions', v)}>
                  {l}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label={t('Особенности по здоровью')} hint={t('Обычно выставляются автоматически из раздела «Анализы», но можно отметить вручную по назначению врача.')}>
            <div className="chips">
              {(flagsList.data || []).map((f) => (
                <Chip key={f.key} active={form.dietFlags.includes(f.key)} onClick={() => toggleIn('dietFlags', f.key)}>
                  {f.title}
                </Chip>
              ))}
            </div>
          </Field>
        </Card>

        <Card title={t('Бюджет')} icon="wallet">
          <div className="form-grid">
            <Field label={t('Бюджет на питание и спорт в месяц, сум')} error={errors.budget} hint={t('Покажем, сколько останется после меню и абонемента')}>
              <input inputMode="numeric" value={form.budget} onChange={set('budget')} placeholder="3 000 000" />
            </Field>
            <Field label={t('Абонемент в месяц, сум')} error={errors.membership}>
              <input inputMode="numeric" value={form.membership} onChange={set('membership')} placeholder="590 000" />
            </Field>
          </div>
        </Card>

        <div className="row-actions sticky-actions">
          <Btn type="submit" icon="check" loading={busy === 'save'} className="abtn-lg">
            {welcome ? t('Сохранить и составить план') : t('Сохранить профиль')}
          </Btn>
        </div>
      </form>

      {!welcome && <AdminAccess user={user} setUser={setUser} />}
      {!welcome && <Account user={user} setUser={setUser} logout={logout} applyToken={applyToken} />}
    </>
  );
}

function Account({ user, setUser, logout, applyToken }) {
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');

  const saveName = async () => {
    setBusy('name');
    try {
      const r = await api.put('/api/auth/me', { name });
      setUser(r.user);
      toast.ok(t('Имя сохранено'));
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy('');
    }
  };

  const changePw = async (e) => {
    e.preventDefault();
    setBusy('pw');
    setErrors({});
    try {
      const r = await api.put('/api/auth/password', pw);
      applyToken(r.token, r.user);
      setPw({ current: '', next: '' });
      toast.ok(t('Пароль изменён. На других устройствах нужно войти заново.'));
    } catch (err) {
      setErrors(err.fields || {});
      toast.error(err);
    } finally {
      setBusy('');
    }
  };

  return (
    <Card title={t('Аккаунт')} icon="user" className="account">
      <div className="form-grid">
        <div className="stack">
          <Field label={t('Имя')}>
            <div className="inline-form">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              <Btn variant="ghost" loading={busy === 'name'} onClick={saveName} disabled={name.trim().length < 2 || name === user.name}>
                {t('Сохранить')}
              </Btn>
            </div>
          </Field>
          <p className="muted small">E-mail: {user.email}</p>
        </div>
        <form className="stack" onSubmit={changePw}>
          <Field label={t('Текущий пароль')} error={errors.current}>
            <input type="password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} autoComplete="current-password" />
          </Field>
          <Field label={t('Новый пароль')} error={errors.next} hint={t('Минимум 8 символов')}>
            <input type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} autoComplete="new-password" />
          </Field>
          <Btn type="submit" variant="ghost" loading={busy === 'pw'} disabled={!pw.current || pw.next.length < 8}>
            {t('Сменить пароль')}
          </Btn>
        </form>
      </div>
      <div className="danger-zone">
        <div>
          <b>{t('Удалить аккаунт')}</b>
          <p className="muted small">{t('Будут удалены профиль, меню, тренировки, анализы и переписка. Действие необратимо.')}</p>
        </div>
        <ConfirmBtn
          size={undefined}
          confirmText={t('Удалить навсегда?')}
          onConfirm={async () => {
            await api.del('/api/auth/me');
            logout();
          }}
        >
          {t('Удалить аккаунт')}
        </ConfirmBtn>
      </div>
    </Card>
  );
}

function AdminAccess({ user, setUser }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user.role === 'admin') {
    return (
      <Card title={t('Доступ администратора')} icon="shield" className="account">
        <p className="muted">{t('Ты администратор. Тебе доступны обучение помощника, заявки, пользователи, продукты и рецепты.')}</p>
        <div className="row-actions">
          <Link to="/app/teach" className="abtn abtn-primary">
            <Icon name="bulb" size={16} /> <span>{t('Обучение ИИ')}</span>
          </Link>
          <Link to="/app/admin" className="abtn abtn-ghost">
            <Icon name="shield" size={16} /> <span>{t('Админка')}</span>
          </Link>
        </div>
      </Card>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/api/auth/admin-code', { code });
      setUser(r.user);
      toast.ok(t('Готово! Теперь ты администратор'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t('Доступ администратора')} icon="shield" className="account">
      <p className="muted small">{t('Код администратора показывается в терминале при запуске сервера (строка «Код администратора: …»). Его можно задать и самому в файле backend/.env — строка ADMIN_CODE.')}</p>
      <form className="inline-form" onSubmit={submit}>
        <input className="search grow" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t('Код администратора')} autoComplete="off" maxLength={64} />
        <Btn type="submit" loading={busy} disabled={code.trim().length < 4}>
          {t('Войти как админ')}
        </Btn>
      </form>
      {error && <p className="afield-error">{error}</p>}
    </Card>
  );
}
