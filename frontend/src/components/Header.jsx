import { LangSwitch, t } from '../i18n.jsx';
import { BrandMark } from './ui.jsx';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './ui.jsx';
import { useAuth } from '../context.jsx';

const links = [
  ['#features', 'Возможности'],
  ['#programs', 'Программы'],
  ['#trainers', 'Тренеры'],
  ['#schedule', 'Расписание'],
  ['#pricing', 'Цены'],
  ['#faq', 'Вопросы'],
];

export function Logo() {
  return (
    <a href="#top" className="logo" aria-label={t('VITALIS — на главную')}>
      <BrandMark />
      <span>VITALIS</span>
    </a>
  );
}

export default function Header({ phone }) {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Блокируем прокрутку под открытым мобильным меню
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`header ${scrolled ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`} id="top">
      <div className="container header-inner">
        <Logo />
        <nav className="nav" aria-label={t('Основное меню')}>
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {t(label)}
            </a>
          ))}
          <Link to={user ? '/app' : '/login'} className="nav-login" onClick={() => setOpen(false)}>
            <Icon name="user" size={16} /> {user ? t('Кабинет') : t('Войти')}
          </Link>
          <a href={`tel:${phone.replace(/\s/g, '')}`} className="nav-phone">
            <Icon name="phone" size={16} /> {phone}
          </a>
        </nav>
        <LangSwitch className="header-lang" />
        <a href="#contact" className="btn btn-primary btn-sm header-cta">
          {t('Записаться')}
        </a>
        <button className="burger" aria-label={open ? t('Закрыть меню') : t('Открыть меню')} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon name={open ? 'close' : 'menu'} size={24} />
        </button>
      </div>
    </header>
  );
}
