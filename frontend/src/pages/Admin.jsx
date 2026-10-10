import { t } from '../i18n.jsx';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useAuth, useToast } from '../context.jsx';
import { Btn, Card, Chip, ConfirmBtn, ErrorBox, Field, Icon, Modal, PageHead, Spinner, Tabs } from '../app/ui.jsx';
import { fmt, GOAL_LABEL, shortDate, SLOT_LABEL, SLOTS, sum, TAG_LABEL } from '../lib/format.js';

const LEAD_STATUS = { new: 'Новая', called: 'Позвонили', client: 'Стал клиентом', rejected: 'Отказ' };

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('stats');
  if (user.role !== 'admin') return <Navigate to="/app" replace />;

  return (
    <>
      <PageHead title={t('Админка')} text={t('Заявки, пользователи, база продуктов и рецептов.')} />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ['stats', t('Обзор')],
          ['leads', t('Заявки')],
          ['users', t('Пользователи')],
          ['ingredients', t('Продукты и цены')],
          ['recipes', t('Рецепты')],
        ]}
      />
      {tab === 'stats' && <Stats />}
      {tab === 'leads' && <Leads />}
      {tab === 'users' && <Users />}
      {tab === 'ingredients' && <Ingredients />}
      {tab === 'recipes' && <Recipes />}
    </>
  );
}

function Stats() {
  const { data, loading, error, reload } = useApi('/api/admin/stats');
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const items = [ [t('Пользователей'), data.users, 'user'], [t('Заявок всего'), data.leads, 'phone'], [t('Новых заявок'), data.newLeads, 'bolt'], [t('Подписчиков'), data.subscribers, 'mail'], [t('Рецептов'), data.recipes, 'book'], [t('Продуктов'), data.ingredients, 'cart'], [t('Подходов с ИИ'), data.sessions, 'camera'], [t('Отметок «Съел»'), data.mealsEaten, 'check'], ];
  
  return (
    <div className="kpis kpis-4">
      {items.map(([l, v, i]) => (
        <div key={l} className="kpi">
          <span className="kpi-label">
            <Icon name={i} size={16} /> {t(l)}
          </span>
          <strong>{fmt(v)}</strong>
        </div>
      ))}
    </div>
  );
}

function Leads() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi('/api/admin/leads');
  const update = async (l, status) => {
    try {
      const u = await api.patch(`/api/admin/leads/${l.id}`, { status });
      setData((list) => list.map((x) => (x.id === l.id ? u : x)));
    } catch (e) {
      toast.error(e);
    }
  };
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <Card pad={false}>
      <div className="table-wrap">
        <table className="atable">
          <thead>
            <tr>
              <th>{t('Дата')}</th>
              <th>{t('Имя')}</th>
              <th>{t('Телефон')}</th>
              <th>{t('Интерес')}</th>
              <th>{t('Комментарий')}</th>
              <th>{t('Статус')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((l) => (
              <tr key={l.id}>
                <td>{shortDate(l.createdAt.slice(0, 10))}</td>
                <td>{l.name}</td>
                <td>
                  <a href={`tel:${l.phone}`}>{l.phone}</a>
                </td>
                <td>{l.program || '—'}</td>
                <td className="muted">{l.message || '—'}</td>
                <td>
                  <select value={l.status || 'new'} onChange={(e) => update(l, e.target.value)} aria-label={t('Статус заявки')}>
                    {Object.entries(LEAD_STATUS).map(([v, label]) => (
                      <option key={v} value={v}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <ConfirmBtn
                    onConfirm={async () => {
                      await api.del(`/api/admin/leads/${l.id}`);
                      setData((list) => list.filter((x) => x.id !== l.id));
                    }}
                  >
                    {''}
                  </ConfirmBtn>
                </td>
              </tr>
            ))}
            {!data.length && (
              <tr>
                <td colSpan={7} className="muted">
                  {t('Заявок пока нет')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Users() {
  const toast = useToast();
  const { user: me } = useAuth();
  const { data, loading, error, reload } = useApi('/api/admin/users');
  const [temp, setTemp] = useState(null); // { name, password }

  const reset = async (u) => {
    try {
      const r = await api.post(`/api/admin/users/${u.id}/reset-password`);
      setTemp({ name: u.name, email: u.email, password: r.password });
    } catch (e) {
      toast.error(e);
    }
  };

  const setRole = async (u, role) => {
    try {
      await api.patch(`/api/admin/users/${u.id}`, { role });
      toast.ok(role === 'admin' ? t('Права администратора выданы') : t('Права администратора сняты'));
      reload();
    } catch (e) {
      toast.error(e);
    }
  };

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <Card pad={false}>
      <div className="table-wrap">
        <table className="atable">
          <thead>
            <tr>
              <th>{t('Имя')}</th>
              <th>E-mail</th>
              <th>{t('Цель')}</th>
              <th>{t('Роль')}</th>
              <th>{t('Регистрация')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{GOAL_LABEL[u.goal] || '—'}</td>
                <td>{u.role === 'admin' ? t('Админ') : t('Клиент')}</td>
                <td>{shortDate(u.createdAt.slice(0, 10))}</td>
                <td className="nowrap">
                  {u.id !== me.id && (
                    <ConfirmBtn icon="refresh" confirmText={t('Сбросить пароль?')} onConfirm={() => reset(u)}>
                      {t('Сбросить пароль')}
                    </ConfirmBtn>
                  )}
                  {u.id !== me.id && (
                    <Btn size="sm" variant="ghost" icon="shield" onClick={() => setRole(u, u.role === 'admin' ? 'user' : 'admin')}>
                      {u.role === 'admin' ? t('Снять админа') : t('Сделать админом')}
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={Boolean(temp)} title={t('Временный пароль')} onClose={() => setTemp(null)}>
        {temp && (
          <div className="stack">
            <p>{t('Передайте пользователю {name} ({email}) этот пароль. После входа пусть сменит его в профиле.', { name: temp.name, email: temp.email })}</p>
            <div className="temp-pass">{temp.password}</div>
            <Btn
              icon="copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(temp.password);
                  toast.ok(t('Скопировано'));
                } catch {
                  toast.error(t('Не удалось скопировать'));
                }
              }}
            >
              {t('Скопировать')}
            </Btn>
          </div>
        )}
      </Modal>
    </Card>
  );
}

const EMPTY_ING = { name: '', category: 'Овощи', kcal: '', p: '', f: '', c: '', price: '' };

function Ingredients() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/api/ingredients');
  const [edit, setEdit] = useState(null); // объект формы или null
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      if (edit.id) await api.put(`/api/admin/ingredients/${edit.id}`, edit);
      else await api.post('/api/admin/ingredients', edit);
      toast.ok(t('Продукт сохранён'));
      setEdit(null);
      reload();
    } catch (err) {
      setErrors(err.fields || {});
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const list = data.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Card
      pad={false}
      title={t('Продукты')}
      action={
        <div className="row-actions">
          <input className="search" placeholder={t('Поиск…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <Btn size="sm" icon="plus" onClick={() => setEdit({ ...EMPTY_ING })}>
            {t('Добавить')}
          </Btn>
        </div>
      }
    >
      <p className="fine pad-x">{t('КБЖУ — на 100 г продукта. Цена — за 1 кг в сумах. Изменения сразу пересчитывают стоимость всех меню.')}</p>
      <div className="table-wrap">
        <table className="atable">
          <thead>
            <tr>
              <th>{t('Продукт')}</th>
              <th>{t('Категория')}</th>
              <th className="num">{t('Ккал')}</th>
              <th className="num">{t('Б')}</th>
              <th className="num">{t('Ж')}</th>
              <th className="num">{t('У')}</th>
              <th className="num">{t('Цена/кг')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id}>
                <td>{t(i.name)}</td>
                <td className="muted">{t(i.category)}</td>
                <td className="num">{i.kcal}</td>
                <td className="num">{i.p}</td>
                <td className="num">{i.f}</td>
                <td className="num">{i.c}</td>
                <td className="num">{fmt(i.price)}</td>
                <td className="nowrap">
                  <Btn size="sm" variant="ghost" icon="edit" onClick={() => setEdit({ ...i })} aria-label={t('Изменить')} />
                  <ConfirmBtn
                    onConfirm={async () => {
                      try {
                        await api.del(`/api/admin/ingredients/${i.id}`);
                        reload();
                      } catch (e) {
                        toast.error(e);
                      }
                    }}
                  >
                    {''}
                  </ConfirmBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={Boolean(edit)} title={edit?.id ? t('Изменить продукт') : t('Новый продукт')} onClose={() => setEdit(null)}>
        {edit && (
          <form className="form-grid" onSubmit={save}>
            <Field label={t('Название')} error={t(errors.name)} className="span-2">
              <input value={edit.name} onChange={(e) => setEdit((x) => ({ ...x, name: e.target.value }))} />
            </Field>
            <Field label={t('Категория')} className="span-2">
              <input value={edit.category} onChange={(e) => setEdit((x) => ({ ...x, category: e.target.value }))} list="ing-cats" />
              <datalist id="ing-cats">
                {[...new Set(data.map((d) => d.category))].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            {[
              ['kcal', t('Ккал / 100 г')],
              ['p', t('Белки / 100 г')],
              ['f', t('Жиры / 100 г')],
              ['c', t('Углеводы / 100 г')],
            ].map(([k, l]) => (
              <Field key={k} label={l} error={errors[k]}>
                <input inputMode="decimal" value={edit[k]} onChange={(e) => setEdit((x) => ({ ...x, [k]: e.target.value.replace(',', '.') }))} />
              </Field>
            ))}
            <Field label={t('Цена за 1 кг, сум')} error={errors.price} className="span-2">
              <input inputMode="numeric" value={edit.price} onChange={(e) => setEdit((x) => ({ ...x, price: e.target.value.replace(/\s/g, '') }))} />
            </Field>
            <Btn type="submit" loading={busy} className="span-2">
              {t('Сохранить')}
            </Btn>
          </form>
        )}
      </Modal>
    </Card>
  );
}

const EMPTY_RECIPE = { title: '', slots: ['lunch'], time: 30, tags: [], ingredients: [{ id: '', g: 100 }], steps: [''] };

function Recipes() {
  const toast = useToast();
  const recipes = useApi('/api/recipes');
  const ings = useApi('/api/ingredients');
  const tags = useApi('/api/admin/recipe-tags');
  const [edit, setEdit] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  const ingIndex = useMemo(() => Object.fromEntries((ings.data || []).map((i) => [i.id, i])), [ings.data]);

  const open = async (r) => {
    if (!r) return setEdit({ ...EMPTY_RECIPE, ingredients: [{ id: ings.data?.[0]?.id || '', g: 100 }] });
    try {
      const full = await api.get(`/api/recipes/${r.id}`);
      setEdit({ id: full.id, title: full.title, slots: full.slots, time: full.time, tags: full.tags || [], ingredients: full.ingredients, steps: full.steps });
    } catch (e) {
      toast.error(e);
    }
  };

  const preview = useMemo(() => {
    if (!edit) return null;
    return edit.ingredients.reduce(
      (s, row) => {
        const i = ingIndex[row.id];
        const g = Number(row.g) || 0;
        if (!i) return s;
        return { kcal: s.kcal + (i.kcal * g) / 100, p: s.p + (i.p * g) / 100, cost: s.cost + (i.price * g) / 1000 };
      },
      { kcal: 0, p: 0, cost: 0 }
    );
  }, [edit, ingIndex]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = { ...edit, steps: edit.steps.filter((s) => s.trim()), ingredients: edit.ingredients.filter((r) => r.id) };
      if (edit.id) await api.put(`/api/admin/recipes/${edit.id}`, body);
      else await api.post('/api/admin/recipes', body);
      toast.ok(t('Рецепт сохранён'));
      setEdit(null);
      recipes.reload();
    } catch (err) {
      setErrors(err.fields || {});
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const setRow = (i, k, v) => setEdit((x) => ({ ...x, ingredients: x.ingredients.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const setStep = (i, v) => setEdit((x) => ({ ...x, steps: x.steps.map((s, j) => (j === i ? v : s)) }));
  const toggle = (k, v) => setEdit((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));

  if (recipes.loading && !recipes.data) return <Spinner />;
  if (recipes.error) return <ErrorBox error={recipes.error} onRetry={recipes.reload} />;
  const list = recipes.data.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <Card
      pad={false}
      title={t('Рецепты')}
      action={
        <div className="row-actions">
          <input className="search" placeholder={t('Поиск…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <Btn size="sm" icon="plus" onClick={() => open(null)}>
            {t('Добавить')}
          </Btn>
        </div>
      }
    >
      <div className="table-wrap">
        <table className="atable">
          <thead>
            <tr>
              <th>{t('Блюдо')}</th>
              <th>{t('Приёмы пищи')}</th>
              <th className="num">{t('Ккал')}</th>
              <th className="num">{t('Белки')}</th>
              <th className="num">{t('Цена порции')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{t(r.title)}</td>
                <td className="muted">{r.slots.map((s) => SLOT_LABEL[s]).join(', ')}</td>
                <td className="num">{r.kcal}</td>
                <td className="num">{r.p} {t('г')}</td>
                <td className="num">{fmt(r.cost)}</td>
                <td className="nowrap">
                  <Btn size="sm" variant="ghost" icon="edit" onClick={() => open(r)} aria-label={t('Изменить')} />
                  <ConfirmBtn
                    onConfirm={async () => {
                      await api.del(`/api/admin/recipes/${r.id}`);
                      recipes.reload();
                    }}
                  >
                    {''}
                  </ConfirmBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={Boolean(edit)} title={edit?.id ? t('Изменить рецепт') : t('Новый рецепт')} onClose={() => setEdit(null)} wide>
        {edit && (
          <form className="stack" onSubmit={save}>
            <div className="form-grid">
              <Field label={t('Название')} error={t(errors.title)}>
                <input value={edit.title} onChange={(e) => setEdit((x) => ({ ...x, title: e.target.value }))} />
              </Field>
              <Field label={t('Время, мин')} error={errors.time}>
                <input inputMode="numeric" value={edit.time} onChange={(e) => setEdit((x) => ({ ...x, time: e.target.value }))} />
              </Field>
            </div>
            <Field label={t('Приёмы пищи')} error={errors.slots}>
              <div className="chips">
                {SLOTS.map((s) => (
                  <Chip key={s} active={edit.slots.includes(s)} onClick={() => toggle('slots', s)}>
                    {SLOT_LABEL[s]}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label={t('Метки')} hint={t('«Есть сахар», «Жирное мясо», «Субпродукты» исключают блюдо из меню при соответствующих анализах')}>
              <div className="chips">
                {(tags.data || []).map((tg) => (
                  <Chip key={tg} active={edit.tags.includes(tg)} onClick={() => toggle('tags', tg)}>
                    {TAG_LABEL[tg] || tg}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label={t('Продукты на 1 порцию (граммы в сыром виде)')} error={errors.ingredients}>
              <div className="stack-sm">
                {edit.ingredients.map((r, i) => (
                  <div key={i} className="ex-row">
                    <select value={r.id} onChange={(e) => setRow(i, 'id', e.target.value)} aria-label={t('Продукт')}>
                      <option value="">{t('— выберите —')}</option>
                      {(ings.data || []).map((x) => (
                        <option key={x.id} value={x.id}>
                          {t(x.name)}
                        </option>
                      ))}
                    </select>
                    <input inputMode="numeric" value={r.g} onChange={(e) => setRow(i, 'g', e.target.value)} aria-label={t('Граммы')} />
                    <span>{t('г')}</span>
                    <button type="button" className="icon-btn" onClick={() => setEdit((x) => ({ ...x, ingredients: x.ingredients.filter((_, j) => j !== i) }))} aria-label={t('Убрать')}>
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                ))}
                <Btn type="button" size="sm" variant="ghost" icon="plus" onClick={() => setEdit((x) => ({ ...x, ingredients: [...x.ingredients, { id: '', g: 100 }] }))}>
                  {t('Продукт')}
                </Btn>
                {preview && (
                  <p className="muted small">
                    {t('Порция: {k} ккал · белки {p} г', { k: Math.round(preview.kcal), p: Math.round(preview.p) })} · {sum(Math.round(preview.cost / 100) * 100)}
                  </p>
                )}
              </div>
            </Field>

            <Field label={t('Шаги приготовления')} error={errors.steps}>
              <div className="stack-sm">
                {edit.steps.map((s, i) => (
                  <div key={i} className="step-row">
                    <span className="step-n">{i + 1}</span>
                    <textarea value={s} rows={2} onChange={(e) => setStep(i, e.target.value)} />
                    <button type="button" className="icon-btn" onClick={() => setEdit((x) => ({ ...x, steps: x.steps.filter((_, j) => j !== i) }))} disabled={edit.steps.length === 1} aria-label={t('Убрать шаг')}>
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                ))}
                <Btn type="button" size="sm" variant="ghost" icon="plus" onClick={() => setEdit((x) => ({ ...x, steps: [...x.steps, ''] }))}>
                  {t('Шаг')}
                </Btn>
              </div>
            </Field>
            <Btn type="submit" loading={busy}>
              {t('Сохранить рецепт')}
            </Btn>
          </form>
        )}
      </Modal>
    </Card>
  );
}
