import { Capacitor } from '@capacitor/core';

/** True inside the Android app, false on the website. */
export const isNative = Capacitor.isNativePlatform();

export const APP_ID = 'io.github.abhaykabdwal.system';
/** Auth emails send the app here; Android routes the link back into the app. */
export const NATIVE_AUTH_URL = `${APP_ID}://auth`;
