import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        cli: resolve(__dirname, 'src/cli.ts'),
      },
      name: 'McpUiCli',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'fs',
        'path',
        'url',
        'process',
        'commander',
        'ajv',
        'chalk',
        'ora',
        'json-schema-to-typescript',
        '@seed-ship/mcp-ui-spec',
      ],
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
