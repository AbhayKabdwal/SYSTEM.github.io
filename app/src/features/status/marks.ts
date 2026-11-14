import type { DayStatus } from '../../domain';

/** How each day's result is drawn in week strips, archives and the plan. */
export const DAY_MARK: Record<DayStatus | 'future', { icon: string; label: string; color: string }> = {
  verified: { icon: '✓', label: 'Cleared with proof', color: 'var(--grn)' },
  unverified: { icon: '◐', label: 'Cleared, no proof', color: 'var(--gold)' },
  rest: { icon: '☾', label: 'Rest day', color: 'var(--glow)' },
  shielded: { icon: '🛡', label: 'Missed, Streak Shield used', color: 'var(--glow)' },
  missed: { icon: '✗', label: 'Missed', color: 'var(--red)' },
  open: { icon: '•', label: 'Today', color: 'var(--bright)' },
  future: { icon: '', label: '', color: 'var(--dim)' },
};
