import { t } from '../i18n.jsx';
// Обучение помощника: администратор пополняет базу знаний, отвечает на вопросы,
// которые помощник не понял, исправляет ответы с оценкой «Не помогло».
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useAuth, useToast } from '../context.jsx';
import { Btn, Card, ConfirmBtn, Empty, ErrorBox, Field, Icon, Modal, PageHead, Spinner, Tabs } from '../app/ui.jsx';
import { fmt, shortDate } from '../lib/format.js';
import { Rich } from './Assistant.jsx';

const EMPTY = { title: '', category: 'Разное', keywords: '', answer: '', enabled: true };

export default function Teach() {
  const { user } = useAuth();
  const [tab, setTab] = useState('base');
  const stats = useApi('/api/admin/teach/stats');
  const [editor, setEditor] = useState(null); // { ...форма, id?, unansweredId?, dislikedId? }

  if (user.role !== 'admin') return <Navigate to="/app" replace />;
  const s = stats.data;

  return (
    <>
      <PageHead title={t('Обучение помощника')} text={t('Добавляй темы и ответы — помощник сразу начнёт ими пользоваться. Никаких внешних API и оплаты.')} />

      {s && (
        <div className="kpis kpis-4">
          {[
            [t('Тем в базе'), `${s.enabled} / ${s.topics}`, 'book'],
            [t('Без ответа'), s.unanswered, 'alert'],
            [t('«Не помогло»'), s.disliked, 'x'],
            [t('Вопросов задано'), s.questions, 'chat'],
          ].map(([l, v, i]) => (
            <div key={l} className="kpi">
              <span className="kpi-label">
                <Icon name={i} size={16} /> {l}
              </span>
              <strong>{typeof v === 'number' ? fmt(v) : v}</strong>
            </div>
          ))}
        </div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ['base', t('База знаний')],
          ['unanswered', `${t('Без ответа')}${s?.unanswered ? ` · ${s.unanswered}` : ''}`],
          ['disliked', `${t('Не помогло')}${s?.disliked ? ` · ${s.disliked}` : ''}`],
          ['test', t('Проверка')],
          ['help', t('Как обучать')],
        ]}
      />

      {tab === 'base' && <Base onEdit={setEditor} onChanged={stats.reload} />}
      {tab === 'unanswered' && <Unanswered onTeach={setEditor} onChanged={stats.reload} />}
      {tab === 'disliked' && <Disliked onTeach={setEditor} onChanged={stats.reload} />}
      {tab === 'test' && <Tester onTeach={setEditor} />}
      {tab === 'help' && <Help />}

      <Editor
        value={editor}
        onClose={() => setEditor(null)}
        onSaved={() => {
          setEditor(null);
          stats.reload();
          window.dispatchEvent(new Event('vitalis:kb-changed'));
        }}
      />
    </>
  );
}

// ---------- База знаний ----------

function Base({ onEdit, onChanged }) {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi('/api/admin/teach/knowledge');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    const h = () => reload();
    window.addEventListener('vitalis:kb-changed', h);
    return () => window.removeEventListener('vitalis:kb-changed', h);
  }, [reload]);

  const cats = useMemo(() => [...new Set((data || []).map((k) => k.category))], [data]);
  const list = (data || []).filter((k) => {
    const s = q.trim().toLowerCase();
    return (!cat || k.category === cat) && (!s || k.title.toLowerCase().includes(s) || k.keywords.join(' ').includes(s) || k.answer.toLowerCase().includes(s));
  });

  const toggle = async (k) => {
    try {
      const u = await api.patch(`/api/admin/teach/knowledge/${k.id}`, { enabled: k.enabled === false });
      setData((l) => l.map((x) => (x.id === k.id ? u : x)));
      onChanged();
    } catch (e) {
      toast.error(e);
    }
  };

  const exportJson = () => {
    const items = (data || []).map(({ id, title, category, keywords, answer, enabled }) => ({ id, title, category, keywords, answer, enabled }));
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vitalis-knowledge-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.ok(t('Файл базы знаний сохранён'));
  };

  const importJson = async (file) => {
    try {
      const items = JSON.parse(await file.text());
      const r = await api.post('/api/admin/teach/knowledge/import', { items: Array.isArray(items) ? items : items.items });
      toast.ok(t('Импорт: добавлено {a}, обновлено {u}, пропущено {s}', { a: r.added, u: r.updated, s: r.skipped.length }));
      reload();
      onChanged();
    } catch (e) {
      toast.error(e instanceof SyntaxError ? t('Файл не похож на JSON') : e);
    }
  };

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <Card
      pad={false}
      title={`${t('Темы')} · ${list.length}`}
      icon="book"
      action={
        <div className="row-actions">
          <input className="search" placeholder={t('Поиск…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="search" value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('Категория')}>
            <option value="">{t('Все категории')}</option>
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Btn size="sm" variant="ghost" icon="upload" onClick={() => fileRef.current?.click()}>
            {t('Импорт')}
          </Btn>
          <Btn size="sm" variant="ghost" icon="copy" onClick={exportJson}>
            {t('Экспорт')}
          </Btn>
          <Btn size="sm" icon="plus" onClick={() => onEdit({ ...EMPTY })}>
            {t('Новая тема')}
          </Btn>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) importJson(f);
            }}
          />
        </div>
      }
    >
      <ul className="kb-list">
        {list.map((k) => (
          <li key={k.id} className={k.enabled === false ? 'is-off' : ''}>
            <div className="kb-main">
              <span className="meal-slot">{t(k.category)}</span>
              <button className="meal-title" onClick={() => onEdit({ ...k, keywords: k.keywords.join(', ') })}>
                {t(k.title)}
              </button>
              <span className="kb-kw">{k.keywords.slice(0, 8).join(' · ')}</span>
            </div>
            <span className="muted small nowrap" title={t('Сколько раз помощник использовал этот ответ')}>
              {k.hits || 0} {t('отв.')}
            </span>
            <label className="switch" title={k.enabled === false ? t('Выключена') : t('Включена')}>
              <input type="checkbox" checked={k.enabled !== false} onChange={() => toggle(k)} aria-label={t('Включить тему')} />
            </label>
            <Btn size="sm" variant="ghost" icon="edit" onClick={() => onEdit({ ...k, keywords: k.keywords.join(', ') })} aria-label={t('Изменить')} />
            <ConfirmBtn
              onConfirm={async () => {
                await api.del(`/api/admin/teach/knowledge/${k.id}`);
                setData((l) => l.filter((x) => x.id !== k.id));
                onChanged();
              }}
            >
              {''}
            </ConfirmBtn>
          </li>
        ))}
        {!list.length && <li className="muted pad-x">{t('Ничего не найдено')}</li>}
      </ul>
    </Card>
  );
}

// ---------- Вопросы, на которые помощник не ответил ----------

function Unanswered({ onTeach, onChanged }) {
  const { data, loading, error, reload, setData } = useApi('/api/admin/teach/unanswered');

  const teach = async (u) => {
    let keywords = '';
    try {
      keywords = (await api.post('/api/admin/teach/keywords', { text: u.question })).keywords.join(', ');
    } catch {
      /* без подсказки */
    }
    onTeach({ ...EMPTY, title: u.question.slice(0, 120), keywords, unansweredId: u.id });
  };

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data.length)
    return (
      <Card>
        <Empty icon="check" title={t('Все вопросы обработаны')} text={t('Когда помощник не поймёт вопрос пользователя, он появится здесь — ты сможешь научить его ответу в один клик.')} />
      </Card>
    );

  return (
    <Card
      title={t('Помощник не знал, что ответить')}
      icon="alert"
      action={
        <ConfirmBtn
          confirmText={t('Очистить весь список?')}
          onConfirm={async () => {
            await api.del('/api/admin/teach/unanswered');
            setData([]);
            onChanged();
          }}
        >
          {t('Очистить')}
        </ConfirmBtn>
      }
    >
      <p className="muted small">{t('Сверху — вопросы, которые задавали чаще всего. Нажми «Научить», напиши ответ — и помощник начнёт отвечать на такие вопросы.')}</p>
      <ul className="crud-list">
        {data.map((u) => (
          <li key={u.id}>
            <b>«{u.question}»</b>
            {u.count > 1 && <span className="res-tag tone-warn">×{u.count}</span>}
            <span className="muted small">{shortDate(u.updatedAt.slice(0, 10))}</span>
            <div className="crud-actions">
              <Btn size="sm" icon="bulb" onClick={() => teach(u)}>
                {t('Научить')}
              </Btn>
              <ConfirmBtn
                onConfirm={async () => {
                  await api.del(`/api/admin/teach/unanswered/${u.id}`);
                  setData((l) => l.filter((x) => x.id !== u.id));
                  onChanged();
                }}
              >
                {''}
              </ConfirmBtn>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------- Ответы с оценкой «Не помогло» ----------

function Disliked({ onTeach, onChanged }) {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi('/api/admin/teach/disliked');
  const kb = useApi('/api/admin/teach/knowledge');

  const fix = async (d) => {
    const entry = (kb.data || []).find((k) => k.id === d.topicId);
    if (entry) onTeach({ ...entry, keywords: entry.keywords.join(', '), dislikedId: d.id });
    else {
      let keywords = '';
      try {
        keywords = (await api.post('/api/admin/teach/keywords', { text: d.question })).keywords.join(', ');
      } catch {
        /* без подсказки */
      }
      onTeach({ ...EMPTY, title: (d.question || '').slice(0, 120), keywords, dislikedId: d.id });
    }
  };

  const dismiss = async (d) => {
    try {
      await api.del(`/api/admin/teach/disliked/${d.id}`);
      setData((l) => l.filter((x) => x.id !== d.id));
      onChanged();
    } catch (e) {
      toast.error(e);
    }
  };

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data.length)
    return (
      <Card>
        <Empty icon="check" title={t('Жалоб на ответы нет')} text={t('Пользователи могут нажать 👎 под ответом помощника. Такие ответы появятся здесь, чтобы ты их улучшила.')} />
      </Card>
    );

  return (
    <div className="stack">
      {data.map((d) => (
        <Card key={d.id} className="disliked">
          <p className="muted small">
            {shortDate(d.date.slice(0, 10))} · {d.topicTitle ? t('тема «{x}»', { x: d.topicTitle }) : t('тема не найдена')}
          </p>
          <p>
            <b>{t('Вопрос:')}</b> «{d.question}»
          </p>
          <div className="msg msg-assistant disliked-answer">
            <Rich text={d.answer} />
          </div>
          <div className="row-actions">
            <Btn size="sm" icon={d.topicTitle ? 'edit' : 'bulb'} onClick={() => fix(d)}>
              {d.topicTitle ? t('Улучшить ответ') : t('Научить новой теме')}
            </Btn>
            <Btn size="sm" variant="ghost" icon="check" onClick={() => dismiss(d)}>
              {t('Всё в порядке')}
            </Btn>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------- Проверка вопроса ----------

function Tester({ onTeach }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (e) => {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    try {
      setRes(await api.post('/api/admin/teach/test', { message: q }));
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid-2">
      <Card title={t('Задай вопрос как пользователь')} icon="chat">
        <form className="inline-form" onSubmit={run}>
          <input className="search grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Например: можно ли пить колу на диете?')} />
          <Btn type="submit" loading={busy} icon="send">
            {t('Проверить')}
          </Btn>
        </form>
        {res && (
          <div className="test-result">
            {res.best ? (
              <>
                <p>
                  {t('Найдена тема:')}{' '}<b>{res.best.title}</b> <span className="muted">({t('баллы')} {res.best.score})</span>
                </p>
                <p className="muted small">{t('Сработали слова')}: {res.best.matched.join(', ')}</p>
                {res.candidates.length > 1 && (
                  <p className="muted small">
                    {t('Другие кандидаты')}: {res.candidates.slice(1).map((c) => `${t(c.title)} (${c.score})`).join('; ')}
                  </p>
                )}
              </>
            ) : (
              <div className="alert alert-error">
                <Icon name="alert" size={18} />
                <span>{t('Помощник не нашёл подходящую тему.')}</span>
              </div>
            )}
            <Btn size="sm" variant={res.best ? 'ghost' : 'primary'} icon="bulb" onClick={() => onTeach({ ...EMPTY, title: q.slice(0, 120), keywords: res.keywords.join(', ') })}>
              {t('Научить ответу на этот вопрос')}
            </Btn>
          </div>
        )}
      </Card>
      <Card title={t('Что ответит помощник')} icon="book">
        {res?.answer ? (
          <div className="msg msg-assistant preview">
            <Rich text={res.answer} />
          </div>
        ) : (
          <p className="muted">{t('Здесь появится ответ с подставленными цифрами из твоего профиля.')}</p>
        )}
      </Card>
    </div>
  );
}

// ---------- Редактор темы ----------

function Editor({ value, onClose, onSaved }) {
  const toast = useToast();
  const placeholders = useApi(value ? '/api/admin/teach/placeholders' : null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const answerRef = useRef(null);

  useEffect(() => {
    if (!value) return;
    setForm({ ...EMPTY, ...value });
    setErrors({});
    setPreview(null);
  }, [value]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const insert = (key) => {
    const el = answerRef.current;
    const tag = `{${key}}`;
    if (!el) return;
    const start = el.selectionStart ?? form.answer.length;
    const end = el.selectionEnd ?? start;
    const next = form.answer.slice(0, start) + tag + form.answer.slice(end);
    setForm((f) => ({ ...f, answer: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const showPreview = async () => {
    try {
      setPreview((await api.post('/api/admin/teach/render', { answer: form.answer })).text);
    } catch (e) {
      toast.error(e);
    }
  };

  const suggest = async () => {
    try {
      const r = await api.post('/api/admin/teach/keywords', { text: form.title });
      const cur = form.keywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      setForm((f) => ({ ...f, keywords: [...new Set([...cur, ...r.keywords])].join(', ') }));
    } catch (e) {
      toast.error(e);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = { ...form, keywords: form.keywords.split(',').map((s) => s.trim()).filter(Boolean) };
      if (form.id) await api.put(`/api/admin/teach/knowledge/${form.id}`, body);
      else await api.post('/api/admin/teach/knowledge', body);
      if (form.dislikedId) await api.del(`/api/admin/teach/disliked/${form.dislikedId}`).catch(() => {});
      toast.ok(form.id ? t('Ответ обновлён — помощник уже знает') : t('Готово! Помощник научился новой теме'));
      onSaved();
    } catch (err) {
      setErrors(err.fields || {});
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={Boolean(value)} title={form.id ? t('Изменить тему') : t('Новая тема')} onClose={onClose} wide>
      <form className="stack" onSubmit={save}>
        <div className="form-grid">
          <Field label={t('Вопрос или тема')} error={t(errors.title)} hint={t('Как бы спросил пользователь. Если вопрос совпадёт дословно — ответ найдётся точно.')}>
            <input value={form.title} onChange={set('title')} maxLength={120} placeholder={t('Можно ли пить колу на диете')} />
          </Field>
          <Field label={t('Категория')}>
            <input value={form.category} onChange={set('category')} list="kb-cats" maxLength={40} />
            <datalist id="kb-cats">
              {['Вода и напитки', 'Питание', 'Похудение', 'Набор массы', 'Тренировки', 'Техника', 'Восстановление', 'Здоровье', 'Мотивация', 'Клуб VITALIS', 'Сайт', 'Общение', 'Разное'].map((c) => (
                <option key={c} value={c} label={t(c)} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field
          label={t('Ключевые слова через запятую')}
          error={errors.keywords}
          hint={t('Пиши начало слова, чтобы ловить все формы: «кол» найдёт «кола», «колу», «колой». Фразы из нескольких слов ищутся целиком.')}
        >
          <div className="inline-form">
            <input value={form.keywords} onChange={set('keywords')} placeholder={t('кола, газировк, сладкие напитки')} />
            <Btn type="button" variant="ghost" size="sm" onClick={suggest} disabled={form.title.trim().length < 3}>
              {t('Подсказать')}
            </Btn>
          </div>
        </Field>

        <Field label={t('Ответ')} error={errors.answer} hint={t('Пустая строка — новый абзац. Строки с «- » станут списком. **Текст в звёздочках** — жирным.')}>
          <textarea ref={answerRef} value={form.answer} onChange={set('answer')} rows={9} className="answer-area" placeholder={t('Например:\nКола без сахара — можно, но не вместо воды.\n\n- обычная кола: 1 банка = 140 ккал\n- твоя норма — {kcal} ккал')} />
        </Field>

        <div>
          <span className="afield-label">{t('Личные цифры пользователя — нажми, чтобы вставить')}</span>
          <div className="chips ph-chips">
            {(placeholders.data || []).map((p) => (
              <button type="button" key={p.key} className="achip achip-sm" onClick={() => insert(p.key)} title={t(p.label)}>
                {t(p.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="row-actions">
          <label className="switch">
            <input type="checkbox" checked={form.enabled !== false} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
            <span>{t('Тема включена')}</span>
          </label>
          <Btn type="button" variant="ghost" icon="target" onClick={showPreview} disabled={form.answer.trim().length < 2}>
            {t('Предпросмотр')}
          </Btn>
          <Btn type="submit" icon="check" loading={busy}>
            {form.id ? t('Сохранить') : t('Научить')}
          </Btn>
        </div>

        {preview && (
          <div className="msg msg-assistant preview">
            <Rich text={preview} />
          </div>
        )}
      </form>
    </Modal>
  );
}

// ---------- Подсказка ----------

function Help() {
  return (
    <Card title={t('Как обучать помощника')} icon="info">
      <ol className="timeline">
        <li>
          <b>{t('1. Смотри «Без ответа»')}</b>
          <span>{t('Сюда попадают вопросы пользователей, которые помощник не понял. Нажми «Научить» — название и ключевые слова заполнятся сами, останется написать ответ.')}</span>
        </li>
        <li>
          <b>{t('2. Ключевые слова')}</b>
          <span>{t('Пиши начало слова: «похуд» поймает «похудеть», «похудение», «похудела». Добавляй синонимы и разговорные слова: «качаться», «накачаться», «масса».')}</span>
        </li>
        <li>
          <b>{t('3. Личные цифры')}</b>
          <span>{t('Вставляй в ответ метки вроде {a} или {b} — каждый пользователь увидит свои цифры из профиля.', { a: '{kcal}', b: '{water_rest}' })}</span>
        </li>
        <li>
          <b>{t('4. Проверяй')}</b>
          <span>{t('Во вкладке «Проверка» задай вопрос разными словами и убедись, что выбирается нужная тема. Если выбирается не та — добавь ключевых слов.')}</span>
        </li>
        <li>
          <b>{t('5. Смотри «Не помогло»')}</b>
          <span>{t('Если пользователь нажал 👎, ответ появится там. Улучши текст — и отметка снимется.')}</span>
        </li>
        <li>
          <b>{t('6. Сохраняй копию')}</b>
          <span>{t('Кнопка «Экспорт» скачивает всю базу знаний файлом. «Импорт» загружает её обратно — например, на новый сервер.')}</span>
        </li>
      </ol>
      <p className="fine">{t('Важно: помощник отвечает только тем, чему его научили. Не пиши в ответах диагнозы и дозировки лекарств — при проблемах со здоровьем отправляй к врачу.')}</p>
    </Card>
  );
}
