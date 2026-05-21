/**
 * Tests for ExpandableWrapper component
 * P1: Expand/fullscreen for tables, charts, code
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { ExpandableWrapper } from './ExpandableWrapper'

// Mock Portal to render inline for testing
vi.mock('solid-js/web', async () => {
  const actual = await vi.importActual('solid-js/web') as any
  return {
    ...actual,
    Portal: (props: any) => props.children,
  }
})

describe('ExpandableWrapper', () => {
  beforeEach(() => {
    cleanup()
  })

  it('renders children inline', () => {
    const { getByText } = render(() => (
      <ExpandableWrapper title="Test">
        <div>Hello World</div>
      </ExpandableWrapper>
    ))

    expect(getByText('Hello World')).toBeDefined()
  })

  it('shows expand button on render', () => {
    const { getByLabelText } = render(() => (
      <ExpandableWrapper title="Test">
        <div>Content</div>
      </ExpandableWrapper>
    ))

    expect(getByLabelText('Expand to fullscreen')).toBeDefined()
  })

  it('opens modal when expand button is clicked', async () => {
    const { getByLabelText, getByRole } = render(() => (
      <ExpandableWrapper title="Test Title">
        <div>Content</div>
      </ExpandableWrapper>
    ))

    const expandBtn = getByLabelText('Expand to fullscreen')
    fireEvent.click(expandBtn)

    // Modal dialog should appear
    const dialog = getByRole('dialog')
    expect(dialog).toBeDefined()
  })

  it('displays title in expanded modal header', async () => {
    const { getByLabelText, getByText } = render(() => (
      <ExpandableWrapper title="Sales Data">
        <div>Table content</div>
      </ExpandableWrapper>
    ))

    fireEvent.click(getByLabelText('Expand to fullscreen'))

    // Title should be visible in the modal header
    expect(getByText('Sales Data')).toBeDefined()
  })

  it('closes modal when close button is clicked', async () => {
    const { getByLabelText, queryByRole } = render(() => (
      <ExpandableWrapper title="Test">
        <div>Content</div>
      </ExpandableWrapper>
    ))

    // Open
    fireEvent.click(getByLabelText('Expand to fullscreen'))
    expect(queryByRole('dialog')).not.toBeNull()

    // Close
    fireEvent.click(getByLabelText('Close expanded view'))

    // Dialog should be gone
    expect(queryByRole('dialog')).toBeNull()
  })

  it('closes modal on Escape key', async () => {
    const { getByLabelText, queryByRole } = render(() => (
      <ExpandableWrapper title="Test">
        <div>Content</div>
      </ExpandableWrapper>
    ))

    fireEvent.click(getByLabelText('Expand to fullscreen'))
    expect(queryByRole('dialog')).not.toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(queryByRole('dialog')).toBeNull()
  })

  it('shows copy button when copyData is provided', async () => {
    const { getByLabelText } = render(() => (
      <ExpandableWrapper title="Test" copyData="some data" copyLabel="Copy TSV">
        <div>Content</div>
      </ExpandableWrapper>
    ))

    fireEvent.click(getByLabelText('Expand to fullscreen'))

    expect(getByLabelText('Copy TSV')).toBeDefined()
  })

  it('does not show copy button when no copyData', async () => {
    const { getByLabelText, queryByLabelText } = render(() => (
      <ExpandableWrapper title="Test">
        <div>Content</div>
      </ExpandableWrapper>
    ))

    fireEvent.click(getByLabelText('Expand to fullscreen'))

    expect(queryByLabelText('Copy to clipboard')).toBeNull()
  })

  it('copies data to clipboard when copy button is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const testData = `col1\tcol2\nval1\tval2`
    const { getByLabelText } = render(() => (
      <ExpandableWrapper title="Test" copyData={testData}>
        <div>Content</div>
      </ExpandableWrapper>
    ))

    fireEvent.click(getByLabelText('Expand to fullscreen'))
    fireEvent.click(getByLabelText('Copy to clipboard'))

    expect(writeText).toHaveBeenCalledWith(testData)
  })

  it('uses default title "Expanded view" when no title provided', async () => {
    const { getByLabelText, getByText } = render(() => (
      <ExpandableWrapper>
        <div>Content</div>
      </ExpandableWrapper>
    ))

    fireEvent.click(getByLabelText('Expand to fullscreen'))

    // v6.6.0: default heading comes from MCPUIStrings.expandedView (D2).
    // Also unified to a single casing — the pre-v6.6.0 code had
    // 'Expanded View' as the heading but 'Expanded view' as the aria-label.
    expect(getByText('Expanded view')).toBeDefined()
  })

  it('expanded content area is scrollable (overflow-auto)', async () => {
    const { getByLabelText, getByRole } = render(() => (
      <ExpandableWrapper title="Scrollable Table">
        <div style={{ height: '2000px' }}>Tall content</div>
      </ExpandableWrapper>
    ))

    fireEvent.click(getByLabelText('Expand to fullscreen'))

    const dialog = getByRole('dialog')
    // Content area inside the modal panel should have overflow-auto
    const contentArea = dialog.querySelector('.overflow-auto')
    expect(contentArea).not.toBeNull()
    expect(contentArea!.classList.contains('overflow-auto')).toBe(true)
  })

  it('closes modal on backdrop click', async () => {
    const { getByLabelText, getByRole, queryByRole } = render(() => (
      <ExpandableWrapper title="Test">
        <div>Content</div>
      </ExpandableWrapper>
    ))

    fireEvent.click(getByLabelText('Expand to fullscreen'))
    const dialog = getByRole('dialog')
    expect(dialog).toBeDefined()

    // Click directly on the backdrop (the dialog element itself, not the inner panel)
    fireEvent.click(dialog)

    expect(queryByRole('dialog')).toBeNull()
  })

  it('has dark theme classes on modal elements', async () => {
    const { getByLabelText, getByRole } = render(() => (
      <ExpandableWrapper title="Dark Theme Test">
        <div>Content</div>
      </ExpandableWrapper>
    ))

    fireEvent.click(getByLabelText('Expand to fullscreen'))

    const dialog = getByRole('dialog')
    // Modal panel should have dark mode background class
    const panel = dialog.querySelector('.dark\\:bg-gray-800')
    expect(panel).not.toBeNull()

    // Header title should have dark mode text class
    const title = dialog.querySelector('.dark\\:text-white')
    expect(title).not.toBeNull()

    // Header border should have dark mode class
    const header = dialog.querySelector('.dark\\:border-gray-700')
    expect(header).not.toBeNull()
  })

  it('prevents body scroll when expanded', async () => {
    const { getByLabelText } = render(() => (
      <ExpandableWrapper title="Test">
        <div>Content</div>
      </ExpandableWrapper>
    ))

    const originalOverflow = document.body.style.overflow

    fireEvent.click(getByLabelText('Expand to fullscreen'))
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.body.style.overflow).toBe(originalOverflow)
  })
})
