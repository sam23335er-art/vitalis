// Форматирование чисел и дат для интерфейса (с учётом языка RU / UZ)
import { getLang, t } from '../i18n.jsx';

export const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0)).replace(/ /g, ' ');
export const sum = (n) => `${fmt(n)} ${t('сум')}`;

const pad = (n) => String(n).padStart(2, '0');

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_UZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WD_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WD_UZ = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const WD_FULL_RU = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const WD_FULL_UZ = ['dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba', 'yakshanba'];

const uz = () => getLang() === 'uz';
export const months = () => (uz() ? MONTHS_UZ : MONTHS_RU);
export const weekdays = () => (uz() ? WD_UZ : WD_RU);

export const monthTitle = (month) => {
  const [y, m] = month.split('-').map(Number);
  return `${months()[m - 1]} ${y}`;
};

export const weekdayIdx = (dateStr) => (new Date(`${dateStr}T12:00:00`).getDay() + 6) % 7;

export function dayTitle(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  const w = weekdayIdx(dateStr);
  return uz() ? `${d}-${MONTHS_UZ[m - 1].toLowerCase()}, ${WD_FULL_UZ[w]}` : `${d} ${MONTHS_GEN[m - 1]}, ${WD_FULL_RU[w]}`;
}

export const shortDate = (dateStr) => {
  const [, m, d] = dateStr.split('-').map(Number);
  return uz() ? `${d}-${MONTHS_UZ[m - 1].slice(0, 3).toLowerCase()}` : `${d} ${MONTHS_GEN[m - 1].slice(0, 3)}`;
};

// Ячейки календаря: с пустыми клетками до первого понедельника
export function calendarCells(month) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const first = weekdayIdx(`${month}-01`);
  const cells = Array.from({ length: first }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export const monthRange = (month) => {
  const [y, m] = month.split('-').map(Number);
  return { from: `${month}-01`, to: `${month}-${pad(new Date(y, m, 0).getDate())}` };
};

export const plural = (n, one, few, many) => {
  if (uz()) return t(one);
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

const SLOT_RU = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' };
export const SLOT_LABEL = new Proxy(SLOT_RU, { get: (o, k) => (o[k] ? t(o[k]) : undefined) });
export const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];

const TAG_RU = {
  fiber: 'Клетчатка',
  heart: 'Для сердца',
  quick: 'Быстро',
  lowCarb: 'Мало углеводов',
  highProtein: 'Много белка',
  iron: 'Железо',
  vitD: 'Витамин D',
  sugar: 'Есть сахар',
  local: 'Узбекская кухня',
  redMeat: 'Красное мясо',
  fattyMeat: 'Жирное мясо',
  organ: 'Субпродукты',
  fish: 'Рыба',
  vegetarian: 'Без мяса',
  fried: 'Жареное',
  salty: 'Солёное',
};
export const TAG_LABEL = new Proxy(TAG_RU, { get: (o, k) => (o[k] ? t(o[k]) : undefined) });

const GOAL_RU = { lose: 'Похудеть', keep: 'Держать форму', gain: 'Набрать массу' };
export const GOAL_LABEL = new Proxy(GOAL_RU, { get: (o, k) => (o[k] ? t(o[k]) : undefined) });
