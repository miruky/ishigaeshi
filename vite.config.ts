import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages配信時はワークフローが ISHIGAESHI_BASE=/ishigaeshi/ を与える。
  base: process.env.ISHIGAESHI_BASE ?? '/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
