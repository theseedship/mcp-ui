import { describe, it, expect } from 'vitest'
import { getUiResourceStableKey } from './stable-key'

describe('getUiResourceStableKey (v6.5.0)', () => {
  it('returns layout.id verbatim when present and non-empty', () => {
    const layout = { id: 'dashboard-2024-Q3', components: [], grid: { columns: 12, gap: '1rem' } }
    expect(getUiResourceStableKey(layout)).toBe('dashboard-2024-Q3')
  })

  it('returns component.id verbatim when present and non-empty', () => {
    const component = { id: 'chart-revenue', type: 'chart', params: {} }
    expect(getUiResourceStableKey(component)).toBe('chart-revenue')
  })

  it('falls back to a content hash when id is missing', () => {
    const bare = { type: 'chart', params: { type: 'bar', data: { labels: ['a'], datasets: [] } } }
    const key = getUiResourceStableKey(bare)
    expect(key).toMatch(/^[a-z0-9]{7}$/)
  })

  it('falls back to a content hash when id is empty string', () => {
    const bare = { id: '', type: 'chart', params: {} }
    const key = getUiResourceStableKey(bare)
    expect(key).toMatch(/^[a-z0-9]{7}$/)
  })

  it('produces the same key across calls for structurally identical payloads', () => {
    const a = { type: 'chart', params: { foo: 1, bar: 2 } }
    const b = { type: 'chart', params: { foo: 1, bar: 2 } }
    expect(getUiResourceStableKey(a)).toBe(getUiResourceStableKey(b))
  })

  it('is independent of object key insertion order', () => {
    const a = { type: 'chart', params: { foo: 1, bar: 2 } }
    const b = { params: { bar: 2, foo: 1 }, type: 'chart' }
    expect(getUiResourceStableKey(a)).toBe(getUiResourceStableKey(b))
  })

  it('produces different keys for different payloads', () => {
    const a = { type: 'chart', params: { x: 1 } }
    const b = { type: 'chart', params: { x: 2 } }
    expect(getUiResourceStableKey(a)).not.toBe(getUiResourceStableKey(b))
  })

  it('ignores metadata.generatedAt (timestamp must not affect identity)', () => {
    const a = { type: 'chart', params: { x: 1 }, metadata: { generatedAt: '2026-05-10T10:00:00Z', llmModel: 'opus' } }
    const b = { type: 'chart', params: { x: 1 }, metadata: { generatedAt: '2026-05-10T11:00:00Z', llmModel: 'opus' } }
    expect(getUiResourceStableKey(a)).toBe(getUiResourceStableKey(b))
  })

  it('still distinguishes payloads with different non-timestamp metadata', () => {
    const a = { type: 'chart', params: { x: 1 }, metadata: { llmModel: 'opus' } }
    const b = { type: 'chart', params: { x: 1 }, metadata: { llmModel: 'sonnet' } }
    expect(getUiResourceStableKey(a)).not.toBe(getUiResourceStableKey(b))
  })

  it('skips undefined entries deterministically', () => {
    const a = { type: 'chart', params: { x: 1, y: undefined } }
    const b = { type: 'chart', params: { x: 1 } }
    expect(getUiResourceStableKey(a)).toBe(getUiResourceStableKey(b))
  })

  it('handles nested arrays', () => {
    const a = { type: 'composite', components: [{ type: 'metric' }, { type: 'chart' }] }
    const b = { type: 'composite', components: [{ type: 'metric' }, { type: 'chart' }] }
    expect(getUiResourceStableKey(a)).toBe(getUiResourceStableKey(b))
  })

  it('different array order yields different keys (order is semantic)', () => {
    const a = { type: 'composite', components: [{ type: 'metric' }, { type: 'chart' }] }
    const b = { type: 'composite', components: [{ type: 'chart' }, { type: 'metric' }] }
    expect(getUiResourceStableKey(a)).not.toBe(getUiResourceStableKey(b))
  })

  it('handles primitives gracefully', () => {
    expect(getUiResourceStableKey('a string')).toMatch(/^[a-z0-9]{7}$/)
    expect(getUiResourceStableKey(42)).toMatch(/^[a-z0-9]{7}$/)
    expect(getUiResourceStableKey(null)).toMatch(/^[a-z0-9]{7}$/)
  })

  it('keeps the explicit id even if other fields would hash differently', () => {
    const a = { id: 'fixed', type: 'chart', params: { x: 1 } }
    const b = { id: 'fixed', type: 'chart', params: { x: 999 } }
    expect(getUiResourceStableKey(a)).toBe('fixed')
    expect(getUiResourceStableKey(b)).toBe('fixed')
  })

  it('generated timestamp ids are NOT special-cased — passthrough is intentional', () => {
    // If a consumer (incorrectly) injects `wrap-${Date.now()}` ids, they get
    // unique keys per render. That's their responsibility — the helper only
    // strips the `id` field when it's missing or empty.
    const a = { id: 'wrap-1700000000000', type: 'chart', params: {} }
    const b = { id: 'wrap-1700000000001', type: 'chart', params: {} }
    expect(getUiResourceStableKey(a)).not.toBe(getUiResourceStableKey(b))
  })
})
