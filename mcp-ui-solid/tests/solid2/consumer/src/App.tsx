import { createSignal, For, Show, onSettled } from 'solid-js'
import {
  UIResourceRenderer, ExpandableWrapper, MCPUIMathProvider, ChatBusProvider,
  createChatBus, useChatBus, setDuplicateMountReporter,
} from '@seed-ship/mcp-ui-solid'
import { useStreamingUI } from '@seed-ship/mcp-ui-solid/hooks'
import { renderKatexMath } from '@seed-ship/mcp-ui-solid/plugins/katex'
// The explicitly exported source path is exercised independently of root
// condition resolution. This comes from the installed tarball, not a workspace.
import { SafeHtml } from '@seed-ship/mcp-ui-solid/src/components/SafeHtml.tsx'
import type { UIComponent } from '@seed-ship/mcp-ui-solid/types'
import './style.css'
import { Engines } from './Engines'

const metrics = { mounts: { A: 0, B: 0, visual: 0, stream: 0 }, unmounts: { A: 0, B: 0, visual: 0, stream: 0 },
  listeners: { A: 0, B: 0 }, callbacks: { A: 0, B: 0, stream: 0, complete: 0, error: 0, citation: 0 },
  citations: [] as { page: string | null; file: string | null }[], duplicateMounts: [] as unknown[] }
declare global { interface Window { __mcpFixture: typeof metrics; __mcpUnsafe?: boolean } }

function instrumentBus(id: 'A' | 'B') {
  const bus = createChatBus(), active = new Set<object>(), on = bus.events.on.bind(bus.events), clear = bus.events.clear.bind(bus.events)
  bus.events.on = ((...args: Parameters<typeof on>) => {
    const token = {}; active.add(token); metrics.listeners[id] = active.size
    const unsubscribe = on(...args)
    return () => { unsubscribe(); active.delete(token); metrics.listeners[id] = active.size }
  }) as typeof bus.events.on
  bus.events.clear = () => { clear(); active.clear(); metrics.listeners[id] = 0 }
  return bus
}
function BusProbe(props: { id: 'A' | 'B' }) {
  const bus = useChatBus(), [text, setText] = createSignal('')
  onSettled(() => {
    metrics.mounts[props.id]++
    const unsubscribe = bus.events.on('onToken', event => {
      metrics.callbacks[props.id]++; setText(value => value + event.token)
    })
    return () => { unsubscribe(); metrics.unmounts[props.id]++ }
  })
  return <output id={`bus-${props.id}`}>{text()}</output>
}
function PersistentVisual() {
  let canvas!: HTMLCanvasElement
  onSettled(() => {
    metrics.mounts.visual++
    const context = canvas.getContext('2d')!
    context.fillStyle = '#237a51'; context.fillRect(0, 0, 120, 40)
    return () => { metrics.unmounts.visual++ }
  })
  return <div id="persistent-content"><canvas id="persistent-canvas" width="120" height="40" ref={canvas} />
    <button id="persistent-citation" data-citation-page="7" data-citation-doc="proof.pdf" data-citation-verified="true">Source page 7</button>
  </div>
}
function StreamProbe(props: { mode: string }) {
  const stream = useStreamingUI({ get query() { return props.mode },
    onComponentReceived: () => { metrics.callbacks.stream++ }, onComplete: () => { metrics.callbacks.complete++ },
    onError: () => { metrics.callbacks.error++ },
  })
  onSettled(() => { metrics.mounts.stream++; return () => { metrics.unmounts.stream++ } })
  return <section id="stream-probe">
    <button id="stop-stream" onClick={stream.stopStreaming}>Stop stream</button>
    <output id="stream-count">{stream.components().length}</output>
    <output id="stream-error">{stream.error()?.error}</output>
    <output id="stream-complete">{stream.metadata()?.layoutId}</output>
    <For each={stream.components()}>{component => <UIResourceRenderer content={component} />}</For>
  </section>
}

const text: UIComponent = { id: 'fixture-text', type: 'text', position: { colStart: 1, colSpan: 12 },
  params: { markdown: true, content: 'Hydrated fixture text: $x + 1$.\n\n<p onclick="window.__mcpUnsafe=true">Sanitized fixture</p>' } }
const table: UIComponent = { id: 'fixture-table', type: 'table', position: { colStart: 1, colSpan: 12 }, params: {
  title: 'Fixture values', columns: [{ key: 'name', label: 'Name', sortable: true }, { key: 'value', label: 'Value', sortable: true }],
  rows: [{ name: 'Beta', value: 2 }, { name: 'Alpha [1]', value: 1 }, { name: 'Missing', value: null }],
  citationMap: { 1: { page: 7, file: 'proof.pdf' } },
  exportable: { formats: ['csv', 'tsv', 'json'], filename: 'fixture-values' }, virtualize: false,
} }
const large: UIComponent = { id: 'fixture-virtual', type: 'table', position: { colStart: 1, colSpan: 12 }, params: {
  title: 'Virtual rows', columns: [{ key: 'name', label: 'Row' }, { key: 'index', label: 'Index' }],
  // Stay inside the package's unchanged default maxTableRows=100 policy.
  rows: Array.from({ length: 100 }, (_, index) => ({ name: `Virtual row ${index}`, index })),
  virtualize: { enabled: true, rowHeight: 48, overscan: 3 }, chatPageSize: 100, pageSize: 100, maxHeight: 280,
} }
export default function App() {
  const a = instrumentBus('A'), b = instrumentBus('B')
  const [mountB, setMountB] = createSignal(true), [mode, setMode] = createSignal<string | null>(null)
  const [dark, setDark] = createSignal(false)
  onSettled(() => {
    window.__mcpFixture = metrics
    document.documentElement.dataset.fixtureHydrated = 'true'
    setDuplicateMountReporter(info => metrics.duplicateMounts.push(info))
    const citation = (event: Event) => {
      const chip = (event.target as Element).closest('[data-citation-page]')
      if (!chip) return
      metrics.callbacks.citation++; metrics.citations.push({ page: chip.getAttribute('data-citation-page'), file: chip.getAttribute('data-citation-doc') })
    }
    document.addEventListener('click', citation)
    return () => { document.removeEventListener('click', citation); setDuplicateMountReporter(null) }
  })
  return <main id="fixture-host" class={dark() ? 'dark' : ''}>
    <h1>MCP UI Solid 2 qualification</h1><p id="ssr-sentinel">SSR node identity sentinel</p>
    <div class="fixture-controls">
      <button id="toggle-dark" onClick={() => setDark(value => !value)}>Toggle dark</button>
      <button id="emit-a" onClick={() => a.events.emit('onToken', { streamKey: 'A', token: 'A' })}>Emit A</button>
      <button id="emit-b" onClick={() => b.events.emit('onToken', { streamKey: 'B', token: 'B' })}>Emit B</button>
      <button id="toggle-b" onClick={() => setMountB(value => !value)}>Toggle B</button>
      <button id="stream-success" onClick={() => setMode('success')}>Start successful stream</button>
      <button id="stream-slow" onClick={() => setMode('slow')}>Start slow stream</button>
      <button id="stream-error-button" onClick={() => setMode('error')}>Start failing stream</button>
      <button id="unmount-stream" onClick={() => setMode(null)}>Unmount stream</button>
    </div>
    <section id="buses"><ChatBusProvider bus={a}><BusProbe id="A" /></ChatBusProvider>
      <Show when={mountB()}><ChatBusProvider bus={b}><BusProbe id="B" /></ChatBusProvider></Show>
    </section>
    <MCPUIMathProvider renderMath={renderKatexMath}>
      <section id="text-fixture"><UIResourceRenderer content={text} /></section>
      <section id="table-fixture"><UIResourceRenderer content={table} toolbarVariant="always-visible" /></section>
    </MCPUIMathProvider>
    <section id="source-fixture"><SafeHtml html={() => '<p>Exported source entry fixture</p>'} /></section>
    <section id="persistent-fixture"><ExpandableWrapper title="Persistent visual" toolbarVariant="always-visible"><PersistentVisual /></ExpandableWrapper></section>
    <section id="virtual-fixture"><UIResourceRenderer content={large} /></section>
    <Show keyed when={mode()}>{value => <StreamProbe mode={value} />}</Show>
    <Engines />
  </main>
}
