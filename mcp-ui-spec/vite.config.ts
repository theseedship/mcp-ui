import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        schemas: resolve(__dirname, 'src/schemas/index.ts'),
      },
      name: 'McpUiSpec',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['zod'],
    },
    sourcemap: true,
    minify: false,
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
