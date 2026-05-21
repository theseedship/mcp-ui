/**
 * v6.6.0 — MCPUIStringsProvider (D2 / R4 of ROADMAP-opendata-macro-mcpui).
 *
 * Coverage:
 *   1. Defaults are English, available with no provider mounted
 *   2. Provider does a partial merge over the EN defaults
 *   3. FeedbackInline reads chrome strings from the provider
 *   4. FeedbackInline `positiveAck` / `negativeAck` props still win over the provider
 *   5. ExpandableWrapper reads the expand-button tooltip from the provider
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import {
  MCPUIStringsProvider,
  useMCPUIStrings,
  DEFAULT_MCPUI_STRINGS,
} from './MCPUIStringsContext'
import { FeedbackInline } from '../components/FeedbackInline'
import { ExpandableWrapper } from '../components/ExpandableWrapper'

describe('MCPUIStringsContext (v6.6.0)', () => {
  beforeEach(() => cleanup())

  it('defaults are English', () => {
    expect(DEFAULT_MCPUI_STRINGS.expand).toBe('Expand')
    expect(DEFAULT_MCPUI_STRINGS.feedbackUseful).toBe('Useful')
    expect(DEFAULT_MCPUI_STRINGS.feedbackPositiveAck).toBe('Thanks!')
    expect(DEFAULT_MCPUI_STRINGS.retry).toBe('Retry')
  })

  it('useMCPUIStrings returns the EN defaults with no provider mounted', () => {
    let captured: ReturnType<typeof useMCPUIStrings> | undefined
    const Probe = () => {
      captured = useMCPUIStrings()
      return <span>probe</span>
    }
    render(() => <Probe />)
    expect(captured).toEqual(DEFAULT_MCPUI_STRINGS)
  })

  it('provider partial-merges over the EN defaults', () => {
    let captured: ReturnType<typeof useMCPUIStrings> | undefined
    const Probe = () => {
      captured = useMCPUIStrings()
      return <span>probe</span>
    }
    render(() => (
      <MCPUIStringsProvider strings={{ expand: 'Agrandir', feedbackUseful: 'Utile' }}>
        <Probe />
      </MCPUIStringsProvider>
    ))
    // Overridden keys
    expect(captured!.expand).toBe('Agrandir')
    expect(captured!.feedbackUseful).toBe('Utile')
    // Untouched keys fall back to EN
    expect(captured!.retry).toBe('Retry')
    expect(captured!.closeExpandedView).toBe('Close expanded view')
  })

  it('FeedbackInline reads its ack from the provider (FR override)', () => {
    const { getByText, container } = render(() => (
      <MCPUIStringsProvider
        strings={{ feedbackPositiveAck: 'Merci !', feedbackUseful: 'Utile' }}
      >
        <FeedbackInline onSubmit={() => {}} />
      </MCPUIStringsProvider>
    ))
    // Tooltip from provider
    const upBtn = container.querySelector('[data-feedback-inline-rating="positive"]')
    expect(upBtn?.getAttribute('title')).toBe('Utile')
    // Ack from provider after click
    fireEvent.click(upBtn!)
    expect(getByText('Merci !')).toBeTruthy()
  })

  it('FeedbackInline defaults to EN ack when no provider is mounted', () => {
    const { getByText, container } = render(() => <FeedbackInline onSubmit={() => {}} />)
    const upBtn = container.querySelector('[data-feedback-inline-rating="positive"]')
    fireEvent.click(upBtn!)
    expect(getByText('Thanks!')).toBeTruthy()
  })

  it('FeedbackInline positiveAck prop still wins over the provider', () => {
    const { getByText, container } = render(() => (
      <MCPUIStringsProvider strings={{ feedbackPositiveAck: 'FromProvider' }}>
        <FeedbackInline onSubmit={() => {}} positiveAck="FromProp" />
      </MCPUIStringsProvider>
    ))
    const upBtn = container.querySelector('[data-feedback-inline-rating="positive"]')
    fireEvent.click(upBtn!)
    expect(getByText('FromProp')).toBeTruthy()
  })

  it('ExpandableWrapper reads the expand-button tooltip from the provider', () => {
    const { container } = render(() => (
      <MCPUIStringsProvider strings={{ expand: 'Plein écran' }}>
        <ExpandableWrapper title="Données">
          <div>content</div>
        </ExpandableWrapper>
      </MCPUIStringsProvider>
    ))
    const expandBtn = container.querySelector('button[aria-label="Expand to fullscreen"]')
    expect(expandBtn?.getAttribute('title')).toBe('Plein écran')
  })

  it('ExpandableWrapper falls back to EN with no provider', () => {
    const { container } = render(() => (
      <ExpandableWrapper title="Data">
        <div>content</div>
      </ExpandableWrapper>
    ))
    const expandBtn = container.querySelector('button[aria-label="Expand to fullscreen"]')
    expect(expandBtn?.getAttribute('title')).toBe('Expand')
  })
})
