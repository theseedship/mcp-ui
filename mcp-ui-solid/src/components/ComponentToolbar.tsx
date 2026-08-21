/**
 * ComponentToolbar - Unified toolbar for component actions
 * v2.2.5: Consistent icon set, position, and hover behavior across all components
 */

import { Component, For, createSignal } from 'solid-js'

/** SVG icon paths for toolbar actions */
const ICONS = {
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  check: 'M5 13l4 4L19 7',
  download: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  expand: 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5',
  wordwrap: 'M3 10h10a4 4 0 010 8H9m4 0l-3-3m3 3l-3 3M3 6h18M3 14h4',
} as const

export type ToolbarIcon = keyof typeof ICONS

export interface ToolbarAction {
  /** Icon to display */
  icon: ToolbarIcon
  /** Tooltip label */
  label: string
  /** Click handler */
  onClick: () => void
  /** Whether to show a success state (green check) after click */
  showFeedback?: boolean
  /** Active/toggled state (e.g. word wrap on) */
  active?: boolean
}

export interface ComponentToolbarProps {
  /** Actions to display */
  actions: ToolbarAction[]
  /** Corner position */
  position?: 'top-right' | 'top-left' | 'bottom-right'
}

/**
 * Renders a row of small icon buttons, visible on parent hover (requires parent `group` class).
 *
 * @example
 * <div class="relative group">
 *   <MyContent />
 *   <ComponentToolbar actions={[
 *     { icon: 'copy', label: 'Copy', onClick: handleCopy, showFeedback: true },
 *     { icon: 'download', label: 'Download CSV', onClick: handleDownload },
 *   ]} />
 * </div>
 */
export const ComponentToolbar: Component<ComponentToolbarProps> = (props) => {
  const positionClasses = () => {
    switch (props.position) {
      case 'top-left': return 'top-2 left-2'
      case 'bottom-right': return 'bottom-2 right-2'
      default: return 'top-2 right-2'
    }
  }

  return (
    <div class={`absolute ${positionClasses()} z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
      <For each={props.actions}>
        {(action) => <ToolbarButton action={action} />}
      </For>
    </div>
  )
}

/** Individual toolbar button with optional feedback state */
const ToolbarButton: Component<{ action: ToolbarAction }> = (props) => {
  const [showCheck, setShowCheck] = createSignal(false)

  const handleClick = () => {
    props.action.onClick()
    if (props.action.showFeedback) {
      setShowCheck(true)
      setTimeout(() => setShowCheck(false), 2000)
    }
  }

  const iconPath = () => showCheck() ? ICONS.check : ICONS[props.action.icon]
  const isActive = () => props.action.active
  const colorClass = () => {
    if (showCheck()) return 'text-green-500'
    if (isActive()) return 'text-blue-500 dark:text-blue-400'
    return 'text-gray-500 dark:text-gray-400'
  }

  return (
    <button
      onClick={handleClick}
      class={`p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-sm`}
      title={props.action.label}
      aria-label={props.action.label}
    >
      <svg class={`w-3 h-3 ${colorClass()}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={iconPath()} />
      </svg>
    </button>
  )
}
