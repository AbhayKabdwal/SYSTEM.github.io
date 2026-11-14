import { useState, type ReactNode } from 'react';

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
  children,
}: {
  id: string;
  title: string;
  summary?: ReactNode;
  icon?: string;
  defaultOpen?: boolean;
  accent?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));
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
    <section className={`card collapsible${open ? ' open' : ''}`} style={accent ? { borderColor: accent } : undefined}>
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
