import { defineConfig } from 'vite'
import solid from '@solidjs/vite-plugin'
import tailwind from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const hostPackage = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
// The Solid plugin intentionally leaves source-condition packages unbundled.
// Vite recommends explicitly optimizing their nested CommonJS dependencies.
// Only actual explicit host dependencies are included; optional-absent stays empty.
const nestedCommonJS = ['leaflet', 'leaflet.markercluster', '@antv/g6', 'highlight.js', 'chart.js', 'chart.js/auto', 'chartjs-plugin-zoom']
  .filter(name => Object.hasOwn(hostPackage.dependencies, name === 'chart.js/auto' ? 'chart.js' : name))
  .map(name => `@seed-ship/mcp-ui-solid > ${name}`)

export default defineConfig({
  plugins: [solid({ start: { node: true, middleware: './src/middleware.ts' }, ssr: true }), tailwind()],
  // Compile the package's public `solid` source condition for both SSR and
  // hydration. No source aliases and no access to the library workspace.
  ssr: { noExternal: ['@seed-ship/mcp-ui-solid', '@seed-ship/mcp-ui-spec'] },
  optimizeDeps: { include: nestedCommonJS },
  server: { host: '127.0.0.1' },
})
