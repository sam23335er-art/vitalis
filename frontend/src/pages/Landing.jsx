import { t } from '../i18n.jsx';
import { useCallback, useEffect, useState } from 'react';
import { getContent, localContent } from '../api.js';
import Header from '../components/Header.jsx';
import Hero from '../components/Hero.jsx';
import Marquee from '../components/Marquee.jsx';
import Programs from '../components/Programs.jsx';
import Features from '../components/Features.jsx';
import Calculator from '../components/Calculator.jsx';
import Trainers from '../components/Trainers.jsx';
import Schedule from '../components/Schedule.jsx';
import Pricing from '../components/Pricing.jsx';
import Reviews from '../components/Reviews.jsx';
import Faq from '../components/Faq.jsx';
import Contact from '../components/Contact.jsx';
import Footer from '../components/Footer.jsx';

export default function Landing() {
  // Сразу показываем встроенный контент, затем подменяем актуальным с сервера
  const [content, setContent] = useState(localContent);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    let alive = true;
    getContent().then((data) => alive && setContent(data));
    return () => {
      alive = false;
    };
  }, []);

  // Выбор программы/тарифа → переход к форме с заполненным полем
  const choose = useCallback((value) => {
    setSelected(value);
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <>
      <Header phone={content.contacts.phone} />
      <main>
        <Hero stats={content.stats} onCta={() => choose(t('Пробная тренировка'))} />
        <Marquee />
        <Features />
        <Programs items={content.programs} onChoose={choose} />
        <Calculator />
        <Trainers items={content.trainers} />
        <Schedule data={content.schedule} onChoose={choose} />
        <Pricing plans={content.plans} onChoose={choose} />
        <Reviews items={content.reviews} />
        <Faq items={content.faq} />
        <Contact contacts={content.contacts} programs={content.programs} plans={content.plans} selected={selected} />
      </main>
      <Footer contacts={content.contacts} />
    </>
  );
}
