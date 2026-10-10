import { t } from '../i18n.jsx';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useToast } from '../context.jsx';
import { Btn, Card, ConfirmBtn, Empty, ErrorBox, Field, Icon, Modal, PageHead, Spinner } from '../app/ui.jsx';
import { calendarCells, dayTitle, monthRange, monthTitle, plural, shiftMonth, shortDate, todayStr, weekdays } from '../lib/format.js';
import { EXERCISES as CAMERA_EX } from '../lib/pose.js';

export default function Training() {
  const toast = useToast();
  const today = todayStr();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const { from, to } = monthRange(month);
  const plan = useApi(`/api/training?from=${from}&to=${to}`);
  const sessions = useApi('/api/sessions');
  const summary = useApi('/api/profile/summary');
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const byDay = useMemo(() => Object.fromEntries((plan.data || []).map((w) => [w.date, w])), [plan.data]);
  const w = byDay[selected];
  const done = (plan.data || []).filter((w) => w.done).length;
  const total = (plan.data || []).length;

  const generate = async () => {
    setBusy(true);
    try {
      const r = await api.post('/api/training/generate', { month });
      toast.ok(t('Расписание готово: {n} {w}', { n: r.created, w: plural(r.created, 'тренировка', 'тренировки', 'тренировок') }));
      plan.reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (w) => {
    try {
      const u = await api.patch(`/api/training/${w.id}`, { done: !w.done });
      plan.setData((list) => list.map((x) => (x.id === w.id ? u : x)));
      if (u.done) toast.ok(t('Отлично! Тренировка засчитана 💪'));
    } catch (e) {
      toast.error(e);
    }
  };

  if (summary.data && !summary.data.complete) {
    return (
      <>
        <PageHead title={t('Тренировки')} />
        <Card>
          <Empty icon="settings" title={t('Сначала заполни профиль')} text={t('Укажи цель, уровень подготовки и дни, в которые удобно тренироваться.')}>
            <Link to="/app/profile" className="abtn abtn-primary">
              <span>{t('Заполнить профиль')}</span>
            </Link>
          </Empty>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHead title={t('Тренировки')} text={total ? t('В этом месяце выполнено {a} из {b}', { a: done, b: total }) : t('Расписание на месяц по твоим дням и цели')}>
        <Btn variant="ghost" icon="plus" onClick={() => setAddOpen(true)}>
          {t('Своя тренировка')}
        </Btn>
        <Btn icon="refresh" loading={busy} onClick={generate}>
          {total ? t('Обновить расписание') : t('Составить расписание')}
        </Btn>
      </PageHead>
      <ErrorBox error={plan.error} onRetry={plan.reload} />

      <div className="cal-layout">
        <Card className="cal-card">
          <div className="cal-toolbar">
            <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t('Предыдущий месяц')}>
              <Icon name="chevronLeft" />
            </button>
            <h2>{monthTitle(month)}</h2>
            <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t('Следующий месяц')}>
              <Icon name="chevronRight" />
            </button>
          </div>
          <div className="cal-grid">
            {weekdays().map((d) => (
              <span key={d} className="cal-wd">
                {d}
              </span>
            ))}
            {calendarCells(month).map((date, i) => {
              if (!date) return <span key={`e${i}`} className="cal-empty" />;
              const wk = byDay[date];
              const missed = wk && !wk.done && date < today;
              return (
                <button
                  key={date}
                  className={`cal-day ${date === selected ? 'is-selected' : ''} ${date === today ? 'is-today' : ''} ${wk ? 'has-workout' : ''} ${wk?.done ? 'is-done' : ''} ${missed ? 'is-missed' : ''}`}
                  onClick={() => setSelected(date)}
                  aria-label={`${dayTitle(date)}${wk ? `: ${t(wk.title)}` : ''}`}
                >
                  <span className="cal-num">{Number(date.slice(8))}</span>
                  {wk && <span className="cal-wtitle">{wk.done ? '✓' : t(wk.title).split(' ')[0]}</span>}
                </button>
              );
            })}
          </div>
          <div className="cal-foot">
            <span>
              <i className="ldot is-planned" />{' '}{t('тренировка')}
            </span>
            <span>
              <i className="ldot is-eaten" />{' '}{t('выполнена')}
            </span>
            <span>
              <i className="ldot is-missed" />{' '}{t('пропущена')}
            </span>
          </div>
        </Card>

        <Card title={dayTitle(selected)} icon="dumbbell" className="day-card">
          {plan.loading && !plan.data ? (
            <Spinner />
          ) : w ? (
            <>
              <h3 className="workout-title">{t(w.title)}</h3>
              <ul className="ex-table">
                {w.exercises.map((e, i) => (
                  <li key={i}>
                    <div>
                      <b>{t(e.name)}</b>
                      <span className="muted">
                        {e.sets} × {e.reps} {t(e.unit)}
                      </span>
                    </div>
                    {e.camera && (
                      <Link to={`/app/coach?ex=${e.camera}`} className="abtn abtn-ghost abtn-sm">
                        <Icon name="camera" size={15} /> <span>{t('ИИ-проверка')}</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <p className="fine">{t('Отдых между подходами: 60–90 сек (силовые — до 2 мин). Начни с разминки 5–7 минут.')}</p>
              <div className="row-actions">
                <Btn variant={w.done ? 'success' : 'primary'} icon="check" onClick={() => toggle(w)} disabled={selected > today}>
                  {w.done ? t('Выполнено') : t('Отметить выполненной')}
                </Btn>
                <ConfirmBtn
                  onConfirm={async () => {
                    await api.del(`/api/training/${w.id}`);
                    plan.setData((list) => list.filter((x) => x.id !== w.id));
                  }}
                >
                  {t('Удалить')}
                </ConfirmBtn>
              </div>
            </>
          ) : (
            <Empty icon="calendar" title={t('День отдыха')} text={t('Мышцы растут во время восстановления. Можно прогуляться 30–40 минут или сделать растяжку.')}>
              <Btn variant="ghost" icon="plus" onClick={() => setAddOpen(true)}>
                {t('Добавить тренировку')}
              </Btn>
            </Empty>
          )}
        </Card>
      </div>

      <Card title={t('История ИИ-тренера')} icon="camera" action={<Link to="/app/coach" className="link-btn">{t('Открыть ИИ-тренер →')}</Link>}>
        {(sessions.data || []).length ? (
          <ul className="crud-list">
            {sessions.data.slice(0, 20).map((s) => (
              <li key={s.id}>
                <span>{shortDate(s.date)}</span>
                <b>{CAMERA_EX[s.exercise]?.name || s.exercise}</b>
                <span className="good">✓ {s.goodReps}</span>
                <span className="bad">✗ {s.badReps}</span>
                <span className="muted">{Math.round(s.durationSec / 60)} {t('мин')}</span>
                <ConfirmBtn
                  onConfirm={async () => {
                    await api.del(`/api/sessions/${s.id}`);
                    sessions.setData((l) => l.filter((x) => x.id !== s.id));
                  }}
                >
                  {''}
                </ConfirmBtn>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('Подходов с ИИ-тренером пока нет. Включи камеру — он посчитает только правильные повторения.')}</p>
        )}
      </Card>

      <AddWorkoutModal
        open={addOpen}
        date={selected}
        onClose={() => setAddOpen(false)}
        onSaved={(w) => {
          plan.setData((l) => [...(l || []).filter((x) => x.date !== w.date || x.id === w.id), w]);
          setAddOpen(false);
        }}
      />
    </>
  );
}

function AddWorkoutModal({ open, date, onClose, onSaved }) {
  const toast = useToast();
  const lib = useApi(open ? '/api/training/exercises' : null);
  const [form, setForm] = useState({ date: '', title: t('Моя тренировка') });
  const [rows, setRows] = useState([{ key: 'squats', sets: 3, reps: '12' }]);
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await api.post('/api/training', { date: form.date || date, title: form.title, exercises: rows });
      toast.ok(t('Тренировка добавлена'));
      onSaved(created);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const setRow = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <Modal open={open} title={t('Своя тренировка')} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <div className="form-grid">
          <Field label={t('Дата')}>
            <input type="date" key={date} defaultValue={date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </Field>
          <Field label={t('Название')}>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={80} />
          </Field>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="ex-row">
            <select value={r.key} onChange={(e) => setRow(i, 'key', e.target.value)} aria-label={t('Упражнение')}>
              {(lib.data || []).map((x) => (
                <option key={x.key} value={x.key}>
                  {t(x.name)}
                </option>
              ))}
            </select>
            <input inputMode="numeric" value={r.sets} onChange={(e) => setRow(i, 'sets', e.target.value)} aria-label={t('Подходы')} />
            <span>×</span>
            <input value={r.reps} onChange={(e) => setRow(i, 'reps', e.target.value)} aria-label={t('Повторения')} />
            <button type="button" className="icon-btn" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} disabled={rows.length === 1} aria-label={t('Убрать')}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
        <Btn type="button" variant="ghost" icon="plus" onClick={() => setRows((r) => [...r, { key: 'pushups', sets: 3, reps: '10' }])} disabled={rows.length >= 20}>
          {t('Упражнение')}
        </Btn>
        <Btn type="submit" loading={busy}>
          {t('Сохранить')}
        </Btn>
      </form>
    </Modal>
  );
}
