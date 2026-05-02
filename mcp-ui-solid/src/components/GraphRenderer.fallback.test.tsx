/**
 * Fallback-path tests — force `@antv/g6` unimportable via `vi.mock` so we
 * can verify the "peer not installed" UX without removing the workspace
 * dep. Companion to `GraphRenderer.test.tsx` (the helpers + validation
 * pass-through suite).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, cleanup, waitFor } from '@solidjs/testing-library'
import { UIResourceRenderer } from './UIResourceRenderer'
import type { UIComponent } from '../types'

vi.mock('@antv/g6', () => {
  // Throwing from the factory makes `import('@antv/g6')` reject in the
  // renderer's `isG6Available()` check — same observable behavior as a
  // missing peer dep in a consumer app.
  throw new Error('peer not installed (test mock)')
})

describe('<GraphRenderer> fallback when @antv/g6 peer is unimportable (v6.0.0)', () => {
  beforeEach(() => {
    cleanup()
  })

  function graphComponent(): UIComponent {
    return {
      id: 'g-no-peer',
      type: 'graph',
      position: { colStart: 1, colSpan: 12 },
      params: { nodes: [{ id: 'a' }] } as any,
    }
  }

  it('renders the yellow informative fallback instead of crashing', async () => {
    const { container } = render(() => (
      <UIResourceRenderer content={graphComponent()} />
    ))
    await waitFor(() => {
      expect(container.textContent).toContain('Graph rendering unavailable')
    })
    expect(container.textContent).toContain('@antv/g6')
  })

  it('does not throw on mount/unmount cycles', () => {
    expect(() => {
      const { unmount } = render(() => <UIResourceRenderer content={graphComponent()} />)
      unmount()
    }).not.toThrow()
  })
})
