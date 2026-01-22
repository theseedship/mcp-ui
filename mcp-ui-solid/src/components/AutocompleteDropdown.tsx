/**
 * AutocompleteDropdown Component
 * Displays data-driven dropdown suggestions
 *
 * Sprint Autocomplete Feature
 */

import { Component, For, Show, createMemo, JSX } from 'solid-js'
import type { AutocompleteOption } from '../types'

/**
 * Props for AutocompleteDropdown
 */
export interface AutocompleteDropdownProps {
  /**
   * Options to display
   */
  options: AutocompleteOption[]

  /**
   * Currently selected index
   */
  selectedIndex: number

  /**
   * Whether dropdown is visible
   */
  isOpen: boolean

  /**
   * Callback when option is selected
   */
  onSelect: (option: AutocompleteOption) => void

  /**
   * Callback when option is hovered
   */
  onHover?: (index: number) => void

  /**
   * Whether loading
   */
  isLoading?: boolean

  /**
   * Custom class
   */
  class?: string

  /**
   * Max height
   */
  maxHeight?: string

  /**
   * Empty state message
   */
  emptyMessage?: string

  /**
   * Loading message
   */
  loadingMessage?: string

  /**
   * Highlight matching text in options
   */
  highlightMatch?: string

  /**
   * Position (default: 'bottom')
   */
  position?: 'top' | 'bottom'

  /**
   * Custom option renderer
   */
  renderOption?: (option: AutocompleteOption, isSelected: boolean) => JSX.Element
}

/**
 * Highlight matching text
 */
function highlightText(text: string, match?: string): JSX.Element {
  if (!match || !text) {
    return <>{text}</>
  }

  const lowerText = text.toLowerCase()
  const lowerMatch = match.toLowerCase()
  const startIndex = lowerText.indexOf(lowerMatch)

  if (startIndex === -1) {
    return <>{text}</>
  }

  const before = text.slice(0, startIndex)
  const matched = text.slice(startIndex, startIndex + match.length)
  const after = text.slice(startIndex + match.length)

  return (
    <>
      {before}
      <strong class="mcp-autocomplete-highlight">{matched}</strong>
      {after}
    </>
  )
}

/**
 * Default option renderer
 */
const DefaultOptionRenderer: Component<{
  option: AutocompleteOption
  isSelected: boolean
  highlightMatch?: string
}> = (props) => {
  const displayLabel = createMemo(() =>
    props.option.label || props.option.value
  )

  return (
    <div class="mcp-autocomplete-option-content">
      <Show when={props.option.icon}>
        <span class="mcp-autocomplete-option-icon">{props.option.icon}</span>
      </Show>
      <div class="mcp-autocomplete-option-text">
        <span class="mcp-autocomplete-option-label">
          {highlightText(displayLabel(), props.highlightMatch)}
        </span>
        <Show when={props.option.description}>
          <span class="mcp-autocomplete-option-description">
            {props.option.description}
          </span>
        </Show>
      </div>
    </div>
  )
}

/**
 * AutocompleteDropdown Component
 */
export const AutocompleteDropdown: Component<AutocompleteDropdownProps> = (props) => {
  const positionStyles = createMemo((): JSX.CSSProperties => {
    if (props.position === 'top') {
      return {
        bottom: '100%',
        'margin-bottom': '4px'
      }
    }
    return {
      top: '100%',
      'margin-top': '4px'
    }
  })

  const containerStyles = createMemo((): JSX.CSSProperties => ({
    position: 'absolute',
    left: '0',
    right: '0',
    'z-index': '50',
    'background-color': '#ffffff',
    border: '1px solid #e5e7eb',
    'border-radius': '6px',
    'box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    'max-height': props.maxHeight || '240px',
    overflow: 'auto',
    ...positionStyles()
  }))

  return (
    <Show when={props.isOpen}>
      <div
        class={`mcp-autocomplete-dropdown ${props.class || ''}`}
        style={containerStyles()}
        role="listbox"
        aria-label="Suggestions"
      >
        {/* Loading state */}
        <Show when={props.isLoading}>
          <div
            class="mcp-autocomplete-loading"
            style={{
              padding: '12px 16px',
              color: '#6b7280',
              'font-size': '0.875rem',
              display: 'flex',
              'align-items': 'center',
              gap: '8px'
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '14px',
                height: '14px',
                border: '2px solid #e5e7eb',
                'border-top-color': '#3b82f6',
                'border-radius': '50%',
                animation: 'mcp-spin 0.6s linear infinite'
              }}
            />
            {props.loadingMessage || 'Loading...'}
          </div>
        </Show>

        {/* Empty state */}
        <Show when={!props.isLoading && props.options.length === 0}>
          <div
            class="mcp-autocomplete-empty"
            style={{
              padding: '12px 16px',
              color: '#9ca3af',
              'font-size': '0.875rem',
              'text-align': 'center'
            }}
          >
            {props.emptyMessage || 'No suggestions found'}
          </div>
        </Show>

        {/* Options list */}
        <Show when={!props.isLoading && props.options.length > 0}>
          <ul
            class="mcp-autocomplete-options"
            style={{ margin: '0', padding: '4px 0', 'list-style': 'none' }}
          >
            <For each={props.options}>
              {(option, index) => {
                const isSelected = () => index() === props.selectedIndex
                const isDisabled = () => option.disabled

                return (
                  <li
                    role="option"
                    aria-selected={isSelected()}
                    aria-disabled={isDisabled()}
                    class={`mcp-autocomplete-option ${isSelected() ? 'mcp-autocomplete-option-selected' : ''} ${isDisabled() ? 'mcp-autocomplete-option-disabled' : ''}`}
                    style={{
                      padding: '8px 16px',
                      cursor: isDisabled() ? 'not-allowed' : 'pointer',
                      'background-color': isSelected() ? '#eff6ff' : 'transparent',
                      color: isDisabled() ? '#9ca3af' : '#374151',
                      'font-size': '0.875rem',
                      transition: 'background-color 150ms ease'
                    }}
                    onClick={() => {
                      if (!isDisabled()) {
                        props.onSelect(option)
                      }
                    }}
                    onMouseEnter={() => {
                      if (!isDisabled()) {
                        props.onHover?.(index())
                      }
                    }}
                  >
                    <Show
                      when={props.renderOption}
                      fallback={
                        <DefaultOptionRenderer
                          option={option}
                          isSelected={isSelected()}
                          highlightMatch={props.highlightMatch}
                        />
                      }
                    >
                      {props.renderOption!(option, isSelected())}
                    </Show>
                  </li>
                )
              }}
            </For>
          </ul>
        </Show>

        {/* Footer hint */}
        <Show when={!props.isLoading && props.options.length > 0}>
          <div
            class="mcp-autocomplete-footer"
            style={{
              padding: '6px 12px',
              'border-top': '1px solid #e5e7eb',
              'background-color': '#f9fafb',
              'font-size': '0.75rem',
              color: '#6b7280'
            }}
          >
            <kbd style={{
              'background-color': '#e5e7eb',
              padding: '1px 4px',
              'border-radius': '2px',
              'font-family': 'inherit',
              'font-size': '0.7rem'
            }}>↑</kbd>
            {' '}
            <kbd style={{
              'background-color': '#e5e7eb',
              padding: '1px 4px',
              'border-radius': '2px',
              'font-family': 'inherit',
              'font-size': '0.7rem'
            }}>↓</kbd>
            {' to navigate, '}
            <kbd style={{
              'background-color': '#e5e7eb',
              padding: '1px 4px',
              'border-radius': '2px',
              'font-family': 'inherit',
              'font-size': '0.7rem'
            }}>Enter</kbd>
            {' to select, '}
            <kbd style={{
              'background-color': '#e5e7eb',
              padding: '1px 4px',
              'border-radius': '2px',
              'font-family': 'inherit',
              'font-size': '0.7rem'
            }}>Esc</kbd>
            {' to dismiss'}
          </div>
        </Show>
      </div>
    </Show>
  )
}

export default AutocompleteDropdown
