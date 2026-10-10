import { useState } from 'react';
import { useReveal } from '../hooks.js';

// Картинка с аккуратной заглушкой, пока файл не загружен в /public/images
export function Img({ src, alt, className = '', label }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div className={`img-ph ${className}`} role="img" aria-label={alt}>
        <Icon name="image" />
        <span>{label || alt}</span>
        <small>{src}</small>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

// Обёртка с анимацией появления
export function Reveal({ as: Tag = 'div', className = '', delay = 0, children, ...rest }) {
  const [ref, visible] = useReveal();
  return (
    <Tag ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionHead({ kicker, title, text, light = false, center = false }) {
  return (
    <Reveal className={`section-head ${light ? 'on-light' : ''} ${center ? 'center' : ''}`}>
      <span className="kicker">{kicker}</span>
      <h2 className="h2">{title}</h2>
      {text && <p className="lead">{text}</p>}
    </Reveal>
  );
}

const paths = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-9 9" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  bolt: <path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z" />,
  heart: <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  telegram: <path d="M21 4L3 11l6 2 2 6 3-4 5 4 2-15zM9 13l9-6-6 8" />,
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </>
  ),
  home: <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z" />,
  food: (
    <>
      <path d="M7 3v8a2 2 0 002 2v8M11 3v6M7 3v6" />
      <path d="M17 21V3c-2 1.5-3 4-3 7s1 3 3 3" />
    </>
  ),
  dumbbell: <path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" />,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  flask: <path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 006 21h12a1.7 1.7 0 001.5-2.5L14 9V3M7 15h10" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  book: <path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" />,
  flame: <path d="M12 21c-4 0-7-2.7-7-6.5 0-3 2-5 3.5-6.5.3 2 1.5 3 2.5 3-1-3 .5-6.5 3.5-8 0 3 5.5 5.5 5.5 11.5 0 3.8-3 6.5-8 6.5z" />,
  drop: <path d="M12 3s7 7.5 7 12a7 7 0 01-14 0c0-4.5 7-12 7-12z" />,
  scale: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M8 9a5 5 0 018 0l-3 3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.5 11h11L21 7H6.2" />
      <circle cx="9" cy="19.5" r="1.5" />
      <circle cx="17" cy="19.5" r="1.5" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  refresh: <path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  play: <path d="M7 4l13 8-13 8z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" />,
  volume: <path d="M4 9h4l5-4v14l-5-4H4zM17 8.5a5 5 0 010 7M19.5 6a8.5 8.5 0 010 12" />,
  copy: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V4a1 1 0 00-1-1H4a1 1 0 00-1 1v11a1 1 0 001 1h4" />
    </>
  ),
  wallet: <path d="M3 7a2 2 0 012-2h13v4M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2zM16 14.5h1" />,
  send: <path d="M21 3L3 10.5l7 2.5 2.5 7z M10 13l11-10" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  alert: <path d="M12 3l10 18H2zM12 10v5M12 18v.5" />,
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.6 10.8c.8.6 1.1 1.4 1.1 2.2V17h5v-1c0-.8.3-1.6 1.1-2.2A6 6 0 0012 3z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
};

export function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

// Знак VITALIS: неоновый квадрат с буквой V
export function BrandMark({ size = 30 }) {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path d="M8.5 9.5l7.5 14 7.5-14" fill="none" stroke="#0b0c08" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
