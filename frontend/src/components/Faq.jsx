import { t } from '../i18n.jsx';
import { useState } from 'react';
import { Icon, Reveal, SectionHead } from './ui.jsx';

export default function Faq({ items }) {
  const [open, setOpen] = useState(0);

  return (
    <section className="section" id="faq">
      <div className="container faq-wrap">
        <SectionHead kicker={t('07 · Вопросы')} title={t('Частые вопросы')} text={t('Не нашли ответ? Напишите нам в Telegram — ответим в течение 15 минут.')} />
        <div className="faq">
          {items.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} className={`faq-item ${isOpen ? 'is-open' : ''}`} delay={i * 60}>
                <button className="faq-q" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? -1 : i)}>
                  <span>{f.q}</span>
                  <Icon name="plus" size={22} />
                </button>
                <div className="faq-a">
                  <div>
                    <p>{f.a}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
