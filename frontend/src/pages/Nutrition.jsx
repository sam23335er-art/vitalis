import { t } from '../i18n.jsx';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useToast } from '../context.jsx';
import { Btn, Card, ConfirmBtn, Empty, ErrorBox, Field, Icon, Macro, Modal, PageHead, Progress, Spinner, Tabs } from '../app/ui.jsx';
import { addDays, calendarCells, dayTitle, fmt, monthRange, monthTitle, plural, shiftMonth, SLOT_LABEL, SLOTS, sum, TAG_LABEL, todayStr, weekdays } from '../lib/format.js';

export default function Nutrition() {
  const toast = useToast();
  const today = todayStr();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const { from, to } = monthRange(month);
  const meals = useApi(`/api/meals?from=${from}&to=${to}`);
  const summary = useApi('/api/profile/summary');
  const [busy, setBusy] = useState(false);
  const [recipe, setRecipe] = useState(null);
  const [swap, setSwap] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

  const byDay = useMemo(() => {
    const map = {};
    for (const m of meals.data || []) (map[m.date] ||= []).push(m);
    return map;
  }, [meals.data]);

  const target = summary.data?.nutrition?.kcal || 0;
  const dayMeals = byDay[selected] || [];
  const dayTotal = dayMeals.reduce((s, m) => ({ kcal: s.kcal + m.nutrition.kcal, p: s.p + m.nutrition.p, f: s.f + m.nutrition.f, c: s.c + m.nutrition.c, cost: s.cost + m.nutrition.cost }), { kcal: 0, p: 0, f: 0, c: 0, cost: 0 });
  const eatenTotal = dayMeals.filter((m) => m.eaten).reduce((s, m) => s + m.nutrition.kcal, 0);
  const monthCost = (meals.data || []).reduce((s, m) => s + m.nutrition.cost, 0);

  const changeMonth = (n) => {
    const m = shiftMonth(month, n);
    setMonth(m);
    setSelected(m === today.slice(0, 7) ? today : `${m}-01`);
  };

  const generate = async () => {
    setBusy(true);
    try {
      const r = await api.post('/api/meals/generate', { month });
      toast.ok(r.created ? t('Готово: {n} {w} в меню', { n: r.created, w: plural(r.created, 'блюдо', 'блюда', 'блюд') }) : t('Меню уже актуально'));
      meals.reload();
      summary.reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const patchMeal = async (m, body, msg) => {
    try {
      const updated = await api.patch(`/api/meals/${m.id}`, body);
      meals.setData((list) => list.map((x) => (x.id === m.id ? updated : x)));
      if (msg) toast.ok(msg);
    } catch (e) {
      toast.error(e);
    }
  };

  const removeMeal = async (m) => {
    await api.del(`/api/meals/${m.id}`);
    meals.setData((list) => list.filter((x) => x.id !== m.id));
  };

  const clearMonth = async () => {
    const r = await api.del(`/api/meals?month=${month}`);
    toast.ok(t('Удалено блюд: {n}', { n: r.removed }));
    meals.reload();
  };

  if (summary.data && !summary.data.complete) {
    return (
      <>
        <PageHead title={t('Питание')} />
        <Card>
          <Empty icon="settings" title={t('Сначала заполни профиль')} text={t('Без роста, веса и цели невозможно рассчитать норму калорий и порции.')}>
            <Link to="/app/profile" className="abtn abtn-primary">
              <span>{t('Заполнить профиль')}</span>
            </Link>
          </Empty>
        </Card>
      </>
    );
  }

  const hasPlan = (meals.data || []).length > 0;

  return (
    <>
      <PageHead title={t('Питание')} text={target ? t('Твоя норма: {k} ккал · Б {p} · Ж {f} · У {c} г', { k: fmt(target), p: summary.data.nutrition.protein, f: summary.data.nutrition.fat, c: summary.data.nutrition.carbs }) : t('Календарь питания на месяц')}>
        <Btn variant="ghost" icon="cart" onClick={() => setShopOpen(true)} disabled={!hasPlan}>
          {t('Список покупок')}
        </Btn>
        <Btn icon="refresh" loading={busy} onClick={generate}>
          {hasPlan ? t('Обновить меню') : t('Составить меню')}
        </Btn>
      </PageHead>

      <ErrorBox error={meals.error} onRetry={meals.reload} />

      <div className="cal-layout">
        <Card className="cal-card">
          <div className="cal-toolbar">
            <button className="icon-btn" onClick={() => changeMonth(-1)} aria-label={t('Предыдущий месяц')}>
              <Icon name="chevronLeft" />
            </button>
            <h2>{monthTitle(month)}</h2>
            <button className="icon-btn" onClick={() => changeMonth(1)} aria-label={t('Следующий месяц')}>
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
              const list = byDay[date] || [];
              const kcal = list.reduce((s, m) => s + m.nutrition.kcal, 0);
              return (
                <button
                  key={date}
                  className={`cal-day ${date === selected ? 'is-selected' : ''} ${date === today ? 'is-today' : ''} ${date < today ? 'is-past' : ''}`}
                  onClick={() => setSelected(date)}
                  aria-label={dayTitle(date)}
                >
                  <span className="cal-num">{Number(date.slice(8))}</span>
                  {list.length > 0 && (
                    <>
                      <span className="cal-kcal">{fmt(kcal)}</span>
                      <span className="cal-dots">
                        {SLOTS.map((slot) => {
                          const m = list.find((x) => x.slot === slot);
                          return <i key={slot} className={m ? (m.eaten ? 'is-eaten' : 'is-planned') : ''} />;
                        })}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="cal-foot">
            <span>
              <i className="ldot is-planned" />{' '}{t('запланировано')}
            </span>
            <span>
              <i className="ldot is-eaten" />{' '}{t('съедено')}
            </span>
            {hasPlan && (
              <span className="cal-cost">
                {t('Меню на месяц:')}{' '}<b>{sum(monthCost)}</b>
              </span>
            )}
          </div>
          {hasPlan && (
            <div className="cal-danger">
              <ConfirmBtn onConfirm={clearMonth} confirmText={t('Удалить всё меню месяца?')}>
                {t('Очистить месяц')}
              </ConfirmBtn>
            </div>
          )}
        </Card>

        <Card
          title={dayTitle(selected)}
          icon="calendar"
          className="day-card"
          action={
            <div className="day-nav">
              <button className="icon-btn" onClick={() => setSelected(addDays(selected, -1))} disabled={!selected.startsWith(month) || selected.endsWith('-01')} aria-label={t('Предыдущий день')}>
                <Icon name="chevronLeft" size={18} />
              </button>
              <button className="icon-btn" onClick={() => setSelected(addDays(selected, 1))} disabled={addDays(selected, 1).slice(0, 7) !== month} aria-label={t('Следующий день')}>
                <Icon name="chevronRight" size={18} />
              </button>
            </div>
          }
        >
          {meals.loading && !meals.data ? (
            <Spinner />
          ) : !hasPlan ? (
            <Empty icon="food" title={t('Меню на {m} не составлено', { m: monthTitle(month).toLowerCase() })} text={t('Подберём блюда под твою норму калорий, ограничения и анализы — с рецептами, граммовкой и ценами.')}>
              <Btn loading={busy} onClick={generate}>
                {t('Составить меню')}
              </Btn>
            </Empty>
          ) : (
            <>
              {target > 0 && (
                <div className="day-total">
                  <div className="day-total-row">
                    <span>
                      {t('Съедено')}{' '}<b>{fmt(eatenTotal)}</b> {t('из')} {fmt(target)} {t('ккал')}
                    </span>
                    <span className="muted">{t('в меню {k} ккал', { k: fmt(dayTotal.kcal) })} · {sum(dayTotal.cost)}</span>
                  </div>
                  <Progress value={eatenTotal} max={target} />
                </div>
              )}

              {dayMeals.length === 0 && <p className="muted">{t('На этот день блюд нет.')}</p>}

              <ul className="day-meals">
                {dayMeals.map((m) => (
                  <li key={m.id} className={`day-meal ${m.eaten ? 'is-eaten' : ''}`}>
                    <div className="day-meal-top">
                      <span className="meal-slot">{SLOT_LABEL[m.slot]}</span>
                      {m.time && (
                        <span className="muted small">
                          <Icon name="clock" size={13} /> {m.time} {t('мин')}
                        </span>
                      )}
                      <ConfirmBtn onConfirm={() => removeMeal(m)} confirmText={t('Удалить?')} className="day-meal-del" aria-label={t('Удалить блюдо')}>
                        {''}
                      </ConfirmBtn>
                    </div>
                    <button className="meal-title big" onClick={() => m.recipeId && setRecipe(m)} disabled={!m.recipeId}>
                      {t(m.title)}
                    </button>
                    <div className="day-meal-meta">
                      <Macro n={m.nutrition} />
                      {m.nutrition.cost > 0 && <span className="price">{sum(m.nutrition.cost)}</span>}
                    </div>
                    <div className="day-meal-actions">
                      <Btn size="sm" variant={m.eaten ? 'success' : 'primary'} icon="check" onClick={() => patchMeal(m, { eaten: !m.eaten }, m.eaten ? null : t('Приятного аппетита! Отмечено ✓'))}>
                        {m.eaten ? t('Съел') : t('Отметить «Съел»')}
                      </Btn>
                      {m.recipeId && (
                        <Btn size="sm" variant="ghost" icon="book" onClick={() => setRecipe(m)}>
                          {t('Рецепт')}
                        </Btn>
                      )}
                      {m.recipeId && !m.eaten && (
                        <Btn size="sm" variant="ghost" icon="refresh" onClick={() => setSwap(m)}>
                          {t('Заменить')}
                        </Btn>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <Btn variant="ghost" icon="plus" onClick={() => setAddOpen(true)}>
                {t('Добавить блюдо')}
              </Btn>
            </>
          )}
        </Card>
      </div>

      <RecipeModal meal={recipe} onClose={() => setRecipe(null)} />
      <SwapModal
        meal={swap}
        onClose={() => setSwap(null)}
        onPick={async (r) => {
          await patchMeal(swap, { recipeId: r.id }, t('Заменено на «{x}»', { x: t(r.title) }));
          setSwap(null);
        }}
      />
      <AddMealModal
        open={addOpen}
        date={selected}
        onClose={() => setAddOpen(false)}
        onAdded={(m) => {
          meals.setData((list) => [...(list || []), m]);
          setAddOpen(false);
        }}
      />
      <ShoppingModal open={shopOpen} onClose={() => setShopOpen(false)} date={selected} month={month} />
    </>
  );
}

export function RecipeModal({ meal, onClose }) {
  const id = meal?.recipeId;
  const { data: r, loading, error } = useApi(id ? `/api/recipes/${id}?factor=${meal.factor || 1}` : null, [meal?.id]);
  const [done, setDone] = useState({});

  return (
    <Modal open={Boolean(meal)} title={meal?.title || t('Рецепт')} onClose={onClose} wide>
      {loading && <Spinner />}
      <ErrorBox error={error} />
      {r && !loading && (
        <div className="recipe">
          <div className="recipe-stats">
            <div>
              <b>{r.nutrition.kcal}</b>
              <span>{t('ккал')}</span>
            </div>
            <div>
              <b>{r.nutrition.p} {t('г')}</b>
              <span>{t('белки')}</span>
            </div>
            <div>
              <b>{r.nutrition.f} {t('г')}</b>
              <span>{t('жиры')}</span>
            </div>
            <div>
              <b>{r.nutrition.c} {t('г')}</b>
              <span>{t('углеводы')}</span>
            </div>
            <div>
              <b>{r.time} {t('мин')}</b>
              <span>{t('время')}</span>
            </div>
            <div>
              <b>{fmt(r.nutrition.cost)}</b>
              <span>{t('сум')}</span>
            </div>
          </div>
          {r.tags?.length > 0 && (
            <div className="tags">
              {r.tags.map((tg) => (
                <span key={tg} className={`tag ${tg === 'sugar' || tg === 'fattyMeat' ? 'tag-warn' : ''}`}>
                  {TAG_LABEL[tg] || tg}
                </span>
              ))}
            </div>
          )}

          <div className="recipe-cols">
            <div>
              <h3>{t('Что купить')}</h3>
              <table className="ing-table">
                <tbody>
                  {r.nutrition.ingredients.map((i) => (
                    <tr key={i.id}>
                      <td>{t(i.name)}</td>
                      <td className="num">{i.g} {t('г')}</td>
                      <td className="num muted">{fmt(i.cost)} {t('сум')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="fine">{t('Граммовка рассчитана под твою норму (порция ×{f}). Вес продуктов — в сыром виде. Цены ориентировочные для Ташкента.', { f: String(r.factor).replace('.', ',') })}</p>
            </div>
            <div>
              <h3>{t('Как приготовить')}</h3>
              <ol className="steps">
                {r.steps.map((s, i) => (
                  <li key={i} className={done[i] ? 'is-done' : ''}>
                    <button onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))} aria-label={t('Шаг {n} выполнен', { n: i + 1 })}>
                      {done[i] ? <Icon name="check" size={14} /> : i + 1}
                    </button>
                    <span>{t(s)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SwapModal({ meal, onClose, onPick }) {
  const { data, loading, error } = useApi(meal ? `/api/meals/${meal.id}/alternatives` : null, [meal?.id]);
  return (
    <Modal open={Boolean(meal)} title={`${t('Заменить')}: ${t(meal?.title || '')}`} onClose={onClose}>
      <p className="muted">{t('Показаны блюда, которые подходят под твои ограничения и анализы. Порция пересчитается под норму.')}</p>
      {loading && <Spinner />}
      <ErrorBox error={error} />
      <ul className="pick-list">
        {(data || []).map((r) => (
          <li key={r.id}>
            <button onClick={() => onPick(r)}>
              <b>{t(r.title)}</b>
              <span className="muted">
                {r.kcal} {t('ккал')} · {t('Б')} {r.p} {t('г')} · {r.time} {t('мин')} · {sum(r.cost)}
              </span>
            </button>
          </li>
        ))}
        {data && !data.length && <li className="muted">{t('Других подходящих блюд нет.')}</li>}
      </ul>
    </Modal>
  );
}

function AddMealModal({ open, date, onClose, onAdded }) {
  const toast = useToast();
  const [tab, setTab] = useState('recipe');
  const [slot, setSlot] = useState('snack');
  const [q, setQ] = useState('');
  const [custom, setCustom] = useState({ title: '', kcal: '', p: '', f: '', c: '', cost: '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const recipes = useApi(open ? `/api/recipes?slot=${slot}` : null);

  const add = async (body) => {
    setBusy(true);
    setErr({});
    try {
      const m = await api.post('/api/meals', { date, slot, ...body });
      toast.ok(t('Добавлено: {x}', { x: t(m.title) }));
      setCustom({ title: '', kcal: '', p: '', f: '', c: '', cost: '' });
      onAdded(m);
    } catch (e) {
      setErr(e.fields || {});
      if (!e.fields) toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const list = (recipes.data || []).filter((r) => r.title.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Modal open={open} title={`${t('Добавить блюдо')} · ${dayTitle(date)}`} onClose={onClose}>
      <Field label={t('Приём пищи')}>
        <select value={slot} onChange={(e) => setSlot(e.target.value)}>
          {SLOTS.map((s) => (
            <option key={s} value={s}>
              {SLOT_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ['recipe', t('Из базы рецептов')],
          ['custom', t('Своё блюдо')],
        ]}
      />
      {tab === 'recipe' ? (
        <>
          <input className="search" placeholder={t('Поиск блюда…')} value={q} onChange={(e) => setQ(e.target.value)} />
          {recipes.loading && <Spinner />}
          <ul className="pick-list">
            {list.map((r) => (
              <li key={r.id}>
                <button onClick={() => add({ recipeId: r.id })} disabled={busy}>
                  <b>{t(r.title)}</b>
                  <span className="muted">
                    {r.kcal} {t('ккал')} · {t('Б')} {r.p} {t('г')} · {sum(r.cost)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            add({ custom });
          }}
        >
          <Field label={t('Название')} error={t(err.title)} className="span-2">
            <input value={custom.title} onChange={(e) => setCustom((c) => ({ ...c, title: e.target.value }))} placeholder={t('Например: самса с тыквой')} />
          </Field>
          {[
            ['kcal', t('Калории')],
            ['p', t('Белки, г')],
            ['f', t('Жиры, г')],
            ['c', t('Углеводы, г')],
          ].map(([k, l]) => (
            <Field key={k} label={l}>
              <input inputMode="numeric" value={custom[k]} onChange={(e) => setCustom((c) => ({ ...c, [k]: e.target.value }))} />
            </Field>
          ))}
          <Field label={t('Стоимость, сум')} className="span-2">
            <input inputMode="numeric" value={custom.cost} onChange={(e) => setCustom((c) => ({ ...c, cost: e.target.value }))} />
          </Field>
          <Btn type="submit" loading={busy} icon="plus" className="span-2">
            {t('Добавить')}
          </Btn>
        </form>
      )}
    </Modal>
  );
}

function ShoppingModal({ open, onClose, date, month }) {
  const toast = useToast();
  const [range, setRange] = useState('week');
  const today = todayStr();
  const start = date < today && date.startsWith(today.slice(0, 7)) ? today : date;
  const period =
    range === 'day' ? { from: start, to: start } : range === 'week' ? { from: start, to: addDays(start, 6) } : monthRange(month);
  const { data, loading, error } = useApi(open ? `/api/meals/shopping?from=${period.from}&to=${period.to}` : null);
  const [checked, setChecked] = useState({});

  const groups = useMemo(() => {
    const g = {};
    for (const it of data?.items || []) (g[it.category] ||= []).push(it);
    return Object.entries(g);
  }, [data]);

  const copy = async () => {
    const text =
      `${t('Список покупок')} VITALIS (${period.from} — ${period.to})\n\n` +
      groups.map(([cat, items]) => `${t(cat)}:\n` + items.map((i) => `• ${t(i.name)} — ${fmtG(i.g)}`).join('\n')).join('\n\n') +
      `\n\n${t('Итого')} ≈ ${sum(data.total)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.ok(t('Список скопирован — можно отправить в Telegram'));
    } catch {
      toast.error(t('Не удалось скопировать'));
    }
  };

  const fmtG = (g) => (g >= 1000 ? `${(g / 1000).toFixed(1).replace('.', ',')} ${t('кг')}` : `${g} ${t('г')}`);

  return (
    <Modal open={open} title={t('Список покупок')} onClose={onClose}>
      <Tabs
        value={range}
        onChange={setRange}
        items={[
          ['day', t('На день')],
          ['week', t('На 7 дней')],
          ['month', t('На месяц')],
        ]}
      />
      <p className="muted small">{t('Учтены только блюда, которые ещё не отмечены как съеденные.')}</p>
      {loading && <Spinner />}
      <ErrorBox error={error} />
      {data && !loading && (
        <>
          {groups.length === 0 && <p className="muted">{t('На этот период покупать нечего.')}</p>}
          {groups.map(([cat, items]) => (
            <div key={cat} className="shop-group">
              <h4>{cat}</h4>
              <ul>
                {items.map((i) => (
                  <li key={i.id} className={checked[i.id] ? 'is-done' : ''}>
                    <label>
                      <input type="checkbox" checked={Boolean(checked[i.id])} onChange={() => setChecked((c) => ({ ...c, [i.id]: !c[i.id] }))} />
                      <span>{t(i.name)}</span>
                    </label>
                    <b>{fmtG(i.g)}</b>
                    <span className="muted">{fmt(i.cost)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {groups.length > 0 && (
            <div className="shop-total">
              <span>
                {t('Итого ≈')}{' '}<b>{sum(data.total)}</b>
              </span>
              <Btn variant="ghost" icon="copy" onClick={copy}>
                {t('Скопировать')}
              </Btn>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
