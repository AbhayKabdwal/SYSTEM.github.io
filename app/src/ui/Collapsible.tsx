import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/** A page can ask one section to open (and scroll into view), e.g. from a feature guide's SHOW ME. */
export const OpenSection = createContext<string | null>(null);

const KEY = 'sys:open:';

function readOpen(id: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(KEY + id);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

/**
 * A card that shows one summary line until tapped. Remembers open/closed per device,
 * so the Status page stays short for new hunters and tidy for regulars.
 */
export function Collapsible({
  id,
  title,
  summary,
  icon,
  defaultOpen = false,
  accent,
  forceOpen,
  children,
}: {
  id: string;
  title: string;
  summary?: ReactNode;
  icon?: string;
  defaultOpen?: boolean;
  accent?: string;
  /** Open on first render whatever was remembered (e.g. arriving from a link). */
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const wanted = useContext(OpenSection) === id;
  const [open, setOpen] = useState(() => forceOpen || wanted || readOpen(id, defaultOpen));
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!wanted) return;
    setOpen(true);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [wanted]);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(KEY + id, o ? '0' : '1');
      } catch {
        /* storage blocked: still toggles for this visit */
      }
      return !o;
    });
  };
  return (
    <section ref={ref} className={`card collapsible${open ? ' open' : ''}`} style={accent ? { borderColor: accent } : undefined}>
      <button className="coll-head" onClick={toggle} aria-expanded={open}>
        {icon && (
          <span className="coll-icon" aria-hidden style={accent ? { color: accent } : undefined}>
            {icon}
          </span>
        )}
        <span className="coll-title">{title}</span>
        {!open && summary && <span className="coll-sum">{summary}</span>}
        <span className="coll-chev" aria-hidden>
          ›
        </span>
      </button>
      {open && <div className="card-body coll-body">{children}</div>}
    </section>
  );
}
