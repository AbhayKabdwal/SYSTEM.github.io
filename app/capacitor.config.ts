import type { CapacitorConfig } from '@capacitor/cli';

// The Android app bundles the same Vite build as the website (dist/).
const config: CapacitorConfig = {
  appId: 'io.github.abhaykabdwal.system',
  appName: 'SYSTEM',
  webDir: 'dist',
  android: {
    backgroundColor: '#040a14',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_system',
      iconColor: '#00c8ff',
    },
  },
};

export default config;
