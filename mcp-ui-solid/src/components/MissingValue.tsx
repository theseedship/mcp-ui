/**
 * The visible and accessible marks of a missing value (v6.24.0).
 *
 * A table cell with no value has always shown `-`. On its own that glyph says
 * nothing to a screen reader (it is read as "dash", or skipped) and it is easy
 * to take for a zero or a minus sign. These two components give it a meaning:
 *
 * - {@link MissingValueMark} — the cell content: the `-` hidden from
 *   assistive technology, followed by `strings.missingValue` hidden from
 *   sight. Visually-hidden through an inline style rather than Tailwind's
 *   `sr-only`, so the text cannot leak on a host whose Tailwind build does
 *   not scan this package.
 * - {@link MissingValueLegend} — one line under a table or data view that
 *   contains a missing value, so the convention never has to be guessed.
 *
 * Both are SSR-safe: no browser API, and the same markup on server and client.
 */

import type { Component, JSX } from 'solid-js'
import { formatMCPUIString, useMCPUIStrings } from '../context/MCPUIStringsContext'
import { MISSING_VALUE_MARKER } from '../utils/missing-value'

/** The classic visually-hidden recipe: in the accessibility tree, out of sight. */
export const VISUALLY_HIDDEN_STYLE: JSX.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  'white-space': 'nowrap',
  border: '0',
}

/** Content of a cell whose value is missing. */
export const MissingValueMark: Component = () => {
  const strings = useMCPUIStrings()
  return (
    <span data-mcp-missing-value="">
      <span aria-hidden="true" class="text-gray-400 dark:text-gray-500">
        {MISSING_VALUE_MARKER}
      </span>
      <span style={VISUALLY_HIDDEN_STYLE}>{strings.missingValue}</span>
    </span>
  )
}

/** The legend line explaining the missing-value glyph. */
export const MissingValueLegend: Component<{ class?: string }> = (props) => {
  const strings = useMCPUIStrings()
  return (
    <p
      data-mcp-missing-legend=""
      role="note"
      class={`text-xs text-gray-500 dark:text-gray-400 ${props.class ?? ''}`}
    >
      {formatMCPUIString(strings.missingValueLegend, { marker: MISSING_VALUE_MARKER })}
    </p>
  )
}
