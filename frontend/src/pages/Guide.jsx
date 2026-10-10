import { t } from '../i18n.jsx';
import { useApi } from '../context.jsx';
import { PageHead } from '../app/ui.jsx';
import GuideContent from './GuideContent.jsx';

export default function Guide() {
  const { data } = useApi('/api/profile/summary');
  return (
    <>
      <PageHead title={t('Справочник здоровья')} text={t('Вода, напитки, вес, сроки результата, режим тренировок и продукты — с твоими личными цифрами.')} />
      <GuideContent metrics={data?.complete ? data : null} />
    </>
  );
}
