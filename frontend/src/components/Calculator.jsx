import { t } from '../i18n.jsx';
import { useMemo, useState } from 'react';
import { Reveal, SectionHead } from './ui.jsx';
import { formatSum } from '../hooks.js';

const activities = [
  { v: 1.2, l: 'Минимальная — сидячая работа' },
  { v: 1.375, l: 'Лёгкая — 1–3 тренировки в неделю' },
  { v: 1.55, l: 'Средняя — 3–5 тренировок в неделю' },
  { v: 1.725, l: 'Высокая — 6–7 тренировок в неделю' },
  { v: 1.9, l: 'Очень высокая — спорт + физический труд' },
];

const goals = [
  { v: 'lose', l: 'Снизить вес', k: 0.85 },
  { v: 'keep', l: 'Держать форму', k: 1 },
  { v: 'gain', l: 'Набрать массу', k: 1.12 },
];

const limits = { age: [14, 90], height: [120, 230], weight: [35, 250] };

function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: t('Недостаток веса'), tone: 'warn' };
  if (bmi < 25) return { label: t('Норма'), tone: 'ok' };
  if (bmi < 30) return { label: t('Избыточный вес'), tone: 'warn' };
  return { label: t('Ожирение'), tone: 'bad' };
}

export default function Calculator() {
  const [form, setForm] = useState({ sex: 'm', age: 28, height: 178, weight: 80, activity: 1.55, goal: 'keep' });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const errors = useMemo(() => {
    const e = {};
    for (const [k, [min, max]] of Object.entries(limits)) {
      const n = Number(form[k]);
      if (!form[k] || Number.isNaN(n) || n < min || n > max) e[k] = t('от {min} до {max}', { min, max });
    }
    return e;
  }, [form]);

  const result = useMemo(() => {
    if (Object.keys(errors).length) return null;
    const age = Number(form.age);
    const h = Number(form.height);
    const w = Number(form.weight);
    const bmi = w / Math.pow(h / 100, 2);
    // Формула Миффлина — Сан Жеора
    const bmr = 10 * w + 6.25 * h - 5 * age + (form.sex === 'm' ? 5 : -161);
    const goal = goals.find((g) => g.v === form.goal);
    const kcal = Math.round((bmr * Number(form.activity) * goal.k) / 10) * 10;
    const protein = Math.round(w * (form.goal === 'gain' ? 2 : 1.8));
    const fat = Math.round(w * 0.9);
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    const pos = Math.min(Math.max(((bmi - 15) / (40 - 15)) * 100, 0), 100);
    return { bmi, cat: bmiCategory(bmi), kcal, protein, fat, carbs, pos };
  }, [form, errors]);

  return (
    <section className="section section-light" id="calculator">
      <div className="container calc-wrap">
        <div>
          <SectionHead
            light
            kicker={t('02 · Калькулятор')}
            title={t('Узнай свою норму за 10 секунд')}
            text={t('Индекс массы тела и дневная норма калорий с распределением белков, жиров и углеводов.')}
          />
          <Reveal className="calc-note">
            {t('Расчёт ориентировочный. Точную программу питания составит наш нутрициолог на консультации.')}
          </Reveal>
        </div>

        <Reveal className="calc-card" delay={100}>
          <form className="calc-form" onSubmit={(e) => e.preventDefault()}>
            <div className="seg" role="radiogroup" aria-label={t('Пол')}>
              {[
                ['m', t('Мужчина')],
                ['f', t('Женщина')],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={form.sex === v}
                  className={form.sex === v ? 'is-active' : ''}
                  onClick={() => setForm((f) => ({ ...f, sex: v }))}
                >
                  {t(l)}
                </button>
              ))}
            </div>

            <div className="calc-row">
              {[
                ['age', t('Возраст'), t('лет')],
                ['height', t('Рост'), t('см')],
                ['weight', t('Вес'), t('кг')],
              ].map(([k, label, unit]) => (
                <label key={k} className={`field ${errors[k] ? 'has-error' : ''}`}>
                  <span>{t(label)}</span>
                  <div className="field-unit">
                    <input type="number" inputMode="decimal" value={form[k]} onChange={set(k)} min={limits[k][0]} max={limits[k][1]} />
                    <em>{t(unit)}</em>
                  </div>
                  {errors[k] && <small>{errors[k]}</small>}
                </label>
              ))}
            </div>

            <label className="field">
              <span>{t('Активность')}</span>
              <select value={form.activity} onChange={set('activity')}>
                {activities.map((a) => (
                  <option key={a.v} value={a.v}>
                    {t(a.l)}
                  </option>
                ))}
              </select>
            </label>

            <div className="seg seg-3" role="radiogroup" aria-label={t('Цель')}>
              {goals.map((g) => (
                <button
                  key={g.v}
                  type="button"
                  role="radio"
                  aria-checked={form.goal === g.v}
                  className={form.goal === g.v ? 'is-active' : ''}
                  onClick={() => setForm((f) => ({ ...f, goal: g.v }))}
                >
                  {t(g.l)}
                </button>
              ))}
            </div>
          </form>

          <div className="calc-result" aria-live="polite">
            {result ? (
              <>
                <div className="res-top">
                  <div>
                    <span className="res-label">{t('Индекс массы тела')}</span>
                    <strong className="res-big">{result.bmi.toFixed(1)}</strong>
                    <span className={`res-tag tone-${result.cat.tone}`}>{t(result.cat.label)}</span>
                  </div>
                  <div>
                    <span className="res-label">{t('Калорий в день')}</span>
                    <strong className="res-big">{formatSum(result.kcal)}</strong>
                    <span className="res-tag">{t('ккал')}</span>
                  </div>
                </div>

                <div className="bmi-scale" aria-hidden="true">
                  <div className="bmi-bar" />
                  <div className="bmi-marker" style={{ left: `${result.pos}%` }} />
                  <div className="bmi-ticks">
                    {[15, 18.5, 25, 30, 40].map((tick) => (
                      <span key={tick} style={{ left: `${((tick - 15) / 25) * 100}%` }}>
                        {tick}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="macros">
                  {[
                    [t('Белки'), result.protein],
                    [t('Жиры'), result.fat],
                    [t('Углеводы'), result.carbs],
                  ].map(([l, v]) => (
                    <div key={l} className="macro">
                      <strong>
                        {v}
                        <em>{' '}{t('г')}</em>
                      </strong>
                      <span>{t(l)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="res-empty">{t('Проверьте введённые значения — результат появится автоматически.')}</p>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
