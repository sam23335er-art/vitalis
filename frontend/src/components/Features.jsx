import { t } from '../i18n.jsx';
import { Link } from 'react-router-dom';
import { Icon, Reveal, SectionHead } from './ui.jsx';
import { useAuth } from '../context.jsx';

const items = [
  {
    icon: 'camera',
    title: 'ИИ-тренер через камеру',
    text: 'Включи камеру — система видит твоё тело, считает только правильные повторения на брусьях, в отжиманиях, приседаниях и подтягиваниях и подсказывает голосом, что исправить.',
  },
  {
    icon: 'flask',
    title: 'Питание по анализам',
    text: 'Внеси сахар, холестерин, гемоглобин и другие показатели — сайт подсветит отклонения и перестроит меню: что есть больше, что ограничить.',
  },
  {
    icon: 'calendar',
    title: 'Календарь питания на месяц',
    text: 'Завтрак, обед, ужин и перекус на каждый день: рецепт по шагам, граммы, белки-жиры-углеводы, цена в сумах и кнопка «Съел».',
  },
  {
    icon: 'cart',
    title: 'Список покупок и бюджет',
    text: 'Продукты на день или неделю одним списком со стоимостью. Видно, сколько уйдёт на еду и спорт за месяц и сколько денег останется.',
  },
  {
    icon: 'drop',
    title: 'Вода, вес и прогноз',
    text: 'Личная норма воды, нужны ли тебе изотоники, сколько килограммов до цели и за сколько недель ты её достигнешь при безопасном темпе.',
  },
  {
    icon: 'chat',
    title: 'Помощник 24/7',
    text: 'Отвечает на вопросы о тренировках, питании и восстановлении с твоими личными цифрами. Работает без интернета и платных сервисов, а тренеры клуба постоянно учат его новому.',
  },
];

export default function Features() {
  const { user } = useAuth();
  return (
    <section className="section features" id="features">
      <div className="container">
        <div className="features-head">
          <SectionHead
            kicker={t('Личный кабинет · бесплатно')}
            title={t('Не просто сайт клуба — твой персональный тренер')}
            text={t('Зарегистрируйся за 30 секунд и получи план тренировок, меню на месяц и ИИ-помощника, который следит за техникой.')}
          />
          <Reveal>
            <Link to={user ? '/app' : '/register'} className="btn btn-primary btn-lg">
              {user ? t('Открыть кабинет') : t('Создать кабинет')} <Icon name="arrow" />
            </Link>
          </Reveal>
        </div>
        <div className="features-grid">
          {items.map((f, i) => (
            <Reveal key={f.title} className="feature" delay={(i % 3) * 90}>
              <span className="feature-icon">
                <Icon name={f.icon} size={26} />
              </span>
              <h3>{t(f.title)}</h3>
              <p>{t(f.text)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
