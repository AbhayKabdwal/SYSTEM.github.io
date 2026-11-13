import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/orbitron/400.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import './ui/theme.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import { isNative } from './native/platform';
import { initNative } from './native/init';

// Website: new versions activate on the next launch instead of being stuck behind a stale cache
// (v1's problem). The Android app ships its files inside the APK and needs no service worker.
if (isNative) initNative();
else registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
