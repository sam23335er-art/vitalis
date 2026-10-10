import { t } from '../i18n.jsx';
import { useState } from 'react';
import { Icon } from './ui.jsx';
import { Logo } from './Header.jsx';
import { subscribe } from '../api.js';

export default function Footer({ contacts }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ status: 'idle', msg: '' });

  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setState({ status: 'error', msg: t('Введите корректный e-mail') });
      return;
    }
    setState({ status: 'sending', msg: '' });
    try {
      const res = await subscribe(email.trim());
      setState({ status: 'done', msg: res.already ? t('Вы уже подписаны 👌') : t('Готово! Первое письмо уже в пути.') });
      setEmail('');
    } catch (err) {
      setState({ status: 'error', msg: err.status === 0 ? t('Сервис временно недоступен') : err.message });
    }
  };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <Logo />
            <p>{t('Клуб здоровья и спорта. Тренируем тело, бережём здоровье, помогаем держать результат годами.')}</p>
            <div className="socials">
              <a href={contacts.telegram} target="_blank" rel="noreferrer" aria-label="Telegram">
                <Icon name="telegram" />
              </a>
              <a href={contacts.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                <Icon name="instagram" />
              </a>
            </div>
          </div>

          <nav className="footer-col" aria-label={t('Разделы')}>
            <h4>{t('Разделы')}</h4>
            <a href="#programs">{t('Программы')}</a>
            <a href="#trainers">{t('Тренеры')}</a>
            <a href="#schedule">{t('Расписание')}</a>
            <a href="#pricing">{t('Абонементы')}</a>
          </nav>

          <div className="footer-col">
            <h4>{t('Контакты')}</h4>
            <a href={`tel:${contacts.phone.replace(/\s/g, '')}`}>{contacts.phone}</a>
            <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
            <span>{contacts.address}</span>
          </div>

          <form className="footer-sub" onSubmit={submit} noValidate>
            <h4>{t('Полезная рассылка')}</h4>
            <p>{t('Тренировки, рецепты и акции — раз в неделю, без спама.')}</p>
            <div className="sub-row">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('Ваш e-mail')} aria-label="E-mail" />
              <button className="round-btn" disabled={state.status === 'sending'} aria-label={t('Подписаться')}>
                <Icon name="arrow" />
              </button>
            </div>
            {state.msg && <small className={state.status === 'error' ? 'is-error' : 'is-ok'}>{state.msg}</small>}
          </form>
        </div>

        <div className="footer-giant" aria-hidden="true">
          VITALIS
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} VITALIS. {t('Все права защищены.')}</span>
          <span>{t('Имеются противопоказания. Перед началом тренировок проконсультируйтесь с врачом.')}</span>
        </div>
      </div>
    </footer>
  );
}
