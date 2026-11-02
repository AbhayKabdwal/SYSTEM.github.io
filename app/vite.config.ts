/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the build works from any GitHub Pages sub-path.
  base: './',
  test: {
    include: ['src/**/*.test.ts'],
    // Fixed zone so the local-vs-UTC date tests mean something.
    env: { TZ: 'Asia/Kolkata' },
  },
});
