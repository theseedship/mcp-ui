/**
 * v6.6.0 — PresentationFeedback (R3 / D9 of ROADMAP-opendata-macro-mcpui).
 *
 * Coverage:
 *   1. Resting step shows the verdict buttons
 *   2. "Clear" submits a `readable` verdict immediately
 *   3. "Not clear" opens the detail step (does NOT submit yet)
 *   4. Detail step assembles problems + preferredLayout + comment into the payload
 *   5. base fields (connectorId/toolName/queryHash/renderKind/layoutType) are carried
 *   6. Submission is best-effort — a rejected onSubmit promise does not throw
 *   7. Labels are overridable via the `labels` prop
 *   8. The layout picker is hidden when no options are given
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { PresentationFeedback } from './PresentationFeedback'
import type { ConnectorRenderFeedback } from '@seed-ship/mcp-ui-spec'

const BASE = {
  connectorId: 'datagouv',
  toolName: 'datagouv.search',
  queryHash: 'a1b2c3d4',
  renderKind: 'primary',
  layoutType: 'table',
}

describe('PresentationFeedback (v6.6.0)', () => {
  beforeEach(() => cleanup())

  it('resting step shows both verdict buttons', () => {
    const { container } = render(() => (
      <PresentationFeedback {...BASE} onSubmit={() => {}} />
    ))
    expect(container.querySelector('[data-presentation-feedback-verdict="readable"]')).toBeTruthy()
    expect(
      container.querySelector('[data-presentation-feedback-verdict="not_readable"]')
    ).toBeTruthy()
    expect(container.querySelector('[data-presentation-feedback-step="idle"]')).toBeTruthy()
  })

  it('"Clear" submits a readable verdict immediately', () => {
    const onSubmit = vi.fn()
    const { container } = render(() => (
      <PresentationFeedback {...BASE} onSubmit={onSubmit} />
    ))
    fireEvent.click(container.querySelector('[data-presentation-feedback-verdict="readable"]')!)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as ConnectorRenderFeedback
    expect(payload.verdict).toBe('readable')
    expect(payload.connectorId).toBe('datagouv')
    expect(payload.queryHash).toBe('a1b2c3d4')
    expect(payload.renderKind).toBe('primary')
    expect(payload.layoutType).toBe('table')
  })

  it('"Not clear" opens the detail step without submitting', () => {
    const onSubmit = vi.fn()
    const { container } = render(() => (
      <PresentationFeedback {...BASE} onSubmit={onSubmit} />
    ))
    fireEvent.click(container.querySelector('[data-presentation-feedback-verdict="not_readable"]')!)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(container.querySelector('[data-presentation-feedback-step="detail"]')).toBeTruthy()
    expect(container.querySelector('[data-presentation-feedback-submit]')).toBeTruthy()
  })

  it('detail step assembles problems + preferredLayout + comment', () => {
    const onSubmit = vi.fn()
    const { container } = render(() => (
      <PresentationFeedback
        {...BASE}
        onSubmit={onSubmit}
        preferredLayoutOptions={['table', 'bar', 'map']}
      />
    ))
    fireEvent.click(container.querySelector('[data-presentation-feedback-verdict="not_readable"]')!)
    fireEvent.click(container.querySelector('[data-presentation-feedback-problem="too_raw"]')!)
    fireEvent.click(
      container.querySelector('[data-presentation-feedback-problem="wrong_columns"]')!
    )
    fireEvent.click(container.querySelector('[data-presentation-feedback-layout="bar"]')!)
    const textarea = container.querySelector('[data-presentation-feedback-comment]') as HTMLTextAreaElement
    fireEvent.input(textarea, { target: { value: 'prefer a chart' } })
    fireEvent.click(container.querySelector('[data-presentation-feedback-submit]')!)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as ConnectorRenderFeedback
    expect(payload.verdict).toBe('not_readable')
    expect(payload.problems).toEqual(['too_raw', 'wrong_columns'])
    expect(payload.preferredLayout).toBe('bar')
    expect(payload.comment).toBe('prefer a chart')
  })

  it('deselecting a problem chip removes it from the payload', () => {
    const onSubmit = vi.fn()
    const { container } = render(() => (
      <PresentationFeedback {...BASE} onSubmit={onSubmit} />
    ))
    fireEvent.click(container.querySelector('[data-presentation-feedback-verdict="not_readable"]')!)
    const chip = container.querySelector('[data-presentation-feedback-problem="wrong_chart"]')!
    fireEvent.click(chip) // select
    fireEvent.click(chip) // deselect
    fireEvent.click(container.querySelector('[data-presentation-feedback-submit]')!)
    const payload = onSubmit.mock.calls[0][0] as ConnectorRenderFeedback
    expect(payload.problems).toBeUndefined()
  })

  it('flips to the ack step after submitting', () => {
    const { container } = render(() => (
      <PresentationFeedback {...BASE} onSubmit={() => {}} />
    ))
    fireEvent.click(container.querySelector('[data-presentation-feedback-verdict="readable"]')!)
    expect(container.querySelector('[data-presentation-feedback-ack]')).toBeTruthy()
  })

  it('submission is best-effort — a rejected onSubmit promise does not throw', () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error('network down')))
    const { container } = render(() => (
      <PresentationFeedback {...BASE} onSubmit={onSubmit} />
    ))
    expect(() =>
      fireEvent.click(container.querySelector('[data-presentation-feedback-verdict="readable"]')!)
    ).not.toThrow()
    expect(container.querySelector('[data-presentation-feedback-ack]')).toBeTruthy()
  })

  it('labels are overridable via the labels prop', () => {
    const { container } = render(() => (
      <PresentationFeedback
        {...BASE}
        onSubmit={() => {}}
        labels={{ readable: 'Lisible', notReadable: 'Pas lisible' }}
      />
    ))
    const readableBtn = container.querySelector(
      '[data-presentation-feedback-verdict="readable"]'
    )
    expect(readableBtn?.textContent).toBe('Lisible')
  })

  it('hides the layout picker when no options are given', () => {
    const { container } = render(() => (
      <PresentationFeedback {...BASE} onSubmit={() => {}} />
    ))
    fireEvent.click(container.querySelector('[data-presentation-feedback-verdict="not_readable"]')!)
    expect(container.querySelector('[data-presentation-feedback-layout]')).toBeNull()
  })

  it('omits queryHash from the payload when not provided', () => {
    const onSubmit = vi.fn()
    const { container } = render(() => (
      <PresentationFeedback
        connectorId="c"
        toolName="t"
        onSubmit={onSubmit}
      />
    ))
    fireEvent.click(container.querySelector('[data-presentation-feedback-verdict="readable"]')!)
    const payload = onSubmit.mock.calls[0][0] as ConnectorRenderFeedback
    expect(payload.queryHash).toBeUndefined()
  })
})
