/// <reference types="vitest" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  // Relative base so the build works from any GitHub Pages sub-path.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'SYSTEM — Hunter Training Tracker',
        short_name: 'SYSTEM',
        description: 'Daily quests, ranks, skill trees and a muscle fatigue map. Private by default.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#040a14',
        theme_color: '#040a14',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        // Never cache API traffic: it is authenticated and must be fresh.
        navigateFallbackDenylist: [/^\/auth/, /^\/rest/],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    // Fixed zone so the local-vs-UTC date tests mean something.
    env: { TZ: 'Asia/Kolkata' },
  },
});
