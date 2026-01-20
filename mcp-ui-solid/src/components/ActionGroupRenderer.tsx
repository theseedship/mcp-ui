/**
 * ActionGroupRenderer - Group of actions with layout options
 * Sprint 3: UX Improvements
 */

import { Component, For, Show } from 'solid-js'
import type { UIComponent, ActionGroupParams, ActionComponentParams } from '../types'
import { useAction } from '../hooks/useAction'

export interface ActionGroupRendererProps {
  /**
   * UIComponent with action-group params (for declarative use)
   */
  component?: UIComponent

  /**
   * Direct action group params (alternative to component)
   */
  params?: ActionGroupParams
}

/**
 * Render a single action button with variants and click handling
 */
const ActionButton: Component<{
  action: ActionComponentParams
  index: number
}> = (props) => {
  const { execute, isExecuting } = useAction()

  const handleClick = async (e: MouseEvent) => {
    if (props.action.disabled) return

    if (props.action.action === 'tool-call' && props.action.toolName) {
      e.preventDefault()
      await execute(props.action.toolName, props.action.params || {})
    } else if (props.action.action === 'link' && props.action.url) {
      window.open(props.action.url, '_blank', 'noopener,noreferrer')
    }
  }

  const isDisabled = () =>
    props.action.disabled || (props.action.action === 'tool-call' && isExecuting())

  const variantClass = () => {
    switch (props.action.variant) {
      case 'primary':
        return 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
      case 'secondary':
        return 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 focus:ring-gray-500'
      case 'outline':
        return 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-500'
      case 'ghost':
        return 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-gray-500'
      case 'danger':
        return 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
      default:
        return 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
    }
  }

  const sizeClass = () => {
    switch (props.action.size) {
      case 'sm':
        return 'px-2 py-1 text-xs'
      case 'lg':
        return 'px-6 py-3 text-base'
      default:
        return 'px-4 py-2 text-sm'
    }
  }

  // Render as link if it's a link action
  if (props.action.type === 'link' || (props.action.action === 'link' && props.action.url)) {
    return (
      <a
        href={props.action.url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        class={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${variantClass()} ${sizeClass()} ${
          isDisabled() ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
        }`}
      >
        <Show when={props.action.icon}>
          <span class="text-current">{props.action.icon}</span>
        </Show>
        {props.action.label}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled()}
      class={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${variantClass()} ${sizeClass()} ${
        isDisabled() ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <Show when={isExecuting() && props.action.action === 'tool-call'}>
        <span class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
      </Show>
      <Show when={props.action.icon && !(isExecuting() && props.action.action === 'tool-call')}>
        <span class="text-current">{props.action.icon}</span>
      </Show>
      {props.action.label}
    </button>
  )
}

/**
 * Action group component for rendering multiple actions with consistent layout
 *
 * @example
 * ```tsx
 * const actionGroup: UIComponent = {
 *   id: 'form-actions',
 *   type: 'action-group',
 *   position: { colStart: 1, colSpan: 12 },
 *   params: {
 *     layout: 'end',
 *     gap: 'md',
 *     actions: [
 *       { label: 'Cancel', variant: 'outline', action: 'link', url: '/back' },
 *       { label: 'Save', variant: 'primary', action: 'tool-call', toolName: 'save' },
 *     ],
 *   },
 * }
 * <ActionGroupRenderer component={actionGroup} />
 * ```
 */
export const ActionGroupRenderer: Component<ActionGroupRendererProps> = (props) => {
  const params = () => props.params || (props.component?.params as ActionGroupParams) || { actions: [] }

  const layoutClass = () => {
    switch (params()?.layout) {
      case 'vertical':
        return 'flex flex-col'
      case 'space-between':
        return 'flex justify-between'
      case 'end':
        return 'flex justify-end'
      case 'center':
        return 'flex justify-center'
      default: // horizontal
        return 'flex'
    }
  }

  const gapClass = () => {
    switch (params()?.gap) {
      case 'none':
        return 'gap-0'
      case 'sm':
        return 'gap-1'
      case 'lg':
        return 'gap-4'
      default: // md
        return 'gap-2'
    }
  }

  return (
    <div
      class={`${layoutClass()} ${gapClass()} ${params()?.fullWidth ? 'w-full' : ''}`}
      role="group"
      aria-label={params()?.label || 'Action group'}
    >
      <For each={params()?.actions || []}>
        {(action, index) => <ActionButton action={action} index={index()} />}
      </For>
    </div>
  )
}
