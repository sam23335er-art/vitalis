import { t } from '../i18n.jsx';
import { Icon, Img, Reveal, SectionHead } from './ui.jsx';

export default function Programs({ items, onChoose }) {
  return (
    <section className="section" id="programs">
      <div className="container">
        <div className="section-row">
          <SectionHead
            kicker={t('01 · Программы')}
            title={t('Найди свой формат тренировок')}
            text={t('Шесть направлений, которые закрывают всё — от силы и выносливости до гибкости и питания.')}
          />
        </div>

        <div className="programs-grid">
          {items.map((p, i) => (
            <Reveal as="article" key={p.id} className="program-card" delay={(i % 3) * 90}>
              <Img src={p.image} alt={p.title} className="program-img" label={`${t('Фото')}: ${p.title}`} />
              <div className="program-shade" />
              <div className="program-body">
                <span className="chip">{p.tag}</span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
                <div className="program-foot">
                  <div className="program-meta">
                    <span>
                      <Icon name="clock" size={16} /> {p.duration}
                    </span>
                    <span>
                      <Icon name="bolt" size={16} /> {p.level}
                    </span>
                  </div>
                  <button className="round-btn" onClick={() => onChoose(p.title)} aria-label={`${t('Записаться')}: ${p.title}`}>
                    <Icon name="arrow" />
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
