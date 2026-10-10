import { t } from '../i18n.jsx';
import { Icon, Reveal, SectionHead } from './ui.jsx';
import { formatSum } from '../hooks.js';

export default function Pricing({ plans, onChoose }) {
  return (
    <section className="section" id="pricing">
      <div className="container">
        <SectionHead
          center
          kicker={t('05 · Абонементы')}
          title={t('Прозрачные цены без скрытых платежей')}
          text={t('Оплата наличными, картами Uzcard, Humo, Visa, Mastercard, через Click и Payme.')}
        />
        <div className="plans">
          {plans.map((p, i) => (
            <Reveal key={p.id} className={`plan ${p.featured ? 'is-featured' : ''}`} delay={i * 100}>
              {p.featured && <span className="plan-flag">{t('Выбор клиентов')}</span>}
              <h3>{p.name}</h3>
              <div className="plan-price">
                <strong>{formatSum(p.price)}</strong>
                <span>{t('сум')} / {t(p.period)}</span>
              </div>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <Icon name="check" size={18} /> {f}
                  </li>
                ))}
              </ul>
              <button className={`btn ${p.featured ? 'btn-light' : 'btn-outline'} btn-block`} onClick={() => onChoose(t('Абонемент «{name}»', { name: p.name }))}>
                {t('Выбрать «{name}»', { name: p.name })}
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
