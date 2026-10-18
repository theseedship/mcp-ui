/**
 * ActionGroupRenderer - Group of actions with layout options
 * Sprint 3: UX Improvements
 */

import { Component, For, Show } from 'solid-js'
import type { UIComponent, ActionGroupParams, ActionComponentParams } from '../types'
import { useAction } from '../hooks/useAction'
import { safeUrl } from '../utils/safe-url'
import { useMCPUIStrings } from '../context/MCPUIStringsContext'

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
  const { execute, executeAction, isExecuting } = useAction()

  // tool-call and submit both go through the host executor — they show a
  // loading state and gate disabled while running. link does neither.
  const isExecutable = () =>
    props.action.action === 'tool-call' || props.action.action === 'submit'

  const handleClick = async (e: MouseEvent) => {
    if (props.action.disabled) return

    if (props.action.action === 'tool-call' && props.action.toolName) {
      e.preventDefault()
      await execute(props.action.toolName, props.action.params || {})
    } else if (props.action.action === 'submit') {
      // submit is NOT a tool call — route it through the executor with the
      // `action: 'submit'` kind preserved so the host can POST to
      // params.submit_url etc. Works without a surrounding <form>.
      e.preventDefault()
      await executeAction({
        action: 'submit',
        toolName: props.action.toolName || 'submit',
        params: props.action.params || {},
      })
    } else if (props.action.action === 'link' && props.action.url) {
      window.open(props.action.url, '_blank', 'noopener,noreferrer')
    }
  }

  const isDisabled = () =>
    props.action.disabled || (isExecutable() && isExecuting())

  const variantClass = () => {
    switch (props.action.variant) {
      case 'primary':
        return 'bg-[color:var(--mcp-ui-accent,var(--color-blue-600))] text-[color:var(--mcp-ui-accent-fg,var(--color-white,#fff))] hover:bg-[color:var(--mcp-ui-accent-hover,var(--color-blue-700))] focus:ring-[color:var(--mcp-ui-focus,var(--color-blue-500))]'
      case 'secondary':
        return 'bg-[color:var(--mcp-ui-surface-muted,var(--color-gray-200,#e5e7eb))] text-[color:var(--mcp-ui-fg,var(--color-gray-800,#1f2937))] hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-300,#d1d5db))] dark:bg-[color:var(--mcp-ui-surface-muted,var(--color-gray-700,#374151))] dark:text-[color:var(--mcp-ui-fg,var(--color-white,#fff))] dark:hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-600,#4b5563))] focus:ring-[color:var(--mcp-ui-focus,var(--color-gray-500,#6b7280))]'
      case 'outline':
        return 'border border-[color:var(--mcp-ui-border,var(--color-gray-300,#d1d5db))] dark:border-[color:var(--mcp-ui-border,var(--color-gray-600,#4b5563))] text-[color:var(--mcp-ui-fg,var(--color-gray-700,#374151))] dark:text-[color:var(--mcp-ui-fg,var(--color-gray-300,#d1d5db))] hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-50,#f9fafb))] dark:hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-700,#374151))] focus:ring-[color:var(--mcp-ui-focus,var(--color-gray-500,#6b7280))]'
      case 'ghost':
        return 'text-[color:var(--mcp-ui-fg,var(--color-gray-700,#374151))] dark:text-[color:var(--mcp-ui-fg,var(--color-gray-300,#d1d5db))] hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-100,#f3f4f6))] dark:hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-700,#374151))] focus:ring-[color:var(--mcp-ui-focus,var(--color-gray-500,#6b7280))]'
      case 'danger':
        return 'bg-[color:var(--mcp-ui-danger,var(--color-red-600))] text-[color:var(--mcp-ui-accent-fg,var(--color-white,#fff))] hover:bg-[color:var(--mcp-ui-danger-hover,var(--color-red-700))] focus:ring-[color:var(--mcp-ui-focus,var(--color-red-500))]'
      default:
        return 'bg-[color:var(--mcp-ui-accent,var(--color-blue-600))] text-[color:var(--mcp-ui-accent-fg,var(--color-white,#fff))] hover:bg-[color:var(--mcp-ui-accent-hover,var(--color-blue-700))] focus:ring-[color:var(--mcp-ui-focus,var(--color-blue-500))]'
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
        href={safeUrl(props.action.url ?? '') ?? '#'}
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
      <Show when={isExecuting() && isExecutable()}>
        <span class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
      </Show>
      <Show when={props.action.icon && !(isExecuting() && isExecutable())}>
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
  const strings = useMCPUIStrings()
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
      aria-label={params()?.label || strings.actionGroupLabel}
    >
      <For each={params()?.actions || []}>
        {(action, index) => <ActionButton action={action} index={index()} />}
      </For>
    </div>
  )
}
