import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { dismissSystemAlert, useNotify } from './notify';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <div className="card-body">{children}</div>
    </section>
  );
}

export const Sec = ({ children }: { children: ReactNode }) => <h2 className="sec">{children}</h2>;

export function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="bar-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Open dialogs, innermost last: only the top one reacts to Escape. */
const dialogStack: symbol[] = [];

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const me = Symbol(title);
    dialogStack.push(me);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dialogStack[dialogStack.length - 1] === me && closeRef.current();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      dialogStack.splice(dialogStack.indexOf(me), 1);
    };
  }, [title]);
  // Portalled so it covers the header and nav, not just the scroll area.
  return createPortal(
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Notifications() {
  const { toast, sys } = useNotify();
  return (
    <>
      {sys && (
        <div className="overlay" onClick={dismissSystemAlert} role="alertdialog" aria-live="assertive">
          <div className="sys-box">
            <div className="sys-title">▲ SYSTEM NOTIFICATION ▲</div>
            <div className="sys-msg">{sys}</div>
            <div className="sys-sub">— TAP TO DISMISS —</div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}

export const ErrorText = ({ error }: { error: string | null | undefined }) => (error ? <div className="error" role="alert">{error}</div> : null);
