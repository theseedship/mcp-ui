import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    solidPlugin({
      // DOM mode: generates client-side code with real DOM elements
      // SolidStart handles SSR separately; packages should export client code
      solid: {
        generate: 'dom',
        hydratable: true,
      },
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        components: resolve(__dirname, 'src/components/index.ts'),
        hooks: resolve(__dirname, 'src/hooks/index.ts'),
        types: resolve(__dirname, 'src/types/index.ts'),
        validation: resolve(__dirname, 'src/validation.ts'),
        'types-export': resolve(__dirname, 'src/types-export.ts'),
      },
      name: 'McpUiSolid',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'solid-js',
        'solid-js/web',
        'solid-js/store',
        'chart.js',
        'chart.js/auto',
      ],
      output: {
        globals: {
          'solid-js': 'SolidJS',
          'solid-js/web': 'SolidJSWeb',
          'solid-js/store': 'SolidJSStore',
          'chart.js': 'Chart',
          'chart.js/auto': 'Chart',
        },
        preserveModules: true, // Preserve directory structure for proper sub-exports
        preserveModulesRoot: 'src',
      },
    },
    sourcemap: true,
    minify: false, // Don't minify library code
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
