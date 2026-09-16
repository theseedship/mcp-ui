/**
 * Contract test for the runtime-agnostic `@seed-ship/mcp-ui-solid/adapters/presentation`
 * subpath.
 *
 * Producers (MCP servers on plain Node, zod 4, no solid-js) consume the
 * presentation recipes through this subpath. The recipes are pure functions
 * over caller-supplied components, so the built artifacts must pull in NO
 * runtime dependency at all — not solid-js, not zod, not @seed-ship/mcp-ui-spec.
 * This asserts that against the real build output, so a stray value import in
 * src/adapters/presentation.ts fails the suite instead of shipping.
 *
 * Runs in the repo's default jsdom environment: the assertions only use Node
 * builtins (fs / node:module), and the shared setup file in vitest.config.ts
 * requires a DOM global.
 *
 * The source-level guard below runs without a build; the dist-level guards need
 * one and fail loudly (rather than skipping) when dist/ is absent, so a missing
 * build can never be mistaken for a passing contract.
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const distEsm = resolve(packageRoot, 'dist/adapters/presentation.js')
const distCjs = resolve(packageRoot, 'dist/adapters/presentation.cjs')
const buildRequired =
  `dist/adapters/presentation.{js,cjs} not found under ${packageRoot}/dist. ` +
  `This contract is asserted against real build output — run \`pnpm build\` first ` +
  `(pnpm --filter @seed-ship/mcp-ui-solid build).`

describe('adapters/presentation source contract', () => {
  it('imports nothing at runtime — every import is `import type`', () => {
    const source = readFileSync(resolve(packageRoot, 'src/adapters/presentation.ts'), 'utf8')
    const importLines = source.match(/^import\b.*$/gm) ?? []
    // Sanity: the module does have imports, so an empty match would be a false pass.
    expect(importLines.length).toBeGreaterThan(0)
    const valueImports = importLines.filter((line) => !/^import type\b/.test(line))
    expect(valueImports).toEqual([])
    expect(source).not.toMatch(/\brequire\(/)
    expect(source).not.toMatch(/(?<!\.)\bimport\(/)
  })
})

describe('adapters/presentation subpath build', () => {
  it('is built (dist present)', () => {
    expect(existsSync(distEsm) && existsSync(distCjs), buildRequired).toBe(true)
  })

  it('emits an ESM bundle with no runtime imports', () => {
    expect(existsSync(distEsm), buildRequired).toBe(true)
    const source = readFileSync(distEsm, 'utf8')
    const imports = source.match(/^import\s.*$/gm) ?? []
    const dynamicImports = source.match(/\bimport\(/g) ?? []
    expect(imports).toEqual([])
    expect(dynamicImports).toEqual([])
    expect(source).not.toMatch(/\b(solid-js|zod|@seed-ship\/mcp-ui-spec)\b/)
  })

  it('emits a CJS bundle with no runtime requires', () => {
    expect(existsSync(distCjs), buildRequired).toBe(true)
    const source = readFileSync(distCjs, 'utf8')
    const requires = source.match(/\brequire\(/g) ?? []
    expect(requires).toEqual([])
    expect(source).not.toMatch(/\b(solid-js|zod|@seed-ship\/mcp-ui-spec)\b/)
  })

  it('is loadable from CommonJS Node without solid-js or zod present', () => {
    expect(existsSync(distCjs), buildRequired).toBe(true)
    const require_ = createRequire(import.meta.url)
    const mod = require_(distCjs) as typeof import('./presentation')

    expect(typeof mod.createComparisonLayout).toBe('function')
    expect(typeof mod.createGeographyLayout).toBe('function')
    expect(typeof mod.createEvidenceLayout).toBe('function')

    const layout = mod.createComparisonLayout({
      id: 'subpath-smoke',
      chart: {
        id: 'c',
        type: 'chart',
        params: { type: 'bar', data: { labels: ['A'], datasets: [{ label: 's', data: [1] }] } },
      },
      table: {
        id: 't',
        type: 'table',
        params: { columns: [{ key: 'a', label: 'A' }], rows: [{ a: 1 }] },
      },
    })

    expect(layout.components.map((component) => component.id)).toEqual(['c', 't'])
    expect(layout.components[0].position).toEqual({ colStart: 1, colSpan: 7, rowStart: 1 })
    expect(layout.components[1].position).toEqual({ colStart: 8, colSpan: 5, rowStart: 1 })
    // Node's CJS resolver must not have been asked for a UI runtime: loading the
    // subpath may not have pulled solid-js, zod or the spec into the module
    // registry. (Asserting the module's own cache entry exists would be vacuous —
    // `require()` always populates it.)
    const uiRuntimeModules = Object.keys(require_.cache).filter((id) =>
      /node_modules[\\/](solid-js|zod|@seed-ship)[\\/]/.test(id)
    )
    expect(uiRuntimeModules).toEqual([])
  })

  it('keeps ./validation free of a solid-js runtime import', () => {
    // Regression guard for server consumers of the ./validation subpath: it may
    // depend on the spec (zod), but never on the UI runtime.
    const validationEsm = resolve(packageRoot, 'dist/validation.js')
    const servicesEsm = resolve(packageRoot, 'dist/services/validation.js')
    for (const file of [validationEsm, servicesEsm]) {
      expect(existsSync(file), buildRequired).toBe(true)
      const source = readFileSync(file, 'utf8')
      const solidImports = (source.match(/^import\s.*from\s+"solid-js[^"]*"/gm) ?? [])
      expect(solidImports).toEqual([])
    }
  })
})
