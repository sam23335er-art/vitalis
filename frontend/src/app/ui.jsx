import { t } from '../i18n.jsx';

// Перевод строковых пропсов; JSX и числа возвращаются как есть
const tr = (v) => (typeof v === 'string' ? t(v) : v);
// Компоненты интерфейса кабинета
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/ui.jsx';

export { Icon };

export const Spinner = ({ small = false }) => <span className={`spinner ${small ? 'spinner-sm' : ''}`} aria-label={t('Загрузка')} />;

export function Card({ title, icon, action, className = '', children, pad = true }) {
  return (
    <section className={`card ${pad ? '' : 'card-flush'} ${className}`}>
      {(title || action) && (
        <header className="card-head">
          {title && (
            <h2>
              {icon && <Icon name={icon} size={18} />} {tr(title)}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHead({ title, text, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{tr(title)}</h1>
        {text && <p>{tr(text)}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function Btn({ variant = 'primary', size, icon, loading, children, className = '', ...rest }) {
  return (
    <button className={`abtn abtn-${variant} ${size ? `abtn-${size}` : ''} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading ? <Spinner small /> : icon && <Icon name={icon} size={16} />}
      {children && <span>{tr(children)}</span>}
    </button>
  );
}

export function Field({ label, error, hint, children, className = '' }) {
  return (
    <label className={`afield ${error ? 'has-error' : ''} ${className}`}>
      {label && <span className="afield-label">{tr(label)}</span>}
      {children}
      {error ? <small className="afield-error">{tr(error)}</small> : hint ? <small className="afield-hint">{tr(hint)}</small> : null}
    </label>
  );
}

export function Empty({ icon = 'info', title, text, children }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{tr(title)}</h3>
      {text && <p>{tr(text)}</p>}
      {children}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-error">
      <Icon name="alert" size={18} />
      <span>{tr(error.message || String(error))}</span>
      {onRetry && (
        <button className="link-btn" onClick={onRetry}>
          {t('Повторить')}
        </button>
      )}
    </div>
  );
}

export function Progress({ value, max, tone = 'accent', label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <div className="progress" aria-label={label} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={Math.round(max)}>
      <div className={`progress-bar tone-bg-${over ? 'bad' : tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Modal({ open, title, onClose, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={tr(title)}>
        <header className="modal-head">
          <h2>{tr(title)}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('Закрыть')}>
            <Icon name="x" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// Кнопка с подтверждением вторым нажатием — без системных диалогов
export function ConfirmBtn({ onConfirm, children, confirmText, icon = 'trash', variant = 'ghost', size = 'sm', ...rest }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <Btn
      variant={armed ? 'danger' : variant}
      size={size}
      icon={icon}
      loading={busy}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setBusy(true);
        try {
          await onConfirm();
        } finally {
          setBusy(false);
          setArmed(false);
        }
      }}
      {...rest}
    >
      {armed ? t(confirmText || 'Точно удалить?') : children === undefined ? t('Удалить') : typeof children === 'string' ? t(children) : children}
    </Btn>
  );
}

export function Tabs({ value, onChange, items }) {
  return (
    <div className="atabs" role="tablist">
      {items.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={value === v} className={value === v ? 'is-active' : ''} onClick={() => onChange(v)}>
          {tr(label)}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children }) {
  return (
    <button type="button" className={`achip ${active ? 'is-active' : ''}`} onClick={onClick} aria-pressed={active}>
      {tr(children)}
    </button>
  );
}

export const Macro = ({ n }) => (
  <span className="macro-line">
    <b>{n.kcal}</b> {t('ккал')} · {t('Б')} {n.p} · {t('Ж')} {n.f} · {t('У')} {n.c}
  </span>
);
