/**
 * Runtime pseudo-localization — the DOM-level counterpart of the AST guard.
 *
 * v6.20.0 (6th i18n pass). Every chrome string is replaced by a marker
 * `⟦key {placeholders}⟧` and every payload value is CJK or digits, so any
 * run of ≥ 2 Latin letters left in the rendered DOM OUTSIDE a `⟦…⟧` segment
 * is chrome the library hardcoded. The walk covers `document.body` (portals
 * included): text nodes plus the accessible / visible attributes.
 *
 * Latin runs allowed by the exclusion policy are listed per test, each
 * citing its policy item (P1…P8).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { DEFAULT_MCPUI_STRINGS, MCPUIStringsProvider, type MCPUIStrings } from './MCPUIStringsContext'
import { UIResourceRenderer } from '../components/UIResourceRenderer'
import { DataPreviewSection } from '../components/DataPreviewSection'
import { ScratchpadPanel } from '../components/ScratchpadPanel'
import { ChatPrompt } from '../components/ChatPrompt'
import { FormRenderer } from '../components/FormRenderer'
import { StreamingUIRenderer } from '../components/StreamingUIRenderer'
import { GenerativeUIErrorBoundary } from '../components/GenerativeUIErrorBoundary'
import { VerifiedText } from '../components/VerifiedText'
import { AgentCard } from '../components/AgentCard'
import { AgentHandoff } from '../components/AgentHandoff'
import { BriefingDiff } from '../components/BriefingDiff'
import { AutocompleteDropdown } from '../components/AutocompleteDropdown'
import { GraphRenderer } from '../components/GraphRenderer'
import { MapRenderer } from '../components/MapRenderer'
import { ChartJSRenderer } from '../components/ChartJSRenderer'
import { SplitStepper } from '../components/SplitStepper'
import { ModalRenderer } from '../components/ModalRenderer'
import { FeedbackInline } from '../components/FeedbackInline'
import { ElicitationForm } from '../components/ElicitationForm'
import { EditableUIResourceRenderer } from '../components/EditableUIResourceRenderer'
import type { UIComponent, UILayout } from '../types'
import type { DataValidation, ScratchpadSection, ScratchpadState } from '../types/chat-bus'

// ─── Mocks ──────────────────────────────────────────────────────────────

vi.mock('highlight.js', () => ({
  default: {
    highlight: vi.fn((code: string) => ({ value: code })),
    highlightAuto: vi.fn((code: string) => ({ value: code })),
    getLanguage: vi.fn(() => true),
  },
}))

vi.mock('chart.js/auto', () => {
  class FakeChart {
    destroy = vi.fn()
    resize = vi.fn()
    toBase64Image = vi.fn(() => 'data:image/png;base64,')
  }
  return { default: FakeChart }
})

/** Leaflet cannot load → MapRenderer's degraded coordinate table. */
vi.mock('leaflet', () => {
  throw new Error('地图')
})

const stream = vi.hoisted(() => ({
  state: null as null | {
    progress: { message: string; receivedCount: number; totalCount: number | null; timestamp: string }
    error: { error: string; message: string; recoverable: boolean } | null
    metadata: Record<string, unknown> | null
  },
  options: null as null | { messages?: Record<string, string> },
}))

vi.mock('../hooks/useStreamingUI', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useStreamingUI')>()
  return {
    ...actual,
    useStreamingUI: (options: { messages?: Record<string, string> }) => {
      stream.options = options
      return {
        components: () => [],
        isLoading: () => true,
        isStreaming: () => true,
        error: () => stream.state?.error ?? null,
        progress: () => stream.state!.progress,
        metadata: () => stream.state?.metadata ?? null,
        startStreaming: () => {},
        stopStreaming: () => {},
      }
    },
  }
})

// ─── Pseudo dictionary ──────────────────────────────────────────────────

/** `⟦key {placeholders}⟧` — placeholders kept so formatMCPUIString fills them. */
const PSEUDO: Required<MCPUIStrings> = Object.fromEntries(
  Object.entries(DEFAULT_MCPUI_STRINGS).map(([key, value]) => {
    if (key === 'locale') return [key, 'fr-FR']
    const placeholders = value.match(/\{\w+\}/g) ?? []
    return [key, `⟦${[key, ...placeholders].join(' ')}⟧`]
  })
) as Required<MCPUIStrings>

const withPseudo = (ui: () => JSX.Element) =>
  render(() => <MCPUIStringsProvider strings={PSEUDO}>{ui()}</MCPUIStringsProvider>)

// ─── DOM walk ───────────────────────────────────────────────────────────

const VISIBLE_ATTRS = ['aria-label', 'aria-description', 'aria-valuetext', 'title', 'alt', 'placeholder']

/** Removes `⟦…⟧` segments, innermost first (templates nest). */
function stripMarkers(text: string): string {
  let out = text
  while (/⟦[^⟦⟧]*⟧/.test(out)) out = out.replace(/⟦[^⟦⟧]*⟧/g, ' ')
  return out
}

interface Leak {
  where: string
  text: string
  runs: string[]
}

function describeElement(el: Element): string {
  const cls = (el.getAttribute('class') ?? '').split(/\s+/).slice(0, 2).join('.')
  return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`
}

/** Every Latin run ≥ 2 letters outside the markers, in text nodes and visible attributes. */
function collectLeaks(root: ParentNode = document.body): Leak[] {
  const leaks: Leak[] = []
  const check = (where: string, raw: string | null) => {
    if (!raw) return
    const runs = stripMarkers(raw).match(/[A-Za-z]{2,}/g)
    if (runs) leaks.push({ where, text: raw.trim().slice(0, 160), runs })
  }
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  for (let node: Node | null = walker.currentNode; node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement
      if (parent && ['STYLE', 'SCRIPT'].includes(parent.tagName)) continue
      check(`text in ${parent ? describeElement(parent) : '?'}`, node.nodeValue)
      continue
    }
    const el = node as Element
    for (const name of VISIBLE_ATTRS) check(`@${name} of ${describeElement(el)}`, el.getAttribute(name))
    const isButtonValue =
      el.tagName === 'BUTTON' ||
      (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes((el as HTMLInputElement).type))
    if (isButtonValue) check(`@value of ${describeElement(el)}`, el.getAttribute('value'))
  }
  return leaks
}

/** Allowed Latin runs for one surface — token → reason citing the policy item. */
type AllowSet = Record<string, `P${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8} — ${string}` | `out-of-scope — ${string}`>

/**
 * `allow` — single Latin tokens; `allowTexts` — a whole rendered string
 * (matched as a substring) such as a P3 developer diagnostic sentence.
 */
function expectNoLeaks(allow: AllowSet = {}, allowTexts: AllowSet = {}) {
  const leaks = collectLeaks()
    .filter((l) => !Object.keys(allowTexts).some((t) => l.text.includes(t)))
    .map((l) => ({ ...l, runs: l.runs.filter((r) => !(r in allow)) }))
    .filter((l) => l.runs.length > 0)
    .map((l) => `${l.where}: ${JSON.stringify(l.text)} → ${l.runs.join(', ')}`)
  expect(leaks, 'Hardcoded chrome rendered outside the pseudo markers').toEqual([])
}

// ─── Fixtures ───────────────────────────────────────────────────────────

let seq = 0
const component = (type: string, params: Record<string, unknown>, colSpan = 12): UIComponent =>
  ({
    id: `c${++seq}`,
    type,
    position: { colStart: 1, colSpan },
    params,
  }) as unknown as UIComponent

const layout = (components: UIComponent[], metadata?: UILayout['metadata']): UILayout => ({
  id: `l${++seq}`,
  components,
  grid: { columns: 12, gap: '16px' },
  ...(metadata ? { metadata } : {}),
})

const cjkRows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ 名称: `数据${i + 1}`, 数量: i * 1000 + 1, 日期: '2026-09-17' }))

const clipboard = { writeText: vi.fn(async (_text: string) => {}) }

beforeEach(() => {
  clipboard.writeText.mockClear()
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

// ─── Tests ──────────────────────────────────────────────────────────────

describe('pseudo-locale — the pseudo dictionary', () => {
  it('replaces every chrome value and keeps each placeholder', () => {
    for (const [key, value] of Object.entries(DEFAULT_MCPUI_STRINGS)) {
      if (key === 'locale') continue
      const pseudo = PSEUDO[key as keyof MCPUIStrings]
      expect(pseudo.startsWith(`⟦${key}`)).toBe(true)
      for (const placeholder of value.match(/\{\w+\}/g) ?? []) expect(pseudo).toContain(placeholder)
    }
    expect(PSEUDO.locale).toBe('fr-FR')
  })

  it('detects a leak — the walk is not vacuous', () => {
    render(() => (
      <div title="Close">
        ⟦ok⟧ 列一 <span aria-label="⟦a ⟦b⟧ tail⟧">x</span> Loading
      </div>
    ))
    const runs = collectLeaks().flatMap((l) => l.runs)
    expect(runs).toEqual(expect.arrayContaining(['Close', 'Loading']))
    expect(runs).not.toContain('ok')
    expect(runs).not.toContain('tail')
  })
})

describe('pseudo-locale — UIResourceRenderer', () => {
  it('table: paginated, searched, export menu opened, expanded fullscreen', async () => {
    const table = component('table', {
      title: '标题',
      columns: [
        { key: '名称', label: '列一' },
        { key: '数量', label: '列二' },
        { key: '日期', label: '列三' },
      ],
      rows: cjkRows(30),
      pageSize: 10,
      searchable: true,
      exportable: { formats: ['tsv', 'csv', 'json'] },
    })
    const { container } = withPseudo(() => <UIResourceRenderer content={table} />)
    expectNoLeaks()

    const search = container.querySelector('input[type="text"]') as HTMLInputElement
    fireEvent.input(search, { target: { value: '数据1' } })
    await waitFor(() => expect(container.querySelector('[aria-label^="⟦tableClearSearch"]')).not.toBeNull())
    await waitFor(() => expect(container.textContent).toContain('⟦tableSearchResultsMany'))
    expectNoLeaks()

    fireEvent.click(container.querySelector('button[aria-haspopup="menu"]') as HTMLElement)
    await waitFor(() => expect(document.body.textContent).toContain('⟦tableDownloadJson'))
    expectNoLeaks()

    fireEvent.click(container.querySelector('[data-mcp-ui-action="expand"]') as HTMLElement)
    await waitFor(() => expect(document.querySelector('[data-mcp-ui-portal="dialog"]')).not.toBeNull())
    expectNoLeaks()
  })

  it('table: server-side pagination and virtualized rows', async () => {
    const server = component('table', {
      title: '标题',
      columns: [{ key: '名称', label: '列一' }],
      rows: cjkRows(5),
      pagination: { currentPage: 1, pageSize: 5, totalRows: 40 },
    })
    const virtual = component('table', {
      title: '标题二',
      columns: [{ key: '名称', label: '列一' }],
      rows: cjkRows(50),
      pageSize: 0,
      virtualize: { threshold: 10 },
    })
    const { container } = withPseudo(() => <UIResourceRenderer content={layout([server, virtual])} />)
    expect(container.textContent).toContain('⟦tableServerPageRange 6 10 40⟧')
    await waitFor(() => expect(container.textContent).toContain('⟦tableVirtualizedRows 50⟧'))
    expectNoLeaks()
  })

  it('metric, text, image, link, action, action-group, artifact, code, carousel + auto-footer', async () => {
    const components = [
      component('metric', { title: '指标', value: 1234, unit: '元', trend: { value: 5, direction: 'up' } }, 6),
      component('text', { content: '文本 **粗体**', markdown: true }, 6),
      component('image', { url: 'https://example.com/a.png' }, 6),
      component('link', { url: 'https://example.com', label: '链接', description: '说明' }, 6),
      component('action', { label: '按钮', type: 'button', action: 'tool-call', toolName: 't' }, 6),
      component('action-group', {
        actions: [
          { label: '一', type: 'button', action: 'tool-call', toolName: 'a' },
          { label: '二', type: 'button', action: 'tool-call', toolName: 'b' },
        ],
      }, 6),
      component('artifact', { url: 'https://example.com/f', filename: '文件', mimeType: 'text/csv', size: 2048 }, 6),
      component('code', { code: '代码 = 1', filename: '代码' }, 6),
      component('carousel', {
        items: [component('metric', { title: '甲', value: 1 }), component('metric', { title: '乙', value: 2 })],
      }),
    ]
    withPseudo(() => (
      <UIResourceRenderer
        content={layout(components, {
          query: '查询',
          generatedAt: '2026-09-17',
          totalComponents: components.length,
          executionTime: 42,
          sourceCount: 3,
          llmModel: '模型',
        })}
      />
    ))
    await waitFor(() => expect(document.body.textContent).toContain('⟦footerSources 3⟧'))
    expectNoLeaks({
      KB: 'P4 — unit symbol of the artifact size (2.0 KB).',
      ms: 'P4 — unit symbol after the footer execution time.',
      Deposium: 'out-of-scope — auto-footer poweredBy brand (E, pre-existing since v1.2.0).',
    })
  })

  it('form, image gallery, video and modal', async () => {
    const components = [
      component('form', {
        title: '表单',
        fields: [
          { name: 'a', type: 'text', label: '甲', required: true },
          { name: 'b', type: 'email', label: '乙' },
          { name: 'c', type: 'select', multiple: true, label: '丙', options: [{ label: '一', value: '1' }, { label: '二', value: '2' }] },
        ],
        showReset: true,
      }),
      component('image-gallery', { title: '图库', images: [{ url: 'https://example.com/1.jpg' }, { url: 'https://example.com/2.jpg' }] }, 6),
      component('video', { url: 'https://deposium.com/v.mp4' }, 6),
      component('modal', {
        title: '对话框',
        trigger: component('action', { label: '打开', type: 'button', action: 'link', url: 'https://example.com' }),
        content: component('text', { content: '内容' }),
      }),
    ]
    const { container } = withPseudo(() => <UIResourceRenderer content={layout(components)} />)
    expectNoLeaks()

    // Validation errors.
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    await waitFor(() => expect(container.textContent).toContain('⟦fieldRequired'))
    expectNoLeaks()

    // An open modal (portal).
    render(() => (
      <MCPUIStringsProvider strings={PSEUDO}>
        <ModalRenderer params={{ title: '对话框', content: component('text', { content: '内容' }) }} isOpen onClose={() => {}}>
          <p>内容</p>
        </ModalRenderer>
      </MCPUIStringsProvider>
    ))
    await waitFor(() => expect(document.querySelector('[aria-label="⟦modalClose⟧"]')).not.toBeNull())
    expectNoLeaks()

    // Lightbox (portal).
    fireEvent.click(container.querySelector('button[aria-label^="⟦galleryViewImage"]') as HTMLElement)
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
    expectNoLeaks()
  })

  it('chart: degraded path (renderer iframe, no quickchart opt-in)', async () => {
    const chart = component('chart', {
      type: 'bar',
      renderer: 'iframe',
      title: '图表',
      data: { labels: ['一', '二'], datasets: [{ data: [1, 2] }, { label: '系列', data: [3, 4] }] },
    })
    const { container } = withPseudo(() => <UIResourceRenderer content={chart} />)
    await waitFor(() => expect(container.textContent).toContain('⟦chartQuickchartCaption'))
    expectNoLeaks(
      {},
      {
        'Interactive chart unavailable — install the chart.js peer dependency':
          'P3 — developer diagnostic naming the chart.js peer dependency and the allowQuickchartFallback flag; the caption around it is localized.',
      }
    )
  })

  it('chart: native path (chart.js resolves) with the data view toggled', async () => {
    const chart = component('chart', {
      type: 'line',
      title: '图表',
      data: { labels: ['一', '二'], datasets: [{ label: '系列', data: [1, 2] }] },
    })
    const { container } = withPseudo(() => <ChartJSRenderer component={chart} />)
    await waitFor(() => expect(container.querySelector('canvas')).not.toBeNull())
    expectNoLeaks()
    const dataButton = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('⟦chartDataView')
    )
    expect(dataButton).toBeDefined()
    fireEvent.click(dataButton as HTMLElement)
    await waitFor(() => expect(container.querySelector('table')).not.toBeNull())
    expectNoLeaks()
  })

  it('tool-error card, and the text its Copy button puts on the clipboard', async () => {
    const { container } = withPseudo(() => (
      <UIResourceRenderer
        content={{ error: true, message: '错误', tool: '工具', type: '类型', suggestions: ['建议'], timestamp: '2026-09-17T10:00:00Z' } as never}
      />
    ))
    expectNoLeaks()

    const copy = container.querySelector('button[title^="⟦copyErrorDetails"]') as HTMLElement
    expect(copy).not.toBeNull()
    fireEvent.click(copy)
    await waitFor(() => expect(clipboard.writeText).toHaveBeenCalled())
    const text = clipboard.writeText.mock.calls[0][0]
    expect(text).toBe('⟦errorCopyText 工具 错误⟧')
    expect(stripMarkers(text)).not.toMatch(/[A-Za-z]{2}/)

    // Without a tool name, the fallback is chrome too.
    cleanup()
    clipboard.writeText.mockClear()
    const bare = withPseudo(() => <UIResourceRenderer content={{ error: true } as never} />)
    fireEvent.click(bare.container.querySelector('button[title^="⟦copyErrorDetails"]') as HTMLElement)
    await waitFor(() => expect(clipboard.writeText).toHaveBeenCalled())
    expect(stripMarkers(clipboard.writeText.mock.calls[0][0])).not.toMatch(/[A-Za-z]{2}/)
  })
})

describe('pseudo-locale — DataPreviewSection', () => {
  it('paginated, sortable, with page info and export buttons', () => {
    const { container } = withPseudo(() => (
      <DataPreviewSection
        content={{
          columns: [
            { key: '名称', label: '列一' },
            { key: '数量', label: '列二', type: 'number' },
            { key: '日期', label: '列三', type: 'date' },
          ],
          rows: cjkRows(12),
          totalRows: 5000,
          pageSize: 5,
          showPageInfo: true,
          source: '来源',
        }}
      />
    ))
    fireEvent.click(container.querySelector('th') as HTMLElement)
    expectNoLeaks({
      CSV: 'P4 — file-format acronym on the export button (its title is localized).',
      JSON: 'P4 — file-format acronym on the export button (its title is localized).',
    })
    // fr-FR formatting through `locale`: 5 000 with a narrow no-break space.
    expect(container.textContent).toMatch(/5\u202F000/)
  })
})

describe('pseudo-locale — ScratchpadPanel', () => {
  let n = 0
  const section = (type: ScratchpadSection['type'], content: unknown, title = '节'): ScratchpadSection => ({
    id: `s${++n}`,
    title,
    type,
    content,
    editable: true,
    source: 'agent',
  })
  const state = (status: ScratchpadState['status'], sections: ScratchpadSection[], extra: Partial<ScratchpadState> = {}): ScratchpadState => ({
    id: `sp${++n}`,
    title: '草稿',
    sections,
    filters: {},
    agentMessages: [{ text: '消息', type: 'question' }],
    status,
    ...extra,
  })

  for (const status of ['loading', 'ready', 'waiting_human', 'processing', 'complete'] as const) {
    it(`status ${status}`, () => {
      withPseudo(() => <ScratchpadPanel state={state(status, [section('message', '消息')])} onClose={() => {}} />)
      expectNoLeaks()
    })
  }

  it('error status with code and retry', () => {
    withPseudo(() => (
      <ScratchpadPanel
        state={state('error', [], { error: { message: '错误', code: '五百', retryable: true } })}
        onRetry={() => {}}
      />
    ))
    expect(document.body.textContent).toContain('⟦scratchpadErrorCode 五百⟧')
    expectNoLeaks()
  })

  it('data, filter, action, steps, form, understanding, feedback, prompt, stepper, error, source card, diff sections', async () => {
    const sections = [
      section('data', { 键: '值' }),
      section('filter', { 城市: { label: '城市' } }),
      section('action', { title: '标题', preview: { count: 3, summary: '摘要' }, validation: { confidence: 0.6, hallucinated: [1] }, actions: [{ label: '确定', value: '1' }] }),
      section('steps', { steps: [{ label: '步骤', status: 'active', description: '描述' }] }),
      section('form', { fields: [{ name: 'a', type: 'text', label: '甲', prefill: '值' }, { name: 'b', type: 'text', label: '乙', prefill: '值' }, { name: 'c', type: '奇怪', label: '丙' }], autoSubmitDelay: 5000 }),
      section('understanding', { detections: [{ label: '标签', value: '值', confidence: 'high' }], warnings: ['警告'] }),
      section('feedback', { question: '问题', allowFreeText: true }),
      section('prompt', { originalQuery: '查询', extracted: { 键: '值' }, plan: '计划', editable: true }),
      section('stepper', { steps: [{ id: '1', label: '一', status: 'done', summary: '好', duration_ms: 5 }], orientation: 'vertical' }),
      section('error', { message: '错误', retryAction: 'r', details: '细节' }),
      section('source_card', { name: '来源', status: 'queried', capabilities: [{ label: '能力', supported: true }], row_count: 12345, freshness: '今天', latency_ms: 20 }),
      section('diff', { left: { label: '左', rows: [{ 键: '1' }] }, right: { label: '右', rows: [{ 键: '2' }] } }),
    ]
    const { container } = withPseudo(() => (
      <ScratchpadPanel state={state('waiting_human', sections, { filters: { 城市: '北京' }, preview: { count: 1234, summary: '摘要', rows: [{ 列: '值' }] } })} onAction={() => {}} onFilterChange={() => {}} />
    ))
    expect(container.textContent).toContain('⟦scratchpadResultCount 12\u202F345⟧')
    for (const marker of ['⟦fieldUnknownType 奇怪⟧', '⟦formPrefilledMany 2 3⟧', '⟦scratchpadPlan⟧', '⟦scratchpadItems⟧', '⟦verifiedConfidence 60⟧', '⟦scratchpadNextStep⟧', '⟦statusYourTurn⟧']) {
      expect(container.textContent).toContain(marker)
    }
    expectNoLeaks({ ms: 'P4 — unit symbol of step durations / latency.' })

    // Error details, then a feedback answer.
    const details = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes('⟦scratchpadDetails'))
    fireEvent.click(details as HTMLElement)
    const yes = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes('⟦yes'))
    fireEvent.click(yes as HTMLElement)
    await waitFor(() => expect(Array.from(container.querySelectorAll('button')).some((b) => (b.textContent ?? '').includes('⟦yes'))).toBe(false))
    expectNoLeaks({ ms: 'P4 — unit symbol of step durations / latency.' })
  })

  it('agent card, agent handoff, briefing diff, verified text and data preview sections', () => {
    const validation: DataValidation = {
      valid: false,
      llmNumbers: [{ value: 42, position: 3, context: '共 42' }, { value: 99, position: 8, context: '和 99' }],
      sourceNumbers: new Set([42]),
      hallucinated: [{ value: 99, position: 8, context: '和 99', closest: 98, distance: 0.01 }],
      confidence: 0.5,
    }
    const sections = [
      section('agent_card', { agentId: 'a', name: '代理', status: 'running', capabilities: ['能力'], model: '模型', currentStep: { id: '1', label: '步骤' } }),
      section('agent_handoff', { from: { id: 'a', name: '甲' }, to: { id: 'b', name: '乙' }, itemCount: 7, dataKeys: ['键'] }),
      section('briefing_diff', { title: '简报', previousDate: '昨天', currentDate: '今天', changes: [{ type: 'changed', label: '变化', previous: '旧', current: '新' }], stats: { added: 1, removed: 2, changed: 3 } }),
      section('verified_text', { text: '共 42 和 99', validation }),
      section('data_preview', { columns: [{ key: '列', label: '列' }], rows: [{ 列: '值' }], exportable: false }),
    ]
    const { container } = withPseudo(() => <ScratchpadPanel state={state('processing', sections)} />)
    for (const marker of ['⟦agentStatusRunning⟧', '⟦handoffItems 7⟧', '⟦briefingAdded 1⟧', '⟦briefingRemoved 2⟧', '⟦briefingChanged 3⟧', '⟦verifiedConfidence 50⟧']) {
      expect(container.textContent).toContain(marker)
    }
    expectNoLeaks()
  })
})

describe('pseudo-locale — ChatPrompt', () => {
  it('confirm', () => {
    withPseudo(() => <ChatPrompt config={{ type: 'confirm', title: '确认', config: { message: '删除?' } }} onSubmit={() => {}} onDismiss={() => {}} />)
    expectNoLeaks()
  })

  it('form', () => {
    withPseudo(() => (
      <ChatPrompt
        config={{ type: 'form', title: '表单', config: { fields: [{ name: 'a', type: 'text', label: '甲', required: true }, { name: 'b', type: 'select', label: '乙', options: [{ label: '一', value: '1' }] }] } }}
        onSubmit={() => {}}
        onDismiss={() => {}}
      />
    ))
    expectNoLeaks()
  })
})

describe('pseudo-locale — FormRenderer', () => {
  const form = (prefilled: number, extra: Record<string, unknown> = {}) =>
    component('form', {
      fields: [
        { name: 'a', type: 'text', label: '甲', required: true, ...(prefilled >= 1 ? { prefill: '值' } : {}) },
        { name: 'b', type: 'text', label: '乙', minLength: 3, ...(prefilled >= 2 ? { prefill: '值' } : {}) },
        { name: 'c', type: 'select', multiple: true, label: '丙', options: [{ label: '一', value: '1' }, { label: '二', value: '2' }], defaultValue: ['1', '2'] },
        { name: 'd', type: 'number', label: '丁', min: 5 },
      ],
      showReset: true,
      ...extra,
    })

  it('one prefilled field, validation errors, multiselect with selections', async () => {
    const { container } = withPseudo(() => <FormRenderer component={form(1)} />)
    expect(container.textContent).toContain('⟦formPrefilledOne')
    expect(container.textContent).toContain('⟦fieldSelectedCount 2⟧')
    fireEvent.input(container.querySelector('input[name="b"]') as HTMLInputElement, { target: { value: '一' } })
    fireEvent.input(container.querySelector('input[name="d"]') as HTMLInputElement, { target: { value: '1' } })
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    await waitFor(() => expect(container.textContent).toContain('⟦fieldMinLength'))
    expectNoLeaks()
  })

  it('two prefilled fields with an auto-submit countdown', () => {
    const { container } = withPseudo(() => <FormRenderer component={form(2, { autoSubmitDelay: 5000 })} />)
    expect(container.textContent).toContain('⟦formPrefilledMany')
    expectNoLeaks()
  })
})

describe('pseudo-locale — StreamingUIRenderer (mocked hook)', () => {
  it('progress message, metadata and error', () => {
    stream.state = {
      progress: { message: '', receivedCount: 1, totalCount: 3, timestamp: '' },
      error: null,
      metadata: { provider: '供应商', model: '模型', executionTimeMs: 12, firstTokenMs: 3, costUSD: 0.1, cached: true },
    }
    withPseudo(() => <StreamingUIRenderer query="查询" />)

    // The renderer hands the hook messages resolved from the context.
    const messages = stream.options!.messages!
    for (const key of Object.keys(messages)) {
      expect(messages[key]).toMatch(/^⟦stream/)
    }
    cleanup()

    stream.state = {
      progress: { message: messages.connecting, receivedCount: 0, totalCount: null, timestamp: '' },
      error: { error: messages.connectionFailed, message: messages.unknownError, recoverable: true },
      metadata: { provider: '供应商', model: '模型', executionTimeMs: 12, firstTokenMs: 3, costUSD: 0.1, cached: true },
    }
    const { container } = withPseudo(() => <StreamingUIRenderer query="查询" />)
    for (const marker of ['⟦streamConnecting⟧', '⟦streamConnectionFailed⟧', '⟦streamUnknownError⟧', '⟦metaProvider⟧', '⟦retry⟧']) {
      expect(container.textContent).toContain(marker)
    }
    expectNoLeaks({ ms: 'P4 — unit symbol after execution time / TTFB.' })
  })
})

describe('pseudo-locale — standalone components', () => {
  it('GenerativeUIErrorBoundary with a throwing child', () => {
    const Boom = () => {
      throw new Error('炸')
    }
    withPseudo(() => (
      <GenerativeUIErrorBoundary componentId="12345678901" componentType="图表" allowRetry>
        <Boom />
      </GenerativeUIErrorBoundary>
    ))
    expect(document.body.textContent).toContain('⟦errorBoundaryTitle⟧')
    expectNoLeaks()
  })

  it('VerifiedText: highlight tooltip, strip mode, confidence footer', () => {
    const validation: DataValidation = {
      valid: false,
      llmNumbers: [{ value: 42, position: 2, context: '共 42' }, { value: 99, position: 7, context: '和 99' }],
      sourceNumbers: new Set([42]),
      hallucinated: [{ value: 99, position: 7, context: '和 99', closest: 98, distance: 0.01 }],
      confidence: 0.5,
    }
    withPseudo(() => (
      <>
        <VerifiedText text="共 42 和 99" validation={validation} />
        <VerifiedText text="共 42 和 99" validation={validation} mode="strip" />
        <VerifiedText text="共 42 和 99" validation={{ ...validation, hallucinated: [{ value: 99, position: 7, context: '和 99' }] }} mode="annotate" />
      </>
    ))
    expect(document.body.textContent).toContain('⟦verifiedStripLabel⟧')
    expect(document.querySelector('[title^="⟦verifiedNotFoundClosest"]')).not.toBeNull()
    expectNoLeaks()
  })

  it('AgentCard, AgentHandoff, BriefingDiff', () => {
    withPseudo(() => (
      <>
        <AgentCard content={{ agentId: 'a', name: '代理', status: 'error', capabilities: ['能力'], model: '模型', currentStep: { id: '1', label: '步骤' } }} />
        <AgentCard content={{ agentId: 'b', name: '代理二', status: 'waiting' }} />
        <AgentHandoff content={{ from: { id: 'a', name: '甲' }, to: { id: 'b', name: '乙' }, itemCount: 7 }} />
        <BriefingDiff content={{ changes: [{ type: 'added', label: '新增', current: '值' }, { type: 'removed', label: '删除', previous: '值' }], stats: { added: 1, removed: 1, changed: 0 } }} />
        <SplitStepper content={{ agents: [{ id: 'a', name: '甲', status: 'active', steps: [{ id: '1', label: '一', status: 'error' }] }], synthesis: { status: 'pending', label: '综合' } }} />
      </>
    ))
    expect(document.body.textContent).toContain('⟦agentStatusError⟧')
    expect(document.body.textContent).toContain('⟦briefingAdded 1⟧')
    expectNoLeaks()
  })

  it('AutocompleteDropdown with suggestions, loading and empty states', () => {
    withPseudo(() => (
      <>
        <AutocompleteDropdown options={[{ value: '1', label: '北京', description: '首都' }]} selectedIndex={0} isOpen onSelect={() => {}} />
        <AutocompleteDropdown options={[]} selectedIndex={-1} isOpen isLoading onSelect={() => {}} />
        <AutocompleteDropdown options={[]} selectedIndex={-1} isOpen onSelect={() => {}} />
      </>
    ))
    expect(document.body.textContent).toContain('⟦autocompleteLoading⟧')
    expect(document.body.textContent).toContain('⟦autocompleteEmpty⟧')
    expectNoLeaks({
      Enter: 'P1 — key cap inside <kbd>.',
      Esc: 'P1 — key cap inside <kbd>.',
    })
  })

  it('GraphRenderer with its export menu open', async () => {
    const graph = component('graph', { title: '图', nodes: [{ id: '一', label: '一' }, { id: '二', label: '二' }], edges: [{ source: '一', target: '二' }] })
    const { container } = withPseudo(() => <GraphRenderer component={graph} />)
    const trigger = await waitFor(() => {
      const button = container.querySelector('button[aria-haspopup="menu"]')
      expect(button).not.toBeNull()
      return button as HTMLElement
    })
    expectNoLeaks()
    fireEvent.click(trigger)
    await waitFor(() => expect(document.body.textContent).toContain('⟦graphDownloadJson'))
    expectNoLeaks()
  })

  it('MapRenderer degraded coordinate table (leaflet unavailable)', async () => {
    const { container } = withPseudo(() => (
      <MapRenderer params={{ title: '地图', center: [39.9, 116.4], markers: [{ lat: 39.9, lng: 116.4, label: '北京' }] } as never} />
    ))
    await waitFor(() => expect(container.textContent).toContain('⟦mapDegradedCaption'))
    expect(container.textContent).toContain('⟦degradedMarker⟧')
    expectNoLeaks()
  })

  it('FeedbackInline before and after a rating', async () => {
    const { container } = withPseudo(() => <FeedbackInline onSubmit={() => {}} />)
    expectNoLeaks()
    fireEvent.click(container.querySelector('button') as HTMLElement)
    await waitFor(() => expect(container.textContent).toContain('⟦feedback'))
    expectNoLeaks()
  })

  it('ElicitationForm: confirm, choice and form shapes', () => {
    withPseudo(() => (
      <>
        <ElicitationForm event={{ message: '继续?', requestedSchema: { type: 'object', properties: { 同意: { type: 'boolean', description: '我同意' } } } }} onAccept={() => {}} onCancel={() => {}} />
        <ElicitationForm event={{ message: '选择', requestedSchema: { type: 'object', properties: { 颜色: { type: 'string', enum: ['1', '2'], enumNames: ['红', '蓝'] } } } }} onAccept={() => {}} />
        <ElicitationForm event={{ message: '表单', requestedSchema: { type: 'object', properties: { 名字: { type: 'string', title: '名字' }, 年龄: { type: 'integer', title: '年龄', minimum: 1 } }, required: ['名字'] } }} onAccept={() => {}} />
      </>
    ))
    expectNoLeaks()
  })

  it('EditableUIResourceRenderer', () => {
    withPseudo(() => (
      <EditableUIResourceRenderer layout={layout([component('metric', { title: '指标', value: 1 }, 6), component('text', { content: '文本' }, 6)])} />
    ))
    expectNoLeaks()
  })
})

describe('pseudo-locale — UIResourceRenderer edge surfaces', () => {
  it('iframe, unsupported type, inline validation chip and a raw-HTML resource', () => {
    withPseudo(() => (
      <>
        <UIResourceRenderer content={component('iframe', { url: 'https://www.youtube.com/embed/1' })} />
        <UIResourceRenderer content={layout([component('奇怪', {})])} />
        <UIResourceRenderer content={component('metric', { title: '无值' })} errorMode="inline-warn" />
        <UIResourceRenderer content={{ uri: 'ui://deposium/资源', metadata: { title: '资源' }, content: { type: 'rawHtml', htmlString: '<p>内容</p>' } } as never} />
      </>
    ))
    expect(document.body.textContent).toContain('⟦invalidComponent')
    expect(document.body.textContent).toContain('⟦unsupportedComponentType⟧')
    expectNoLeaks(
      {},
      {
        'Invalid input':
          'P3 — payload-schema diagnostic (ValidationError.message) in the title of the inline chip; the chip text itself is localized (invalidComponent).',
      }
    )
  })
})
