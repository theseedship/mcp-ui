import { defineConfig } from 'vitest/config';
import solidPlugin from '@solidjs/vite-plugin';

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: { conditions: ['browser', 'development'] },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
