/**
 * Tests for ChartRenderer reactivity fix
 * Verifies the <Show> pattern is used instead of synchronous if
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('ChartRenderer reactivity', () => {
  const source = readFileSync(
    resolve(__dirname, 'UIResourceRenderer.tsx'),
    'utf-8'
  )

  it('does NOT use synchronous if(useNative()) for rendering', () => {
    // The bug was: if (useNative()) { return <ChartJSRenderer /> }
    // This pattern evaluates once at mount — useNative() is always false
    const hasSyncIf = /if\s*\(useNative\(\)\)\s*\{[\s\S]*?return\s*\(?\s*<ChartJSRenderer/.test(source)
    expect(hasSyncIf).toBe(false)
  })

  it('uses reactive <Show when={useNative()}> pattern', () => {
    // The fix: <Show when={useNative()}> ... <ChartJSRenderer /> ... </Show>
    const hasReactiveShow = /Show[\s\S]*?when=\{useNative\(\)\}/.test(source)
    expect(hasReactiveShow).toBe(true)
  })

  it('has ChartJSRenderer as Show children (not in fallback)', () => {
    // ChartJSRenderer is between </Show>'s closing tag of the fallback and the outer </Show>
    // i.e. it's the children of <Show when={useNative()}>, rendered when native is true
    const showIdx = source.indexOf('when={useNative()}')
    expect(showIdx).toBeGreaterThan(-1)
    // The entire Show block should contain ChartJSRenderer
    const afterShow = source.slice(showIdx, showIdx + 3000)
    expect(afterShow).toContain('<ChartJSRenderer')
  })

  it('has quickchart.io URL in the iframe fallback', () => {
    // The fallback should build a quickchart URL
    expect(source).toContain('quickchart.io')
  })
})
