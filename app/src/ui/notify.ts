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

/** Full-screen "SYSTEM NOTIFICATION" for moments that matter. */
export function systemAlert(msg: string) {
  useNotify.setState({ sys: msg });
  hapticSuccess();
  clearTimeout(sysTimer);
  sysTimer = setTimeout(() => useNotify.setState({ sys: null }), 4500);
}

export const dismissSystemAlert = () => useNotify.setState({ sys: null });

/** Closes the system alert if one is showing. Returns false if none was. */
export function dismissIfShowing(): boolean {
  if (!useNotify.getState().sys) return false;
  dismissSystemAlert();
  return true;
}
