// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import solidPlugin from '@solidjs/vite-plugin'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type Entry = typeof import('../../test-support/ssr/error-boundary-entry')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
let server: ViteDevServer
let render: Entry['renderBoundaryToString']

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
  const entry = await server.ssrLoadModule('/test-support/ssr/error-boundary-entry.tsx') as Entry
  render = entry.renderBoundaryToString
}, 60_000)

afterAll(async () => { await server?.close() })

describe('GenerativeUIErrorBoundary — real SSR', () => {
  it('notifies onError exactly once and safely renders the fallback exactly once', () => {
    const { html, errors, fallbackCalls } = render()
    expect(fallbackCalls).toBe(1)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      type: 'render', message: '<unsafe-error>', componentId: 'ssr-generic-boundary',
      details: { renderDuration: 0, retryCount: 0, userAgent: 'server', viewport: { width: 0, height: 0 } },
    })
    expect(html).toContain('data-error-fallback')
    expect(html).toContain('&lt;unsafe-error>')
    expect(html).not.toContain('<unsafe-error>')
  })
})
