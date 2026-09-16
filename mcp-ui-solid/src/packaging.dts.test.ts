// @vitest-environment node
/**
 * Declaration-packaging contract.
 *
 * The flattened subpath barrels (dist/components.d.ts, hooks.d.ts, types.d.ts,
 * adapters.d.ts) used to be *copies* of dist/<dir>/index.d.ts. A copy moves the
 * file up one directory, so its relative re-exports (`export { X } from
 * './UIResourceRenderer'`) pointed at dist/UIResourceRenderer.d.ts, which does
 * not exist. With `skipLibCheck` (the default for most consumers) TypeScript
 * swallows the unresolved module and every symbol flowing through such a barrel
 * silently becomes `any` — including UIResourceRenderer, StreamingUIRenderer and
 * GenerativeUIErrorBoundary at the package ROOT, since dist/index.d.ts
 * re-exports them from './components'.
 *
 * The fix is to emit a real re-export barrel instead of copying. These tests
 * assert the emitted shape so a regression in package.json's `build:types:copy`
 * fails the suite instead of shipping `any` to every consumer.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(packageRoot, 'dist')

const distMissing =
  `dist/ not found at ${dist}. The declaration-packaging contract is asserted ` +
  `against real build output — run \`pnpm --filter @seed-ship/mcp-ui-solid build\` first.`

describe('declaration packaging', () => {
  it('has a built dist/ to assert against', () => {
    expect(existsSync(dist), distMissing).toBe(true)
  })

  const barrels = ['components', 'hooks', 'types', 'adapters'] as const

  it.each(barrels)('dist/%s.d.ts is a re-export barrel, not a copy', (dir) => {
    expect(existsSync(dist), distMissing).toBe(true)

    const nested = resolve(dist, dir, 'index.d.ts')
    expect(existsSync(nested), `missing re-export target ${nested}`).toBe(true)

    const barrel = resolve(dist, `${dir}.d.ts`)
    expect(existsSync(barrel), `missing flattened barrel ${barrel}`).toBe(true)

    const source = readFileSync(barrel, 'utf8')
    expect(source).toContain(`export * from './${dir}/index'`)
  })

  it('re-exports the components default through the flattened barrel', () => {
    expect(existsSync(dist), distMissing).toBe(true)
    // src/components/index.ts has `export { UIResourceRenderer as default }`.
    // `export *` does NOT carry a default, so it needs its own line.
    const source = readFileSync(resolve(dist, 'components.d.ts'), 'utf8')
    expect(source).toContain(`export { default } from './components/index'`)
  })

  it('ships the declaration entry points every export condition points at', () => {
    expect(existsSync(dist), distMissing).toBe(true)
    for (const file of [
      'index.d.ts',
      'index.d.cts',
      'adapters/presentation.d.ts',
      'adapters/presentation.d.cts',
    ]) {
      expect(existsSync(resolve(dist, file)), `missing dist/${file}`).toBe(true)
    }
  })
})
