import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { preloadDuckDB } from './duckdb'

const state = vi.hoisted(() => ({
  defaultValue: undefined as unknown,
  bundles: vi.fn(() => { throw new Error('fixture-stop-before-worker') }),
  select: vi.fn(), database: vi.fn(), logger: vi.fn(),
}))
vi.mock('@duckdb/duckdb-wasm', () => ({
  get default() { return state.defaultValue },
  getJsDelivrBundles: state.bundles,
  selectBundle: state.select,
  AsyncDuckDB: state.database,
  ConsoleLogger: state.logger,
}))
let errorLog: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  errorLog = vi.spyOn(console, 'error')
  state.defaultValue = undefined
  // Deliberately exercise the loader with module API stubs, never a real
  // database. The normal test-environment guard remains unchanged in source.
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('VITEST', 'false')
  vi.stubGlobal('vitest', undefined)
  vi.stubGlobal('Worker', vi.fn(() => { throw new Error('Worker must not initialize') }))
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network must not run') }))
})
afterEach(() => {
  expect(Worker).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
  expect(state.select).not.toHaveBeenCalled()
  expect(state.database).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('DuckDB optional module loading only — no Worker/WASM/network qualification', () => {
  it('accepts the ESM namespace and stops before selecting a WASM bundle', async () => {
    await expect(preloadDuckDB()).resolves.toBeUndefined()
    expect(errorLog).toHaveBeenCalledWith('[DuckDB Plugin] Preload error:',
      expect.objectContaining({ message: 'fixture-stop-before-worker' }))
    expect(state.bundles).toHaveBeenCalledTimes(1)
  })

  it('accepts a standard CommonJS default namespace', async () => {
    state.defaultValue = { getJsDelivrBundles: state.bundles, selectBundle: state.select,
      AsyncDuckDB: state.database, ConsoleLogger: state.logger }
    await expect(preloadDuckDB()).resolves.toBeUndefined()
    expect(errorLog).toHaveBeenCalledWith('[DuckDB Plugin] Preload error:',
      expect.objectContaining({ message: 'fixture-stop-before-worker' }))
    expect(state.bundles).toHaveBeenCalledTimes(1)
  })

  it.each(['getJsDelivrBundles', 'selectBundle', 'AsyncDuckDB', 'ConsoleLogger'])(
    'rejects an optional stub or partial module missing %s before initialization', async (missing) => {
      const api: Record<string, unknown> = { getJsDelivrBundles: state.bundles, selectBundle: state.select,
        AsyncDuckDB: state.database, ConsoleLogger: state.logger }
      delete api[missing]
      state.defaultValue = api
      await expect(preloadDuckDB()).resolves.toBeUndefined()
      expect(errorLog).toHaveBeenCalledWith('[DuckDB Plugin] Preload error:',
        expect.objectContaining({ message: expect.stringContaining('does not expose its browser API') }))
      expect(state.bundles).not.toHaveBeenCalled()
    },
  )

  it('rejects the empty optional-peer production stub without creating a worker', async () => {
    state.defaultValue = {}
    await expect(preloadDuckDB()).resolves.toBeUndefined()
    expect(errorLog).toHaveBeenCalledWith('[DuckDB Plugin] Preload error:',
      expect.objectContaining({ message: expect.stringContaining('does not expose its browser API') }))
    expect(state.bundles).not.toHaveBeenCalled()
  })
})
