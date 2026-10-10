import { t } from '../i18n.jsx';
import { useEffect, useState } from 'react';
import { Icon, Img, Reveal, SectionHead } from './ui.jsx';

export default function Reviews({ items }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;

  useEffect(() => {
    if (paused || n < 2) return;
    const timer = setInterval(() => setI((v) => (v + 1) % n), 6000);
    return () => clearInterval(timer);
  }, [paused, n]);

  if (!n) return null;
  const r = items[i % n];

  return (
    <section className="section section-light" id="reviews">
      <div className="container">
        <SectionHead light kicker={t('06 · Результаты')} title={t('Истории наших клиентов')} />

        <Reveal className="review" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div className="review-photo" key={`p-${r.id}`}>
            <Img src={r.image} alt={r.name} label={`${t('Фото клиента')}: ${r.name}`} />
            <span className="review-result">{r.result}</span>
          </div>
          <div className="review-body" key={`b-${r.id}`}>
            <div className="stars" aria-label={t('Оценка 5 из 5')}>
              {Array.from({ length: 5 }).map((_, k) => (
                <Icon key={k} name="star" size={18} />
              ))}
            </div>
            <blockquote>«{r.text}»</blockquote>
            <p className="review-name">{r.name}</p>

            <div className="review-nav">
              <button className="round-btn dark" onClick={() => setI((v) => (v - 1 + n) % n)} aria-label={t('Предыдущий отзыв')}>
                <Icon name="arrowLeft" />
              </button>
              <div className="dots">
                {items.map((it, k) => (
                  <button key={it.id} className={k === i ? 'is-active' : ''} onClick={() => setI(k)} aria-label={`${t('Отзыв')} ${k + 1}`} />
                ))}
              </div>
              <button className="round-btn dark" onClick={() => setI((v) => (v + 1) % n)} aria-label={t('Следующий отзыв')}>
                <Icon name="arrow" />
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
