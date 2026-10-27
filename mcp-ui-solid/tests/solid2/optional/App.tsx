import { onSettled } from 'solid-js'
import { UIResourceRenderer } from '@seed-ship/mcp-ui-solid'
import { SafeHtml } from '@seed-ship/mcp-ui-solid/src/components/SafeHtml.tsx'
import type { UIComponent } from '@seed-ship/mcp-ui-solid/types'
import './style.css'

const text: UIComponent = { id: 'optional-text-item', type: 'text', position: { colStart: 1, colSpan: 12 }, params: { content: 'Optional consumer text', markdown: false } }
const table: UIComponent = { id: 'optional-table-item', type: 'table', position: { colStart: 1, colSpan: 12 }, params: {
  title: 'Optional values', columns: [{ key: 'name', label: 'Name', sortable: true }, { key: 'value', label: 'Value' }],
  rows: [{ name: 'Beta', value: 2 }, { name: 'Alpha', value: 1 }], virtualize: false,
} }
const graph: UIComponent = { id: 'optional-graph-item', type: 'graph', position: { colStart: 1, colSpan: 12 },
  params: { nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ source: 'a', target: 'b' }] } }

export default function OptionalApp() {
  onSettled(() => { document.documentElement.dataset.fixtureHydrated = 'true' })
  return <main><h1>Optional-absent genuine browser consumer</h1><p id="ssr-sentinel">SSR optional identity</p>
    <section id="optional-text"><UIResourceRenderer content={text} /></section>
    <section id="optional-table"><UIResourceRenderer content={table} /></section>
    <section id="optional-graph"><UIResourceRenderer content={graph} /></section>
    <section id="source-fixture"><SafeHtml html={() => 'Optional source entry'} /></section>
  </main>
}
