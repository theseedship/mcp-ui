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
import { createSignal } from 'solid-js'
import {
  MCPUIStringsContext,
  MCPUIStringsProvider,
  useMCPUIStrings,
  DEFAULT_MCPUI_STRINGS,
  type MCPUIStrings,
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
    expect(DEFAULT_MCPUI_STRINGS.chartView).toBe('Chart')
    expect(DEFAULT_MCPUI_STRINGS.chartDataView).toBe('Data')
    expect(DEFAULT_MCPUI_STRINGS.paginationPrevious).toBe('Previous page')
    expect(DEFAULT_MCPUI_STRINGS.paginationNext).toBe('Next page')
    expect(DEFAULT_MCPUI_STRINGS.paginationPageSize).toBe('Rows per page')
    expect(DEFAULT_MCPUI_STRINGS.gridRegion).toBe('Layout grid')
  })

  it('provider partial-merges pagination/grid overrides over the EN defaults', () => {
    let captured: ReturnType<typeof useMCPUIStrings> | undefined
    const Probe = () => {
      captured = useMCPUIStrings()
      return <span>probe</span>
    }
    render(() => (
      <MCPUIStringsProvider
        strings={{ paginationPrevious: 'Page précédente', gridRegion: 'Grille de mise en page' }}
      >
        <Probe />
      </MCPUIStringsProvider>
    ))
    expect(captured!.paginationPrevious).toBe('Page précédente')
    expect(captured!.gridRegion).toBe('Grille de mise en page')
    // Untouched keys fall back to EN
    expect(captured!.paginationNext).toBe('Next page')
    expect(captured!.paginationPageSize).toBe('Rows per page')
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

  it('accepts a legacy typed dictionary and resolves chart defaults through the direct context', () => {
    const legacyStrings: MCPUIStrings = {
      expand: 'Legacy expand',
      expandedView: 'Legacy expanded view',
      copyToClipboard: 'Legacy copy',
      closeExpandedView: 'Legacy close',
      feedbackUseful: 'Legacy useful',
      feedbackNotUseful: 'Legacy not useful',
      feedbackPositiveAck: 'Legacy positive',
      feedbackNegativeAck: 'Legacy negative',
      retry: 'Legacy retry',
    }
    let captured: ReturnType<typeof useMCPUIStrings> | undefined
    const Probe = () => {
      captured = useMCPUIStrings()
      return <span>probe</span>
    }

    render(() => (
      <MCPUIStringsContext.Provider value={legacyStrings}>
        <Probe />
      </MCPUIStringsContext.Provider>
    ))

    expect(captured!.expand).toBe('Legacy expand')
    expect(captured!.chartView).toBe('Chart')
    expect(captured!.chartDataView).toBe('Data')
    expect(captured!.chartViewSelector).toBe('Chart or data view')
  })

  it('keeps replacement provider overrides reactive while resolving omitted defaults', () => {
    const [overrides, setOverrides] = createSignal<Partial<MCPUIStrings>>({
      chartView: 'Diagram',
    })
    const Probe = () => {
      const strings = useMCPUIStrings()
      return (
        <button type="button" onClick={() => setOverrides({ chartView: 'Graphique' })}>
          {strings.chartView}|{strings.chartDataView}
        </button>
      )
    }

    const { getByRole } = render(() => (
      <MCPUIStringsProvider strings={overrides()}>
        <Probe />
      </MCPUIStringsProvider>
    ))
    const button = getByRole('button')

    expect(button.textContent).toBe('Diagram|Data')
    fireEvent.click(button)
    expect(button.textContent).toBe('Graphique|Data')
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
    const expandBtn = container.querySelector('button[data-mcp-ui-action="expand"]')
    expect(expandBtn?.getAttribute('title')).toBe('Plein écran')
    // The ACCESSIBLE NAME must be translated too — `title` alone leaves screen
    // readers on the English default.
    expect(expandBtn?.getAttribute('aria-label')).toBe('Plein écran')
  })

  it('ExpandableWrapper falls back to EN with no provider', () => {
    const { container } = render(() => (
      <ExpandableWrapper title="Data">
        <div>content</div>
      </ExpandableWrapper>
    ))
    const expandBtn = container.querySelector('button[data-mcp-ui-action="expand"]')
    expect(expandBtn?.getAttribute('title')).toBe('Expand')
    expect(expandBtn?.getAttribute('aria-label')).toBe('Expand')
  })
})

describe('FeedbackInline accessible names follow the provider (v6.19.1)', () => {
  it('uses the English defaults for both title and aria-label without a provider', () => {
    const { container } = render(() => <FeedbackInline onSubmit={() => {}} />)
    const up = container.querySelector('button[data-feedback-inline-rating="positive"]')!
    const down = container.querySelector('button[data-feedback-inline-rating="negative"]')!
    expect(up.getAttribute('aria-label')).toBe('Useful')
    expect(up.getAttribute('title')).toBe('Useful')
    expect(down.getAttribute('aria-label')).toBe('Not useful')
    expect(down.getAttribute('title')).toBe('Not useful')
  })

  it('translates the aria-labels, not only the tooltips', () => {
    const { container } = render(() => (
      <MCPUIStringsProvider strings={{ feedbackUseful: 'Utile', feedbackNotUseful: 'Pas utile' }}>
        <FeedbackInline onSubmit={() => {}} />
      </MCPUIStringsProvider>
    ))
    expect(container.querySelector('button[data-feedback-inline-rating="positive"]')!.getAttribute('aria-label')).toBe('Utile')
    expect(container.querySelector('button[data-feedback-inline-rating="negative"]')!.getAttribute('aria-label')).toBe('Pas utile')
    expect(container.innerHTML).not.toContain('Mark response as')
  })
})
