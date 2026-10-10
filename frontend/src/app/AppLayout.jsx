import { LangSwitch, t } from '../i18n.jsx';
import { BrandMark } from '../components/ui.jsx';
import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context.jsx';
import { Icon, Spinner } from './ui.jsx';

const NAV = [
  ['/app', 'home', 'Главная', true],
  ['/app/nutrition', 'food', 'Питание'],
  ['/app/training', 'dumbbell', 'Тренировки'],
  ['/app/coach', 'camera', 'ИИ-тренер'],
  ['/app/labs', 'flask', 'Анализы'],
  ['/app/assistant', 'chat', 'Помощник'],
  ['/app/guide', 'book', 'Справочник'],
  ['/app/profile', 'settings', 'Профиль'],
];

// На телефоне внизу — 5 главных разделов
const MOBILE = ['/app', '/app/nutrition', '/app/coach', '/app/training', '/app/assistant'];

export default function AppLayout() {
  const { user, loading, logout } = useAuth();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  if (loading) {
    return (
      <div className="page-loading">
        <Spinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  const items = user.role === 'admin' ? [...NAV, ['/app/teach', 'bulb', 'Обучение ИИ'], ['/app/admin', 'shield', 'Админка']] : NAV;
  
  return (
    <div className={`shell ${menu ? 'menu-open' : ''}`}>
      <aside className="sidebar">
        <Link to="/" className="logo">
          <BrandMark />
          <span>VITALIS</span>
        </Link>
        <nav className="side-nav" aria-label={t('Разделы кабинета')}>
          {items.map(([to, icon, label, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'is-active' : '')}>
              <Icon name={icon} size={19} />
              <span>{t(label)}</span>
            </NavLink>
          ))}
        </nav>
        <LangSwitch className="side-lang" />
        <div className="side-user">
          <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="side-user-info">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="icon-btn" onClick={logout} aria-label={t('Выйти')} title={t('Выйти')}>
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <div className="topbar">
        <Link to="/app" className="logo">
          <BrandMark />
          <span>VITALIS</span>
        </Link>
        <LangSwitch className="top-lang" />
        <button className="icon-btn" onClick={() => setMenu((v) => !v)} aria-label={t('Меню')} aria-expanded={menu}>
          <Icon name={menu ? 'x' : 'menu'} size={22} />
        </button>
      </div>
      <div className="side-backdrop" onClick={() => setMenu(false)} />

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label={t('Быстрый доступ')}>
        {NAV.filter(([to]) => MOBILE.includes(to)).map(([to, icon, label, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'is-active' : '')}>
            <Icon name={icon} size={21} />
            <span>{t(label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
