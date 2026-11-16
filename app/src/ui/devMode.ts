// Developer mode: unlocked by tapping the version in More seven times. Per device.

const DEV_KEY = 'sys:dev';

export const devMode = () => {
  try {
    return localStorage.getItem(DEV_KEY) === '1';
  } catch {
    return false;
  }
};

export function setDevMode(on: boolean) {
  try {
    if (on) localStorage.setItem(DEV_KEY, '1');
    else localStorage.removeItem(DEV_KEY);
  } catch {
    /* storage blocked */
  }
}
