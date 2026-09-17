/**
 * Chrome-strings i18n sweep — DOM-level coverage.
 *
 * Two assertions per surface:
 *   1. with a `<MCPUIStringsProvider>` the rendered attribute is the override
 *   2. with no provider it is the EXACT literal the component hardcoded
 *      before the sweep (regression pin at the DOM level)
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { MCPUIStringsProvider, useMCPUIStrings } from './MCPUIStringsContext'
import { ChatPrompt } from '../components/ChatPrompt'
import { CodeBlockRenderer } from '../components/CodeBlockRenderer'
import { FormRenderer } from '../components/FormRenderer'
import { GraphRenderer } from '../components/GraphRenderer'
import { ImageGalleryRenderer } from '../components/ImageGalleryRenderer'
import { LightboxOverlay } from '../components/LightboxOverlay'
import { ModalRenderer } from '../components/ModalRenderer'
import { ScratchpadPanel } from '../components/ScratchpadPanel'
import { StreamingUIRenderer } from '../components/StreamingUIRenderer'
import { UIResourceRenderer } from '../components/UIResourceRenderer'
import { VerifiedText } from '../components/VerifiedText'
import { VideoRenderer } from '../components/VideoRenderer'
import { FormFieldRenderer } from '../components/FormFieldRenderer'
import { DataPreviewSection } from '../components/DataPreviewSection'
import { GenerativeUIErrorBoundary } from '../components/GenerativeUIErrorBoundary'
import { AgentHandoff } from '../components/AgentHandoff'
import { AutocompleteDropdown } from '../components/AutocompleteDropdown'
import { DegradedFallback } from '../components/DegradedFallback'
import { mapToDegradedTable } from '../utils/degraded-projections'
import type { DataValidation, FormFieldParams, GalleryImage, UIComponent } from '../types'
import type { ScratchpadSection, ScratchpadState } from '../types/chat-bus'

vi.mock('highlight.js', () => ({
  default: {
    highlight: vi.fn((code: string) => ({ value: code })),
    highlightAuto: vi.fn((code: string) => ({ value: code })),
    getLanguage: vi.fn(() => true),
  },
}))

/**
 * `StreamingUIRenderer`'s metadata panel is fed by the SSE hook. Mocking the
 * hook injects a finished run's metadata without standing up an endpoint —
 * same approach as `StreamingUIRenderer.parity.test.tsx`.
 */
const streamingRun = vi.hoisted(() => ({
  metadata: null as Record<string, unknown> | null,
}))

vi.mock('../hooks/useStreamingUI', () => ({
  useStreamingUI: () => ({
    components: () => [],
    isLoading: () => false,
    isStreaming: () => false,
    error: () => null,
    progress: () => ({ message: '', receivedCount: 0, totalCount: null }),
    metadata: () => streamingRun.metadata,
    startStreaming: () => {},
    stopStreaming: () => {},
  }),
}))

afterEach(() => cleanup())

/** Renders `ui` twice: once under a provider, once bare. */
function renderBoth(
  strings: Parameters<typeof MCPUIStringsProvider>[0]['strings'],
  ui: () => JSX.Element
): { withProvider: HTMLElement; withDefaults: HTMLElement } {
  const withProvider = render(() => (
    <MCPUIStringsProvider strings={strings}>{ui()}</MCPUIStringsProvider>
  )).container
  const withDefaults = render(ui).container
  return { withProvider, withDefaults }
}

const attr = (root: ParentNode, selector: string, name: string): string | null =>
  root.querySelector(selector)?.getAttribute(name) ?? null

// Unique per call: `renderBoth` mounts the same component twice, and the
// duplicate-mount registry warns when two live renderers share an id.
let seq = 0
const component = (type: string, params: Record<string, unknown>): UIComponent =>
  ({
    id: `${type}-${++seq}`,
    type,
    position: { colStart: 1, colSpan: 12 },
    params,
  }) as unknown as UIComponent

describe('sweep — CodeBlockRenderer', () => {
  const ui = () => <CodeBlockRenderer params={{ code: 'const a = 1', language: 'js' }} />

  it('reads the copy and search chrome from the provider', () => {
    const { withProvider, withDefaults } = renderBoth(
      { codeCopy: 'Copier le code', codeSearchAria: 'Rechercher dans le code' },
      ui
    )

    expect(attr(withProvider, 'button[title="Copier le code"]', 'aria-label')).toBe(
      'Copier le code'
    )
    expect(attr(withProvider, 'input[type="text"]', 'aria-label')).toBe(
      'Rechercher dans le code'
    )

    // Defaults unchanged
    expect(attr(withDefaults, 'button[title="Copy code"]', 'aria-label')).toBe('Copy code')
    expect(attr(withDefaults, 'input[type="text"]', 'aria-label')).toBe('Search in code')
  })
})

describe('sweep — LightboxOverlay', () => {
  const images: GalleryImage[] = [
    { url: 'https://example.com/1.jpg', alt: 'One' },
    { url: 'https://example.com/2.jpg', alt: 'Two' },
  ]
  const ui = () => (
    <LightboxOverlay images={images} selectedIndex={0} onClose={() => {}} onNavigate={() => {}} />
  )

  it('reads the lightbox chrome from the provider', () => {
    // The overlay renders through a <Portal>, so it lands in document.body.
    render(() => (
      <MCPUIStringsProvider strings={{ lightboxClose: 'Fermer la visionneuse' }}>
        {ui()}
      </MCPUIStringsProvider>
    ))
    expect(document.querySelector('[aria-label="Fermer la visionneuse"]')).not.toBeNull()
    cleanup()

    render(ui)
    expect(document.querySelector('[aria-label="Close lightbox"]')).not.toBeNull()
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Image lightbox'
    )
    expect(document.querySelector('[aria-label="Next image"]')).not.toBeNull()
  })
})

describe('sweep — ModalRenderer', () => {
  const ui = () => (
    <ModalRenderer params={{ title: 'Titre' }} isOpen={true} onClose={() => {}}>
      <p>body</p>
    </ModalRenderer>
  )

  it('reads the close button label from the provider', () => {
    render(() => (
      <MCPUIStringsProvider strings={{ modalClose: 'Fermer la fenêtre' }}>{ui()}</MCPUIStringsProvider>
    ))
    expect(document.querySelector('[aria-label="Fermer la fenêtre"]')).not.toBeNull()
    cleanup()

    render(ui)
    expect(document.querySelector('[aria-label="Close modal"]')).not.toBeNull()
  })
})

describe('sweep — table chrome (UIResourceRenderer)', () => {
  const table = (extra: Record<string, unknown> = {}) =>
    component('table', {
      columns: [{ key: 'revenue', label: 'Revenue' }],
      rows: [{ revenue: 1 }, { revenue: 2 }],
      ...extra,
    })

  it('localizes the CSV copy button and the sortable header', () => {
    const ui = () => <UIResourceRenderer content={table()} />
    const { withProvider, withDefaults } = renderBoth(
      { tableCopyCsv: 'Copier le tableau (CSV)', sortBy: 'Trier par {column}' },
      ui
    )

    expect(attr(withProvider, 'button[data-mcp-ui-action="copy"]', 'title')).toBe(
      'Copier le tableau (CSV)'
    )
    expect(attr(withProvider, 'th', 'title')).toBe('Trier par Revenue')

    expect(attr(withDefaults, 'button[data-mcp-ui-action="copy"]', 'title')).toBe(
      'Copy table (CSV)'
    )
    expect(attr(withDefaults, 'th', 'title')).toBe('Sort by Revenue')
  })

  it('localizes the export menu trigger and the untitled region label', () => {
    const ui = () => <UIResourceRenderer content={table({ exportable: true })} />
    const { withProvider, withDefaults } = renderBoth(
      { tableExport: 'Exporter le tableau', tableAriaLabel: 'Tableau de données' },
      ui
    )

    expect(attr(withProvider, 'button[aria-haspopup="menu"]', 'title')).toBe(
      'Exporter le tableau'
    )
    expect(attr(withProvider, '[role="region"]', 'aria-label')).toBe('Tableau de données')

    expect(attr(withDefaults, 'button[aria-haspopup="menu"]', 'title')).toBe('Export table')
    expect(attr(withDefaults, 'button[aria-haspopup="menu"]', 'aria-label')).toBe('Export table')
    expect(attr(withDefaults, '[role="region"]', 'aria-label')).toBe('Data table')
  })

  it('localizes the search reset button once a query is typed', () => {
    const type = (root: ParentNode) => {
      const input = root.querySelector('input[type="text"]') as HTMLInputElement
      fireEvent.input(input, { target: { value: 'x' } })
    }

    const withProvider = render(() => (
      <MCPUIStringsProvider strings={{ tableClearSearch: 'Effacer la recherche' }}>
        <UIResourceRenderer content={table({ searchable: true })} />
      </MCPUIStringsProvider>
    )).container
    type(withProvider)
    expect(withProvider.querySelector('[aria-label="Effacer la recherche"]')).not.toBeNull()

    const withDefaults = render(() => (
      <UIResourceRenderer content={table({ searchable: true })} />
    )).container
    type(withDefaults)
    expect(withDefaults.querySelector('[aria-label="Clear search"]')).not.toBeNull()
  })
})

describe('sweep — copy buttons, media and links (UIResourceRenderer)', () => {
  it('localizes the metric copy button', () => {
    const ui = () => (
      <UIResourceRenderer content={component('metric', { title: 'CA', value: 42 })} />
    )
    const { withProvider, withDefaults } = renderBoth({ copyMetric: 'Copier la métrique' }, ui)

    expect(attr(withProvider, 'button[data-mcp-ui-action="copy"]', 'title')).toBe(
      'Copier la métrique'
    )
    expect(attr(withDefaults, 'button[data-mcp-ui-action="copy"]', 'title')).toBe('Copy metric')
  })

  it('localizes the text copy button', () => {
    const ui = () => (
      <UIResourceRenderer content={component('text', { content: 'plain', markdown: false })} />
    )
    const { withProvider, withDefaults } = renderBoth({ copyText: 'Copier le texte' }, ui)

    expect(attr(withProvider, 'button[data-mcp-ui-action="copy"]', 'aria-label')).toBe(
      'Copier le texte'
    )
    expect(attr(withDefaults, 'button[data-mcp-ui-action="copy"]', 'aria-label')).toBe('Copy text')
  })

  it('localizes the link accessible name through the template', () => {
    const ui = () => (
      <UIResourceRenderer
        content={component('link', {
          url: 'https://example.com',
          label: 'Docs',
          description: 'The manual',
        })}
      />
    )
    const { withProvider, withDefaults } = renderBoth(
      { linkOpensInNewTab: '{label} : {description} (ouvre un nouvel onglet)' },
      ui
    )

    expect(attr(withProvider, 'a[href="https://example.com"]', 'aria-label')).toBe(
      'Docs : The manual (ouvre un nouvel onglet)'
    )
    expect(attr(withDefaults, 'a[href="https://example.com"]', 'aria-label')).toBe(
      'Docs: The manual (opens in new tab)'
    )
  })

  it('localizes the image alt fallback', () => {
    const ui = () => (
      <UIResourceRenderer content={component('image', { url: 'https://example.com/a.png' })} />
    )
    const { withProvider, withDefaults } = renderBoth({ imageAlt: 'Image (fr)' }, ui)

    expect(attr(withProvider, 'img', 'alt')).toBe('Image (fr)')
    expect(attr(withDefaults, 'img', 'alt')).toBe('Image')
  })
})

describe('sweep — ExpandableWrapper copyLabel (VideoRenderer)', () => {
  const ui = () => <VideoRenderer params={{ url: 'https://example.com/clip.mp4' }} />

  /** The copy button only exists inside the fullscreen modal (a Portal). */
  const expand = (root: ParentNode) =>
    fireEvent.click(root.querySelector('[data-mcp-ui-action="expand"]') as HTMLElement)

  const copyTitle = (): string | null =>
    document.querySelector('[data-mcp-ui-portal="dialog"] [data-mcp-ui-action="copy"]')
      ?.getAttribute('title') ?? null

  it('reads the video copy label from the provider', () => {
    const withProvider = render(() => (
      <MCPUIStringsProvider strings={{ videoCopy: "Copier l'URL de la vidéo" }}>
        {ui()}
      </MCPUIStringsProvider>
    )).container
    expand(withProvider)
    expect(copyTitle()).toBe("Copier l'URL de la vidéo")
    expect(
      document
        .querySelector('[data-mcp-ui-portal="dialog"] [data-mcp-ui-action="copy"]')
        ?.getAttribute('aria-label')
    ).toBe("Copier l'URL de la vidéo")
    cleanup()

    const withDefaults = render(ui).container
    expand(withDefaults)
    expect(copyTitle()).toBe('Copy video URL')
  })
})

describe('sweep — table search placeholder (UIResourceRenderer)', () => {
  const searchable = (extra: Record<string, unknown> = {}) =>
    component('table', {
      columns: [{ key: 'revenue', label: 'Revenue' }],
      rows: [{ revenue: 1 }],
      searchable: true,
      ...extra,
    })

  it('localizes the placeholder and keeps the payload override winning', () => {
    const ui = () => <UIResourceRenderer content={searchable()} />
    const { withProvider, withDefaults } = renderBoth(
      { tableSearchPlaceholder: 'Rechercher dans le tableau…' },
      ui
    )

    expect(attr(withProvider, 'input[type="text"]', 'placeholder')).toBe(
      'Rechercher dans le tableau…'
    )
    // Former literal was French; the shipped default is now English.
    expect(attr(withDefaults, 'input[type="text"]', 'placeholder')).toBe('Search the table...')

    const overridden = render(() => (
      <MCPUIStringsProvider strings={{ tableSearchPlaceholder: 'ignored' }}>
        <UIResourceRenderer
          content={searchable({ searchPlaceholder: 'Filtrer les lignes' })}
        />
      </MCPUIStringsProvider>
    )).container
    expect(attr(overridden, 'input[type="text"]', 'placeholder')).toBe('Filtrer les lignes')
  })
})

describe('sweep — table export menu labels (UIResourceRenderer)', () => {
  const exportable = () =>
    component('table', {
      columns: [{ key: 'revenue', label: 'Revenue' }],
      rows: [{ revenue: 1 }],
      exportable: { formats: ['tsv', 'csv', 'json'] },
    })

  /** The menu items live in a <PortalDropdownMenu> mounted on document.body. */
  const openMenu = (root: ParentNode) =>
    fireEvent.click(root.querySelector('button[aria-haspopup="menu"]') as HTMLElement)

  const itemTexts = (): string[] =>
    Array.from(document.querySelectorAll('body > div button')).map((b) => b.textContent ?? '')

  it('localizes the three export items', () => {
    const withProvider = render(() => (
      <MCPUIStringsProvider
        strings={{
          tableCopyTsv: 'Copier en TSV',
          tableDownloadCsv: 'Télécharger le CSV',
          tableDownloadJson: 'Télécharger le JSON',
        }}
      >
        <UIResourceRenderer content={exportable()} />
      </MCPUIStringsProvider>
    )).container
    openMenu(withProvider)
    expect(itemTexts()).toEqual(
      expect.arrayContaining(['Copier en TSV', 'Télécharger le CSV', 'Télécharger le JSON'])
    )
    cleanup()

    const withDefaults = render(() => <UIResourceRenderer content={exportable()} />).container
    openMenu(withDefaults)
    expect(itemTexts()).toEqual(
      expect.arrayContaining(['Copy TSV', 'Download CSV', 'Download JSON'])
    )
  })
})

describe('sweep — prefill source badge (FormFieldRenderer)', () => {
  const field: FormFieldParams = {
    name: 'city',
    type: 'text',
    label: 'City',
    source: 'detected',
  } as FormFieldParams
  const ui = () => <FormFieldRenderer field={field} value="" onChange={() => {}} />

  it('resolves the module-level badge title through the context', () => {
    const { withProvider, withDefaults } = renderBoth(
      { sourceDetected: 'Détecté dans le message' },
      ui
    )

    expect(attr(withProvider, 'label span[title]', 'title')).toBe('Détecté dans le message')
    expect(attr(withDefaults, 'label span[title]', 'title')).toBe('Detected from message')
  })
})

describe('sweep — VerifiedText', () => {
  // "Total 42 and 99": 42 at index 6 (verified), 99 at index 13 (hallucinated).
  const validation: DataValidation = {
    valid: false,
    llmNumbers: [
      { value: 42, position: 6, context: 'Total 42' },
      { value: 99, position: 13, context: 'and 99' },
    ],
    sourceNumbers: new Set([42]),
    hallucinated: [{ value: 99, position: 13, context: 'and 99', closest: 42, distance: 1.35 }],
    confidence: 0.5,
  }
  const ui = () => <VerifiedText text="Total 42 and 99" validation={validation} />

  it('localizes the verified / unverified markers', () => {
    const { withProvider, withDefaults } = renderBoth(
      { verifiedTitle: 'Vérifié sur les données source', verifiedAria: 'vérifié', unverifiedAria: 'non vérifié' },
      ui
    )

    expect(attr(withProvider, 'span[title]', 'title')).toBe('Vérifié sur les données source')
    expect(withProvider.querySelector('[aria-label="vérifié"]')).not.toBeNull()
    expect(withProvider.querySelector('[aria-label="non vérifié"]')).not.toBeNull()

    expect(attr(withDefaults, 'span[title]', 'title')).toBe('Verified against source data')
    expect(withDefaults.querySelector('[aria-label="verified"]')).not.toBeNull()
    expect(withDefaults.querySelector('[aria-label="unverified"]')).not.toBeNull()
  })

  it('localizes the strip-mode placeholder and the not-found tooltips', () => {
    const stripUi = () => (
      <VerifiedText text="Total 42 and 99" validation={validation} mode="strip" />
    )
    const { withProvider, withDefaults } = renderBoth(
      {
        verifiedStripLabel: '[non vérifié]',
        verifiedNotFoundClosest:
          'Introuvable dans les données source. Le plus proche : {closest} ({pct}% d\u2019écart)',
      },
      stripUi
    )

    expect(withProvider.textContent).toContain('[non vérifié]')
    expect(attr(withProvider, 'span[title*="Introuvable"]', 'title')).toBe(
      'Introuvable dans les données source. Le plus proche : 42 (135% d\u2019écart)'
    )

    // Former literal was the French '[non vérifié]'; the default is now English.
    expect(withDefaults.textContent).toContain('[unverified]')
    expect(withDefaults.textContent).not.toContain('[non vérifié]')
    expect(attr(withDefaults, 'span[title*="Closest"]', 'title')).toBe(
      'Not found in source data. Closest: 42 (135% off)'
    )
  })

  it('falls back to the plain not-found tooltip when there is no closest match', () => {
    const bare: DataValidation = {
      valid: false,
      llmNumbers: [{ value: 99, position: 6, context: 'Total 99' }],
      sourceNumbers: new Set<number>(),
      hallucinated: [{ value: 99, position: 6, context: 'Total 99' }],
      confidence: 0,
    }
    const bareUi = () => <VerifiedText text="Total 99" validation={bare} />
    const { withProvider, withDefaults } = renderBoth(
      { verifiedNotFound: 'Introuvable dans les données source' },
      bareUi
    )

    expect(attr(withProvider, 'span[title]', 'title')).toBe(
      'Introuvable dans les données source'
    )
    expect(attr(withDefaults, 'span[title]', 'title')).toBe('Not found in source data')
  })
})

describe('sweep — VerifiedText confidence summary', () => {
  const validation: DataValidation = {
    valid: false,
    llmNumbers: [
      { value: 42, position: 6, context: 'Total 42' },
      { value: 99, position: 13, context: 'and 99' },
    ],
    sourceNumbers: new Set([42]),
    hallucinated: [{ value: 99, position: 13, context: 'and 99' }],
    confidence: 0.5,
  }
  const ui = () => <VerifiedText text="Total 42 and 99" validation={validation} />

  it('localizes the confidence and unverified-count templates', () => {
    const { withProvider, withDefaults } = renderBoth(
      {
        verifiedConfidence: '{pct} % vérifié',
        verifiedUnverifiedCount: '({count} non vérifiés)',
      },
      ui
    )

    expect(withProvider.textContent).toContain('50 % vérifié')
    expect(withProvider.textContent).toContain('(1 non vérifiés)')

    expect(withDefaults.textContent).toContain('50% verified')
    expect(withDefaults.textContent).toContain('(1 unverified)')
  })
})

describe('sweep — ImageGalleryRenderer / VideoRenderer untitled fallbacks', () => {
  /** Both titles surface as the fullscreen dialog's accessible name. */
  const expand = (root: ParentNode) =>
    fireEvent.click(root.querySelector('[data-mcp-ui-action="expand"]') as HTMLElement)

  const dialogLabel = (): string | null =>
    document.querySelector('[data-mcp-ui-portal="dialog"]')?.getAttribute('aria-label') ?? null

  it('localizes the untitled gallery title', () => {
    const ui = () => (
      <ImageGalleryRenderer params={{ images: [{ url: 'https://example.com/1.jpg' }] }} />
    )

    const withProvider = render(() => (
      <MCPUIStringsProvider strings={{ galleryTitle: 'Galerie' }}>{ui()}</MCPUIStringsProvider>
    )).container
    expand(withProvider)
    expect(dialogLabel()).toBe('Galerie')
    cleanup()

    const withDefaults = render(ui).container
    expand(withDefaults)
    expect(dialogLabel()).toBe('Gallery')
  })

  it('localizes the untitled video title, including the embed iframe', () => {
    const ui = () => (
      <VideoRenderer params={{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }} />
    )

    const withProvider = render(() => (
      <MCPUIStringsProvider strings={{ videoTitle: 'Vidéo' }}>{ui()}</MCPUIStringsProvider>
    )).container
    expect(attr(withProvider, 'iframe', 'title')).toBe('Vidéo')
    expand(withProvider)
    expect(dialogLabel()).toBe('Vidéo')
    cleanup()

    const withDefaults = render(ui).container
    expect(attr(withDefaults, 'iframe', 'title')).toBe('Video')
    expand(withDefaults)
    expect(dialogLabel()).toBe('Video')
  })
})

describe('sweep — ChatPrompt', () => {
  const confirmConfig = {
    type: 'confirm' as const,
    config: { message: 'Delete it?' },
  }

  it('localizes the confirm/cancel buttons and keeps the payload override winning', () => {
    const ui = () => <ChatPrompt config={confirmConfig} onSubmit={() => {}} />
    const { withProvider, withDefaults } = renderBoth(
      { cancel: 'Annuler', confirm: 'Valider' },
      ui
    )

    expect(withProvider.textContent).toContain('Annuler')
    expect(withProvider.textContent).toContain('Valider')

    expect(withDefaults.textContent).toContain('Cancel')
    expect(withDefaults.textContent).toContain('Confirm')

    // The payload's own labels still win over the provider.
    const overridden = render(() => (
      <MCPUIStringsProvider strings={{ cancel: 'Annuler', confirm: 'Valider' }}>
        <ChatPrompt
          config={{
            type: 'confirm',
            config: { message: 'Delete it?', confirmLabel: 'Oui, supprimer', cancelLabel: 'Non' },
          }}
          onSubmit={() => {}}
        />
      </MCPUIStringsProvider>
    )).container
    expect(overridden.textContent).toContain('Oui, supprimer')
    expect(overridden.textContent).not.toContain('Valider')
  })

  it('localizes the form submit button and the dismiss control', () => {
    const ui = () => (
      <ChatPrompt
        config={{
          type: 'form',
          config: { fields: [{ name: 'city', type: 'text', label: 'City' }] },
        }}
        dismissLabel={undefined}
        onDismiss={() => {}}
        onSubmit={() => {}}
      />
    )
    const { withProvider, withDefaults } = renderBoth({ submit: 'Envoyer', dismiss: 'Ignorer' }, ui)

    expect(withProvider.textContent).toContain('Envoyer')
    expect(withProvider.querySelector('[aria-label="Ignorer"]')).not.toBeNull()

    expect(withDefaults.textContent).toContain('Submit')
    expect(withDefaults.querySelector('[aria-label="Dismiss"]')).not.toBeNull()
  })
})

describe('sweep — FormRenderer auto-submit countdown', () => {
  const form = () =>
    component('form', {
      fields: [{ name: 'city', type: 'text', label: 'City', required: true, prefill: 'Paris' }],
      autoSubmitDelay: 5000,
    })

  it('localizes the countdown template', () => {
    const ui = () => <FormRenderer component={form()} />
    const { withProvider, withDefaults } = renderBoth(
      { formSubmitCountdown: 'Envoi de « {label} » dans {seconds} s…', submit: 'Envoyer' },
      ui
    )

    expect(withProvider.textContent).toContain('Envoi de « Envoyer » dans 5 s…')
    expect(withDefaults.textContent).toContain('Submit in 5s...')
  })
})

describe('sweep — chart error overlay (UIResourceRenderer)', () => {
  const chart = () =>
    component('chart', {
      type: 'bar',
      renderer: 'iframe',
      data: { labels: ['Q1'], datasets: [{ label: 'Revenue', data: [1] }] },
    })

  /** The overlay only appears once the quickchart <img> fails to load. */
  const breakImage = async (root: ParentNode) => {
    const img = await waitFor(() => {
      const found = Array.from(root.querySelectorAll('img')).find((i) =>
        (i.getAttribute('src') ?? '').includes('quickchart.io')
      )
      expect(found).toBeDefined()
      return found as HTMLImageElement
    })
    fireEvent.error(img)
  }

  it('localizes the error heading', async () => {
    const withProvider = render(() => (
      <MCPUIStringsProvider strings={{ chartError: 'Erreur de graphique' }}>
        <UIResourceRenderer content={chart()} allowQuickchartFallback />
      </MCPUIStringsProvider>
    )).container
    await breakImage(withProvider)
    expect(withProvider.textContent).toContain('Erreur de graphique')
    cleanup()

    const withDefaults = render(() => (
      <UIResourceRenderer content={chart()} allowQuickchartFallback />
    )).container
    await breakImage(withDefaults)
    expect(withDefaults.textContent).toContain('Chart Error')
  })
})

describe('sweep — GraphRenderer export menu', () => {
  const graph = () => component('graph', { nodes: [{ id: 'a' }, { id: 'b' }], edges: [] })

  /** The trigger is only rendered once `@antv/g6` resolved successfully. */
  const trigger = async (root: ParentNode): Promise<HTMLElement> =>
    waitFor(() => {
      const button = root.querySelector('button[aria-haspopup="menu"]')
      expect(button, 'the @antv/g6 peer must resolve for the export menu to mount').not.toBeNull()
      return button as HTMLElement
    })

  const itemTexts = (): string[] =>
    Array.from(document.querySelectorAll('body > div button')).map((b) => b.textContent ?? '')

  it('localizes the menu trigger label and the export items', async () => {
    const withProvider = render(() => (
      <MCPUIStringsProvider
        strings={{ graphExportMenu: 'Exporter ▾', graphDownloadPng: 'Télécharger le PNG' }}
      >
        <GraphRenderer component={graph()} />
      </MCPUIStringsProvider>
    )).container
    const providerTrigger = await trigger(withProvider)
    expect(providerTrigger.textContent?.trim()).toBe('Exporter ▾')
    fireEvent.click(providerTrigger)
    expect(itemTexts().join(' | ')).toContain('Télécharger le PNG')
    cleanup()

    const withDefaults = render(() => <GraphRenderer component={graph()} />).container
    const defaultTrigger = await trigger(withDefaults)
    expect(defaultTrigger.textContent?.trim()).toBe('Export ▾')
    fireEvent.click(defaultTrigger)
    const defaults = itemTexts().join(' | ')
    expect(defaults).toContain('Download PNG')
    expect(defaults).toContain('visual snapshot')
    expect(defaults).toContain('Download Mermaid')
    expect(defaults).toContain('Download JSON')
  })
})

describe('sweep — ScratchpadPanel', () => {
  let spId = 0
  const state = (
    section: Omit<ScratchpadSection, 'editable' | 'source'>,
    filters: Record<string, string | string[]> = {}
  ): ScratchpadState => ({
    // Unique per mount: `renderBoth` mounts the panel twice and the
    // duplicate-mount registry warns when two live panels share an id.
    id: `sp-${++spId}`,
    title: 'Scratchpad',
    sections: [{ ...section, editable: true, source: 'agent' }],
    filters,
    agentMessages: [],
    status: 'ready',
  })

  it('localizes the inline filter editor buttons', () => {
    const ui = () => (
      <ScratchpadPanel
        state={state(
          { id: 'f1', title: 'Filters', type: 'filter', content: { city: { label: 'City' } } },
          { city: 'Paris' }
        )}
        onFilterChange={() => {}}
      />
    )
    /** Clicking the chip's own button opens the inline value editor. */
    const openEditor = (root: ParentNode) => {
      const chip = root.querySelector('span.rounded-full button') as HTMLElement
      fireEvent.click(chip)
    }

    const withProvider = render(() => (
      <MCPUIStringsProvider strings={{ cancel: 'Annuler', ok: 'Valider' }}>{ui()}</MCPUIStringsProvider>
    )).container
    openEditor(withProvider)
    expect(withProvider.textContent).toContain('Annuler')
    cleanup()

    const withDefaults = render(ui).container
    openEditor(withDefaults)
    expect(withDefaults.textContent).toContain('Cancel')
  })

  it('ships English "Edit" on the collapsed auto-submit form (was French "Modifier")', () => {
    const ui = () => (
      <ScratchpadPanel
        state={state({
          id: 'form1',
          title: 'Form',
          type: 'form',
          content: {
            fields: [{ name: 'city', type: 'text', label: 'City', prefill: 'Paris' }],
            autoSubmitDelay: 5000,
          },
        })}
      />
    )
    const { withProvider, withDefaults } = renderBoth({ scratchpadEdit: 'Modifier' }, ui)

    expect(withProvider.textContent).toContain('Modifier')
    expect(withDefaults.textContent).toContain('Edit')
    expect(withDefaults.textContent).not.toContain('Modifier')
  })
})

describe('sweep — StreamingUIRenderer metadata panel', () => {
  const ui = () => <StreamingUIRenderer query="revenue" spaceIds={['s1']} />

  it('localizes the metadata labels and the cached "Yes" value', () => {
    streamingRun.metadata = {
      provider: 'anthropic',
      model: 'claude',
      executionTimeMs: 120,
      firstTokenMs: 30,
      cached: true,
    }

    const { withProvider, withDefaults } = renderBoth(
      { metaProvider: 'Fournisseur', metaCached: 'En cache', yes: 'Oui' },
      ui
    )

    expect(withProvider.textContent).toContain('Fournisseur')
    expect(withProvider.textContent).toContain('En cache')
    expect(withProvider.textContent).toContain('Oui')

    expect(withDefaults.textContent).toContain('Provider')
    expect(withDefaults.textContent).toContain('Model')
    expect(withDefaults.textContent).toContain('Execution Time')
    expect(withDefaults.textContent).toContain('TTFB')
    expect(withDefaults.textContent).toContain('Cached')
    expect(withDefaults.textContent).toContain('Yes')

    streamingRun.metadata = null
  })
})

// ─────────────────────────────────────────────────────────────
// 6.20.0
// ─────────────────────────────────────────────────────────────

describe('sweep — DataPreviewSection pagination', () => {
  // pageSize 2 over 5 rows → paginated (3 pages).
  const ui = () => (
    <DataPreviewSection
      content={
        {
          columns: [{ key: 'a', label: 'A' }],
          rows: [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 }],
          pageSize: 2,
        } as never
      }
    />
  )

  it('localizes the Prev / Next labels and the page indicator', () => {
    const { withProvider, withDefaults } = renderBoth(
      {
        previewPrev: 'Précédent',
        previewNext: 'Suivant',
        previewPageIndicator: 'Page {page} sur {total}',
      },
      ui
    )

    expect(withProvider.textContent).toContain('Précédent')
    expect(withProvider.textContent).toContain('Suivant')
    expect(withProvider.textContent).toContain('Page 1 sur 3')

    expect(withDefaults.textContent).toContain('Prev')
    expect(withDefaults.textContent).toContain('Next')
    expect(withDefaults.textContent).toContain('Page 1 / 3')
  })

  it('gives both buttons an accessible name, a type and an action hook', () => {
    const { withDefaults } = renderBoth({}, ui)

    const prev = withDefaults.querySelector('[data-mcp-ui-action="page-prev"]')
    const next = withDefaults.querySelector('[data-mcp-ui-action="page-next"]')
    expect(prev?.getAttribute('aria-label')).toBe('Previous page')
    expect(next?.getAttribute('aria-label')).toBe('Next page')
    expect(prev?.getAttribute('type')).toBe('button')
    expect(next?.getAttribute('type')).toBe('button')
    // The glyphs stay decorative.
    expect(prev?.querySelector('[aria-hidden="true"]')).toBeTruthy()
    expect(next?.querySelector('[aria-hidden="true"]')).toBeTruthy()
  })
})

describe('sweep — FormRenderer prefill summary', () => {
  const form = (prefilled: number) =>
    component('form', {
      fields: [
        { name: 'city', type: 'text', label: 'City', ...(prefilled >= 1 ? { prefill: 'Paris' } : {}) },
        { name: 'year', type: 'text', label: 'Year', ...(prefilled >= 2 ? { prefill: '2026' } : {}) },
        { name: 'kind', type: 'text', label: 'Kind' },
      ],
    })

  it('uses the SINGULAR template for exactly one pre-filled field', () => {
    const ui = () => <FormRenderer component={form(1)} />
    const { withProvider, withDefaults } = renderBoth(
      { formPrefilledOne: '{count} champ pré-rempli sur {total}' },
      ui
    )

    expect(withProvider.textContent).toContain('1 champ pré-rempli sur 3')
    expect(withDefaults.textContent).toContain('1 field pre-filled out of 3')
    expect(withDefaults.textContent).not.toContain('1 fields')
  })

  it('uses the PLURAL template for several pre-filled fields', () => {
    const ui = () => <FormRenderer component={form(2)} />
    const { withProvider, withDefaults } = renderBoth(
      { formPrefilledMany: '{count} champs pré-remplis sur {total}' },
      ui
    )

    expect(withProvider.textContent).toContain('2 champs pré-remplis sur 3')
    expect(withDefaults.textContent).toContain('2 fields pre-filled out of 3')
  })

  it('ships no French by default', () => {
    const { withDefaults } = renderBoth({}, () => <FormRenderer component={form(2)} />)
    expect(withDefaults.textContent).not.toContain('champ')
  })
})

describe('sweep — GenerativeUIErrorBoundary default fallback', () => {
  const Boom = () => {
    throw new Error('boom')
  }
  const ui = () => (
    <GenerativeUIErrorBoundary componentId="abcdef0123456789" componentType="metric" allowRetry>
      <Boom />
    </GenerativeUIErrorBoundary>
  )

  it('localizes the fallback title, metadata line and retry button', () => {
    const { withProvider, withDefaults } = renderBoth(
      {
        errorBoundaryTitle: 'Composant non rendu',
        errorBoundaryMeta: 'Type : {type} | ID : {id}…',
        errorBoundaryRetry: 'Réessayer le rendu',
      },
      ui
    )

    expect(withProvider.textContent).toContain('Composant non rendu')
    expect(withProvider.textContent).toContain('Type : metric | ID : abcdef01…')
    expect(withProvider.textContent).toContain('Réessayer le rendu')

    expect(withDefaults.textContent).toContain('Component Failed to Render')
    expect(withDefaults.textContent).toContain('Type: metric | ID: abcdef01...')
    expect(withDefaults.textContent).toContain('Retry Rendering')
  })

  it('localizes the `unknown` fallbacks of the metadata line', () => {
    const bare = () => (
      <GenerativeUIErrorBoundary componentId="" componentType="">
        <Boom />
      </GenerativeUIErrorBoundary>
    )
    const { withProvider, withDefaults } = renderBoth({ unknown: 'inconnu' }, bare)

    expect(withProvider.textContent).toContain('Type: inconnu | ID: inconnu')
    expect(withDefaults.textContent).toContain('Type: unknown | ID: unknown')
  })
})

describe('sweep — inline validation chip (UIResourceRenderer)', () => {
  // `value` is required for a metric — this payload fails validation.
  const broken = () => component('metric', { title: 'No value' })
  const ui = () => <UIResourceRenderer content={broken()} errorMode="inline-warn" />

  it('localizes the "Invalid {type}" chip', () => {
    const { withProvider, withDefaults } = renderBoth(
      { invalidComponent: 'Composant {type} invalide' },
      ui
    )

    expect(withProvider.textContent).toContain('Composant metric invalide')
    expect(withDefaults.textContent).toContain('Invalid metric')
  })
})

describe('sweep — VideoRenderer <video> fallback text', () => {
  const ui = () => (
    <VideoRenderer component={component('video', { url: 'https://cdn.test/a.mp4' })} />
  )

  it('localizes the "browser does not support" fallback', () => {
    const { withProvider, withDefaults } = renderBoth(
      { videoUnsupported: 'Votre navigateur ne gère pas la balise vidéo.' },
      ui
    )

    expect(withProvider.querySelector('video')?.textContent).toContain(
      'Votre navigateur ne gère pas la balise vidéo.'
    )
    expect(withDefaults.querySelector('video')?.textContent).toContain(
      'Your browser does not support the video tag.'
    )
  })
})

describe('sweep — unresolved citation placeholder (UIResourceRenderer)', () => {
  // An EMPTY citationMap is the "consumer supplied no mapping" case: the
  // marker is kept as a human-visible placeholder instead of vanishing.
  const table = () =>
    component('table', {
      columns: [{ key: 'cites', label: 'Citations' }],
      rows: [{ cites: '[1]' }],
      citationMap: {},
    })
  const ui = () => <UIResourceRenderer content={table()} />

  it('localizes the `[ref. {id}]` placeholder', () => {
    const { withProvider, withDefaults } = renderBoth(
      { citationUnresolved: '[réf. {id}]' },
      ui
    )

    expect(withProvider.textContent).toContain('[réf. 1]')
    expect(withDefaults.textContent).toContain('[ref. 1]')
    expect(withDefaults.textContent).not.toContain('réf')
  })
})

// ─────────────────────────────────────────────────────────────
// 6.20.0 — the leaks the widened guard now catches
// ─────────────────────────────────────────────────────────────

describe('sweep — DataPreviewSection page info', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ a: i + 1 }))

  it('localizes the paginated "Showing {start}–{end} of {total}" line', () => {
    const ui = () => (
      <DataPreviewSection
        content={
          {
            columns: [{ key: 'a', label: 'A' }],
            rows: rows(5),
            pageSize: 2,
            showPageInfo: true,
          } as never
        }
      />
    )

    const { withProvider, withDefaults } = renderBoth(
      { previewShowingRange: 'Lignes {start} à {end} sur {total}' },
      ui
    )

    expect(withProvider.textContent).toContain('Lignes 1 à 2 sur 5')
    expect(withDefaults.textContent).toContain('Showing 1\u20132 of 5')
  })

  it('localizes the unpaginated row count and the total suffix', () => {
    const ui = () => (
      <DataPreviewSection
        content={
          {
            columns: [{ key: 'a', label: 'A' }],
            rows: rows(3),
            totalRows: 120,
            showPageInfo: true,
          } as never
        }
      />
    )

    const { withProvider, withDefaults } = renderBoth(
      { previewRowsMany: '{count} lignes', previewTotalSuffix: ' ({total} au total)' },
      ui
    )

    expect(withProvider.textContent).toContain('3 lignes')
    expect(withProvider.textContent).toContain('(120 au total)')
    expect(withDefaults.textContent).toContain('3 rows')
    expect(withDefaults.textContent).toContain('(120 total)')
  })

  it('uses the singular key for exactly one row', () => {
    const ui = () => (
      <DataPreviewSection
        content={
          { columns: [{ key: 'a', label: 'A' }], rows: rows(1), showPageInfo: true } as never
        }
      />
    )

    const { withProvider, withDefaults } = renderBoth({ previewRowsOne: '{count} ligne' }, ui)

    expect(withProvider.textContent).toContain('1 ligne')
    expect(withDefaults.textContent).toContain('1 row')
    expect(withDefaults.textContent).not.toContain('1 rows')
  })
})

describe('sweep — ScratchpadPanel status badge', () => {
  let id = 0
  const ui = () => (
    <ScratchpadPanel
      state={{
        id: `sp-status-${++id}`,
        title: 'Scratchpad',
        sections: [],
        filters: {},
        agentMessages: [],
        status: 'ready',
      }}
    />
  )

  it('localizes the STATUS_BADGES label of the `ready` state', () => {
    const { withProvider, withDefaults } = renderBoth(
      { statusActionAvailable: 'Action disponible' },
      ui
    )

    expect(withProvider.textContent).toContain('Action disponible')
    expect(withDefaults.textContent).toContain('Action available')
  })
})

describe('sweep — AgentHandoff item count', () => {
  const ui = () => (
    <AgentHandoff
      content={{
        from: { id: 'a', name: 'Extractor' },
        to: { id: 'b', name: 'Analyst' },
        itemCount: 47,
      }}
    />
  )

  it('localizes the "{count} items" fallback summary', () => {
    const { withProvider, withDefaults } = renderBoth({ handoffItems: '{count} éléments' }, ui)

    expect(withProvider.textContent).toContain('47 éléments')
    expect(withDefaults.textContent).toContain('47 items')
  })

  it('still prefers an explicit summary from the payload', () => {
    const withSummary = render(() => (
      <MCPUIStringsProvider strings={{ handoffItems: '{count} éléments' }}>
        <AgentHandoff
          content={{
            from: { id: 'a', name: 'Extractor' },
            to: { id: 'b', name: 'Analyst' },
            itemCount: 47,
            summary: '47 entités transmises',
          }}
        />
      </MCPUIStringsProvider>
    )).container

    expect(withSummary.textContent).toContain('47 entités transmises')
    expect(withSummary.textContent).not.toContain('47 éléments')
  })
})

describe('sweep — AutocompleteDropdown keyboard hint', () => {
  const ui = () => (
    <AutocompleteDropdown
      options={[{ value: 'paris', label: 'Paris' }]}
      selectedIndex={0}
      isOpen
      onSelect={() => {}}
    />
  )

  it('localizes the prose around the <kbd> caps, and keeps the caps as-is', () => {
    const { withProvider, withDefaults } = renderBoth(
      {
        autocompleteHintNavigate: ' pour naviguer, ',
        autocompleteHintSelect: ' pour choisir, ',
        autocompleteHintDismiss: ' pour fermer',
      },
      ui
    )

    const footer = (root: ParentNode) =>
      root.querySelector('.mcp-autocomplete-footer')?.textContent ?? ''

    expect(footer(withProvider)).toContain(' pour naviguer, ')
    expect(footer(withProvider)).toContain(' pour choisir, ')
    expect(footer(withProvider)).toContain(' pour fermer')
    // P1: the key caps themselves are never translated.
    expect(footer(withProvider)).toContain('Enter')
    expect(footer(withProvider)).toContain('Esc')

    expect(footer(withDefaults)).toContain(' to navigate, ')
    expect(footer(withDefaults)).toContain(' to select, ')
    expect(footer(withDefaults)).toContain(' to dismiss')
  })
})

describe('sweep — ImageGalleryRenderer image alt', () => {
  const ui = () => (
    <ImageGalleryRenderer
      params={{ images: [{ url: 'https://example.com/1.jpg' }] }}
    />
  )

  it('localizes the "Image {index}" alt and the "View image {index}" button name', () => {
    const { withProvider, withDefaults } = renderBoth(
      { galleryImageAlt: 'Image n°{index}', galleryViewImage: 'Voir l’image {index}' },
      ui
    )

    expect(attr(withProvider, 'img', 'alt')).toBe('Image n°1')
    expect(attr(withProvider, 'button[type="button"]', 'aria-label')).toBe('Voir l’image 1')

    expect(attr(withDefaults, 'img', 'alt')).toBe('Image 1')
    expect(attr(withDefaults, 'button[type="button"]', 'aria-label')).toBe('View image 1')
  })

  it("still prefers the payload's own alt", () => {
    const withAlt = render(() => (
      <MCPUIStringsProvider strings={{ galleryImageAlt: 'Image n°{index}' }}>
        <ImageGalleryRenderer
          params={{ images: [{ url: 'https://example.com/1.jpg', alt: 'Tour Eiffel' }] }}
        />
      </MCPUIStringsProvider>
    )).container

    expect(attr(withAlt, 'img', 'alt')).toBe('Tour Eiffel')
  })
})

describe('sweep — DegradedFallback through a renderer that falls back', () => {
  /**
   * `renderer: 'iframe'` with no `allowQuickchartFallback` is the cheapest
   * deterministic way into the degraded ladder: the branch is gated on the
   * host opt-in alone, not on whether `chart.js` is installed (see
   * `ChartRenderer.quickchart.test.tsx`).
   */
  const chart = (datasetCount = 1, rowCount = 2): UIComponent =>
    component('chart', {
      type: 'bar',
      renderer: 'iframe',
      data: {
        labels: Array.from({ length: rowCount }, (_, i) => `L${i + 1}`),
        datasets: Array.from({ length: datasetCount }, () => ({
          data: Array.from({ length: rowCount }, (_, i) => i),
        })),
      },
    })

  it('localizes the degraded caption and the unlabelled series header', async () => {
    const ui = () => <UIResourceRenderer content={chart()} />
    const { withProvider, withDefaults } = renderBoth(
      {
        chartQuickchartCaption: 'Données du graphique en tableau.',
        degradedSeries: 'Série {n}',
      },
      ui
    )

    await waitFor(() => {
      expect(withProvider.textContent ?? '').toContain('Données du graphique en tableau.')
    })
    expect(withProvider.textContent).toContain('Série 1')

    await waitFor(() => {
      expect(withDefaults.textContent ?? '').toContain('Showing the chart data as a table.')
    })
    expect(withDefaults.textContent).toContain('Series 1')
  })

  it('localizes the "+{count} more rows not shown." truncation notice', async () => {
    // 60 rows > the 50-row cap of DegradedFallback → 10 hidden.
    const ui = () => <UIResourceRenderer content={chart(1, 60)} />
    const { withProvider, withDefaults } = renderBoth(
      { degradedMoreRows: '+{count} lignes masquées.' },
      ui
    )

    await waitFor(() => {
      expect(withProvider.textContent ?? '').toContain('+10 lignes masquées.')
    })
    await waitFor(() => {
      expect(withDefaults.textContent ?? '').toContain('+10 more rows not shown.')
    })
  })

  it('localizes the chart image load failure (quickchart opt-in)', async () => {
    const failing = component('chart', {
      type: 'bar',
      renderer: 'iframe',
      data: { labels: ['A'], datasets: [{ label: 'R', data: [1] }] },
    })
    const ui = () => <UIResourceRenderer content={failing} allowQuickchartFallback />

    const { withProvider, withDefaults } = renderBoth(
      { chartLoadFailed: 'Échec du chargement du graphique' },
      ui
    )

    for (const [root, expected] of [
      [withProvider, 'Échec du chargement du graphique'],
      [withDefaults, 'Failed to load chart'],
    ] as const) {
      const img = await waitFor(() => {
        const found = Array.from(root.querySelectorAll('img')).find((i) =>
          (i.getAttribute('src') ?? '').includes('quickchart.io')
        )
        expect(found).toBeTruthy()
        return found as HTMLImageElement
      })
      fireEvent.error(img)
      await waitFor(() => {
        expect(root.textContent ?? '').toContain(expected)
      })
    }
  })

  it('localizes the chart image alt, with and without a payload title', async () => {
    const titled = component('chart', {
      type: 'bar',
      renderer: 'iframe',
      title: 'Revenus',
      data: { labels: ['A'], datasets: [{ label: 'R', data: [1] }] },
    })
    const untitled = component('chart', {
      type: 'bar',
      renderer: 'iframe',
      data: { labels: ['A'], datasets: [{ label: 'R', data: [1] }] },
    })

    const withTitle = render(() => (
      <UIResourceRenderer content={titled} allowQuickchartFallback />
    )).container
    await waitFor(() => {
      expect(attr(withTitle, 'img', 'alt')).toBe('Chart: Revenus')
    })
    cleanup()

    const withoutTitle = render(() => (
      <MCPUIStringsProvider strings={{ chartVisualizationAlt: 'Visualisation du graphique' }}>
        <UIResourceRenderer content={untitled} allowQuickchartFallback />
      </MCPUIStringsProvider>
    )).container
    await waitFor(() => {
      expect(attr(withoutTitle, 'img', 'alt')).toBe('Visualisation du graphique')
    })
  })
})

describe('sweep — degraded projection column headers reach the table', () => {
  /**
   * The map renderer's call site, in miniature: the projection takes its
   * column headers from `MCPUIStrings` and `DegradedFallback` renders them.
   * (The live Leaflet failure that triggers it is not reproducible in jsdom.)
   */
  const MapDegradedProbe = () => {
    const strings = useMCPUIStrings()
    return (
      <DegradedFallback
        message="probe"
        {...mapToDegradedTable(
          { markers: [{ position: [48.85, 2.35], tooltip: 'Paris' }] },
          {
            type: strings.degradedColType,
            lat: strings.degradedColLat,
            lng: strings.degradedColLng,
            info: strings.degradedColInfo,
          }
        )}
      />
    )
  }

  it('localizes Type / Lat / Lng / Info', () => {
    const { withProvider, withDefaults } = renderBoth(
      {
        degradedColType: 'Type',
        degradedColLat: 'Latitude',
        degradedColLng: 'Longitude',
        degradedColInfo: 'Détails',
      },
      () => <MapDegradedProbe />
    )

    const headers = (root: ParentNode) =>
      Array.from(root.querySelectorAll('th')).map((th) => th.textContent)

    expect(headers(withProvider)).toEqual(['Type', 'Latitude', 'Longitude', 'Détails'])
    expect(headers(withDefaults)).toEqual(['Type', 'Lat', 'Lng', 'Info'])
  })
})
