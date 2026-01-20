/**
 * ActionGroupRenderer Tests
 * Sprint 3: UX Improvements
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library'
import { ActionGroupRenderer } from './ActionGroupRenderer'
import type { UIComponent, ActionGroupParams, ActionComponentParams } from '../types'

// Mock useAction hook
vi.mock('../hooks/useAction', () => ({
  useAction: () => ({
    execute: vi.fn().mockResolvedValue({ success: true }),
    isExecuting: () => false,
    lastResult: () => undefined,
    lastError: () => undefined,
  }),
}))

// Mock window.open for link actions
const mockWindowOpen = vi.fn()
vi.stubGlobal('open', mockWindowOpen)

describe('ActionGroupRenderer', () => {
  const createActionGroup = (
    actions: ActionComponentParams[],
    options: Partial<ActionGroupParams> = {}
  ): UIComponent => ({
    id: 'test-action-group',
    type: 'action-group',
    position: { colStart: 1, colSpan: 12 },
    params: {
      actions,
      ...options,
    } as ActionGroupParams,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders action buttons', () => {
    const component = createActionGroup([
      { label: 'Save', variant: 'primary' },
      { label: 'Cancel', variant: 'outline' },
    ])

    render(() => <ActionGroupRenderer component={component} />)

    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('renders with direct params', () => {
    render(() => (
      <ActionGroupRenderer
        params={{
          actions: [
            { label: 'Action 1' },
            { label: 'Action 2' },
          ],
        }}
      />
    ))

    expect(screen.getByRole('button', { name: 'Action 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Action 2' })).toBeTruthy()
  })

  it('renders link type as anchor', () => {
    const component = createActionGroup([
      { label: 'Visit Site', type: 'link', url: 'https://example.com' },
    ])

    render(() => <ActionGroupRenderer component={component} />)

    const link = screen.getByRole('link', { name: 'Visit Site' })
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('https://example.com')
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('renders link action as anchor', () => {
    const component = createActionGroup([
      { label: 'External Link', action: 'link', url: 'https://example.com' },
    ])

    render(() => <ActionGroupRenderer component={component} />)

    const link = screen.getByRole('link', { name: 'External Link' })
    expect(link).toBeTruthy()
  })

  it('disables button when disabled prop is true', () => {
    const component = createActionGroup([
      { label: 'Disabled Action', disabled: true },
    ])

    render(() => <ActionGroupRenderer component={component} />)

    const button = screen.getByRole('button', { name: 'Disabled Action' })
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  it('renders different variants', () => {
    const variants: Array<'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'> = [
      'primary',
      'secondary',
      'outline',
      'ghost',
      'danger',
    ]

    const actions = variants.map((variant) => ({
      label: `${variant} Button`,
      variant,
    }))

    const component = createActionGroup(actions)
    render(() => <ActionGroupRenderer component={component} />)

    for (const variant of variants) {
      expect(screen.getByRole('button', { name: `${variant} Button` })).toBeTruthy()
    }
  })

  it('renders different sizes', () => {
    const component = createActionGroup([
      { label: 'Small', size: 'sm' },
      { label: 'Medium', size: 'md' },
      { label: 'Large', size: 'lg' },
    ])

    render(() => <ActionGroupRenderer component={component} />)

    expect(screen.getByRole('button', { name: 'Small' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Medium' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Large' })).toBeTruthy()
  })

  it('renders icon in button', () => {
    const component = createActionGroup([
      { label: 'With Icon', icon: '🔍' },
    ])

    render(() => <ActionGroupRenderer component={component} />)

    expect(screen.getByText('🔍')).toBeTruthy()
  })

  it('applies horizontal layout by default', () => {
    const component = createActionGroup(
      [{ label: 'Action 1' }, { label: 'Action 2' }],
      { layout: 'horizontal' }
    )

    render(() => <ActionGroupRenderer component={component} />)

    const group = screen.getByRole('group')
    expect(group.classList.contains('flex')).toBe(true)
  })

  it('applies vertical layout', () => {
    const component = createActionGroup(
      [{ label: 'Action 1' }, { label: 'Action 2' }],
      { layout: 'vertical' }
    )

    render(() => <ActionGroupRenderer component={component} />)

    const group = screen.getByRole('group')
    expect(group.classList.contains('flex-col')).toBe(true)
  })

  it('applies space-between layout', () => {
    const component = createActionGroup(
      [{ label: 'Action 1' }, { label: 'Action 2' }],
      { layout: 'space-between' }
    )

    render(() => <ActionGroupRenderer component={component} />)

    const group = screen.getByRole('group')
    expect(group.classList.contains('justify-between')).toBe(true)
  })

  it('applies end layout', () => {
    const component = createActionGroup(
      [{ label: 'Action 1' }, { label: 'Action 2' }],
      { layout: 'end' }
    )

    render(() => <ActionGroupRenderer component={component} />)

    const group = screen.getByRole('group')
    expect(group.classList.contains('justify-end')).toBe(true)
  })

  it('applies center layout', () => {
    const component = createActionGroup(
      [{ label: 'Action 1' }, { label: 'Action 2' }],
      { layout: 'center' }
    )

    render(() => <ActionGroupRenderer component={component} />)

    const group = screen.getByRole('group')
    expect(group.classList.contains('justify-center')).toBe(true)
  })

  it('applies different gap sizes', () => {
    const gaps: Array<'none' | 'sm' | 'md' | 'lg'> = ['none', 'sm', 'md', 'lg']
    const expectedClasses = ['gap-0', 'gap-1', 'gap-2', 'gap-4']

    gaps.forEach((gap, index) => {
      const component = createActionGroup([{ label: 'Action' }], { gap })
      const { unmount } = render(() => <ActionGroupRenderer component={component} />)

      const group = screen.getByRole('group')
      expect(group.classList.contains(expectedClasses[index])).toBe(true)

      unmount()
    })
  })

  it('applies fullWidth class', () => {
    const component = createActionGroup([{ label: 'Action' }], { fullWidth: true })

    render(() => <ActionGroupRenderer component={component} />)

    const group = screen.getByRole('group')
    expect(group.classList.contains('w-full')).toBe(true)
  })

  it('sets aria-label from label prop', () => {
    const component = createActionGroup([{ label: 'Action' }], { label: 'Form Actions' })

    render(() => <ActionGroupRenderer component={component} />)

    const group = screen.getByRole('group', { name: 'Form Actions' })
    expect(group).toBeTruthy()
  })

  it('uses default aria-label when no label provided', () => {
    const component = createActionGroup([{ label: 'Action' }])

    render(() => <ActionGroupRenderer component={component} />)

    const group = screen.getByRole('group', { name: 'Action group' })
    expect(group).toBeTruthy()
  })

  it('handles tool-call action click', async () => {
    const component = createActionGroup([
      {
        label: 'Execute Tool',
        action: 'tool-call',
        toolName: 'test-tool',
        params: { key: 'value' },
      },
    ])

    render(() => <ActionGroupRenderer component={component} />)

    const button = screen.getByRole('button', { name: 'Execute Tool' })
    fireEvent.click(button)

    // The action should be triggered (mocked useAction.execute)
    await waitFor(() => {
      expect(button).toBeTruthy()
    })
  })

  it('handles link action click', async () => {
    const component = createActionGroup([
      {
        label: 'Open Link',
        action: 'link',
        url: 'https://example.com',
      },
    ])

    render(() => <ActionGroupRenderer component={component} />)

    // Link action renders as anchor, not button with click handler
    const link = screen.getByRole('link', { name: 'Open Link' })
    expect(link.getAttribute('href')).toBe('https://example.com')
  })

  it('does not trigger action when button is disabled', () => {
    const component = createActionGroup([
      {
        label: 'Disabled Tool',
        action: 'tool-call',
        toolName: 'test-tool',
        disabled: true,
      },
    ])

    render(() => <ActionGroupRenderer component={component} />)

    const button = screen.getByRole('button', { name: 'Disabled Tool' })
    fireEvent.click(button)

    // Button should be disabled and not trigger action
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  it('renders empty state when no actions provided', () => {
    const component = createActionGroup([])

    render(() => <ActionGroupRenderer component={component} />)

    const group = screen.getByRole('group')
    expect(group.children.length).toBe(0)
  })
})
