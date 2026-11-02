import type { ReactElement } from 'react';
import { MUSCLES, type Muscle } from '../../domain';

// Stylised anatomy on a 100×200 grid per view. Shapes are drawn for the viewer's
// left side and mirrored, so both sides always match.

type Shape = { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot?: number } | { kind: 'path'; d: string };

const e = (cx: number, cy: number, rx: number, ry: number, rot = 0): Shape => ({ kind: 'ellipse', cx, cy, rx, ry, rot });
const p = (d: string): Shape => ({ kind: 'path', d });

const FRONT: [Muscle, Shape][] = [
  ['traps', p('M44 25 L37 31 L45 31 Z')],
  ['front_delts', e(32.5, 36, 5.2, 6.5, 15)],
  ['side_delts', e(27.5, 38, 2.8, 6, 10)],
  ['chest', p('M49.5 32 L38 33.5 Q34.5 41 38 47 Q44 49.5 49.5 47.5 Z')],
  ['biceps', e(28, 53, 4, 9, 8)],
  ['forearms', e(24, 73, 3.8, 10.5, 10)],
  ['abs', p('M44.5 50 L49.5 50 L49.5 79 Q46 79 44.5 76 Z')],
  ['obliques', p('M38.5 50 L43.5 51 L43.5 75 Q39.5 70 38.5 62 Z')],
  ['quads', p('M38 86 Q36 104 39 128 L45.5 128 Q48.5 106 47 88 Z')],
  ['calves', e(41.5, 151, 4, 13)],
];

const BACK: [Muscle, Shape][] = [
  ['traps', p('M50 23 L39 31 L44 35 L50 52 Z')],
  ['rear_delts', e(32.5, 36, 5.2, 6.5, -15)],
  ['side_delts', e(27.5, 38, 2.8, 6, 10)],
  ['lats', p('M38.5 39 L44 36 L49.5 55 L49.5 64 L42 63 Q36.5 52 38.5 39 Z')],
  ['triceps', e(28, 53, 4, 9, 8)],
  ['forearms', e(24, 73, 3.8, 10.5, 10)],
  ['lower_back', p('M43 64 L49.5 65 L49.5 80 L42 80 Q41 72 43 64 Z')],
  ['glutes', e(43, 89, 7.5, 8)],
  ['hamstrings', p('M37.5 98 Q36.5 112 39.5 130 L45.5 130 Q48 113 47.5 98 Z')],
  ['calves', e(41.5, 148, 5, 12)],
];

/** Silhouette under the muscles, also mirrored. */
const BASE_HALF = [
  'M50 23 L44 25 Q36 28 30 31 Q24 34 24 42 L22 60 L19 84 Q19 88 22 88 L27 66 L31 48 L35 50 L37 74 L36 90 L36 104 L38 132 L37 164 L39 178 L46 178 L46 166 L47 134 L49 104 L50 96 Z',
];

function mirror(s: Shape): Shape {
  if (s.kind === 'ellipse') return { ...s, cx: 100 - s.cx, rot: -(s.rot ?? 0) };
  // Flip x of every coordinate pair in an absolute path.
  const d = s.d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${100 - Number(x)} ${y}`);
  return { kind: 'path', d };
}

function draw(s: Shape, props: Record<string, unknown>, key: string): ReactElement {
  if (s.kind === 'ellipse') {
    return <ellipse key={key} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} {...props} />;
  }
  return <path key={key} d={s.d} {...props} />;
}

/** fresh → worked → strained → overloaded */
export function fatigueColor(pct: number): string {
  if (pct < 5) return 'rgba(0, 200, 255, 0.10)';
  if (pct < 25) return `rgba(0, 200, 255, ${0.15 + pct / 100})`;
  if (pct < 55) return `rgba(61, 255, 160, ${0.35 + (pct - 25) / 80})`;
  if (pct < 80) return `rgba(255, 215, 0, ${0.5 + (pct - 55) / 80})`;
  return `rgba(255, 64, 96, ${0.65 + (pct - 80) / 60})`;
}

export const LEGEND = [
  { label: 'Fresh', color: fatigueColor(10) },
  { label: 'Worked', color: fatigueColor(40) },
  { label: 'Strained', color: fatigueColor(70) },
  { label: 'Overloaded', color: fatigueColor(95) },
];

const label = (m: Muscle) => MUSCLES.find((x) => x.id === m)!.label;

function View({
  shapes,
  fatigue,
  selected,
  onSelect,
  caption,
}: {
  shapes: [Muscle, Shape][];
  fatigue: Record<Muscle, number>;
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
  caption: string;
}) {
  return (
    <figure className="body-map">
      <svg viewBox="10 4 80 180" role="group" aria-label={`${caption} muscle map`}>
        <circle className="base" cx="50" cy="13" r="8.5" />
        {BASE_HALF.map((d, i) => (
          <g key={i}>
            <path className="base" d={d} />
            <path className="base" d={(mirror(p(d)) as { d: string }).d} />
          </g>
        ))}
        {shapes.flatMap(([m, s], i) =>
          [s, mirror(s)].map((shape, side) =>
            draw(
              shape,
              {
                className: `muscle${selected === m ? ' selected' : ''}`,
                fill: fatigueColor(fatigue[m]),
                onClick: () => onSelect(m),
                role: 'button',
                tabIndex: side === 0 ? 0 : -1,
                'aria-label': `${label(m)} ${fatigue[m]}%`,
                onKeyDown: (ev: React.KeyboardEvent) => (ev.key === 'Enter' || ev.key === ' ') && onSelect(m),
              },
              `${m}-${i}-${side}`,
            ),
          ),
        )}
      </svg>
      <figcaption className="body-map-caption">{caption}</figcaption>
    </figure>
  );
}

export function BodyMap(props: { fatigue: Record<Muscle, number>; selected: Muscle | null; onSelect: (m: Muscle) => void }) {
  return (
    <div className="body-maps">
      <View shapes={FRONT} caption="FRONT" {...props} />
      <View shapes={BACK} caption="BACK" {...props} />
    </div>
  );
}
