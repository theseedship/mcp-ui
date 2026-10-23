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
import solidPlugin from "@solidjs/vite-plugin";
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

type Entry = typeof import('../../test-support/ssr/table-entry')

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

let server: ViteDevServer
let render: Entry['renderTableToString']
let renderValidation: Entry['renderValidationToString']

beforeAll(async () => {
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: {
      noExternal: ['solid-js', '@solidjs/web', '@solidjs/signals'],
      resolve: { conditions: ['node', 'development'] },
    },
    plugins: [solidPlugin({ ssr: true })],
  })
  const mod = (await server.ssrLoadModule('/test-support/ssr/table-entry.tsx')) as Entry
  render = mod.renderTableToString
  renderValidation = mod.renderValidationToString
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
  it('blocks a known malicious iframe and reports validation synchronously even in silent mode', () => {
    for (const mode of ['block', 'silent'] as const) {
      const result = renderValidation({ id: 'ssr-invalid-frame', type: 'iframe', params: {
        url: 'javascript:alert(1)', title: 'Unsafe frame',
      }, position: { colStart: 1, colSpan: 12 } }, mode)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toMatchObject({ type: 'validation', componentId: 'ssr-invalid-frame' })
      expect(result.html).not.toMatch(/<iframe\b/i)
      expect(result.html).not.toMatch(/(?:src|href)="javascript:/i)
      if (mode === 'block') expect(result.html).toContain('Validation Error')
      else expect(result.html).not.toContain('Validation Error')
    }
  })

  it('keeps unknown components visible under silent mode and reports their validation failure', () => {
    const result = renderValidation({ id: 'ssr-unknown', type: 'invented-component', params: {},
      position: { colStart: 1, colSpan: 12 } }, 'silent')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({ type: 'validation', componentId: 'ssr-unknown' })
    expect(result.html).toContain('invented-component')
    expect(result.html).toContain('Unsupported component type')
    expect(result.html).not.toMatch(/<iframe\b|<script\b/i)
  })

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
