import { hydrate, render } from 'solid-js/web'
import { UIResourceRenderer, MCPUIMathProvider } from '@seed-ship/mcp-ui-solid'
__MATH_IMPORT__

const position = { colStart: 1, colSpan: 12 }
const table = {
  id: 'packed-table', type: 'table', position,
  params: {
    title: 'Packed table',
    columns: [{ key: 'name', label: 'Name' }, { key: 'citation', label: 'Evidence' }],
    rows: [{ name: 'Alpha', citation: '[1]' }],
    citationMap: { 1: { page: 7, file: 'evidence.pdf' } },
  },
} as const
const map = {
  id: 'packed-map', type: 'map', position,
  params: {
    center: [48.8566, 2.3522], zoom: 4, height: '260px', tileLayer: '/tile.png',
    markers: [{ position: [48.8566, 2.3522], tooltip: '<img src=x onerror=alert(1)>', popup: 'Paris' }],
  },
} as const
const graph = {
  id: 'packed-graph', type: 'graph', position,
  params: { title: 'Packed graph', nodes: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }], edges: [{ source: 'a', target: 'b' }], height: '260px' },
} as const
const math = { id: 'packed-math', type: 'text', position, params: { content: 'Equation $x + 1$', markdown: true } } as const

const ssrHost = document.getElementById('ssr')!
const hydrated = __SSR_MOUNT__
const dispose = render(() => <main>
  <section id="table"><UIResourceRenderer content={table} toolbarVariant="always-visible" /></section>
  <section id="map"><UIResourceRenderer content={map} toolbarVariant="always-visible" /></section>
  <section id="graph"><UIResourceRenderer content={graph} toolbarVariant="always-visible" /></section>
  <section id="math"><MCPUIMathProvider renderMath={renderMath}><UIResourceRenderer content={math} /></MCPUIMathProvider></section>
</main>, document.getElementById('app')!)

;(window as any).__mcpuiReady = true
;(window as any).__mcpuiDispose = () => {
  dispose()
  if (typeof hydrated === 'function') hydrated()
  ssrHost.replaceChildren()
  document.getElementById('app')!.replaceChildren()
}
