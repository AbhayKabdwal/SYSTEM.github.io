import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { closeTopDialog } from '../ui/components';
import { dismissIfShowing, systemAlert, toast } from '../ui/notify';
import { useSession } from '../state/session';
import { isNative, NATIVE_AUTH_URL } from './platform';

/** Wires the Android shell: status bar, back button and auth deep links. No-op on the web. */
export function initNative() {
  if (!isNative) return;

  void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
  void StatusBar.setBackgroundColor({ color: '#040a14' }).catch(() => undefined);

  // Back closes what's on top first, then walks the router history, then leaves the app.
  void App.addListener('backButton', () => {
    if (dismissIfShowing() || closeTopDialog()) return;
    const atHome = location.hash === '' || location.hash === '#/' || location.hash === '#';
    if (atHome) void App.minimizeApp();
    else history.back();
  });

  const handle = async (url: string) => {
    if (!url.startsWith(NATIVE_AUTH_URL)) return;
    try {
      await useSession.getState().completeAuthLink(url);
      location.hash = '#/account';
      if (!useSession.getState().passwordRecovery) systemAlert('EMAIL CONFIRMED\nYou are signed in.');
    } catch (e) {
      location.hash = '#/account';
      toast(`SIGN-IN LINK FAILED: ${(e as Error).message}`);
    }
  };
  void App.addListener('appUrlOpen', ({ url }) => void handle(url));
  // Cold start from a link: the event may have fired before the listener existed.
  void App.getLaunchUrl().then((r) => {
    if (r?.url) void handle(r.url);
  });
}
