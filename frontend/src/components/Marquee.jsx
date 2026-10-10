import { t } from '../i18n.jsx';
const words = ['Сила', 'Выносливость', 'Гибкость', 'Питание', 'Восстановление', 'Энергия', 'Здоровье', 'Результат'];

export default function Marquee() {
  // Слова дублируются, чтобы лента прокручивалась бесшовно
  const row = [...words, ...words];
  return (
    <div className="marquee-wrap" aria-hidden="true">
      <div className="marquee">
        <div className="marquee-track">
          {row.map((w, i) => (
            <span key={i}>
              {t(w)}
              <i>✦</i>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
