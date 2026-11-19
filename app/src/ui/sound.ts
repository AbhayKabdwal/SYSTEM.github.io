// Small synthesized sounds (Web Audio, no files): System chimes for big moments and
// quiet interface blips for everyday taps. Both can be turned off in More.

const KEY = 'sys:sound';
const UI_KEY = 'sys:uiSound';
let ctx: AudioContext | null = null;

const flag = (key: string) => {
  try {
    return localStorage.getItem(key) !== '0';
  } catch {
    return true;
  }
};

const setFlag = (key: string, on: boolean) => {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* storage blocked */
  }
};

/** All sounds. */
export const soundOn = () => flag(KEY);
export const setSoundOn = (on: boolean) => setFlag(KEY, on);
/** Interface blips (taps, tabs, rows); needs soundOn too. */
export const uiSoundOn = () => flag(UI_KEY);
export const setUiSoundOn = (on: boolean) => setFlag(UI_KEY, on);

type Wave = OscillatorType;
/** One tone: frequency (Hz), start (s), length (s), loudness 0–1, wave, optional glide target. */
type Tone = [freq: number, at: number, dur: number, gain: number, wave?: Wave, glideTo?: number];

/** Big moments: System notices, level-ups, warnings. */
const SYSTEM = {
  chime: [
    [659.25, 0, 0.6, 1],
    [1318.5, 0, 0.6, 0.18, 'triangle'],
    [987.77, 0.11, 0.6, 1],
    [1975.5, 0.11, 0.6, 0.18, 'triangle'],
  ],
  fanfare: [
    [523.25, 0, 0.6, 1],
    [659.25, 0.1, 0.6, 1],
    [783.99, 0.2, 0.6, 1],
    [1046.5, 0.32, 0.7, 1],
    [2093, 0.32, 0.7, 0.15, 'triangle'],
  ],
  warning: [
    [392, 0, 0.45, 1],
    [311.13, 0.16, 0.45, 1],
  ],
} satisfies Record<string, Tone[]>;

/** Everyday interface: short, soft, mostly above speech so they read as "UI", not music. */
const UI = {
  /** Any button: a tiny glassy tick. */
  tap: [[1480, 0, 0.045, 0.22, 'triangle']],
  /** Collapsible row opens: quick upward blip. */
  open: [[740, 0, 0.09, 0.35, 'sine', 1110]],
  /** ...and closes: the same, downward. */
  close: [[1110, 0, 0.08, 0.3, 'sine', 740]],
  /** Tab or page switch: two soft notes. */
  tab: [
    [988, 0, 0.05, 0.28, 'triangle'],
    [1319, 0.045, 0.06, 0.24, 'triangle'],
  ],
  /** A quest task reached its target: bright rising ping, like a coin. */
  tick: [
    [1319, 0, 0.08, 0.45],
    [1976, 0.06, 0.14, 0.4],
  ],
  /** Like: a little pop. */
  pop: [[520, 0, 0.07, 0.5, 'sine', 980]],
  /** Saved: two-note confirm. */
  success: [
    [880, 0, 0.09, 0.4],
    [1175, 0.08, 0.16, 0.38],
  ],
  /** Something failed: low double buzz. */
  error: [
    [220, 0, 0.09, 0.45, 'square'],
    [196, 0.11, 0.12, 0.4, 'square'],
  ],
} satisfies Record<string, Tone[]>;

export type SystemCue = keyof typeof SYSTEM;
export type UiCue = keyof typeof UI;
type Cue = SystemCue | UiCue;

const isUi = (c: Cue): c is UiCue => c in UI;

/** Which System cue suits a notice, from its first line. */
export function cueFor(message: string): SystemCue {
  const head = message.split('\n')[0]!.toUpperCase();
  if (/LEVEL UP|RANK UP|ARISE|PROMOTED|CLEARED|COMPLETE|UNLOCKED|RECORD|SURVIVED/.test(head)) return 'fanfare';
  if (/PENALTY|FAILED|WARNING|AT RISK/.test(head)) return 'warning';
  return 'chime';
}

// Taps can fire faster than the ear needs; skip a cue repeated within this window.
const MIN_GAP_MS = 40;
let last = { cue: '', at: 0 };

export function play(cue: Cue) {
  if (!soundOn() || (isUi(cue) && !uiSoundOn())) return;
  const now = performance.now();
  if (last.cue === cue && now - last.at < MIN_GAP_MS) return;
  last = { cue, at: now };
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + 0.01;
    const master = ctx.createGain();
    // Interface sounds sit well under the System chimes.
    master.gain.value = isUi(cue) ? 0.09 : 0.18;
    master.connect(ctx.destination);
    const tones: readonly Tone[] = isUi(cue) ? UI[cue] : SYSTEM[cue];
    for (const [freq, at, dur, level, wave = 'sine', glideTo] of tones) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, t0 + at);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + at + dur * 0.8);
      g.gain.setValueAtTime(0, t0 + at);
      g.gain.linearRampToValueAtTime(level, t0 + at + Math.min(0.008, dur / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      osc.connect(g).connect(master);
      osc.start(t0 + at);
      osc.stop(t0 + at + dur + 0.02);
    }
  } catch {
    /* audio unavailable: silent */
  }
}

/**
 * One listener for the whole app: buttons tick, tabs and nav switch, rows open and
 * close. Anything can opt out with data-sound="none" or pick a cue with data-sound="pop".
 */
export function installInterfaceSounds() {
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>('button, a.btn, a.list-item, a.nav-btn, label.check');
      if (!el || (el as HTMLButtonElement).disabled) return;
      const chosen = el.dataset.sound;
      if (chosen === 'none') return;
      if (chosen && chosen in UI) return play(chosen as UiCue);
      // Runs before React handles the click, so aria-expanded still shows the old state.
      if (el.classList.contains('coll-head')) return play(el.getAttribute('aria-expanded') === 'true' ? 'close' : 'open');
      if (el.closest('.seg') || el.classList.contains('nav-btn')) return play('tab');
      // The System overlay and full notices make their own sound.
      if (el.closest('.sys-box')) return;
      play('tap');
    },
    { capture: true },
  );
}
