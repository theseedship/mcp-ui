import { onSettled } from 'solid-js'
import { MCPUIMathProvider, UIResourceRenderer } from '@seed-ship/mcp-ui-solid'
import type { UIComponent } from '@seed-ship/mcp-ui-solid/types'

const text: UIComponent = { id: 'absent-math', type: 'text', position: { colStart: 1, colSpan: 12 },
  params: { markdown: true, content: 'Optional peer absent: $x_1$ stays ordinary Markdown.' } }
export default function App() {
  onSettled(() => { document.documentElement.dataset.fixtureHydrated = 'true' })
  return <main><p id="ssr-sentinel">SSR sentinel</p><MCPUIMathProvider>
    <section id="math-text"><UIResourceRenderer content={text} /></section>
  </MCPUIMathProvider></main>
}
