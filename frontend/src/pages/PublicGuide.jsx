import { t } from '../i18n.jsx';
import { BrandMark } from '../components/ui.jsx';
// Публичная версия справочника — полезный контент для поисковиков и новых посетителей
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context.jsx';
import { Icon } from '../app/ui.jsx';
import GuideContent from './GuideContent.jsx';

export default function PublicGuide() {
  const { user } = useAuth();
  useEffect(() => {
    document.title = t('Справочник здоровья — вода, питание, тренировки | VITALIS');
    return () => {
      document.title = t('VITALIS — Здоровье и Спорт | Фитнес-клуб в Ташкенте');
    };
  }, []);

  return (
    <div className="public-page">
      <header className="public-head">
        <div className="container public-head-inner">
          <Link to="/" className="logo">
            <BrandMark />
            <span>VITALIS</span>
          </Link>
          <Link to={user ? '/app/guide' : '/register'} className="btn btn-primary btn-sm">
            {user ? t('Мои цифры') : t('Рассчитать для меня')}
          </Link>
        </div>
      </header>
      <main className="container public-main">
        <span className="kicker">{t('Справочник')}</span>
        <h1 className="h2">{t('Здоровье без мифов')}</h1>
        <p className="lead">{t('Короткие ответы на главные вопросы: сколько пить, когда нужны изотоники, сколько ждать результата и что есть. Зарегистрируйся — и мы подставим твои личные цифры.')}</p>
        <GuideContent metrics={null} />
        <div className="public-cta">
          <h2>{t('Хочешь персональный план?')}</h2>
          <p>{t('Меню на месяц с рецептами и ценами, расписание тренировок и ИИ-тренер, который проверяет технику через камеру.')}</p>
          <Link to={user ? '/app' : '/register'} className="btn btn-primary btn-lg">
            {user ? t('Открыть кабинет') : t('Создать кабинет бесплатно')} <Icon name="arrow" />
          </Link>
        </div>
      </main>
    </div>
  );
}
