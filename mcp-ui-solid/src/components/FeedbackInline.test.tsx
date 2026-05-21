/**
 * Tests for FeedbackInline component — v5.2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { FeedbackInline } from './FeedbackInline'

describe('FeedbackInline — v5.2.0', () => {
  beforeEach(() => {
    cleanup()
  })

  it('renders two rating buttons by default', () => {
    const { container } = render(() => <FeedbackInline onSubmit={() => {}} />)
    const positive = container.querySelector('[data-feedback-inline-rating="positive"]')
    const negative = container.querySelector('[data-feedback-inline-rating="negative"]')
    expect(positive).toBeDefined()
    expect(negative).toBeDefined()
  })

  it('click thumb-up calls onSubmit with positive + context and shows ack', () => {
    const onSubmit = vi.fn()
    const { container, getByText } = render(() => (
      <FeedbackInline
        onSubmit={onSubmit}
        context={{ intent: 'search', confidenceBand: 'high' }}
      />
    ))
    const positive = container.querySelector(
      '[data-feedback-inline-rating="positive"]'
    ) as HTMLElement
    fireEvent.click(positive)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('positive', {
      intent: 'search',
      confidenceBand: 'high',
    })
    // v6.6.0: default ack is now EN (MCPUIStrings.feedbackPositiveAck) — R4.
    expect(getByText('Thanks!')).toBeDefined()
  })

  it('click thumb-down calls onSubmit with negative and shows negative ack', () => {
    const onSubmit = vi.fn()
    const { container, getByText } = render(() => <FeedbackInline onSubmit={onSubmit} />)
    const negative = container.querySelector(
      '[data-feedback-inline-rating="negative"]'
    ) as HTMLElement
    fireEvent.click(negative)

    expect(onSubmit).toHaveBeenCalledWith('negative', undefined)
    // v6.6.0: default ack is now EN (MCPUIStrings.feedbackNegativeAck) — R4.
    expect(getByText("Noted — we'll improve")).toBeDefined()
  })

  it('second click after rating is a no-op (final state)', () => {
    const onSubmit = vi.fn()
    const { container } = render(() => <FeedbackInline onSubmit={onSubmit} />)
    const positive = container.querySelector(
      '[data-feedback-inline-rating="positive"]'
    ) as HTMLElement
    fireEvent.click(positive)
    // After first click, buttons are replaced by ack text — there's no button
    // to click, but verify onSubmit isn't called again via any stale ref
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-feedback-inline-rating]')).toBeNull()
  })

  it('custom positiveAck / negativeAck text is rendered', () => {
    const { container, getByText, unmount } = render(() => (
      <FeedbackInline
        onSubmit={() => {}}
        positiveAck="Thanks!"
        negativeAck="Got it, sorry"
      />
    ))
    const positive = container.querySelector(
      '[data-feedback-inline-rating="positive"]'
    ) as HTMLElement
    fireEvent.click(positive)
    expect(getByText('Thanks!')).toBeDefined()
    unmount()

    const second = render(() => (
      <FeedbackInline
        onSubmit={() => {}}
        positiveAck="Thanks!"
        negativeAck="Got it, sorry"
      />
    ))
    const negative = second.container.querySelector(
      '[data-feedback-inline-rating="negative"]'
    ) as HTMLElement
    fireEvent.click(negative)
    expect(second.getByText('Got it, sorry')).toBeDefined()
  })

  it('onSubmit promise rejection is swallowed (best-effort, UI still flips)', () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('network down'))
    const { container, getByText } = render(() => <FeedbackInline onSubmit={onSubmit} />)
    const positive = container.querySelector(
      '[data-feedback-inline-rating="positive"]'
    ) as HTMLElement
    // Should not throw even though onSubmit rejects
    expect(() => fireEvent.click(positive)).not.toThrow()
    // v6.6.0: default ack is now EN (MCPUIStrings.feedbackPositiveAck) — R4.
    expect(getByText('Thanks!')).toBeDefined()
  })

  it('works without messageHash or context', () => {
    const onSubmit = vi.fn()
    const { container } = render(() => <FeedbackInline onSubmit={onSubmit} />)
    const positive = container.querySelector(
      '[data-feedback-inline-rating="positive"]'
    ) as HTMLElement
    fireEvent.click(positive)
    expect(onSubmit).toHaveBeenCalledWith('positive', undefined)
  })
})
