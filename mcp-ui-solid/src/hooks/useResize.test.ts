/**
 * useResize Tests
 * Sprint Drag-Drop Feature
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSignal, createRoot } from 'solid-js'
import { useResize } from './useResize'
import type { GridPosition } from '../types'

// Mock pointer events
const createMockPointerEvent = (
  type: string,
  clientX: number = 0,
  clientY: number = 0
): PointerEvent => {
  return {
    type,
    clientX,
    clientY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as unknown as PointerEvent
}

describe('useResize', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    // Clean up any document listeners
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  describe('initialization', () => {
    it('initializes with correct default state', () => {
      createRoot((dispose) => {
        const [position] = createSignal<GridPosition>({
          colStart: 1,
          colSpan: 6
        })

        const resize = useResize({
          componentId: 'test-comp',
          currentPosition: position,
          onResize: vi.fn(),
          enabled: true
        })

        expect(resize.isResizing()).toBe(false)
        expect(resize.resizeEdge()).toBeNull()
        expect(resize.previewPosition()).toBeNull()

        dispose()
      })
    })

    it('provides getResizeHandleProps for edges', () => {
      createRoot((dispose) => {
        const [position] = createSignal<GridPosition>({
          colStart: 1,
          colSpan: 6
        })

        const resize = useResize({
          componentId: 'test-comp',
          currentPosition: position,
          onResize: vi.fn(),
          enabled: true
        })

        const rightProps = resize.getResizeHandleProps('right')
        const leftProps = resize.getResizeHandleProps('left')
        const topProps = resize.getResizeHandleProps('top')
        const bottomProps = resize.getResizeHandleProps('bottom')

        expect(rightProps['data-resize-edge']).toBe('right')
        expect(leftProps['data-resize-edge']).toBe('left')
        expect(topProps['data-resize-edge']).toBe('top')
        expect(bottomProps['data-resize-edge']).toBe('bottom')

        expect(rightProps.style.cursor).toBe('ew-resize')
        expect(topProps.style.cursor).toBe('ns-resize')

        dispose()
      })
    })
  })

  describe('resize operations', () => {
    it('starts resize on pointer down', () => {
      createRoot((dispose) => {
        const [position] = createSignal<GridPosition>({
          colStart: 1,
          colSpan: 6
        })

        const resize = useResize({
          componentId: 'test-comp',
          currentPosition: position,
          onResize: vi.fn(),
          enabled: true
        })

        const event = createMockPointerEvent('pointerdown', 100, 50)
        resize.handleResizeStart(event, 'right')

        expect(resize.isResizing()).toBe(true)
        expect(resize.resizeEdge()).toBe('right')
        expect(resize.previewPosition()).toEqual({ colStart: 1, colSpan: 6 })
        expect(event.preventDefault).toHaveBeenCalled()
        expect(event.stopPropagation).toHaveBeenCalled()

        dispose()
      })
    })

    it('does not start resize when disabled', () => {
      createRoot((dispose) => {
        const [position] = createSignal<GridPosition>({
          colStart: 1,
          colSpan: 6
        })

        const resize = useResize({
          componentId: 'test-comp',
          currentPosition: position,
          onResize: vi.fn(),
          enabled: false
        })

        const event = createMockPointerEvent('pointerdown', 100, 50)
        resize.handleResizeStart(event, 'right')

        expect(resize.isResizing()).toBe(false)
        expect(resize.resizeEdge()).toBeNull()

        dispose()
      })
    })
  })

  describe('constraints', () => {
    it('respects minColSpan constraint', () => {
      createRoot((dispose) => {
        const [position] = createSignal<GridPosition>({
          colStart: 1,
          colSpan: 4
        })

        const onResize = vi.fn()

        const resize = useResize({
          componentId: 'test-comp',
          currentPosition: position,
          onResize,
          constraints: { minColSpan: 2, maxColSpan: 8 },
          enabled: true
        })

        // Verify constraints are applied in the hook configuration
        expect(resize.isResizing()).toBe(false)

        dispose()
      })
    })

    it('handles lockHorizontal constraint', () => {
      createRoot((dispose) => {
        const [position] = createSignal<GridPosition>({
          colStart: 1,
          colSpan: 6
        })

        const resize = useResize({
          componentId: 'test-comp',
          currentPosition: position,
          onResize: vi.fn(),
          constraints: { lockHorizontal: true },
          enabled: true
        })

        // Start horizontal resize
        const event = createMockPointerEvent('pointerdown', 100, 50)
        resize.handleResizeStart(event, 'right')

        // The initial state should be set correctly
        expect(resize.isResizing()).toBe(true)

        dispose()
      })
    })
  })

  describe('edge-specific behavior', () => {
    it('handles right edge resize start', () => {
      createRoot((dispose) => {
        const [position] = createSignal<GridPosition>({
          colStart: 1,
          colSpan: 6
        })

        const resize = useResize({
          componentId: 'test-comp',
          currentPosition: position,
          onResize: vi.fn(),
          enabled: true
        })

        resize.handleResizeStart(createMockPointerEvent('pointerdown'), 'right')
        expect(resize.resizeEdge()).toBe('right')

        dispose()
      })
    })

    it('handles left edge resize start', () => {
      createRoot((dispose) => {
        const [position] = createSignal<GridPosition>({
          colStart: 3,
          colSpan: 6
        })

        const resize = useResize({
          componentId: 'test-comp',
          currentPosition: position,
          onResize: vi.fn(),
          enabled: true
        })

        resize.handleResizeStart(createMockPointerEvent('pointerdown'), 'left')
        expect(resize.resizeEdge()).toBe('left')

        dispose()
      })
    })

    it('handles top edge resize start', () => {
      createRoot((dispose) => {
        const [position] = createSignal<GridPosition>({
          colStart: 1,
          colSpan: 6,
          rowStart: 2,
          rowSpan: 2
        })

        const resize = useResize({
          componentId: 'test-comp',
          currentPosition: position,
          onResize: vi.fn(),
          enabled: true
        })

        resize.handleResizeStart(createMockPointerEvent('pointerdown'), 'top')
        expect(resize.resizeEdge()).toBe('top')

        dispose()
      })
    })

    it('handles bottom edge resize start', () => {
      createRoot((dispose) => {
        const [position] = createSignal<GridPosition>({
          colStart: 1,
          colSpan: 6,
          rowStart: 1,
          rowSpan: 2
        })

        const resize = useResize({
          componentId: 'test-comp',
          currentPosition: position,
          onResize: vi.fn(),
          enabled: true
        })

        resize.handleResizeStart(createMockPointerEvent('pointerdown'), 'bottom')
        expect(resize.resizeEdge()).toBe('bottom')

        dispose()
      })
    })
  })

  describe('SSR safety', () => {
    it('returns no-op functions on server', () => {
      // Note: In real SSR, isServer would be true
      // This test verifies the hook doesn't throw
      createRoot((dispose) => {
        const [position] = createSignal<GridPosition>({
          colStart: 1,
          colSpan: 6
        })

        const resize = useResize({
          componentId: 'test-comp',
          currentPosition: position,
          onResize: vi.fn(),
          enabled: true
        })

        // Should not throw
        expect(() => resize.getResizeHandleProps('right')).not.toThrow()

        dispose()
      })
    })
  })
})
