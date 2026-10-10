// Переводы RU / UZ. Ключ — русский текст: если перевода нет, показывается русский,
// поэтому сайт никогда не «ломается» из-за пропущенной строки.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { UZ, UZ_PATTERNS } from './i18n.uz.js';

const KEY = 'vitalis_lang';
export const LANGS = [
  ['ru', 'RU'],
  ['uz', 'UZ'],
];

let current = 'ru';
try {
  const saved = localStorage.getItem(KEY);
  if (saved === 'ru' || saved === 'uz') current = saved;
} catch {
  /* приватный режим браузера */
}

export const getLang = () => current;

// t('Привет, {name}!', { name: 'Ксения' })
export function t(text, vars) {
  if (text === null || text === undefined) return '';
  let s = String(text);
  if (current === 'uz') {
    if (UZ[s] !== undefined) s = UZ[s];
    else {
      for (const [re, fn] of UZ_PATTERNS) {
        const m = s.match(re);
        if (m) {
          s = fn(...m.slice(1));
          break;
        }
      }
    }
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (all, k) => (vars[k] !== undefined ? String(vars[k]) : all));
  return s;
}

const LangCtx = createContext({ lang: 'ru', setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(current);

  const setLang = useCallback((l) => {
    current = l;
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* не критично */
    }
    setLangState(l);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'uz' ? 'uz' : 'ru';
    document.title = t('VITALIS — здоровье, спорт и питание | Ташкент');
  }, [lang]);

  // key={lang}: при смене языка всё дерево перерисовывается с новыми текстами
  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      <div key={lang} className="lang-root">
        {children}
      </div>
    </LangCtx.Provider>
  );
}

export const useLang = () => useContext(LangCtx);

export function LangSwitch({ className = '' }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label="Язык / Til">
      {LANGS.map(([code, label]) => (
        <button key={code} type="button" className={lang === code ? 'is-active' : ''} aria-pressed={lang === code} onClick={() => lang !== code && setLang(code)}>
          {label}
        </button>
      ))}
    </div>
  );
}
