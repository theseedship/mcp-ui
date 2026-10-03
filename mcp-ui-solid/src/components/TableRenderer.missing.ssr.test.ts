// @vitest-environment node
/**
 * SSR contract for missing table cells (v6.24.0): the marker, the
 * visually-hidden wording and the legend are in the SERVER html.
 *
 * `renderToString` is a stub in the DOM build vitest compiles for, so the
 * entry module is loaded through a Vite SSR server (Solid's `generate: 'ssr'`
 * transform + the server build of solid-js) — a genuine server render.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'

type Entry = typeof import('../../test-support/ssr/table-entry')

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// Pin Solid to its SERVER builds: the plugin's dev conditions would otherwise
// resolve `solid-js` to dev.js next to web/dist/server.js (two runtimes).
const solidDir = dirname(createRequire(import.meta.url).resolve('solid-js/package.json'))
const solidServer = [
  { find: /^solid-js$/, replacement: resolve(solidDir, 'dist/server.js') },
  { find: /^solid-js\/web$/, replacement: resolve(solidDir, 'web/dist/server.js') },
  { find: /^solid-js\/store$/, replacement: resolve(solidDir, 'store/dist/server.js') },
]

let server: ViteDevServer
let render: Entry['renderTableToString']

beforeAll(async () => {
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: solidServer },
    plugins: [solidPlugin({ ssr: true })],
  })
  const mod = (await server.ssrLoadModule('/test-support/ssr/table-entry.tsx')) as Entry
  render = mod.renderTableToString
}, 60_000)

afterAll(async () => {
  await server?.close()
})

const table = (rows: Array<Record<string, unknown>>) => ({
  id: 'ssr-table',
  type: 'table',
  position: { colStart: 1, colSpan: 12 },
  params: { columns: [{ key: 'name', label: 'Name' }, { key: 'qty', label: 'Qty' }], rows },
})

describe('TableRenderer missing cells — SSR', () => {
  it('renders the marker, the hidden wording and the legend for a null cell', () => {
    const html = render(table([{ name: 'Alpha', qty: null }, { name: 'Beta', qty: 3 }]))
    expect(html).toContain('data-mcp-missing-value')
    expect(html).toContain('Missing value')
    expect(html).toContain('data-mcp-missing-legend')
    expect(html).toContain('marks a missing value')
  })

  it('honours provider wording on the server', () => {
    const html = render(table([{ name: 'Alpha', qty: null }]), {
      missingValue: 'Valeur manquante',
      missingValueLegend: 'Légende {marker}',
    })
    expect(html).toContain('Valeur manquante')
    expect(html).toContain('Légende -')
  })

  it('emits neither marker nor legend when no cell is missing', () => {
    const html = render(table([{ name: 'Alpha', qty: 0 }]))
    expect(html).toContain('Alpha')
    expect(html).not.toContain('data-mcp-missing-value')
    expect(html).not.toContain('data-mcp-missing-legend')
  })
})
