/**
 * v6.15.0 — audit P1.6: a component that reaches the renderer with a type that
 * has no render branch must never produce a silent blank.
 *
 * `errorMode: 'silent'` lets a payload past the validation gate without an
 * error card, so a bogus / known-but-unrendered type would otherwise render
 * nothing. We assert the visible "Unsupported component type" notice instead,
 * and that a real type (`footer`, previously missing a branch) now renders.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@solidjs/testing-library'
import { UIResourceRenderer } from './UIResourceRenderer'
import { MCPUITelemetryProvider } from '../context/MCPUITelemetryContext'
import type { UIComponent } from '../types'

afterEach(cleanup)

const bogus = {
  id: 'x1',
  type: 'totally-made-up' as any,
  position: { colStart: 1, colSpan: 12 },
  params: {},
} satisfies UIComponent

describe('Unsupported component never renders blank (P1.6)', () => {
  it('shows a visible "Unsupported component type" notice', async () => {
    // errorMode: 'silent' skips the validation error card, so the bogus type
    // reaches the render dispatch — the catch-all must still surface it.
    const { container } = render(() => (
      <UIResourceRenderer content={bogus} errorMode="silent" />
    ))

    await waitFor(() => {
      expect(container.textContent ?? '').toContain('Unsupported component type')
    })
    expect(container.textContent).toContain('totally-made-up')
  })

  it('emits a render:error telemetry signal for the unsupported type', async () => {
    const events: Array<{ type: string; errorMessage?: string }> = []
    render(() => (
      <MCPUITelemetryProvider
        sink={(batch) => events.push(...batch)}
        options={{ bufferMs: 0 }}
      >
        <UIResourceRenderer content={bogus} errorMode="silent" />
      </MCPUITelemetryProvider>
    ))

    await waitFor(() => {
      expect(
        events.some(
          (e) => e.type === 'render:error' && /Unsupported component type/.test(e.errorMessage ?? '')
        )
      ).toBe(true)
    })
  })

  it('renders a standalone footer component (previously a silent blank)', async () => {
    const footer: UIComponent = {
      id: 'f1',
      type: 'footer',
      position: { colStart: 1, colSpan: 12 },
      params: { poweredBy: 'Deposium', sourceCount: 3 } as any,
    }
    const { container } = render(() => <UIResourceRenderer content={footer} />)

    await waitFor(() => {
      expect(container.textContent ?? '').toContain('Deposium')
    })
    // Not the unsupported notice — footer is a real renderer now.
    expect(container.textContent).not.toContain('Unsupported component type')
  })
})
