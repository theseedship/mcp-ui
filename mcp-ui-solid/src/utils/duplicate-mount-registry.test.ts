import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  setDuplicateMountReporter,
  getDuplicateMountReporter,
  _registerMount,
  _unregisterMount,
  _resetRegistry,
  _getMountCount,
} from './duplicate-mount-registry'

describe('duplicate-mount-registry (v6.5.0)', () => {
  beforeEach(() => {
    _resetRegistry()
  })

  it('first mount returns count=1, no duplicate', () => {
    const info = _registerMount('alpha')
    expect(info.key).toBe('alpha')
    expect(info.count).toBe(1)
    expect(typeof info.firstMountedAt).toBe('number')
  })

  it('second concurrent mount returns count=2 (caller decides to warn)', () => {
    _registerMount('beta')
    const info = _registerMount('beta')
    expect(info.count).toBe(2)
  })

  it('unregister decrements and cleans up at 0', () => {
    _registerMount('gamma')
    _registerMount('gamma')
    expect(_getMountCount('gamma')).toBe(2)
    _unregisterMount('gamma')
    expect(_getMountCount('gamma')).toBe(1)
    _unregisterMount('gamma')
    expect(_getMountCount('gamma')).toBe(0)
  })

  it('unregister on unknown key is a no-op (no throw)', () => {
    expect(() => _unregisterMount('does-not-exist')).not.toThrow()
  })

  it('firstMountedAt is preserved across the lifetime of the entry', () => {
    const a = _registerMount('delta')
    const b = _registerMount('delta')
    expect(b.firstMountedAt).toBe(a.firstMountedAt)
  })

  it('firstMountedAt resets after a full cleanup cycle', async () => {
    const first = _registerMount('epsilon')
    _unregisterMount('epsilon')
    // Tiny delay to guarantee a different Date.now() reading
    await new Promise((r) => setTimeout(r, 2))
    const second = _registerMount('epsilon')
    expect(second.firstMountedAt).toBeGreaterThanOrEqual(first.firstMountedAt)
  })

  it('module reporter starts unwired (null)', () => {
    expect(getDuplicateMountReporter()).toBeNull()
  })

  it('setDuplicateMountReporter wires + replaces + clears', () => {
    const r1 = vi.fn()
    setDuplicateMountReporter(r1)
    expect(getDuplicateMountReporter()).toBe(r1)

    const r2 = vi.fn()
    setDuplicateMountReporter(r2)
    expect(getDuplicateMountReporter()).toBe(r2)

    setDuplicateMountReporter(null)
    expect(getDuplicateMountReporter()).toBeNull()
  })

  it('different keys live in independent slots', () => {
    _registerMount('zeta')
    _registerMount('eta')
    _registerMount('zeta')
    expect(_getMountCount('zeta')).toBe(2)
    expect(_getMountCount('eta')).toBe(1)
  })
})
