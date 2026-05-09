/**
 * v6.5.0 — Identity stability + opt-in observability for <UIResourceRenderer>.
 *
 * Coverage targets :
 *   1. Layout content gets `data-mcp-ui-layout-id` from layout.id
 *   2. Layout content without id falls back to a content hash
 *   3. Single-component content gets `data-mcp-ui-component-id` (no layout id)
 *   4. Each rendered child carries `data-mcp-ui-component-id`
 *   5. `onMountDuplicate` callback fires on the 2nd concurrent mount
 *   6. Module-level reporter (`setDuplicateMountReporter`) fires on duplicate
 *   7. Single mount fires no duplicate notification
 *   8. Cleanup on unmount allows the same key to be re-mounted without warn
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { UIResourceRenderer } from './UIResourceRenderer'
import {
  setDuplicateMountReporter,
  _resetRegistry,
  _getMountCount,
} from '../utils/duplicate-mount-registry'
import { getUiResourceStableKey } from '../utils/stable-key'

const SIMPLE_TEXT_COMPONENT = {
  id: 'text-comp-1',
  type: 'text' as const,
  position: { colStart: 1, colSpan: 12 },
  params: { content: 'Hello' },
}

const SIMPLE_LAYOUT = {
  id: 'layout-1',
  components: [SIMPLE_TEXT_COMPONENT],
  grid: { columns: 12, gap: '1rem' },
}

describe('UIResourceRenderer identity (v6.5.0)', () => {
  beforeEach(() => {
    cleanup()
    _resetRegistry()
  })

  it('layout content emits data-mcp-ui-layout-id from layout.id', () => {
    const { container } = render(() => <UIResourceRenderer content={SIMPLE_LAYOUT} />)
    const wrapper = container.querySelector('[data-mcp-ui-layout-id="layout-1"]')
    expect(wrapper).toBeTruthy()
  })

  it('layout without id falls back to a content hash', () => {
    const bareLayout = {
      components: [SIMPLE_TEXT_COMPONENT],
      grid: { columns: 12, gap: '1rem' },
    } as any
    const expectedKey = getUiResourceStableKey(bareLayout)
    const { container } = render(() => <UIResourceRenderer content={bareLayout} />)
    const wrapper = container.querySelector(`[data-mcp-ui-layout-id="${expectedKey}"]`)
    expect(wrapper).toBeTruthy()
    // Hash form (FNV-1a base36) is 7 chars
    expect(expectedKey).toMatch(/^[a-z0-9]{7}$/)
  })

  it('single-component content emits data-mcp-ui-component-id (no layout id)', () => {
    const { container } = render(() => <UIResourceRenderer content={SIMPLE_TEXT_COMPONENT} />)
    expect(container.querySelector('[data-mcp-ui-layout-id]')).toBeNull()
    const wrappers = container.querySelectorAll('[data-mcp-ui-component-id="text-comp-1"]')
    // Outer wrapper + inner per-component wrapper both carry the id
    expect(wrappers.length).toBeGreaterThanOrEqual(1)
  })

  it('each child component wrapper inside a layout carries data-mcp-ui-component-id', () => {
    const layout = {
      id: 'multi',
      components: [
        { id: 'comp-a', type: 'text', position: { colStart: 1, colSpan: 6 }, params: { content: 'A' } },
        { id: 'comp-b', type: 'text', position: { colStart: 7, colSpan: 6 }, params: { content: 'B' } },
      ],
      grid: { columns: 12, gap: '1rem' },
    } as any
    const { container } = render(() => <UIResourceRenderer content={layout} />)
    expect(container.querySelector('[data-mcp-ui-component-id="comp-a"]')).toBeTruthy()
    expect(container.querySelector('[data-mcp-ui-component-id="comp-b"]')).toBeTruthy()
  })

  it('fires onMountDuplicate on the 2nd concurrent mount of the same key', () => {
    const onDup = vi.fn()
    render(() => (
      <>
        <UIResourceRenderer content={SIMPLE_LAYOUT} onMountDuplicate={onDup} />
        <UIResourceRenderer content={SIMPLE_LAYOUT} onMountDuplicate={onDup} />
      </>
    ))
    // Only the 2nd mount triggers the callback (count crosses 2)
    expect(onDup).toHaveBeenCalledTimes(1)
    expect(onDup).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'layout-1', count: 2 })
    )
  })

  it('does NOT fire onMountDuplicate on a single mount', () => {
    const onDup = vi.fn()
    render(() => <UIResourceRenderer content={SIMPLE_LAYOUT} onMountDuplicate={onDup} />)
    expect(onDup).not.toHaveBeenCalled()
  })

  it('module-level setDuplicateMountReporter fires on the 2nd mount', () => {
    const reporter = vi.fn()
    setDuplicateMountReporter(reporter)
    render(() => (
      <>
        <UIResourceRenderer content={SIMPLE_LAYOUT} />
        <UIResourceRenderer content={SIMPLE_LAYOUT} />
      </>
    ))
    expect(reporter).toHaveBeenCalledTimes(1)
    expect(reporter).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'layout-1', count: 2 })
    )
  })

  it('mounts unique-key payloads independently (no false positives)', () => {
    const onDup = vi.fn()
    const reporter = vi.fn()
    setDuplicateMountReporter(reporter)
    const a = { ...SIMPLE_LAYOUT, id: 'layout-A' }
    const b = { ...SIMPLE_LAYOUT, id: 'layout-B' }
    render(() => (
      <>
        <UIResourceRenderer content={a} onMountDuplicate={onDup} />
        <UIResourceRenderer content={b} onMountDuplicate={onDup} />
      </>
    ))
    expect(onDup).not.toHaveBeenCalled()
    expect(reporter).not.toHaveBeenCalled()
  })

  it('cleanup unregisters the mount so the registry never leaks', () => {
    const { unmount } = render(() => <UIResourceRenderer content={SIMPLE_LAYOUT} />)
    expect(_getMountCount('layout-1')).toBe(1)
    unmount()
    expect(_getMountCount('layout-1')).toBe(0)
  })

  it('debugDuplicateMounts prop forces a console.warn even when global debug off', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render(() => (
        <>
          <UIResourceRenderer content={SIMPLE_LAYOUT} debugDuplicateMounts />
          <UIResourceRenderer content={SIMPLE_LAYOUT} debugDuplicateMounts />
        </>
      ))
      expect(warnSpy).toHaveBeenCalledWith(
        '[mcp-ui] duplicate UIResourceRenderer mount',
        expect.objectContaining({ key: 'layout-1', count: 2 })
      )
    } finally {
      warnSpy.mockRestore()
    }
  })
})
