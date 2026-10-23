import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal, createStore, flush } from 'solid-js'
import { UIResourceRenderer } from './UIResourceRenderer'
import { MCPUIStringsProvider } from '../context/MCPUIStringsContext'
import { _getMountCount, _resetRegistry } from '../utils/duplicate-mount-registry'
import type { UIComponent } from '../types'

const component = (id: string, type: string, params: Record<string, unknown>): UIComponent =>
  ({ id, type, params, position: { colStart: 1, colSpan: 12 } }) as UIComponent

afterEach(() => {
  cleanup()
  _resetRegistry()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('UIResourceRenderer Solid 2 live payload boundaries', () => {
  it('revalidates the same store proxy before rendering a malicious replacement, including silent mode', () => {
    for (const mode of ['block', 'silent'] as const) {
      const [payload, setPayload] = createStore(component(`live-iframe-${mode}`, 'iframe', {
        url: 'https://www.youtube.com/embed/test', title: 'Allowed frame',
      }))
      const onError = vi.fn()
      const view = render(() => <UIResourceRenderer content={payload} errorMode={mode} onError={onError} />)
      expect(view.container.querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube.com/embed/test')
      setPayload((draft) => { draft.params = { url: 'javascript:alert(document.cookie)', title: 'Blocked frame' } })
      flush()
      expect(view.container.querySelector('iframe')).toBeNull()
      expect(view.container.querySelector('[src^="javascript:"]')).toBeNull()
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][0]).toMatchObject({ type: 'validation', componentId: `live-iframe-${mode}` })
      if (mode === 'silent') expect(view.container.querySelector('[role="alert"]')).toBeNull()
      else expect(view.container.textContent).toContain('Validation Error')
      view.unmount()
    }
  })

  it('switches content kinds on one renderer instance and sanitizes a raw-HTML resource', () => {
    const [payload, setPayload] = createSignal<unknown>(component('kind-switch', 'text', { content: 'Initial text' }))
    const view = render(() => <UIResourceRenderer content={payload() as UIComponent} />)
    expect(view.container.textContent).toContain('Initial text')
    setPayload({ error: true, tool: 'fixture.tool', message: 'Tool failed deliberately' })
    flush()
    expect(view.container.textContent).toContain('Tool failed deliberately')
    expect(view.container.textContent).not.toContain('Initial text')
    setPayload({ uri: 'ui://fixture/live', content: { type: 'rawHtml', htmlString: '<strong>Safe resource</strong><img src="x" onerror="alert(1)"><script>alert(2)</script>' } })
    flush()
    expect(view.container.querySelector('strong')?.textContent).toBe('Safe resource')
    expect(view.container.querySelector('script,[onerror]')).toBeNull()
    expect(view.container.textContent).not.toContain('Tool failed deliberately')
    setPayload(component('kind-switch', 'text', { content: 'Final text' }))
    flush()
    expect(view.container.textContent).toContain('Final text')
    expect(view.container.querySelector('strong')).toBeNull()
    view.unmount()
  })

  it('updates table params and citation-provider wording without remounting the stable payload', () => {
    const [payload, setPayload] = createStore(component('stable-live-table', 'table', {
      columns: [{ key: 'cite', label: 'Original column' }], rows: [{ cite: '[1]' }],
      citationMap: { '1': { page: 5, file: 'Original.pdf' } }, virtualize: false,
    }))
    const [french, setFrench] = createSignal(false)
    const onMountDuplicate = vi.fn()
    const view = render(() => <MCPUIStringsProvider strings={french() ? { citationViewSource: 'Voir {label}' } : {}}>
      <UIResourceRenderer content={payload} onMountDuplicate={onMountDuplicate} />
    </MCPUIStringsProvider>)
    const table = view.container.querySelector('table')
    expect(table).not.toBeNull()
    expect(_getMountCount('stable-live-table')).toBe(1)
    expect(view.container.querySelector('[data-citation-page]')?.getAttribute('title')).toBe('View source - Original.pdf - 5')
    setPayload((draft) => { draft.params = {
      columns: [{ key: 'cite', label: 'Replacement column' }], rows: [{ cite: 'Updated [2]' }],
      citationMap: { '2': { page: 9, file: 'Replacement.pdf' } }, virtualize: false,
    } })
    setFrench(true)
    flush()
    expect(view.container.querySelector('table')).toBe(table)
    expect(view.container.textContent).toContain('Replacement column')
    expect(view.container.textContent).not.toContain('Original column')
    const citation = view.container.querySelector('[data-citation-page]')
    expect(citation?.getAttribute('data-citation-page')).toBe('9')
    expect(citation?.getAttribute('data-citation-doc')).toBe('Replacement.pdf')
    expect(citation?.getAttribute('title')).toBe('Voir Replacement.pdf - 9')
    expect(_getMountCount('stable-live-table')).toBe(1)
    expect(onMountDuplicate).not.toHaveBeenCalled()
    view.unmount()
    expect(_getMountCount('stable-live-table')).toBe(0)
  })

  it('ignores clipboard completion after unmount and clears an existing copy-feedback timer', async () => {
    vi.useFakeTimers()
    let finishCopy!: () => void
    const writeText = vi.fn(() => new Promise<void>((resolve) => { finishCopy = resolve }))
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    try {
      const first = render(() => <UIResourceRenderer content={component('copy-late', 'text', { content: 'Copy payload' })} />)
      const button = first.container.querySelector<HTMLButtonElement>('[data-mcp-ui-action="copy"]')!
      expect(button).not.toBeNull()
      const markup = button.innerHTML
      const baseline = vi.getTimerCount()
      fireEvent.click(button)
      expect(writeText).toHaveBeenCalledWith('Copy payload')
      first.unmount()
      finishCopy()
      await Promise.resolve()
      flush()
      expect(button.innerHTML).toBe(markup)
      expect(vi.getTimerCount()).toBe(baseline)
      writeText.mockImplementation(() => Promise.resolve())
      const second = render(() => <UIResourceRenderer content={component('copy-timer', 'text', { content: 'Copy now' })} />)
      fireEvent.click(second.container.querySelector('[data-mcp-ui-action="copy"]')!)
      await Promise.resolve()
      flush()
      expect(vi.getTimerCount()).toBe(baseline + 1)
      second.unmount()
      expect(vi.getTimerCount()).toBe(baseline)
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  })
})
