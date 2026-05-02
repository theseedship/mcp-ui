/**
 * GraphRenderer (v6.0.0) — generic node-link visualization powered by
 * `@antv/g6 ^5` (peer-optional). Same lazy-load pattern as
 * `ChartJSRenderer` and `MapRenderer` : the heavy lib is dynamically
 * imported only on first mount, and apps that don't install the peer
 * see an informative fallback instead of a crash.
 *
 * Spec : `@seed-ship/mcp-ui-spec@5.0.4` exports `GraphComponentParamsSchema`,
 * `GraphNode`, `GraphEdge`, `GraphLayoutName`, `GraphLayout`,
 * `GraphComponentParams` — the shape consumed here. Domain semantics
 * (`weight` etc.) are opaque to this renderer ; consumers decide what
 * the values mean.
 *
 * Copy + export : the renderer ships with `<ExpandableWrapper>` (default
 * copy = JSON of `{nodes, edges}`) plus a 3-format export menu — **PNG**
 * (visual snapshot via the underlying canvas/SVG), **Mermaid** (markdown
 * / GitHub-renderable `flowchart` syntax), **JSON** (raw reimportable
 * data). All three are computed lazily on click.
 */

import { Component, createSignal, onCleanup, onMount, Show, For } from 'solid-js'
import type { UIComponent } from '../types'
import type { GraphComponentParams, GraphLayout, GraphNode, GraphEdge } from '@seed-ship/mcp-ui-spec'
import { ExpandableWrapper } from './ExpandableWrapper'

// Module-scoped lazy import promise — first call triggers the dynamic
// import, subsequent calls reuse the resolved module.
let g6ModulePromise: Promise<typeof import('@antv/g6')> | undefined

/**
 * Whether the `@antv/g6` peer dependency is installed and importable.
 * Resolves to `true` when the lib is available, `false` otherwise.
 *
 * Mirrors `isChartJSAvailable()` from `ChartJSRenderer`.
 */
export async function isG6Available(): Promise<boolean> {
  try {
    if (!g6ModulePromise) {
      g6ModulePromise = import('@antv/g6')
    }
    await g6ModulePromise
    return true
  } catch {
    return false
  }
}

/**
 * Resolve the spec layout shorthand or object form into the config object
 * G6 v5 expects. When `layout` is omitted, picks `'force'` if edges are
 * present (universal default) or `'circular'` otherwise.
 */
function resolveLayout(params: GraphComponentParams): { type: string; [key: string]: unknown } {
  const layout: GraphLayout | undefined = params.layout
  if (layout === undefined) {
    const hasEdges = (params.edges?.length ?? 0) > 0
    return { type: hasEdges ? 'force' : 'circular' }
  }
  if (typeof layout === 'string') {
    return { type: layout }
  }
  // Object form: spread the passthrough options alongside `type`.
  return { type: layout.type, ...(layout.options ?? {}) }
}

/**
 * Build the G6 v5 `behaviors` array from the params interactivity flags.
 * Defaults : drag-canvas + zoom-canvas + drag-element + click-select.
 * Any flag set to `false` opts out.
 */
function resolveBehaviors(params: GraphComponentParams): string[] {
  const behaviors: string[] = []
  if (params.enableDrag !== false) behaviors.push('drag-element')
  if (params.enableZoom !== false) {
    behaviors.push('zoom-canvas', 'drag-canvas')
  }
  if (params.enableSelect !== false) behaviors.push('click-select')
  return behaviors
}

/**
 * Pick a sensible Mermaid `flowchart` direction from the resolved layout.
 * `dagre` / `tree` / `mindmap` are top-down hierarchies → TD ; everything
 * else (force, concentric, circular, grid) → LR (default mermaid).
 */
function mermaidDirection(layoutType: string): 'TD' | 'LR' {
  return layoutType === 'dagre' || layoutType === 'tree' || layoutType === 'mindmap' ? 'TD' : 'LR'
}

/**
 * Sanitize a string for use inside a Mermaid node label. Mermaid breaks
 * on raw quotes / brackets / pipes ; we strip the worst offenders.
 */
function mermaidLabel(s: string): string {
  return s.replace(/["[\]|]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Convert the graph data to Mermaid `flowchart` syntax. The edge label
 * carries the optional `weight` prefix when present (e.g. `|3| label`).
 */
function toMermaid(params: GraphComponentParams): string {
  const layoutType = resolveLayout(params).type
  const dir = mermaidDirection(layoutType)
  const lines: string[] = [`flowchart ${dir}`]
  for (const n of params.nodes) {
    const label = mermaidLabel(n.label ?? n.id)
    lines.push(`  ${n.id}["${label}"]`)
  }
  for (const e of params.edges ?? []) {
    const labelParts: string[] = []
    if (e.weight !== undefined) labelParts.push(String(e.weight))
    if (e.label) labelParts.push(mermaidLabel(e.label))
    const labelText = labelParts.join(' · ')
    if (labelText) {
      lines.push(`  ${e.source} -->|${labelText}| ${e.target}`)
    } else {
      lines.push(`  ${e.source} --> ${e.target}`)
    }
  }
  return lines.join('\n')
}

function toJSON(params: GraphComponentParams): string {
  return JSON.stringify({ nodes: params.nodes, edges: params.edges ?? [] }, null, 2)
}

function downloadBlob(content: string | Blob, filename: string, mimeType?: string): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType ?? 'text/plain' }) : content
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const GraphRenderer: Component<{ component: UIComponent }> = (props) => {
  const params = () => props.component.params as GraphComponentParams
  const [available, setAvailable] = createSignal<boolean | null>(null)
  const [error, setError] = createSignal<string | undefined>()
  const [exportMenuOpen, setExportMenuOpen] = createSignal(false)
  let containerRef: HTMLDivElement | undefined
  // Loosely typed because G6 is a peer-optional — we don't pull its
  // types into the bundle just to type a transient local handle.
  let graphInstance: any | undefined

  onMount(async () => {
    const g6Available = await isG6Available()
    setAvailable(g6Available)
    if (!g6Available || !containerRef) return

    try {
      const { Graph } = await g6ModulePromise!
      const p = params()
      const config: Record<string, unknown> = {
        container: containerRef,
        data: { nodes: p.nodes, edges: p.edges ?? [] },
        layout: resolveLayout(p),
        behaviors: resolveBehaviors(p),
        renderer: p.rendererPref === 'svg' ? 'svg' : 'canvas',
      }
      if (p.fitView !== false) {
        config.autoFit = 'view'
      }
      if (p.tooltip !== false) {
        // Built-in tooltip plugin — shows label + a compact dump of
        // node.data on hover. Consumers can opt out with `tooltip: false`.
        config.plugins = [
          {
            type: 'tooltip',
            getContent: (_evt: unknown, items: any[]) => {
              const item = items?.[0]
              if (!item) return ''
              const label = item.label ?? item.id ?? ''
              const data = item.data ? JSON.stringify(item.data) : ''
              return `<div style="padding:4px 8px"><strong>${escapeHtml(String(label))}</strong>${
                data ? `<br><span style="font-size:11px;opacity:0.7">${escapeHtml(data)}</span>` : ''
              }</div>`
            },
          },
        ]
      }
      graphInstance = new (Graph as any)(config)
      await graphInstance.render()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to render graph')
    }
  })

  onCleanup(() => {
    try {
      graphInstance?.destroy()
    } catch {
      // G6 destroy can throw on already-destroyed instances or partial
      // init failures — silent because the component is unmounting anyway.
    }
    graphInstance = undefined
  })

  // ─── Export handlers ────────────────────────────────────────────────
  const handleExportJSON = () => {
    downloadBlob(toJSON(params()), `${graphFilenameStem(params())}.json`, 'application/json')
    setExportMenuOpen(false)
  }

  const handleExportMermaid = () => {
    downloadBlob(toMermaid(params()), `${graphFilenameStem(params())}.mmd`, 'text/plain')
    setExportMenuOpen(false)
  }

  const handleExportPNG = async () => {
    if (!graphInstance) return
    try {
      // G6 v5 exposes `toDataURL()` on the graph instance.
      const dataUrl: string = await graphInstance.toDataURL?.('image/png')
      if (!dataUrl) {
        // Fallback: try to grab the underlying canvas directly.
        const canvas = containerRef?.querySelector('canvas')
        if (canvas) {
          const url = (canvas as HTMLCanvasElement).toDataURL('image/png')
          await downloadDataUrl(url, `${graphFilenameStem(params())}.png`)
        } else {
          setError('PNG export not supported in current renderer mode')
        }
      } else {
        await downloadDataUrl(dataUrl, `${graphFilenameStem(params())}.png`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PNG export failed')
    }
    setExportMenuOpen(false)
  }

  return (
    <Show
      when={available() === true}
      fallback={
        <Show
          when={available() === false}
          fallback={
            // Loading skeleton while we determine peer availability
            <div class="w-full p-4 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse">
              <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div class="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          }
        >
          <div class="w-full p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p class="text-sm font-medium text-yellow-900 dark:text-yellow-100">
              Graph rendering unavailable
            </p>
            <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
              Install <code>@antv/g6</code> peer dependency to render <code>type: "graph"</code> components.
            </p>
          </div>
        </Show>
      }
    >
      <ExpandableWrapper
        title={params().title ?? 'Graph'}
        copyData={toJSON(params())}
        copyLabel="Copy graph (JSON)"
      >
        <div class={`relative w-full ${params().className ?? ''}`}>
          {/* Export menu — top-right, mirrors TableRenderer's pattern */}
          <div class="absolute right-2 top-2 z-10">
            <button
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              class="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              title="Export graph"
              aria-label="Export graph"
              aria-expanded={exportMenuOpen()}
            >
              Export ▾
            </button>
            <Show when={exportMenuOpen()}>
              <div class="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg text-xs">
                <For each={[
                  { label: 'Download PNG', onClick: handleExportPNG, hint: 'visual snapshot' },
                  { label: 'Download Mermaid', onClick: handleExportMermaid, hint: 'markdown / GitHub' },
                  { label: 'Download JSON', onClick: handleExportJSON, hint: 'raw data' },
                ]}>
                  {(item) => (
                    <button
                      type="button"
                      onClick={item.onClick}
                      class="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                      <div class="font-medium">{item.label}</div>
                      <div class="text-[10px] text-gray-500 dark:text-gray-400">{item.hint}</div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div
            ref={containerRef}
            class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            style={`height: ${params().height ?? '400px'}; width: ${params().width ?? '100%'};`}
          />
          <Show when={error()}>
            <p class="text-xs text-red-600 dark:text-red-400 mt-1">Render error: {error()}</p>
          </Show>
        </div>
      </ExpandableWrapper>
    </Show>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────

function graphFilenameStem(params: GraphComponentParams): string {
  const base = (params.title ?? 'graph').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '')
  return base || 'graph'
}

async function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  downloadBlob(blob, filename)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      default: return c
    }
  })
}

// Re-export for tests + consumers that want to compose their own export menu
export { toMermaid as graphToMermaid, toJSON as graphToJSON }
