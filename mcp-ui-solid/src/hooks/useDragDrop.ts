/**
 * useDragDrop Hook
 * Handles drag-and-drop reordering of grid components using HTML5 Drag-Drop API
 *
 * Sprint Drag-Drop Feature
 */

import { createSignal, Accessor, batch, onCleanup } from 'solid-js'
import type { UIComponent } from '../types'

/**
 * Options for the useDragDrop hook
 */
export interface UseDragDropOptions {
  /**
   * Accessor for current components
   */
  components: Accessor<UIComponent[]>

  /**
   * Callback when components are reordered
   */
  onReorder: (newComponents: UIComponent[]) => void

  /**
   * Whether drag-drop is enabled
   */
  enabled?: boolean

  /**
   * Animation duration in ms
   */
  animationDuration?: number
}

/**
 * Props to apply to a draggable element
 */
export interface DragProps {
  draggable: boolean
  onDragStart: (e: DragEvent) => void
  onDragOver: (e: DragEvent) => void
  onDragEnter: (e: DragEvent) => void
  onDragLeave: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
  onDragEnd: (e: DragEvent) => void
  'data-component-id': string
}

/**
 * Return type for the useDragDrop hook
 */
export interface UseDragDropReturn {
  /**
   * ID of the component currently being dragged
   */
  draggedId: Accessor<string | null>

  /**
   * ID of the current drop target
   */
  dropTargetId: Accessor<string | null>

  /**
   * Whether a drag operation is in progress
   */
  isDragging: Accessor<boolean>

  /**
   * Handle drag start event
   */
  handleDragStart: (e: DragEvent, componentId: string) => void

  /**
   * Handle drag over event
   */
  handleDragOver: (e: DragEvent, componentId: string) => void

  /**
   * Handle drag enter event
   */
  handleDragEnter: (e: DragEvent, componentId: string) => void

  /**
   * Handle drag leave event
   */
  handleDragLeave: (e: DragEvent) => void

  /**
   * Handle drop event
   */
  handleDrop: (e: DragEvent, targetId: string) => void

  /**
   * Handle drag end event
   */
  handleDragEnd: (e: DragEvent) => void

  /**
   * Get drag props for a component
   */
  getDragProps: (componentId: string) => DragProps

  /**
   * Check if a component is being dragged
   */
  isComponentDragging: (componentId: string) => boolean

  /**
   * Check if a component is a drop target
   */
  isDropTarget: (componentId: string) => boolean
}

/**
 * Calculate drop position based on mouse position relative to target
 */
function getDropPosition(
  e: DragEvent,
  targetElement: HTMLElement
): 'before' | 'after' {
  const rect = targetElement.getBoundingClientRect()
  const midY = rect.top + rect.height / 2
  return e.clientY < midY ? 'before' : 'after'
}

/**
 * Reorder components by inserting source at a position relative to target
 */
function reorderComponents(
  components: UIComponent[],
  sourceId: string,
  targetId: string,
  position: 'before' | 'after'
): UIComponent[] {
  const sourceIndex = components.findIndex(c => c.id === sourceId)
  const targetIndex = components.findIndex(c => c.id === targetId)

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return components
  }

  // Create a copy and remove source
  const result = [...components]
  const [sourceComponent] = result.splice(sourceIndex, 1)

  // Find new target index (accounting for removal)
  let newTargetIndex = result.findIndex(c => c.id === targetId)
  if (position === 'after') {
    newTargetIndex += 1
  }

  // Insert at new position
  result.splice(newTargetIndex, 0, sourceComponent)

  // Recalculate row positions based on new order
  return recalculatePositions(result)
}

/**
 * Recalculate grid positions after reordering
 * Assigns sequential row positions while preserving column layout
 */
function recalculatePositions(components: UIComponent[]): UIComponent[] {
  let currentRow = 1
  const rowComponents: Map<number, UIComponent[]> = new Map()

  // Group by original row
  components.forEach((c, index) => {
    const row = c.position.rowStart || index + 1
    if (!rowComponents.has(row)) {
      rowComponents.set(row, [])
    }
    rowComponents.get(row)!.push(c)
  })

  // Flatten with new row assignments
  const result: UIComponent[] = []
  const sortedRows = Array.from(rowComponents.keys()).sort((a, b) => a - b)

  sortedRows.forEach(row => {
    const rowComps = rowComponents.get(row)!
    rowComps.forEach(c => {
      result.push({
        ...c,
        position: {
          ...c.position,
          rowStart: currentRow
        }
      })
    })
    currentRow += Math.max(...rowComps.map(c => c.position.rowSpan || 1))
  })

  return result
}

/**
 * Hook for handling drag-and-drop reordering of grid components
 */
export function useDragDrop(options: UseDragDropOptions): UseDragDropReturn {
  const {
    components,
    onReorder,
    enabled = true
  } = options

  const [draggedId, setDraggedId] = createSignal<string | null>(null)
  const [dropTargetId, setDropTargetId] = createSignal<string | null>(null)
  const [dropPosition, setDropPosition] = createSignal<'before' | 'after'>('after')
  const isDragging = () => draggedId() !== null

  // Track drag counter for nested elements
  let dragCounter = 0

  /**
   * Handle drag start
   */
  const handleDragStart = (e: DragEvent, componentId: string) => {
    if (!enabled) {
      e.preventDefault()
      return
    }

    const target = e.currentTarget as HTMLElement

    // Set drag data
    e.dataTransfer!.effectAllowed = 'move'
    e.dataTransfer!.setData('text/plain', componentId)

    // Create drag image
    if (target) {
      const rect = target.getBoundingClientRect()
      e.dataTransfer!.setDragImage(target, rect.width / 2, 20)
    }

    // Delay setting state to allow drag image to be captured
    requestAnimationFrame(() => {
      setDraggedId(componentId)
    })
  }

  /**
   * Handle drag over
   */
  const handleDragOver = (e: DragEvent, componentId: string) => {
    if (!enabled || !draggedId() || draggedId() === componentId) {
      return
    }

    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'

    // Calculate drop position
    const target = e.currentTarget as HTMLElement
    const position = getDropPosition(e, target)
    setDropPosition(position)
  }

  /**
   * Handle drag enter
   */
  const handleDragEnter = (e: DragEvent, componentId: string) => {
    if (!enabled || !draggedId() || draggedId() === componentId) {
      return
    }

    e.preventDefault()
    dragCounter++
    setDropTargetId(componentId)
  }

  /**
   * Handle drag leave
   */
  const handleDragLeave = (_e: DragEvent) => {
    if (!enabled) return

    dragCounter--
    if (dragCounter === 0) {
      setDropTargetId(null)
    }
  }

  /**
   * Handle drop
   */
  const handleDrop = (e: DragEvent, targetId: string) => {
    if (!enabled) return

    e.preventDefault()
    dragCounter = 0

    const sourceId = e.dataTransfer!.getData('text/plain')
    if (!sourceId || sourceId === targetId) {
      batch(() => {
        setDraggedId(null)
        setDropTargetId(null)
      })
      return
    }

    // Reorder components
    const currentComponents = components()
    const reordered = reorderComponents(
      currentComponents,
      sourceId,
      targetId,
      dropPosition()
    )

    // Apply reorder
    batch(() => {
      setDraggedId(null)
      setDropTargetId(null)
    })

    onReorder(reordered)
  }

  /**
   * Handle drag end
   */
  const handleDragEnd = (_e: DragEvent) => {
    dragCounter = 0
    batch(() => {
      setDraggedId(null)
      setDropTargetId(null)
    })
  }

  /**
   * Get drag props for a component
   */
  const getDragProps = (componentId: string): DragProps => ({
    draggable: enabled,
    onDragStart: (e) => handleDragStart(e, componentId),
    onDragOver: (e) => handleDragOver(e, componentId),
    onDragEnter: (e) => handleDragEnter(e, componentId),
    onDragLeave: handleDragLeave,
    onDrop: (e) => handleDrop(e, componentId),
    onDragEnd: handleDragEnd,
    'data-component-id': componentId
  })

  /**
   * Check if a component is being dragged
   */
  const isComponentDragging = (componentId: string): boolean => {
    return draggedId() === componentId
  }

  /**
   * Check if a component is a drop target
   */
  const isDropTarget = (componentId: string): boolean => {
    return dropTargetId() === componentId
  }

  // Cleanup on unmount
  onCleanup(() => {
    dragCounter = 0
  })

  return {
    draggedId,
    dropTargetId,
    isDragging,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    getDragProps,
    isComponentDragging,
    isDropTarget
  }
}
