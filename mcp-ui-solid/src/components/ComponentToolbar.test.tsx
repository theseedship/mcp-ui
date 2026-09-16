/**
 * Tests for ComponentToolbar — stable `data-mcp-ui-action` hooks (v6.19.0)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@solidjs/testing-library'
import { ComponentToolbar } from './ComponentToolbar'

describe('ComponentToolbar', () => {
  it('renders one type="button" per action with a data-mcp-ui-action hook equal to the icon name', () => {
    const onCopy = vi.fn()
    const { container } = render(() => (
      <ComponentToolbar
        actions={[
          { icon: 'copy', label: 'Copy', onClick: onCopy },
          { icon: 'download', label: 'Download CSV', onClick: () => {} },
        ]}
      />
    ))

    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(2)
    expect(buttons[0].getAttribute('data-mcp-ui-action')).toBe('copy')
    expect(buttons[0].getAttribute('type')).toBe('button')
    expect(buttons[0].getAttribute('aria-label')).toBe('Copy')
    expect(buttons[1].getAttribute('data-mcp-ui-action')).toBe('download')

    fireEvent.click(buttons[0])
    expect(onCopy).toHaveBeenCalledTimes(1)
  })
})
