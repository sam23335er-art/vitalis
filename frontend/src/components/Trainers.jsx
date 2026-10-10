import { t } from '../i18n.jsx';
import { Img, Reveal, SectionHead } from './ui.jsx';

export default function Trainers({ items }) {
  return (
    <section className="section" id="trainers">
      <div className="container">
        <SectionHead
          kicker={t('03 · Команда')}
          title={t('Тренеры, которые доводят до результата')}
          text={t('Мастера спорта, врачи и сертифицированные инструкторы. Каждый проходит аттестацию дважды в год.')}
        />
        <div className="trainers-grid">
          {items.map((tr, i) => (
            <Reveal as="article" key={tr.id} className="trainer" delay={i * 90}>
              <div className="trainer-photo">
                <Img src={tr.image} alt={tr.name} label={`${t('Фото тренера')}: ${tr.name}`} />
                <span className="trainer-num">0{i + 1}</span>
              </div>
              <div className="trainer-info">
                <h3>{tr.name}</h3>
                <p className="trainer-role">
                  {tr.role} · {tr.experience}
                </p>
                <ul className="badges">
                  {tr.badges.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
