/**
 * useDragDrop Tests
 * Sprint Drag-Drop Feature
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSignal, createRoot, flush } from 'solid-js'
import { useDragDrop } from './useDragDrop'
import type { UIComponent } from '../types'

// Helper to create mock components
const createMockComponent = (
  id: string,
  colStart: number,
  colSpan: number,
  rowStart?: number
): UIComponent => ({
  id,
  type: 'text',
  position: { colStart, colSpan, rowStart, rowSpan: 1 },
  params: { content: `Component ${id}` },
})

// Mock DragEvent
const createMockDragEvent = (type: string, data?: Record<string, any>): DragEvent => {
  const event = {
    type,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(() => data?.componentId || ''),
      setDragImage: vi.fn(),
    },
    clientX: data?.clientX || 0,
    clientY: data?.clientY || 0,
    currentTarget: data?.currentTarget || document.createElement('div'),
  } as unknown as DragEvent
  return event
}

describe('useDragDrop', () => {
  it('reads an enabled getter at the event boundary and from existing drag props', () => {
    let dispose!: () => void
    const { dragDrop, setEnabled } = createRoot((cleanup) => {
      dispose = cleanup
      const [enabled, setEnabled] = createSignal(false)
      const dragDrop = useDragDrop({
        components: () => [createMockComponent('comp1', 1, 6)],
        onReorder: vi.fn(),
        get enabled() { return enabled() },
      })
      return { dragDrop, setEnabled }
    })
    const props = dragDrop.getDragProps('comp1')
    expect(props.draggable).toBe(false)
    setEnabled(true)
    flush()
    expect(props.draggable).toBe(true)
    dragDrop.handleDragStart(createMockDragEvent('dragstart'), 'comp1')
    vi.advanceTimersByTime(16)
    flush()
    expect(dragDrop.draggedId()).toBe('comp1')
    setEnabled(false)
    flush()
    expect(props.draggable).toBe(false)
    const event = createMockDragEvent('dragstart')
    dragDrop.handleDragStart(event, 'other')
    expect(event.preventDefault).toHaveBeenCalled()
    dispose()
  })

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('initializes with correct default state', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6),
          createMockComponent('comp2', 7, 6),
        ])

        const onReorder = vi.fn()

        const dragDrop = useDragDrop({
          components,
          onReorder,
          enabled: true,
        })

        // Exercise imperative events outside the pure root-construction scope.
        return () => {
          expect(dragDrop.draggedId()).toBeNull()
          expect(dragDrop.dropTargetId()).toBeNull()
          expect(dragDrop.isDragging()).toBe(false)

          dispose()
        }
      })()
    })

    it('provides getDragProps for components', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([createMockComponent('comp1', 1, 6)])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: true,
        })

        // Exercise imperative events outside the pure root-construction scope.
        return () => {
          const props = dragDrop.getDragProps('comp1')

          expect(props.draggable).toBe(true)
          expect(props['data-component-id']).toBe('comp1')
          expect(typeof props.onDragStart).toBe('function')
          expect(typeof props.onDragOver).toBe('function')
          expect(typeof props.onDrop).toBe('function')

          dispose()
        }
      })()
    })

    it('sets draggable to false when disabled', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([createMockComponent('comp1', 1, 6)])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: false,
        })

        // Exercise imperative events outside the pure root-construction scope.
        return () => {
          const props = dragDrop.getDragProps('comp1')
          expect(props.draggable).toBe(false)

          dispose()
        }
      })()
    })
  })

  describe('drag operations', () => {
    it('sets draggedId on drag start', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6),
          createMockComponent('comp2', 7, 6),
        ])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: true,
        })

        // Exercise imperative events outside the pure root-construction scope.
        return () => {
          const event = createMockDragEvent('dragstart')
          dragDrop.handleDragStart(event, 'comp1')
          flush()

          // Need to advance timer for requestAnimationFrame
          vi.advanceTimersByTime(16)
          flush()

          expect(dragDrop.draggedId()).toBe('comp1')
          expect(dragDrop.isDragging()).toBe(true)
          expect(event.dataTransfer!.setData).toHaveBeenCalledWith('text/plain', 'comp1')

          dispose()
        }
      })()
    })

    it('sets dropTargetId on drag enter', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6),
          createMockComponent('comp2', 7, 6),
        ])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: true,
        })

        // Exercise imperative events outside the pure root-construction scope.
        return () => {
          // Start dragging comp1
          const startEvent = createMockDragEvent('dragstart')
          dragDrop.handleDragStart(startEvent, 'comp1')
          flush()
          vi.advanceTimersByTime(16)
          flush()

          // Enter comp2
          const enterEvent = createMockDragEvent('dragenter')
          dragDrop.handleDragEnter(enterEvent, 'comp2')
          flush()

          expect(dragDrop.dropTargetId()).toBe('comp2')
          expect(dragDrop.isDropTarget('comp2')).toBe(true)

          dispose()
        }
      })()
    })

    it('clears state on drag end', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6),
          createMockComponent('comp2', 7, 6),
        ])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: true,
        })

        // Exercise imperative events outside the pure root-construction scope.
        return () => {
          // Start drag
          const startEvent = createMockDragEvent('dragstart')
          dragDrop.handleDragStart(startEvent, 'comp1')
          flush()
          vi.advanceTimersByTime(16)
          flush()

          expect(dragDrop.isDragging()).toBe(true)

          // End drag
          const endEvent = createMockDragEvent('dragend')
          dragDrop.handleDragEnd(endEvent)
          flush()

          expect(dragDrop.draggedId()).toBeNull()
          expect(dragDrop.dropTargetId()).toBeNull()
          expect(dragDrop.isDragging()).toBe(false)

          dispose()
        }
      })()
    })

    it('calls onReorder on drop', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6, 1),
          createMockComponent('comp2', 7, 6, 1),
        ])

        const onReorder = vi.fn()

        const dragDrop = useDragDrop({
          components,
          onReorder,
          enabled: true,
        })

        // Exercise imperative events outside the pure root-construction scope.
        return () => {
          // Start dragging comp1
          const startEvent = createMockDragEvent('dragstart')
          dragDrop.handleDragStart(startEvent, 'comp1')
          flush()
          vi.advanceTimersByTime(16)
          flush()

          // Drop on comp2
          const dropEvent = createMockDragEvent('drop', { componentId: 'comp1' })
          dragDrop.handleDrop(dropEvent, 'comp2')
          flush()

          expect(onReorder).toHaveBeenCalled()
          expect(dropEvent.preventDefault).toHaveBeenCalled()

          dispose()
        }
      })()
    })

    it('does not call onReorder when dropping on self', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([createMockComponent('comp1', 1, 6)])

        const onReorder = vi.fn()

        const dragDrop = useDragDrop({
          components,
          onReorder,
          enabled: true,
        })

        // Exercise imperative events outside the pure root-construction scope.
        return () => {
          // Start dragging comp1
          const startEvent = createMockDragEvent('dragstart')
          dragDrop.handleDragStart(startEvent, 'comp1')
          flush()
          vi.advanceTimersByTime(16)
          flush()

          // Drop on same component
          const dropEvent = createMockDragEvent('drop', { componentId: 'comp1' })
          dragDrop.handleDrop(dropEvent, 'comp1')
          flush()

          expect(onReorder).not.toHaveBeenCalled()

          dispose()
        }
      })()
    })
  })

  describe('helper functions', () => {
    it('isComponentDragging returns correct value', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6),
          createMockComponent('comp2', 7, 6),
        ])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: true,
        })

        // Exercise imperative events outside the pure root-construction scope.
        return () => {
          expect(dragDrop.isComponentDragging('comp1')).toBe(false)

          const event = createMockDragEvent('dragstart')
          dragDrop.handleDragStart(event, 'comp1')
          flush()
          vi.advanceTimersByTime(16)
          flush()

          expect(dragDrop.isComponentDragging('comp1')).toBe(true)
          expect(dragDrop.isComponentDragging('comp2')).toBe(false)

          dispose()
        }
      })()
    })

    it('isDropTarget returns correct value', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6),
          createMockComponent('comp2', 7, 6),
        ])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: true,
        })

        // Exercise imperative events outside the pure root-construction scope.
        return () => {
          expect(dragDrop.isDropTarget('comp2')).toBe(false)

          // Start dragging
          const startEvent = createMockDragEvent('dragstart')
          dragDrop.handleDragStart(startEvent, 'comp1')
          flush()
          vi.advanceTimersByTime(16)
          flush()

          // Enter target
          const enterEvent = createMockDragEvent('dragenter')
          dragDrop.handleDragEnter(enterEvent, 'comp2')
          flush()

          expect(dragDrop.isDropTarget('comp2')).toBe(true)
          expect(dragDrop.isDropTarget('comp1')).toBe(false)

          dispose()
        }
      })()
    })
  })

  describe('disabled state', () => {
    it('prevents drag operations when disabled', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([createMockComponent('comp1', 1, 6)])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: false,
        })

        // Exercise imperative events outside the pure root-construction scope.
        return () => {
          const event = createMockDragEvent('dragstart')
          dragDrop.handleDragStart(event, 'comp1')
          flush()
          vi.advanceTimersByTime(16)
          flush()

          expect(event.preventDefault).toHaveBeenCalled()
          expect(dragDrop.draggedId()).toBeNull()

          dispose()
        }
      })()
    })
  })
})
