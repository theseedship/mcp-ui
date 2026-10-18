// @vitest-environment node
/**
 * Compatibility smoke for Solid's Seroval security updates, not an exploit test.
 * The normal Vitest JSX pipeline targets the DOM, so use the same real-server
 * setup as TableRenderer.missing.ssr.test.ts instead of its renderToString stub.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SerializationPayload } from '../test-support/ssr/security-serialization-entry'

type Entry = typeof import('../test-support/ssr/security-serialization-entry')

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const solidPackage = createRequire(import.meta.url).resolve('solid-js/package.json')
const solidDir = dirname(solidPackage)
// Exercise the Seroval actually owned by Solid, without adding a direct dep.
const seroval = createRequire(solidPackage)('seroval') as {
  toJSONAsync(value: unknown): Promise<unknown>
  fromJSON<T>(value: unknown): T
}

const payload = (): SerializationPayload => ({
  labels: new Map([['status', 'serialization-ready']]),
  created: new Date('2026-10-18T12:34:56.000Z'),
  bytes: new Uint8Array([0, 42, 255]),
  ready: Promise.resolve('promise-ready'),
})

let server: ViteDevServer
let render: Entry['renderSerializedResource']

beforeAll(async () => {
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: {
      alias: [
        { find: /^solid-js$/, replacement: resolve(solidDir, 'dist/server.js') },
        { find: /^solid-js\/web$/, replacement: resolve(solidDir, 'web/dist/server.js') },
        { find: /^solid-js\/store$/, replacement: resolve(solidDir, 'store/dist/server.js') },
      ],
    },
    plugins: [solidPlugin({ ssr: true })],
  })
  const entry = (await server.ssrLoadModule(
    '/test-support/ssr/security-serialization-entry.tsx',
  )) as Entry
  render = entry.renderSerializedResource
}, 60_000)

afterAll(async () => {
  await server?.close()
})

describe('Solid / Seroval security-update compatibility', () => {
  it('really server-renders an async resource and emits hydration serialization', async () => {
    const { html, isServer } = await render(payload())

    expect(isServer).toBe(true)
    expect(html).toContain('data-security-serialization')
    expect(html).toContain('serialization-ready')
    expect(html).toContain('2026-10-18T12:34:56.000Z')
    expect(html).toContain('0,42,255')
    expect(html).not.toContain('Loading serialization fixture')
    // These values must also pass through Solid's hydration serializer, not
    // only through text rendering. The nested promise is not read in JSX.
    expect(html).toContain('<script')
    expect(html).toContain('new Map(')
    expect(html).toContain('new Date(')
    expect(html).toContain('new Uint8Array(')
    expect(html).toContain('promise-ready')
  })

  it('roundtrips legitimate JSON with maps, dates, typed arrays and promises', async () => {
    const encoded = await seroval.toJSONAsync(payload())
    // Emulate the JSON transport boundary, not an in-memory object roundtrip.
    const decoded = seroval.fromJSON<SerializationPayload>(
      JSON.parse(JSON.stringify(encoded)),
    )

    expect(decoded.labels).toBeInstanceOf(Map)
    expect(decoded.labels.get('status')).toBe('serialization-ready')
    expect(decoded.created).toBeInstanceOf(Date)
    expect(decoded.created.toISOString()).toBe('2026-10-18T12:34:56.000Z')
    expect(decoded.bytes).toBeInstanceOf(Uint8Array)
    expect(Array.from(decoded.bytes)).toEqual([0, 42, 255])
    expect(decoded.ready).toBeInstanceOf(Promise)
    await expect(decoded.ready).resolves.toBe('promise-ready')
  })
})
