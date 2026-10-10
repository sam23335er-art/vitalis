import { t } from '../i18n.jsx';
import { useMemo, useState } from 'react';
import { Icon, Reveal, SectionHead } from './ui.jsx';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const FULL = {
  Пн: 'Понедельник',
  Вт: 'Вторник',
  Ср: 'Среда',
  Чт: 'Четверг',
  Пт: 'Пятница',
  Сб: 'Суббота',
  Вс: 'Воскресенье',
};

export default function Schedule({ data, onChoose }) {
  // По умолчанию открыт сегодняшний день недели
  const today = useMemo(() => DAYS[(new Date().getDay() + 6) % 7], []);
  const [day, setDay] = useState(today);
  const list = data[day] || [];

  return (
    <section className="section section-light" id="schedule">
      <div className="container">
        <SectionHead
          light
          kicker={t('04 · Расписание')}
          title={t('Групповые занятия на неделю')}
          text={t('Выбери день и запишись на занятие в один клик — администратор подтвердит место.')}
        />

        <Reveal className="days" role="tablist" aria-label={t('Дни недели')}>
          {DAYS.map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={day === d}
              className={`day ${day === d ? 'is-active' : ''}`}
              onClick={() => setDay(d)}
            >
              <strong>{t(d)}</strong>
              <span>{d === today ? t('сегодня') : `${(data[d] || []).length} ${t('зан.')}`}</span>
            </button>
          ))}
        </Reveal>

        <div className="slots" role="tabpanel" aria-label={t(FULL[day])} key={day}>
          {list.length === 0 && <p className="slots-empty">{t('В этот день групповых занятий нет — зал открыт для самостоятельных тренировок.')}</p>}
          {list.map((s, i) => (
            <div className="slot" key={`${s.time}-${s.title}`} style={{ animationDelay: `${i * 60}ms` }}>
              <time>{s.time}</time>
              <div className="slot-main">
                <h3>{s.title}</h3>
                <p>
                  <Icon name="user" size={15} /> {s.trainer}
                  <span className="sep" />
                  <Icon name="pin" size={15} /> {s.room}
                </p>
              </div>
              <button className="btn btn-dark btn-sm" onClick={() => onChoose(`${s.title} — ${t(FULL[day])}, ${s.time}`)}>
                {t('Записаться')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
