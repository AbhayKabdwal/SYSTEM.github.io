// Small synthesized System sounds (Web Audio, no files). Off with the Sound toggle in More.

const KEY = 'sys:sound';
let ctx: AudioContext | null = null;

export const soundOn = () => {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
};

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* storage blocked */
  }
}

type Cue = 'chime' | 'fanfare' | 'warning';

/** Notes (Hz) and their start offsets (s) for each cue. */
const CUES: Record<Cue, [number, number][]> = {
  chime: [
    [659.25, 0],
    [987.77, 0.11],
  ],
  fanfare: [
    [523.25, 0],
    [659.25, 0.1],
    [783.99, 0.2],
    [1046.5, 0.32],
  ],
  warning: [
    [392, 0],
    [311.13, 0.16],
  ],
};

/** Which cue suits a System notice, from its first line. */
export function cueFor(message: string): Cue {
  const head = message.split('\n')[0]!.toUpperCase();
  if (/LEVEL UP|RANK UP|ARISE|PROMOTED|CLEARED|COMPLETE|UNLOCKED|RECORD|SURVIVED/.test(head)) return 'fanfare';
  if (/PENALTY|FAILED|WARNING|AT RISK/.test(head)) return 'warning';
  return 'chime';
}

export function play(cue: Cue) {
  if (!soundOn()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    for (const [freq, at] of CUES[cue]) {
      for (const [mult, level, type] of [
        [1, 1, 'sine'],
        [2, 0.18, 'triangle'],
      ] as const) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq * mult;
        g.gain.setValueAtTime(0, t0 + at);
        g.gain.linearRampToValueAtTime(level, t0 + at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + (cue === 'warning' ? 0.45 : 0.6));
        osc.connect(g).connect(master);
        osc.start(t0 + at);
        osc.stop(t0 + at + 0.7);
      }
    }
  } catch {
    /* audio unavailable: silent */
  }
}
