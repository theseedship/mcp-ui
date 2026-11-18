import { createSignal, onSettled, Show } from 'solid-js'
import { MCPUIMathProvider, UIResourceRenderer } from '@seed-ship/mcp-ui-solid'
import { renderKatexMath } from '@seed-ship/mcp-ui-solid/plugins/katex'
import type { UIComponent } from '@seed-ship/mcp-ui-solid/types'

const original = [
  String.raw`Inline $x_1$ and fraction $\frac{1}{2}$.`,
  String.raw`$$\begin{matrix}a&b\\c&d\end{matrix}$$`,
  String.raw`Invalid $\notARealCommand{$; currency $5 and $10; unsafe $\href{javascript:alert(1)}{x}$.`,
  String.raw`<span onclick="window.__mcpUnsafe=true">Unsafe marker</span><script>window.__mcpUnsafe=true</script>`,
].join('\n\n')
// A rule is a spacing primitive, not a visible formula: the sanitizer drops
// its background paint. Check limits separately from equation glyph geometry.
const bounds = String.raw`Bounded $\rule{500em}{500em}$; recursive $\def\a{\a}\a$.`
const updated = String.raw`Updated $y_2$ and $\frac{3}{4}$.`
const text = (content: string): UIComponent => ({ id: 'math-text', type: 'text', position: { colStart: 1, colSpan: 12 }, params: { markdown: true, content } })
const table: UIComponent = { id: 'math-table', type: 'table', position: { colStart: 1, colSpan: 12 }, params: {
  title: 'Math table', columns: [{ key: 'formula', label: 'Formula' }],
  rows: [{ formula: String.raw`Cell $z_3$ and $\frac{2}{5}$` }, { formula: String.raw`Matrix $\begin{matrix}1&2\\3&4\end{matrix}$` }],
  virtualize: false,
} }

export default function App() {
  const [source, setSource] = createSignal(original), [mounted, setMounted] = createSignal(true)
  onSettled(() => { document.documentElement.dataset.fixtureHydrated = 'true' })
  return <main><h1>KaTeX tarball qualification</h1><p id="ssr-sentinel">SSR sentinel</p>
    <button id="update" onClick={() => setSource(updated)}>Update source</button>
    <button id="unmount" onClick={() => setMounted(false)}>Unmount</button>
    <MCPUIMathProvider renderMath={renderKatexMath}><Show when={mounted()}>
      <section id="math-text"><UIResourceRenderer content={text(source())} /></section>
      <section id="math-table"><UIResourceRenderer content={table} /></section>
      <section id="math-bounds"><UIResourceRenderer content={text(bounds)} /></section>
    </Show></MCPUIMathProvider>
  </main>
}
