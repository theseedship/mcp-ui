/**
 * ModalRenderer Tests
 * Sprint 3: UX Improvements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library'
import { ModalRenderer } from './ModalRenderer'
import { useModal, useConfirmModal } from '../hooks/useModal'
import { createSignal } from 'solid-js'
import type { UIComponent, ModalComponentParams } from '../types'

describe('ModalRenderer', () => {
  const createModalComponent = (params: Partial<ModalComponentParams> = {}): UIComponent => ({
    id: 'test-modal',
    type: 'modal',
    position: { colStart: 1, colSpan: 12 },
    params: {
      title: 'Test Modal',
      size: 'md',
      ...params,
    } as ModalComponentParams,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('renders modal when isOpen is true', () => {
    render(() => (
      <ModalRenderer
        params={{ title: 'Test Modal' }}
        isOpen={true}
        onClose={() => {}}
      >
        <p>Modal content</p>
      </ModalRenderer>
    ))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Test Modal')).toBeTruthy()
    expect(screen.getByText('Modal content')).toBeTruthy()
  })

  it('does not render modal when isOpen is false', () => {
    render(() => (
      <ModalRenderer
        params={{ title: 'Test Modal' }}
        isOpen={false}
        onClose={() => {}}
      >
        <p>Modal content</p>
      </ModalRenderer>
    ))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Modal content')).toBeNull()
  })

  it('renders modal with component props', () => {
    const component = createModalComponent({ title: 'Component Modal' })

    render(() => (
      <ModalRenderer
        component={component}
        isOpen={true}
        onClose={() => {}}
      >
        <p>Content from component</p>
      </ModalRenderer>
    ))

    expect(screen.getByText('Component Modal')).toBeTruthy()
    expect(screen.getByText('Content from component')).toBeTruthy()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()

    render(() => (
      <ModalRenderer
        params={{ title: 'Test Modal' }}
        isOpen={true}
        onClose={onClose}
      >
        <p>Content</p>
      </ModalRenderer>
    ))

    const closeButton = screen.getByLabelText('Close modal')
    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()

    render(() => (
      <ModalRenderer
        params={{ title: 'Test Modal', closeOnBackdrop: true }}
        isOpen={true}
        onClose={onClose}
      >
        <p>Content</p>
      </ModalRenderer>
    ))

    const backdrop = screen.getByRole('dialog')
    fireEvent.click(backdrop)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('does not close when backdrop click is disabled', async () => {
    const onClose = vi.fn()

    render(() => (
      <ModalRenderer
        params={{ title: 'Test Modal', closeOnBackdrop: false }}
        isOpen={true}
        onClose={onClose}
      >
        <p>Content</p>
      </ModalRenderer>
    ))

    const backdrop = screen.getByRole('dialog')
    fireEvent.click(backdrop)

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn()

    render(() => (
      <ModalRenderer
        params={{ title: 'Test Modal', closeOnEscape: true }}
        isOpen={true}
        onClose={onClose}
      >
        <p>Content</p>
      </ModalRenderer>
    ))

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('does not close when Escape is disabled', async () => {
    const onClose = vi.fn()

    render(() => (
      <ModalRenderer
        params={{ title: 'Test Modal', closeOnEscape: false }}
        isOpen={true}
        onClose={onClose}
      >
        <p>Content</p>
      </ModalRenderer>
    ))

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  it('hides close button when showClose is false', () => {
    render(() => (
      <ModalRenderer
        params={{ title: 'Test Modal', showClose: false }}
        isOpen={true}
        onClose={() => {}}
      >
        <p>Content</p>
      </ModalRenderer>
    ))

    expect(screen.queryByLabelText('Close modal')).toBeNull()
  })

  it('renders different sizes correctly', () => {
    const sizes: Array<'sm' | 'md' | 'lg' | 'xl' | 'full'> = ['sm', 'md', 'lg', 'xl', 'full']

    for (const size of sizes) {
      const { unmount } = render(() => (
        <ModalRenderer
          params={{ title: `Modal ${size}`, size }}
          isOpen={true}
          onClose={() => {}}
        >
          <p>Content</p>
        </ModalRenderer>
      ))

      expect(screen.getByText(`Modal ${size}`)).toBeTruthy()
      unmount()
    }
  })

  it('prevents body scroll when open', async () => {
    const TestComponent = () => {
      const [isOpen, setIsOpen] = createSignal(false)
      return (
        <>
          <button onClick={() => setIsOpen(true)}>Open</button>
          <ModalRenderer
            params={{ title: 'Test Modal' }}
            isOpen={isOpen()}
            onClose={() => setIsOpen(false)}
          >
            <p>Content</p>
          </ModalRenderer>
        </>
      )
    }

    render(() => <TestComponent />)

    expect(document.body.style.overflow).toBe('')

    const openButton = screen.getByText('Open')
    fireEvent.click(openButton)

    await waitFor(() => {
      expect(document.body.style.overflow).toBe('hidden')
    })
  })

  it('renders without title', () => {
    render(() => (
      <ModalRenderer
        params={{}}
        isOpen={true}
        onClose={() => {}}
      >
        <p>Content only</p>
      </ModalRenderer>
    ))

    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByText('Content only')).toBeTruthy()
  })

  it('renders content with maxHeight style', () => {
    render(() => (
      <ModalRenderer
        params={{ title: 'Test Modal', maxHeight: '400px' }}
        isOpen={true}
        onClose={() => {}}
      >
        <p>Scrollable content</p>
      </ModalRenderer>
    ))

    expect(screen.getByText('Scrollable content')).toBeTruthy()
  })
})

describe('useModal hook', () => {
  it('initializes with default closed state', () => {
    const TestComponent = () => {
      const { isOpen } = useModal()
      return <p>{isOpen() ? 'open' : 'closed'}</p>
    }

    render(() => <TestComponent />)
    expect(screen.getByText('closed')).toBeTruthy()
  })

  it('initializes with custom initial state', () => {
    const TestComponent = () => {
      const { isOpen } = useModal(true)
      return <p>{isOpen() ? 'open' : 'closed'}</p>
    }

    render(() => <TestComponent />)
    expect(screen.getByText('open')).toBeTruthy()
  })

  it('opens and closes modal', async () => {
    const TestComponent = () => {
      const { isOpen, open, close } = useModal()
      return (
        <>
          <p>{isOpen() ? 'open' : 'closed'}</p>
          <button onClick={open}>Open</button>
          <button onClick={close}>Close</button>
        </>
      )
    }

    render(() => <TestComponent />)

    expect(screen.getByText('closed')).toBeTruthy()

    fireEvent.click(screen.getByText('Open'))
    await waitFor(() => {
      expect(screen.getByText('open')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Close'))
    await waitFor(() => {
      expect(screen.getByText('closed')).toBeTruthy()
    })
  })

  it('toggles modal state', async () => {
    const TestComponent = () => {
      const { isOpen, toggle } = useModal()
      return (
        <>
          <p>{isOpen() ? 'open' : 'closed'}</p>
          <button onClick={toggle}>Toggle</button>
        </>
      )
    }

    render(() => <TestComponent />)

    fireEvent.click(screen.getByText('Toggle'))
    await waitFor(() => {
      expect(screen.getByText('open')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Toggle'))
    await waitFor(() => {
      expect(screen.getByText('closed')).toBeTruthy()
    })
  })
})

describe('useConfirmModal hook', () => {
  it('resolves with true when confirmed', async () => {
    let confirmResult: boolean | null = null

    const TestComponent = () => {
      const { isOpen, confirm, handleConfirm, handleCancel } = useConfirmModal()

      const handleClick = async () => {
        confirmResult = await confirm()
      }

      return (
        <>
          <button onClick={handleClick}>Show Confirm</button>
          {isOpen() && (
            <div>
              <p>Confirm dialog</p>
              <button onClick={handleConfirm}>Yes</button>
              <button onClick={handleCancel}>No</button>
            </div>
          )}
        </>
      )
    }

    render(() => <TestComponent />)

    fireEvent.click(screen.getByText('Show Confirm'))

    await waitFor(() => {
      expect(screen.getByText('Confirm dialog')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Yes'))

    await waitFor(() => {
      expect(confirmResult).toBe(true)
      expect(screen.queryByText('Confirm dialog')).toBeNull()
    })
  })

  it('resolves with false when cancelled', async () => {
    let confirmResult: boolean | null = null

    const TestComponent = () => {
      const { isOpen, confirm, handleConfirm, handleCancel } = useConfirmModal()

      const handleClick = async () => {
        confirmResult = await confirm()
      }

      return (
        <>
          <button onClick={handleClick}>Show Confirm</button>
          {isOpen() && (
            <div>
              <p>Confirm dialog</p>
              <button onClick={handleConfirm}>Yes</button>
              <button onClick={handleCancel}>No</button>
            </div>
          )}
        </>
      )
    }

    render(() => <TestComponent />)

    fireEvent.click(screen.getByText('Show Confirm'))

    await waitFor(() => {
      expect(screen.getByText('Confirm dialog')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('No'))

    await waitFor(() => {
      expect(confirmResult).toBe(false)
      expect(screen.queryByText('Confirm dialog')).toBeNull()
    })
  })
})
