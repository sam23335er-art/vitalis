import { t } from '../i18n.jsx';
import { useEffect, useState } from 'react';
import { Icon, Reveal } from './ui.jsx';
import { sendLead } from '../api.js';

// Маска телефона: +998 XX XXX XX XX
function formatPhone(value) {
  let d = value.replace(/\D/g, '');
  if (d.startsWith('998')) d = d.slice(3);
  d = d.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return '+998' + (parts.length ? ' ' + parts.join(' ') : '');
}

const empty = { name: '', phone: '+998', program: '', message: '', website: '' };

export default function Contact({ contacts, programs, plans, selected }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (selected) setForm((f) => ({ ...f, program: selected }));
  }, [selected]);

  const options = [
    t('Пробная тренировка'),
    ...programs.map((p) => p.title),
    ...plans.map((p) => t('Абонемент «{name}»', { name: p.name })),
  ];
  if (form.program && !options.includes(form.program)) options.unshift(form.program);

  const update = (key) => (e) => {
    const value = key === 'phone' ? formatPhone(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = t('Укажите имя');
    if (form.phone.replace(/\D/g, '').length !== 12) e.phone = t('Введите номер полностью');
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;

    setStatus('sending');
    setServerError('');
    try {
      await sendLead(form);
      setStatus('done');
      setForm(empty);
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      setServerError(err.fields ? '' : err.status === 0 ? t('Не удалось отправить. Позвоните нам или попробуйте позже.') : err.message);
      setStatus('error');
    }
  };

  const tel = contacts.phone.replace(/\s/g, '');

  return (
    <section className="section contact" id="contact">
      <div className="contact-glow" aria-hidden="true" />
      <div className="container contact-wrap">
        <Reveal className="contact-info">
          <span className="kicker">{t('08 · Запись')}</span>
          <h2 className="h2">
            {t('Первая тренировка —')}{' '}<span className="accent">{t('бесплатно')}</span>
          </h2>
          <p className="lead">{t('Оставь заявку: администратор перезвонит в течение 15 минут, подберёт время и тренера.')}</p>

          <ul className="contact-list">
            <li>
              <Icon name="pin" /> {contacts.address}
            </li>
            <li>
              <Icon name="phone" /> <a href={`tel:${tel}`}>{contacts.phone}</a>
            </li>
            <li>
              <Icon name="mail" /> <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
            </li>
            <li>
              <Icon name="clock" /> {contacts.hours}
            </li>
          </ul>
        </Reveal>

        <Reveal className="contact-card" delay={120}>
          {status === 'done' ? (
            <div className="success">
              <div className="success-icon">
                <Icon name="check" size={36} />
              </div>
              <h3>{t('Заявка принята!')}</h3>
              <p>{t('Мы перезвоним в течение 15 минут в рабочее время клуба.')}</p>
              <button className="btn btn-outline" onClick={() => setStatus('idle')}>
                {t('Отправить ещё одну')}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h3>{t('Записаться в клуб')}</h3>

              <label className={`field ${errors.name ? 'has-error' : ''}`}>
                <span>{t('Имя')}</span>
                <input value={form.name} onChange={update('name')} placeholder={t('Как к вам обращаться')} autoComplete="name" maxLength={80} />
                {errors.name && <small>{t(errors.name)}</small>}
              </label>

              <label className={`field ${errors.phone ? 'has-error' : ''}`}>
                <span>{t('Телефон')}</span>
                <input value={form.phone} onChange={update('phone')} inputMode="tel" autoComplete="tel" placeholder="+998 90 123 45 67" />
                {errors.phone && <small>{t(errors.phone)}</small>}
              </label>

              <label className="field">
                <span>{t('Что интересует')}</span>
                <select value={form.program} onChange={update('program')}>
                  <option value="">{t('Выберите направление')}</option>
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{t('Комментарий')}</span>
                <textarea value={form.message} onChange={update('message')} rows={3} placeholder={t('Цель, удобное время, вопросы')} maxLength={1000} />
              </label>

              {/* Скрытое поле-ловушка для спам-ботов */}
              <input className="hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={update('website')} aria-hidden="true" />

              {serverError && <p className="form-error">{serverError}</p>}

              <button className="btn btn-primary btn-lg btn-block" disabled={status === 'sending'}>
                {status === 'sending' ? t('Отправляем…') : t('Отправить заявку')} <Icon name="arrow" />
              </button>
              <p className="form-hint">{t('Нажимая кнопку, вы соглашаетесь на обработку персональных данных.')}</p>
            </form>
          )}
        </Reveal>
      </div>

      <div className="container">
        <Reveal className="map">
          <iframe
            title={t('Карта: как нас найти')}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(contacts.address)}&z=15&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </Reveal>
      </div>
    </section>
  );
}
