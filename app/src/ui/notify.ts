import { create } from 'zustand';
import { hapticSuccess } from '../native/haptics';

interface NotifyState {
  toast: string | null;
  sys: string | null;
}

export const useNotify = create<NotifyState>(() => ({ toast: null, sys: null }));

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let sysTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(msg: string) {
  useNotify.setState({ toast: msg });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => useNotify.setState({ toast: null }), 2800);
}

const queue: string[] = [];

function show(msg: string) {
  useNotify.setState({ sys: msg });
  hapticSuccess();
  clearTimeout(sysTimer);
  sysTimer = setTimeout(dismissSystemAlert, 4500);
}

/**
 * Full-screen "SYSTEM NOTIFICATION" for moments that matter. If one is already showing,
 * the next waits its turn, so a level-up isn't hidden by the unlock it caused.
 */
export function systemAlert(msg: string) {
  if (useNotify.getState().sys) {
    if (!queue.includes(msg)) queue.push(msg);
    return;
  }
  show(msg);
}

export function dismissSystemAlert() {
  clearTimeout(sysTimer);
  const next = queue.shift();
  if (next) show(next);
  else useNotify.setState({ sys: null });
}

/** Closes the system alert if one is showing. Returns false if none was. */
export function dismissIfShowing(): boolean {
  if (!useNotify.getState().sys) return false;
  dismissSystemAlert();
  return true;
}

export const pendingAlerts = () => queue.length;
