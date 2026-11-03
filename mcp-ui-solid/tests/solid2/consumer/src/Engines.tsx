import { createSignal, onSettled, Show, type ParentComponent } from 'solid-js'
import { Chart } from 'chart.js'
import { ExpandableWrapper, GraphRenderer } from '@seed-ship/mcp-ui-solid'
import { ChartJSRenderer, CodeBlockRenderer, MapRenderer } from '@seed-ship/mcp-ui-solid/components'
import type { UIComponent } from '@seed-ship/mcp-ui-solid/types'

let observedChartCanvas: HTMLCanvasElement | undefined
const nativeChart = () => {
  // Both the outer fixture and the renderer's own fullscreen can move this
  // real node into a body portal. Retain its identity, not an SDK substitute.
  const canvas = document.querySelector<HTMLCanvasElement>('[data-engine-persistent="chart"] canvas')
  if (canvas) observedChartCanvas = canvas
  return observedChartCanvas?.isConnected ? Chart.getChart(observedChartCanvas) : undefined
}

const evidence = {
  mounts: { chart: 0, map: 0, graph: 0, code: 0 },
  unmounts: { chart: 0, map: 0, graph: 0, code: 0 },
  citations: { chart: 0, map: 0, graph: 0, code: 0 },
  chartInstanceId: () => nativeChart()?.id ?? null,
  chartObservedCanvas: () => observedChartCanvas ?? null,
  inspectChartCanvas: (canvas: HTMLCanvasElement) => {
    // Read the public SDK registry for THIS exact DOM node. This does not
    // choose another canvas or construct/rebind an engine instance.
    const chart = Chart.getChart(canvas) as (Chart & { zoom?: unknown; getZoomLevel?: () => number }) | undefined
    return { registryId: chart?.id ?? null, zoomReady: typeof chart?.zoom === 'function',
      zoomLevel: chart?.getZoomLevel?.() ?? null }
  },
  chartZoomReady: () => {
    const chart = nativeChart() as (Chart & { zoom?: unknown }) | undefined
    return typeof chart?.zoom === 'function'
  },
  chartZoomLevel: () => {
    const chart = nativeChart() as (Chart & { getZoomLevel?: () => number }) | undefined
    return chart?.getZoomLevel?.() ?? null
  },
}
type Engine = keyof typeof evidence.mounts
declare global { interface Window { __mcpEngines: typeof evidence } }

const EngineCase: ParentComponent<{ kind: Engine }> = (props) => {
  onSettled(() => {
    evidence.mounts[props.kind]++
    return () => { evidence.unmounts[props.kind]++ }
  })
  return <section id={`engine-${props.kind}`} data-engine={props.kind}>
    <ExpandableWrapper title={`Native ${props.kind} engine`} toolbarVariant="always-visible">
      {/* Keep the fixture's outer toolbar above the real renderer's toolbar.
          Both remain ordinary pointer targets; qualification never force-clicks. */}
      <div data-engine-persistent={props.kind} style={{ 'padding-top': '48px' }}>
        {props.children}
        <button data-engine-citation={props.kind} data-citation-page="11"
          data-citation-doc="synthetic-engine-proof.pdf" data-citation-verified="true"
          onClick={() => { evidence.citations[props.kind]++ }}>Synthetic source page 11</button>
      </div>
    </ExpandableWrapper>
  </section>
}

const chart: UIComponent = {
  id: 'fixture-native-chart', type: 'chart', position: { colStart: 1, colSpan: 12 },
  params: { type: 'bar', title: 'Synthetic native chart', height: '280px',
    data: { labels: ['Synthetic A', 'Synthetic B', 'Synthetic C', 'Synthetic D', 'Synthetic E', 'Synthetic F', 'Synthetic G', 'Synthetic H'],
      datasets: [{ label: 'Fixture', data: [2, 5, 3, 7, 4, 8, 6, 9], backgroundColor: '#347853' }] },
    options: { animation: false, responsive: true, maintainAspectRatio: false },
  },
}
const graph: UIComponent = {
  id: 'fixture-native-graph', type: 'graph', position: { colStart: 1, colSpan: 12 },
  params: { title: 'Synthetic hierarchical diagram', height: '300px', layout: 'dagre', tooltip: false,
    nodes: [
      { id: 'synthetic-start', style: { fill: '#347853', size: 36, labelText: 'Start' } },
      { id: 'synthetic-check', style: { fill: '#5357a8', size: 36, labelText: 'Check' } },
      { id: 'synthetic-result', style: { fill: '#98542d', size: 36, labelText: 'Result' } },
    ],
    edges: [
      { source: 'synthetic-start', target: 'synthetic-check', style: { endArrow: true } },
      { source: 'synthetic-check', target: 'synthetic-result', style: { endArrow: true } },
    ],
  },
}

/** SSR intentionally emits only a button. Engines start after the main host gate. */
export function Engines() {
  const [started, setStarted] = createSignal(false)
  onSettled(() => { window.__mcpEngines = evidence })
  return <section id="engines-fixture">
    <button id="engine-start" onClick={() => setStarted(true)}>Start real optional engines</button>
    <Show when={started()}>
      <EngineCase kind="chart"><ChartJSRenderer component={chart} toolbarVariant="always-visible" /></EngineCase>
      <EngineCase kind="map"><MapRenderer params={{ height: '300px', center: [48.85, 2.35], zoom: 11,
        tileLayer: '/__fixture/engine-tiles/{z}/{x}/{y}.png', attribution: '', clustering: false,
        markers: [{ position: [48.85, 2.35], tooltip: 'Synthetic marker A' }, { position: [48.86, 2.36], tooltip: 'Synthetic marker B' }],
      }} toolbarVariant="always-visible" /></EngineCase>
      <EngineCase kind="graph"><GraphRenderer component={graph} toolbarVariant="always-visible" /></EngineCase>
      <EngineCase kind="code"><CodeBlockRenderer params={{ language: 'typescript', code: 'const syntheticValue: number = 42;', filename: 'synthetic.ts' }} toolbarVariant="always-visible" /></EngineCase>
    </Show>
  </section>
}
