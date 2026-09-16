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
        adapters: resolve(__dirname, 'src/adapters/index.ts'),
        'adapters/presentation': resolve(__dirname, 'src/adapters/presentation.ts'),
        'plugins/duckdb': resolve(__dirname, 'src/plugins/duckdb.ts'),
      },
      name: 'McpUiSolid',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // Externalize EVERY bare specifier. With `preserveModules`, an allow-list
      // silently inlined the whole dependency tree (@antv/g6, leaflet,
      // highlight.js, zod, @seed-ship/mcp-ui-spec, ...) under
      // `dist/node_modules/.pnpm/**` — 39.8 MB / 5428 files published.
      // Anything that is not a relative path, an absolute path, a rollup
      // virtual module (\0) or a Windows drive path is a package import and
      // must stay an import in the output. This also covers CSS side-imports
      // such as 'leaflet/dist/leaflet.css' and 'highlight.js/styles/github.css',
      // which sit in browser-only `await import()` branches.
      external: (id: string) =>
        !id.startsWith('.') &&
        !id.startsWith('/') &&
        !id.startsWith('\0') &&
        !/^[A-Za-z]:\\/.test(id),
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
