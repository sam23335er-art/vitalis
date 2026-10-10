import { t } from '../i18n.jsx';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useAuth, useToast } from '../context.jsx';
import { Btn, Card, ConfirmBtn, ErrorBox, Field, Icon, PageHead, Spinner } from '../app/ui.jsx';
import { shortDate, todayStr } from '../lib/format.js';

const STATUS = { normal: 'Норма', low: 'Ниже нормы', high: 'Выше нормы', critical: 'К врачу' };

export default function Labs() {
  const toast = useToast();
  const nav = useNavigate();
  const { setUser } = useAuth();
  const markers = useApi('/api/labs/markers');
  const history = useApi('/api/labs');
  const [values, setValues] = useState({});
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [editId, setEditId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');

  const groups = useMemo(() => {
    const g = {};
    for (const m of markers.data || []) (g[m.group] ||= []).push(m);
    return Object.entries(g);
  }, [markers.data]);

  const filled = Object.values(values).filter((v) => String(v).trim() !== '').length;

  const run = async (save) => {
    setBusy(save ? 'save' : 'check');
    setErrors({});
    try {
      if (save) {
        const doc = editId ? await api.put(`/api/labs/${editId}`, { date, note, values }) : await api.post('/api/labs', { date, note, values });
        setAnalysis(doc.analysis);
        setSavedId(doc.id);
        setEditId(doc.id);
        history.reload();
        toast.ok(t('Анализы сохранены'));
      } else {
        setAnalysis(await api.post('/api/labs/analyze', { values }));
        setSavedId(null);
      }
      setTimeout(() => document.getElementById('lab-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) {
      setErrors(e.fields || {});
      toast.error(e);
    } finally {
      setBusy('');
    }
  };

  const apply = async (id) => {
    setBusy('apply');
    try {
      const r = await api.post(`/api/labs/${id}/apply`);
      setUser(r.user);
      toast.ok(r.regenerated ? t('Меню перестроено с сегодняшнего дня: {n} блюд', { n: r.regenerated }) : t('Пищевой профиль обновлён'));
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy('');
    }
  };

  const load = (lab) => {
    setEditId(lab.id);
    setDate(lab.date);
    setNote(lab.note || '');
    setValues(Object.fromEntries(Object.entries(lab.values).map(([k, v]) => [k, String(v).replace('.', ',')])));
    setAnalysis(lab.analysis);
    setSavedId(lab.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => {
    setEditId(null);
    setValues({});
    setNote('');
    setDate(todayStr());
    setAnalysis(null);
    setSavedId(null);
  };

  const askAi = () => {
    const bad = (analysis?.findings || []).filter((f) => f.status !== 'normal');
    const text = bad.length
      ? `Мои анализы: ${bad.map((f) => `${t(f.label)} ${String(f.value).replace('.', ',')} ${f.unit}`).join(', ')}. Что мне есть и чего избегать?`
      : t('Мои анализы в норме. Как поддерживать здоровье питанием и тренировками?');
    nav('/app/assistant', { state: { prompt: text } });
  };

  return (
    <>
      <PageHead title={t('Анализы и питание')} text={t('Внеси результаты анализов — подсветим отклонения и подберём меню, которое их учитывает.')} />

      <div className="alert alert-info">
        <Icon name="info" size={18} />
        <span>
          {t('Это не диагноз и не замена врачу. Нормы — типовые для взрослых и могут отличаться в вашей лаборатории. При значительных отклонениях обязательно обратитесь к врачу.')}
        </span>
      </div>

      <div className="labs-layout">
        <Card title={editId ? t('Редактирование анализа') : t('Новые анализы')} icon="flask" action={editId && <button className="link-btn" onClick={reset}>{t('Новый')}</button>}>
          {markers.loading && <Spinner />}
          <ErrorBox error={markers.error} onRetry={markers.reload} />
          <div className="form-grid">
            <Field label={t('Дата сдачи')}>
              <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t('Комментарий')}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Лаборатория, натощак…')} maxLength={300} />
            </Field>
          </div>
          {groups.map(([group, list]) => (
            <fieldset key={group} className="lab-group">
              <legend>{t(group)}</legend>
              {list.map((m) => (
                <Field
                  key={m.key}
                  label={t(m.label)}
                  error={errors[m.key]}
                  hint={`${t('Норма')}: ${m.min !== null && m.max !== null ? `${m.min}–${m.max}` : m.min !== null ? `${t('от')} ${m.min}` : `${t('до')} ${m.max}`} ${t(m.unit)}`.replace(/(\d)\.(\d)/g, '$1,$2')}
                >
                  <div className="field-unit">
                    <input inputMode="decimal" value={values[m.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [m.key]: e.target.value }))} placeholder="—" />
                    <em>{t(m.unit)}</em>
                  </div>
                </Field>
              ))}
            </fieldset>
          ))}
          <div className="row-actions sticky-actions">
            <Btn variant="ghost" icon="target" loading={busy === 'check'} disabled={!filled} onClick={() => run(false)}>
              {t('Проверить')}
            </Btn>
            <Btn icon="check" loading={busy === 'save'} disabled={!filled} onClick={() => run(true)}>
              {editId ? t('Сохранить изменения') : t('Сохранить и разобрать')}
            </Btn>
          </div>
        </Card>

        <div className="stack" id="lab-result">
          {analysis ? (
            <>
              <Card title={t('Результат')} icon="target">
                {analysis.doctor && (
                  <div className="alert alert-error">
                    <Icon name="alert" size={18} />
                    <span>{t('Есть значимые отклонения — покажите результаты врачу. Меню учтёт их, но не заменит лечение.')}</span>
                  </div>
                )}
                <ul className="findings">
                  {analysis.findings.map((f) => (
                    <li key={f.key} className={`f-${f.status}`}>
                      <div>
                        <b>{t(f.label)}</b>
                        <span className="muted small">
                          {t('норма')} {f.range.replace(/(\d)\.(\d)/g, '$1,$2').replace('от', t('от')).replace('до', t('до'))} {t(f.unit)}
                        </span>
                      </div>
                      <div className="f-value">
                        <b>{String(f.value).replace('.', ',')}</b>
                        <span className={`res-tag tone-${f.status === 'normal' ? 'ok' : f.status === 'critical' ? 'bad' : 'warn'}`}>{t(STATUS[f.status])}</span>
                      </div>
                      {f.status !== 'normal' && <p className="small">{t(f.message)}</p>}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title={t('Твоя диета')} icon="food">
                {analysis.diet.sections.length ? (
                  <>
                    {analysis.diet.sections.map((s) => (
                      <div key={s.flag} className="diet-block">
                        <h3>{t(s.title)}</h3>
                        <div className="diet-cols">
                          <div>
                            <span className="good">{t('Больше')}</span>
                            <ul>
                              {s.prefer.map((x) => (
                                <li key={x}>{t(x)}</li>
                              ))}
                            </ul>
                          </div>
                          {s.limit.length > 0 && (
                            <div>
                              <span className="bad">{t('Ограничить')}</span>
                              <ul>
                                {s.limit.map((x) => (
                                  <li key={x}>{t(x)}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        {s.note && <p className="fine">{t(s.note)}</p>}
                      </div>
                    ))}
                    <div className="row-actions">
                      {savedId ? (
                        <Btn icon="refresh" loading={busy === 'apply'} onClick={() => apply(savedId)}>
                          {t('Применить к моему меню')}
                        </Btn>
                      ) : (
                        <p className="muted small">{t('Сохрани анализы, чтобы перестроить меню под них.')}</p>
                      )}
                      <Btn variant="ghost" icon="chat" onClick={askAi}>
                        {t('Спросить ИИ')}
                      </Btn>
                    </div>
                  </>
                ) : (
                  <>
                    <p>{t('Внесённые показатели в норме — особая диета не нужна. Придерживайся сбалансированного меню из календаря питания.')}</p>
                    {savedId && (
                      <Btn variant="ghost" icon="refresh" loading={busy === 'apply'} onClick={() => apply(savedId)}>
                        {t('Снять прошлые ограничения в меню')}
                      </Btn>
                    )}
                  </>
                )}
              </Card>
            </>
          ) : (
            <Card title={t('Как это работает')} icon="info">
              <ol className="timeline">
                <li>
                  <b>1</b>
                  <span>{t('Внеси показатели из бланка лаборатории — можно не все, достаточно тех, что есть.')}</span>
                </li>
                <li>
                  <b>2</b>
                  <span>{t('Система сравнит их с нормами и подсветит отклонения.')}</span>
                </li>
                <li>
                  <b>3</b>
                  <span>{t('Нажми «Применить к меню» — календарь питания перестроится: например, при высоком сахаре уйдут мёд и сладкое, при низком гемоглобине добавятся гречка, говядина и чечевица.')}</span>
                </li>
              </ol>
            </Card>
          )}

          <Card title={t('История анализов')} icon="calendar">
            {history.loading && !history.data && <Spinner />}
            {(history.data || []).length ? (
              <ul className="crud-list">
                {history.data.map((l) => {
                  const bad = l.analysis.findings.filter((f) => f.status !== 'normal').length;
                  return (
                    <li key={l.id}>
                      <span>{shortDate(l.date)}</span>
                      <b>{Object.keys(l.values).length} {t('показ.')}</b>
                      <span className={bad ? 'bad' : 'good'}>{bad ? `${bad} ${t('откл.')}` : t('норма')}</span>
                      <div className="crud-actions">
                        <Btn size="sm" variant="ghost" icon="edit" onClick={() => load(l)} aria-label={t('Открыть')} />
                        <ConfirmBtn
                          onConfirm={async () => {
                            await api.del(`/api/labs/${l.id}`);
                            if (editId === l.id) reset();
                            history.reload();
                          }}
                        >
                          {''}
                        </ConfirmBtn>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">{t('Сохранённых анализов пока нет.')}</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
