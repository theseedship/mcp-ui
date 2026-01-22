/**
 * GhostText Component
 * Displays LLM-style ghost text completion overlay
 *
 * Sprint Autocomplete Feature
 */

import { Component, Show, JSX, createMemo } from 'solid-js'

/**
 * Props for GhostText component
 */
export interface GhostTextProps {
  /**
   * Current input value
   */
  inputValue: string

  /**
   * Ghost text to show (the completion after input)
   */
  ghostText: string

  /**
   * Whether ghost text is visible
   */
  visible?: boolean

  /**
   * Custom class for the container
   */
  class?: string

  /**
   * Custom class for the ghost text
   */
  ghostClass?: string

  /**
   * Accept hint text (e.g., "Tab to accept")
   */
  hintText?: string

  /**
   * Whether loading
   */
  isLoading?: boolean
}

/**
 * GhostText Component
 * Overlays ghost text on an input field to show completion suggestions
 */
export const GhostText: Component<GhostTextProps> = (props) => {
  const shouldShow = createMemo(() =>
    props.visible !== false && props.ghostText && props.ghostText.length > 0
  )

  return (
    <div
      class={`mcp-ghost-text-container ${props.class || ''}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '100%'
      }}
    >
      {/* Ghost text overlay */}
      <Show when={shouldShow()}>
        <div
          class="mcp-ghost-text-overlay"
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            'pointer-events': 'none',
            overflow: 'hidden',
            'white-space': 'pre',
            padding: 'inherit',
            font: 'inherit',
            'line-height': 'inherit',
            'letter-spacing': 'inherit'
          }}
          aria-hidden="true"
        >
          {/* Invisible placeholder for input text */}
          <span style={{ visibility: 'hidden' }}>{props.inputValue}</span>
          {/* Visible ghost text */}
          <span
            class={`mcp-ghost-text ${props.ghostClass || ''}`}
            style={{
              color: '#9ca3af',
              opacity: '0.7'
            }}
          >
            {props.ghostText}
          </span>
        </div>
      </Show>

      {/* Hint text */}
      <Show when={shouldShow() && props.hintText}>
        <div
          class="mcp-ghost-text-hint"
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            'font-size': '0.75rem',
            color: '#6b7280',
            'background-color': 'rgba(255, 255, 255, 0.9)',
            padding: '2px 6px',
            'border-radius': '4px',
            'pointer-events': 'none'
          }}
        >
          {props.hintText}
        </div>
      </Show>

      {/* Loading indicator */}
      <Show when={props.isLoading}>
        <div
          class="mcp-ghost-text-loading"
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              border: '2px solid #e5e7eb',
              'border-top-color': '#3b82f6',
              'border-radius': '50%',
              animation: 'mcp-spin 0.6s linear infinite'
            }}
          />
        </div>
      </Show>
    </div>
  )
}

/**
 * Input wrapper that includes ghost text functionality
 */
export interface GhostTextInputProps {
  /**
   * Current input value
   */
  value: string

  /**
   * Ghost text to show
   */
  ghostText: string

  /**
   * onChange handler
   */
  onInput?: (value: string) => void

  /**
   * onKeyDown handler
   */
  onKeyDown?: (e: KeyboardEvent) => void

  /**
   * Placeholder text
   */
  placeholder?: string

  /**
   * Input type
   */
  type?: 'text' | 'email' | 'search'

  /**
   * Whether input is disabled
   */
  disabled?: boolean

  /**
   * Input name
   */
  name?: string

  /**
   * Input ID
   */
  id?: string

  /**
   * Custom class for input
   */
  class?: string

  /**
   * Accept hint
   */
  hintText?: string

  /**
   * Whether loading
   */
  isLoading?: boolean

  /**
   * Whether ghost text is visible
   */
  showGhost?: boolean

  /**
   * Additional input attributes
   */
  inputProps?: JSX.InputHTMLAttributes<HTMLInputElement>
}

/**
 * GhostTextInput Component
 * Input field with integrated ghost text overlay
 */
export const GhostTextInput: Component<GhostTextInputProps> = (props) => {
  return (
    <div class="mcp-ghost-text-input-wrapper" style={{ position: 'relative' }}>
      <GhostText
        inputValue={props.value}
        ghostText={props.ghostText}
        visible={props.showGhost}
        hintText={props.hintText}
        isLoading={props.isLoading}
      />
      <input
        type={props.type || 'text'}
        id={props.id}
        name={props.name}
        value={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        class={`mcp-ghost-text-input ${props.class || ''}`}
        style={{
          position: 'relative',
          'background-color': 'transparent',
          'caret-color': 'inherit'
        }}
        onInput={(e) => props.onInput?.(e.currentTarget.value)}
        onKeyDown={(e) => props.onKeyDown?.(e)}
        {...(props.inputProps || {})}
      />
    </div>
  )
}

export default GhostText
