/**
 * useDragDrop Tests
 * Sprint Drag-Drop Feature
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSignal, createRoot } from 'solid-js'
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
  params: { content: `Component ${id}` }
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
      setDragImage: vi.fn()
    },
    clientX: data?.clientX || 0,
    clientY: data?.clientY || 0,
    currentTarget: data?.currentTarget || document.createElement('div')
  } as unknown as DragEvent
  return event
}

describe('useDragDrop', () => {
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
          createMockComponent('comp2', 7, 6)
        ])

        const onReorder = vi.fn()

        const dragDrop = useDragDrop({
          components,
          onReorder,
          enabled: true
        })

        expect(dragDrop.draggedId()).toBeNull()
        expect(dragDrop.dropTargetId()).toBeNull()
        expect(dragDrop.isDragging()).toBe(false)

        dispose()
      })
    })

    it('provides getDragProps for components', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6)
        ])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: true
        })

        const props = dragDrop.getDragProps('comp1')

        expect(props.draggable).toBe(true)
        expect(props['data-component-id']).toBe('comp1')
        expect(typeof props.onDragStart).toBe('function')
        expect(typeof props.onDragOver).toBe('function')
        expect(typeof props.onDrop).toBe('function')

        dispose()
      })
    })

    it('sets draggable to false when disabled', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6)
        ])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: false
        })

        const props = dragDrop.getDragProps('comp1')
        expect(props.draggable).toBe(false)

        dispose()
      })
    })
  })

  describe('drag operations', () => {
    it('sets draggedId on drag start', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6),
          createMockComponent('comp2', 7, 6)
        ])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: true
        })

        const event = createMockDragEvent('dragstart')
        dragDrop.handleDragStart(event, 'comp1')

        // Need to advance timer for requestAnimationFrame
        vi.advanceTimersByTime(16)

        expect(dragDrop.draggedId()).toBe('comp1')
        expect(dragDrop.isDragging()).toBe(true)
        expect(event.dataTransfer!.setData).toHaveBeenCalledWith('text/plain', 'comp1')

        dispose()
      })
    })

    it('sets dropTargetId on drag enter', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6),
          createMockComponent('comp2', 7, 6)
        ])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: true
        })

        // Start dragging comp1
        const startEvent = createMockDragEvent('dragstart')
        dragDrop.handleDragStart(startEvent, 'comp1')
        vi.advanceTimersByTime(16)

        // Enter comp2
        const enterEvent = createMockDragEvent('dragenter')
        dragDrop.handleDragEnter(enterEvent, 'comp2')

        expect(dragDrop.dropTargetId()).toBe('comp2')
        expect(dragDrop.isDropTarget('comp2')).toBe(true)

        dispose()
      })
    })

    it('clears state on drag end', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6),
          createMockComponent('comp2', 7, 6)
        ])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: true
        })

        // Start drag
        const startEvent = createMockDragEvent('dragstart')
        dragDrop.handleDragStart(startEvent, 'comp1')
        vi.advanceTimersByTime(16)

        expect(dragDrop.isDragging()).toBe(true)

        // End drag
        const endEvent = createMockDragEvent('dragend')
        dragDrop.handleDragEnd(endEvent)

        expect(dragDrop.draggedId()).toBeNull()
        expect(dragDrop.dropTargetId()).toBeNull()
        expect(dragDrop.isDragging()).toBe(false)

        dispose()
      })
    })

    it('calls onReorder on drop', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6, 1),
          createMockComponent('comp2', 7, 6, 1)
        ])

        const onReorder = vi.fn()

        const dragDrop = useDragDrop({
          components,
          onReorder,
          enabled: true
        })

        // Start dragging comp1
        const startEvent = createMockDragEvent('dragstart')
        dragDrop.handleDragStart(startEvent, 'comp1')
        vi.advanceTimersByTime(16)

        // Drop on comp2
        const dropEvent = createMockDragEvent('drop', { componentId: 'comp1' })
        dragDrop.handleDrop(dropEvent, 'comp2')

        expect(onReorder).toHaveBeenCalled()
        expect(dropEvent.preventDefault).toHaveBeenCalled()

        dispose()
      })
    })

    it('does not call onReorder when dropping on self', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6)
        ])

        const onReorder = vi.fn()

        const dragDrop = useDragDrop({
          components,
          onReorder,
          enabled: true
        })

        // Start dragging comp1
        const startEvent = createMockDragEvent('dragstart')
        dragDrop.handleDragStart(startEvent, 'comp1')
        vi.advanceTimersByTime(16)

        // Drop on same component
        const dropEvent = createMockDragEvent('drop', { componentId: 'comp1' })
        dragDrop.handleDrop(dropEvent, 'comp1')

        expect(onReorder).not.toHaveBeenCalled()

        dispose()
      })
    })
  })

  describe('helper functions', () => {
    it('isComponentDragging returns correct value', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6),
          createMockComponent('comp2', 7, 6)
        ])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: true
        })

        expect(dragDrop.isComponentDragging('comp1')).toBe(false)

        const event = createMockDragEvent('dragstart')
        dragDrop.handleDragStart(event, 'comp1')
        vi.advanceTimersByTime(16)

        expect(dragDrop.isComponentDragging('comp1')).toBe(true)
        expect(dragDrop.isComponentDragging('comp2')).toBe(false)

        dispose()
      })
    })

    it('isDropTarget returns correct value', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6),
          createMockComponent('comp2', 7, 6)
        ])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: true
        })

        expect(dragDrop.isDropTarget('comp2')).toBe(false)

        // Start dragging
        const startEvent = createMockDragEvent('dragstart')
        dragDrop.handleDragStart(startEvent, 'comp1')
        vi.advanceTimersByTime(16)

        // Enter target
        const enterEvent = createMockDragEvent('dragenter')
        dragDrop.handleDragEnter(enterEvent, 'comp2')

        expect(dragDrop.isDropTarget('comp2')).toBe(true)
        expect(dragDrop.isDropTarget('comp1')).toBe(false)

        dispose()
      })
    })
  })

  describe('disabled state', () => {
    it('prevents drag operations when disabled', () => {
      createRoot((dispose) => {
        const [components] = createSignal<UIComponent[]>([
          createMockComponent('comp1', 1, 6)
        ])

        const dragDrop = useDragDrop({
          components,
          onReorder: vi.fn(),
          enabled: false
        })

        const event = createMockDragEvent('dragstart')
        dragDrop.handleDragStart(event, 'comp1')
        vi.advanceTimersByTime(16)

        expect(event.preventDefault).toHaveBeenCalled()
        expect(dragDrop.draggedId()).toBeNull()

        dispose()
      })
    })
  })
})
