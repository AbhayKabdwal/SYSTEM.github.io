import { useId, type ReactElement } from 'react';
import { MUSCLES, type Muscle } from '../../domain';
import frontImg from '../../assets/anatomy-front.png';
import backImg from '../../assets/anatomy-back.png';

// Anatomy art: OpenStax, "Anatomy and Physiology" fig. 11.5 (CC BY 4.0), labels and
// leader lines removed. Regions below are in the image's own pixel space and are
// drawn blurred and clipped to the body, so they read as a heat map, not stickers.

type Shape = { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot?: number; single?: boolean } | { kind: 'path'; d: string; single?: boolean };

const e = (cx: number, cy: number, rx: number, ry: number, rot = 0, single = false): Shape => ({ kind: 'ellipse', cx, cy, rx, ry, rot, single });
const p = (d: string): Shape => ({ kind: 'path', d, single: true });

interface View {
  caption: string;
  src: string;
  w: number;
  h: number;
  /** Mirror axis for paired muscles. */
  mid: number;
  shapes: [Muscle, Shape][];
}

const FRONT: View = {
  caption: 'FRONT',
  src: frontImg,
  w: 396,
  h: 720,
  mid: 199,
  shapes: [
    ['traps', e(172, 122, 18, 7, -25)],
    ['front_delts', e(113, 152, 15, 24, 15)],
    ['side_delts', e(98, 162, 8, 22, 10)],
    ['chest', e(160, 178, 34, 31)],
    ['biceps', e(92, 232, 13, 36, 22)],
    ['forearms', e(63, 318, 12, 40, 25)],
    ['abs', e(199, 282, 24, 62, 0, true)],
    ['obliques', e(146, 270, 12, 42, -5)],
    ['quads', e(163, 425, 27, 62, -4)],
    ['calves', e(163, 565, 15, 48)],
  ],
};

const BACK: View = {
  caption: 'BACK',
  src: backImg,
  w: 361,
  h: 720,
  mid: 182,
  shapes: [
    ['traps', p('M182 88 L232 132 L205 175 L182 250 L159 175 L132 132 Z')],
    ['rear_delts', e(102, 170, 16, 22, -10)],
    ['side_delts', e(88, 178, 8, 22, 10)],
    ['lats', e(140, 235, 24, 50, -18)],
    ['triceps', e(86, 238, 13, 36, 18)],
    ['forearms', e(62, 320, 12, 38, 24)],
    ['lower_back', e(182, 288, 30, 22, 0, true)],
    ['glutes', e(152, 336, 30, 30)],
    ['hamstrings', e(157, 425, 24, 55, -3)],
    ['calves', e(158, 540, 20, 50)],
  ],
};

function mirror(s: Shape, mid: number): Shape {
  if (s.kind === 'ellipse') return { ...s, cx: 2 * mid - s.cx, rot: -(s.rot ?? 0) };
  return s;
}

function draw(s: Shape, props: Record<string, unknown>, key: string): ReactElement {
  if (s.kind === 'ellipse') {
    return <ellipse key={key} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} {...props} />;
  }
  return <path key={key} d={s.d} {...props} />;
}

const both = (v: View) => v.shapes.flatMap(([m, s]) => (s.single ? [[m, s, 0] as const] : [[m, s, 0] as const, [m, mirror(s, v.mid), 1] as const]));

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

function AnatomyView({ view, fatigue, selected, onSelect }: { view: View; fatigue: Record<Muscle, number>; selected: Muscle | null; onSelect: (m: Muscle) => void }) {
  const blurId = `blur${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const mask = { maskImage: `url(${view.src})`, WebkitMaskImage: `url(${view.src})` };
  const shapes = both(view);
  return (
    <figure className="body-map">
      <div className="anatomy" style={{ aspectRatio: `${view.w} / ${view.h}` }}>
        <img src={view.src} alt="" draggable={false} />
        <svg className="heat" viewBox={`0 0 ${view.w} ${view.h}`} style={mask} aria-hidden>
          <defs>
            <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>
          <g filter={`url(#${blurId})`}>
            {shapes.map(([m, s, side], i) => draw(s, { fill: fatigueColor(fatigue[m]) }, `${m}-${i}-${side}`))}
          </g>
        </svg>
        <svg className="hit" viewBox={`0 0 ${view.w} ${view.h}`} role="group" aria-label={`${view.caption.toLowerCase()} muscle map`}>
          {shapes.map(([m, s, side], i) =>
            draw(
              s,
              {
                className: `muscle-hit${selected === m ? ' selected' : ''}`,
                onClick: () => onSelect(m),
                role: 'button',
                tabIndex: side === 0 ? 0 : -1,
                'aria-label': `${label(m)} ${fatigue[m]}%`,
                onKeyDown: (ev: React.KeyboardEvent) => (ev.key === 'Enter' || ev.key === ' ') && onSelect(m),
              },
              `${m}-${i}-${side}`,
            ),
          )}
        </svg>
      </div>
      <figcaption className="body-map-caption">{view.caption}</figcaption>
    </figure>
  );
}

export function BodyMap(props: { fatigue: Record<Muscle, number>; selected: Muscle | null; onSelect: (m: Muscle) => void }) {
  return (
    <div className="body-maps">
      <AnatomyView view={FRONT} {...props} />
      <AnatomyView view={BACK} {...props} />
    </div>
  );
}

export const ANATOMY_CREDIT = {
  text: 'Anatomy art: OpenStax, Anatomy and Physiology, fig. 11.5, CC BY 4.0. Labels removed.',
  url: 'https://commons.wikimedia.org/wiki/File:1105_Anterior_and_Posterior_Views_of_Muscles.jpg',
};
