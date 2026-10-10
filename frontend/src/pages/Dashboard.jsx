import { t } from '../i18n.jsx';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useAuth, useToast } from '../context.jsx';
import { Btn, Card, ConfirmBtn, Empty, ErrorBox, Field, Icon, Macro, Modal, PageHead, Progress, Spinner } from '../app/ui.jsx';
import WeightChart from '../app/WeightChart.jsx';
import { fmt, plural, shortDate, SLOT_LABEL, sum, todayStr } from '../lib/format.js';
import { RecipeModal } from './Nutrition.jsx';
import { Rich } from './Assistant.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return t('Доброй ночи');
  if (h < 12) return t('Доброе утро');
  if (h < 18) return t('Добрый день');
  return t('Добрый вечер');
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const { data: s, loading, error, reload, setData } = useApi('/api/profile/summary');
  const [weightOpen, setWeightOpen] = useState(false);
  const [recipe, setRecipe] = useState(null);
  const [busy, setBusy] = useState('');

  if (loading && !s) return <div className="page-loading"><Spinner /></div>;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!s) return null;

  if (!s.complete) {
    return (
      <>
        <PageHead title={`${greeting()}, ${user.name}!`} text={t('Давай настроим кабинет под тебя.')} />
        <Card>
          <Empty icon="target" title={t('Заполни профиль — это 1 минута')} text={t('Рост, вес, возраст и цель нужны, чтобы рассчитать норму калорий и воды, составить меню и план тренировок.')}>
            <Link to="/app/profile?welcome=1" className="abtn abtn-primary">
              <span>{t('Заполнить профиль')}</span>
            </Link>
          </Empty>
        </Card>
      </>
    );
  }

  const today = s.today;
  const isTrainingDay = Boolean(s.workout);
  const waterTarget = isTrainingDay ? s.water.trainingDayMl : s.water.restDayMl;

  const setWater = async (ml) => {
    const value = Math.max(0, Math.min(10000, ml));
    setData((d) => ({ ...d, waterMl: value }));
    try {
      await api.put(`/api/water/${todayStr()}`, { ml: value });
    } catch (e) {
      toast.error(e);
      reload();
    }
  };

  const toggleMeal = async (m) => {
    setData((d) => ({ ...d, todayMeals: d.todayMeals.map((x) => (x.id === m.id ? { ...x, eaten: !m.eaten } : x)) }));
    try {
      await api.patch(`/api/meals/${m.id}`, { eaten: !m.eaten });
      if (!m.eaten) toast.ok(t('Отмечено: {x}', { x: t(m.title) }));
      reload();
    } catch (e) {
      toast.error(e);
      reload();
    }
  };

  const generate = async (kind) => {
    setBusy(kind);
    try {
      const month = todayStr().slice(0, 7);
      const r = await api.post(`/api/${kind}/generate`, { month });
      toast.ok(kind === 'meals' ? t('Меню составлено: {n} {w}', { n: r.created, w: plural(r.created, 'блюдо', 'блюда', 'блюд') }) : t('План тренировок готов: {n} {w}', { n: r.created, w: plural(r.created, 'тренировка', 'тренировки', 'тренировок') }));
      reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy('');
    }
  };

  const toggleWorkout = async () => {
    try {
      await api.patch(`/api/training/${s.workout.id}`, { done: !s.workout.done });
      if (!s.workout.done) toast.ok(t('Тренировка выполнена! 💪'));
      reload();
    } catch (e) {
      toast.error(e);
    }
  };

  const { progress: pr, nutrition: n, budget: b } = s;
  const glasses = Math.ceil(waterTarget / 250);
  const drunk = Math.floor(s.waterMl / 250);

  return (
    <>
      <PageHead title={`${greeting()}, ${user.name}!`} text={s.workout ? t('Сегодня тренировка: {x}', { x: t(s.workout.title) }) : t('Сегодня день отдыха — восстановление тоже часть прогресса.')}>
        <div className={`streak ${s.streak.activeToday ? 'is-on' : ''}`} title={t('Дней подряд с активностью: вода, еда, тренировки')}>
          <Icon name="flame" size={18} />
          <b>{s.streak.streak}</b> {plural(s.streak.streak, t('день'), t('дня'), t('дней'))} {t('подряд')}
        </div>
      </PageHead>

      <TipOfDay />

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">
            <Icon name="flame" size={16} />{' '}{t('Калории сегодня')}
          </span>
          <strong>
            {fmt(s.eaten.kcal)} <em>/ {fmt(n.kcal)}</em>
          </strong>
          <Progress value={s.eaten.kcal} max={n.kcal} label={t('Калории')} />
          <small>
            {t('Б')} {s.eaten.p}/{n.protein} · {t('Ж')} {s.eaten.f}/{n.fat} · {t('У')} {s.eaten.c}/{n.carbs} {t('г')}
          </small>
        </div>

        <div className="kpi">
          <span className="kpi-label">
            <Icon name="drop" size={16} />{' '}{t('Вода')}
          </span>
          <strong>
            {fmt(s.waterMl)} <em>/ {fmt(waterTarget)} {t('мл')}</em>
          </strong>
          <div className="glasses" aria-label={t('Выпито {a} из {b} стаканов', { a: drunk, b: glasses })}>
            {Array.from({ length: glasses }).map((_, i) => (
              <button key={i} className={i < drunk ? 'is-full' : ''} onClick={() => setWater((i + 1) * 250)} aria-label={t('{n} стакан', { n: i + 1 })} />
            ))}
          </div>
          <div className="kpi-actions">
            <Btn size="sm" variant="ghost" onClick={() => setWater(s.waterMl - 250)} disabled={s.waterMl <= 0}>
              −250
            </Btn>
            <Btn size="sm" onClick={() => setWater(s.waterMl + 250)}>{t('+ стакан')}</Btn>
          </div>
        </div>

        <div className="kpi">
          <span className="kpi-label">
            <Icon name="scale" size={16} />{' '}{t('Вес')}
          </span>
          <strong>
            {pr.weight} <em>{t('кг')}</em>
          </strong>
          <small>
            {pr.target
              ? pr.diff > 0
                ? t('До цели {t} кг: −{d} кг', { t: pr.target, d: pr.diff })
                : pr.diff < 0
                  ? t('До цели {t} кг: +{d} кг', { t: pr.target, d: Math.abs(pr.diff) })
                  : t('Цель достигнута 🎉')
              : t('Вес в норме — держим форму')}
          </small>
          <Btn size="sm" variant="ghost" icon="plus" onClick={() => setWeightOpen(true)}>
            {t('Записать вес')}
          </Btn>
        </div>

        <div className="kpi">
          <span className="kpi-label">
            <Icon name="target" size={16} />{' '}{t('Индекс массы тела')}
          </span>
          <strong>{pr.bmi.bmi}</strong>
          <span className={`res-tag tone-${pr.bmi.tone}`}>{t(pr.bmi.label)}</span>
          <small>
            {t('Здоровый вес для твоего роста: {a}–{b} кг', { a: pr.bmi.idealMin, b: pr.bmi.idealMax })}
          </small>
        </div>
      </div>

      <div className="grid-2">
        <Card title={t('Меню на сегодня')} icon="food" action={<Link to="/app/nutrition" className="link-btn">{t('Календарь →')}</Link>}>
          {s.todayMeals.length ? (
            <ul className="meal-list">
              {s.todayMeals.map((m) => (
                <li key={m.id} className={m.eaten ? 'is-eaten' : ''}>
                  <button className={`check ${m.eaten ? 'is-on' : ''}`} onClick={() => toggleMeal(m)} aria-label={m.eaten ? t('Отменить отметку') : t('Отметить: съел')}>
                    <Icon name="check" size={16} />
                  </button>
                  <div className="meal-main">
                    <span className="meal-slot">{SLOT_LABEL[m.slot]}</span>
                    <button className="meal-title" onClick={() => m.recipeId && setRecipe(m)}>
                      {t(m.title)}
                    </button>
                    <Macro n={m.nutrition} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="calendar" title={t('Меню ещё не составлено')} text={t('Составим питание на месяц под твою норму, ограничения и анализы.')}>
              <Btn loading={busy === 'meals'} onClick={() => generate('meals')}>
                {t('Составить меню')}
              </Btn>
            </Empty>
          )}
        </Card>

        <Card title={s.workout ? t('Тренировка сегодня') : t('Тренировки')} icon="dumbbell" action={<Link to="/app/training" className="link-btn">{t('План →')}</Link>}>
          {s.workout ? (
            <>
              <h3 className="workout-title">{t(s.workout.title)}</h3>
              <ul className="ex-list">
                {s.workout.exercises.map((e, i) => (
                  <li key={i}>
                    <span>{t(e.name)}</span>
                    <span className="muted">
                      {e.sets} × {e.reps} {t(e.unit)}
                    </span>
                    {e.camera && (
                      <Link to={`/app/coach?ex=${e.camera}`} className="mini-link" title={t('Проверить технику с ИИ-тренером')}>
                        <Icon name="camera" size={15} />{' '}{t('ИИ')}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <Btn variant={s.workout.done ? 'ghost' : 'primary'} icon="check" onClick={toggleWorkout}>
                {s.workout.done ? t('Выполнено ✓') : t('Отметить выполненной')}
              </Btn>
            </>
          ) : s.hasTrainingPlan ? (
            <Empty icon="calendar" title={t('Сегодня отдых')} text={s.nextWorkout ? t('Следующая тренировка — {d}: {x}', { d: shortDate(s.nextWorkout.date), x: t(s.nextWorkout.title) }) : t('В этом месяце тренировок больше нет.')} />
          ) : (
            <Empty icon="dumbbell" title={t('Плана тренировок пока нет')} text={t('Составим расписание на месяц по твоим дням и цели.')}>
              <Btn loading={busy === 'training'} onClick={() => generate('training')}>
                {t('Составить план')}
              </Btn>
            </Empty>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card title={t('Прогноз результата')} icon="target">
          {pr.eta ? (
            <div className="eta">
              <strong>
                {pr.eta.weeksMin}–{pr.eta.weeksMax} <em>{t('недель')}</em>
              </strong>
              <p>
                {s.progress.diff > 0 ? t('чтобы сбросить {d} кг', { d: pr.diff }) : t('до заметного набора мышечной массы')}{' '}
                {t('при безопасном темпе {p}. Быстрее — значит терять мышцы и здоровье.', { p: t(pr.eta.pace) })}
              </p>
            </div>
          ) : (
            <p className="muted">{t('Цель — поддерживать форму. Следи, чтобы вес оставался в коридоре ±1,5 кг.')}</p>
          )}
          <ol className="timeline">
            {pr.milestones.map((m) => (
              <li key={m.weeks}>
                <b>{t(m.weeks)}</b>
                <span>{t(m.text)}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title={t('Бюджет на месяц')} icon="wallet" action={<Link to="/app/profile" className="link-btn">{t('Изменить →')}</Link>}>
          <div className="budget">
            <div>
              <span>{t('Питание по плану')}{b.estimated ? t(' (прогноз)') : ''}</span>
              <b>{sum(b.food)}</b>
            </div>
            <div>
              <span>{t('Абонемент')}</span>
              <b>{sum(b.membership)}</b>
            </div>
            <div className="budget-total">
              <span>{t('Итого расходы')}</span>
              <b>{sum(b.total)}</b>
            </div>
            {b.budget ? (
              <>
                <div>
                  <span>{t('Твой бюджет')}</span>
                  <b>{sum(b.budget)}</b>
                </div>
                <div className={`budget-left ${b.left < 0 ? 'is-bad' : 'is-ok'}`}>
                  <span>{b.left < 0 ? t('Не хватает') : t('Останется')}</span>
                  <b>{sum(Math.abs(b.left))}</b>
                </div>
              </>
            ) : (
              <p className="muted">{t('Укажи бюджет в профиле — посчитаем, сколько денег останется.')}</p>
            )}
          </div>
          {b.left < 0 && <p className="hint-warn">{t('Совет: замени лосось на хек, ягоды — на яблоки, а миндаль — на грецкий орех. Это снизит стоимость меню на 20–30%.')}</p>}
        </Card>
      </div>

      <div className="grid-2">
        <Card title={t('Динамика веса')} icon="scale" action={<button className="link-btn" onClick={() => setWeightOpen(true)}>{t('История →')}</button>}>
          {s.weights.length >= 2 ? (
            <WeightChart points={s.weights} target={pr.target} />
          ) : (
            <Empty icon="scale" title={t('Мало данных для графика')} text={t('Взвешивайся 1–2 раза в неделю утром натощак — здесь появится график.')} />
          )}
        </Card>

        <Card title={t('Вода и напитки')} icon="drop">
          <ul className="tips">
            <li>
              <b>{t('Норма:')}</b> {t('{a} мл в день отдыха, {b} мл в день тренировки', { a: fmt(s.water.restDayMl), b: fmt(s.water.trainingDayMl) })}{s.water.hot ? t(' (с учётом жары)') : ''}.
            </li>
            <li>
              <b>{t('Спортивные напитки:')}</b> {t(s.water.sportsDrink.text)}
            </li>
            <li>
              <b>{t('Какую воду пить:')}</b>{' '}{t('чистую питьевую или фильтрованную; минеральную с высокой минерализацией — не каждый день. Соки и газировки воду не заменяют.')}
            </li>
          </ul>
          <Link to="/app/guide" className="link-btn">
            {t('Подробнее в справочнике →')}
          </Link>
        </Card>
      </div>

      <WeightModal open={weightOpen} onClose={() => setWeightOpen(false)} onChange={reload} />
      <RecipeModal meal={recipe} onClose={() => setRecipe(null)} />
    </>
  );
}

function WeightModal({ open, onClose, onChange }) {
  const toast = useToast();
  const { data, reload } = useApi(open ? '/api/weights' : null);
  const [form, setForm] = useState({ date: todayStr(), weight: '' });
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr({});
    try {
      const body = { date: form.date, weight: Number(String(form.weight).replace(',', '.')) };
      if (edit) await api.put(`/api/weights/${edit}`, body);
      else await api.post('/api/weights', body);
      toast.ok(t('Вес сохранён'));
      setForm({ date: todayStr(), weight: '' });
      setEdit(null);
      reload();
      onChange();
    } catch (e2) {
      setErr(e2.fields || {});
      if (!e2.fields) toast.error(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={t('Дневник веса')} onClose={onClose}>
      <form className="row-form" onSubmit={save}>
        <Field label={t('Дата')} error={err.date}>
          <input type="date" value={form.date} max={todayStr()} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </Field>
        <Field label={t('Вес, кг')} error={err.weight}>
          <input inputMode="decimal" value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} placeholder="72,5" />
        </Field>
        <Btn type="submit" loading={busy} icon={edit ? 'check' : 'plus'}>
          {edit ? t('Сохранить') : t('Добавить')}
        </Btn>
      </form>
      <p className="fine">{t('Взвешивайся утром натощак, после туалета — так цифры будут сравнимы.')}</p>
      <ul className="crud-list">
        {(data || [])
          .slice()
          .reverse()
          .map((w) => (
            <li key={w.id}>
              <span>{shortDate(w.date)}</span>
              <b>{w.weight} {t('кг')}</b>
              <div className="crud-actions">
                <Btn
                  size="sm"
                  variant="ghost"
                  icon="edit"
                  onClick={() => {
                    setEdit(w.id);
                    setForm({ date: w.date, weight: String(w.weight) });
                  }}
                  aria-label={t('Изменить')}
                />
                <ConfirmBtn
                  onConfirm={async () => {
                    await api.del(`/api/weights/${w.id}`);
                    reload();
                    onChange();
                  }}
                >
                  {''}
                </ConfirmBtn>
              </div>
            </li>
          ))}
        {data && !data.length && <li className="muted">{t('Записей пока нет')}</li>}
      </ul>
    </Modal>
  );
}

// Совет дня из базы знаний помощника — свой для каждого пользователя и дня
function TipOfDay() {
  const { data } = useApi('/api/ai/tip');
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <section className={`tip ${open ? 'is-open' : ''}`}>
      <div className="tip-head">
        <span className="feature-icon small">
          <Icon name="bulb" size={20} />
        </span>
        <div>
          <span className="meal-slot">{t('Совет дня')} · {t(data.category)}</span>
          <h3>{t(data.title)}</h3>
        </div>
        <button className="link-btn" onClick={() => setOpen((v) => !v)}>
          {open ? t('Свернуть') : t('Читать')}
        </button>
      </div>
      {open && (
        <div className="tip-body">
          <Rich text={data.content} />
          <Link to="/app/assistant" className="link-btn">
            {t('Задать свой вопрос помощнику →')}
          </Link>
        </div>
      )}
    </section>
  );
}
