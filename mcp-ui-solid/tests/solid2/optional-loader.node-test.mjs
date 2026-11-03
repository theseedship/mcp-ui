/** Build-only optional import regression: never invokes a peer API or network. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const req = createRequire(resolve(root, 'package.json'))
const { build } = await import(pathToFileURL(req.resolve('vite')).href)
const cases = [
  ['protomaps-leaflet', 'src/components/MapRenderer.tsx', 'export function leafletLayer() {}'],
  ['@duckdb/duckdb-wasm', 'src/plugins/duckdb.ts', 'export function getJsDelivrBundles() {}; export function selectBundle() {}; export class AsyncDuckDB {}; export class ConsoleLogger {}'],
]

for (const [peer, file, installedAPI] of cases) for (const mode of ['installed-api-stub', 'absent-optional-stub']) {
  test(`${peer}: actual source namespace import bundles with ${mode}, without running an engine`, async () => {
    const source = await readFile(resolve(root, file), 'utf8')
    const expression = [...source.matchAll(/import\(\s*(?:\/\*[\s\S]*?\*\/\s*)?(['"])([^'"]+)\1\s*\)/g)]
      .find(match => match[2] === peer)?.[0]
    assert(expression, 'Actual production-source dynamic import was not found')
    assert(!expression.includes('@vite-ignore'), 'Bare import must not bypass the host bundler')
    const entry = resolve(root, 'readonly-optional-loader-probe.js')
    const result = await build({ root, configFile: false, logLevel: 'silent', plugins: [{
      name: 'optional-api-shape-fixtures',
      resolveId(id) {
        if (id === entry) return '\0optional-loader-entry'
        if (id === peer) return '\0optional-peer-api-shape'
      },
      load(id) {
        if (id === '\0optional-loader-entry') return `export const load = () => ${expression};`
        if (id === '\0optional-peer-api-shape') return mode === 'installed-api-stub' ? installedAPI : 'export default {};'
      },
    }], build: { write: false, minify: false, lib: { entry, formats: ['es'] } } })
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(build => build.output || [])
    const chunks = outputs.filter(output => output.type === 'chunk')
    assert(chunks.length >= 2, 'Dynamic optional peer was not emitted as a separate chunk')
    for (const chunk of chunks) {
      const imports = [...chunk.code.matchAll(/import\(\s*(['"`])([^'"`]+)\1/g)].map(match => match[2])
      assert(!imports.includes(peer), `Output retained unresolvable browser bare import ${peer}`)
    }
  })
}
