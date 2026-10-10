import { t } from '../i18n.jsx';
import { Link } from 'react-router-dom';
import { Icon, Reveal } from './ui.jsx';
import { useCountUp, useReveal } from '../hooks.js';

function Stat({ value, suffix, label, run, delay }) {
  const n = useCountUp(value, run);
  return (
    <div className="stat" style={{ transitionDelay: `${delay}ms` }}>
      <strong>
        {new Intl.NumberFormat('ru-RU').format(n).replace(/ /g, ' ')}
        <em>{suffix}</em>
      </strong>
      <span>{label}</span>
    </div>
  );
}

// Кольцо прогресса для карточки «Мой день»
function Ring({ value, max, size = 108 }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-val" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
    </svg>
  );
}

// Пример кабинета — показывает посетителю, что он получит после регистрации
function DayCard() {
  return (
    <div className="daycard" aria-label={t('Пример личного кабинета')}>
      <div className="daycard-head">
        <span className="live-dot" />{' '}{t('Мой день · пример кабинета')}
      </div>
      <div className="daycard-main">
        <div className="daycard-ring">
          <Ring value={1420} max={1900} />
          <div>
            <b>1 420</b>
            <span>{t('из 1 900 ккал')}</span>
          </div>
        </div>
        <ul className="daycard-macros">
          <li>
            <span>{t('Белки')}</span>
            <i style={{ width: '78%' }} />
            <b>{t('98 г')}</b>
          </li>
          <li>
            <span>{t('Жиры')}</span>
            <i style={{ width: '64%' }} />
            <b>{t('41 г')}</b>
          </li>
          <li>
            <span>{t('Углеводы')}</span>
            <i style={{ width: '71%' }} />
            <b>{t('152 г')}</b>
          </li>
        </ul>
      </div>
      <div className="daycard-row">
        <Icon name="drop" size={18} />
        <span>{t('Вода')}</span>
        <div className="daycard-glasses">
          {Array.from({ length: 10 }).map((_, i) => (
            <i key={i} className={i < 6 ? 'is-full' : ''} />
          ))}
        </div>
        <b>{t('1,5 / 2,5 л')}</b>
      </div>
      <div className="daycard-row">
        <Icon name="camera" size={18} />
        <span>{t('ИИ-тренер: брусья')}</span>
        <b className="good">✓ 8</b>
        <b className="bad">✗ 2</b>
      </div>
      <div className="daycard-row">
        <Icon name="food" size={18} />
        <span>{t('Ужин: лосось с брокколи')}</span>
        <b>{t('420 ккал')}</b>
      </div>
    </div>
  );
}

export default function Hero({ stats, onCta }) {
  const [ref, visible] = useReveal({ threshold: 0.3 });

  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-photo" />
        <div className="hero-grid" />
        <div className="hero-glow" />
      </div>

      <div className="container hero-inner">
        <div className="hero-cols">
          <div className="hero-left">
            <Reveal className="hero-badge">
              <span className="dot" />{' '}{t('Ташкент · клуб и онлайн-кабинет')}
            </Reveal>

            <h1 className="hero-title">
              <span className="line">{t('Здоровье —').replace(' —', '\u00a0—')}</span>
              <span className="line">{t('это твоя')}</span>
              <span className="line">
                <span className="outline">{t('сила')}</span>
              </span>
            </h1>

            <Reveal className="hero-sub" delay={150}>
              <p>
                {t('Тренировки с тренером, меню на месяц по твоим анализам и ИИ-тренер, который через камеру засчитывает только правильные повторения.')}
              </p>
              <div className="hero-actions">
                <Link to="/register" className="btn btn-primary btn-lg">
                  {t('Создать кабинет бесплатно')}{' '}<Icon name="arrow" />
                </Link>
                <button className="btn btn-ghost btn-lg" onClick={onCta}>
                  {t('Пробная тренировка')}
                </button>
              </div>
            </Reveal>
          </div>

          <Reveal className="hero-right" delay={250}>
            <DayCard />
          </Reveal>
        </div>

        <div ref={ref} className={`stats ${visible ? 'is-visible' : ''}`}>
          {stats.map((s, i) => (
            <Stat key={s.label} {...s} run={visible} delay={i * 90} />
          ))}
        </div>
      </div>
    </section>
  );
}
