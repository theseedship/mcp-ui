# Brief — `'graph'` ComponentType powered by `@antv/g6`

> **Status** : drafted 2026-05-02. NOT yet implemented. Intended to surface
> design choices + risks BEFORE coding so the API doesn't get baked in
> wrong.
>
> **Audience** : `@seed-ship/mcp-ui-solid` maintainer + deposium MCPs
> agent (will be the first emitter of `type: 'graph'` payloads).
>
> **PUBLIC PACKAGE — AGNOSTIC RULE** : `@seed-ship/mcp-ui-solid` and
> `@seed-ship/mcp-ui-spec` are public on npm. The lib code, CHANGELOG,
> README, and any committed doc must remain agnostic — no
> deposium-specific naming, no domain-specific naming. **This brief +
> its INSPIRATION companion stay LOCAL (untracked) ; they exist to
> stress-test the agnostic API against real consumer cases without
> baking those cases into shipped code.**
>
> **Effort** : ~1.5 days (spec schemas + renderer + lazy import + tests +
> CLI hookup). Backward compatible — new ComponentType, opt-in via peer
> dep installation.
>
> **Companion** : sibling pattern of `BRIEF-citations-in-table-cells.md`
> (data shape on the spec side, render logic on the solid side, peer
> optional for the heavy lib).

---

## 1. The user-facing problem

> Examples in this section name a specific consumer (deposium) for
> stress-testing only — the public lib must NOT reference any of them
> in code/CHANGELOG/README. The `'graph'` ComponentType ships as a
> generic node-link primitive ; the consumer wires meaning.

LLM-driven UI emitters increasingly want to show **relationships**, not
just rows or charts. Today mcp-ui has no primitive for this — consumers
fall back to (a) embedding an `iframe` to a third-party graph viewer
(heavy, sandboxed, can't pass LLM-generated data nicely) or (b) cobbling
something with `chart.js` (which doesn't do graph topology at all).

Three illustrative seed cases (LOCAL framing, not for the public README) :

1. **Entity / organization networks** — entities extracted from docs
   connected by relationship types. Layout : `force`. Without this,
   topology gets lost in flat tables.
2. **Tool / process DAGs** — facade-to-implementation dependencies, or
   any hierarchical pipeline. Layout : `dagre`. Static DAG visualization
   beats a tabular tool list for "why did this chain fire ?".
3. **Mindmaps inline in chat answers** — synthesizing LLM reasoning as
   a radial mindmap instead of nested bullet lists. Layout : `mindmap`.
   Visual structure makes the synthesis scannable.

§5.5 stress-tests this design against 7 additional concrete cases drawn
from the INSPIRATION companion brief (chat UX, compliance/SOC2/RGPD,
runtime observability) — the same agnostic API supports all of them via
weight + style passthrough.

## 2. What already works in MCP-UI v5.7.0

Adjacent renderers that informed the design choices below :

- **`<ChartRenderer>`** (`UIResourceRenderer.tsx`) — peer-optional
  `chart.js` ; `isChartJSAvailable()` runtime check ; iframe fallback
  to Quickchart.io. **Same lazy-load pattern** is the right precedent
  for G6.
- **`<ImageGalleryRenderer>`**, **`<MapRenderer>`**, **DuckDB plugin** —
  all peer-optional, all off the main bundle path.
- **`KNOWN_COMPONENT_TYPES`** + `SPEC_VALIDATORS` dispatch in
  `services/validation.ts` — adding `'graph'` is a single-entry change
  in each.

Also relevant : `MCPUITelemetryProvider` (v5.6.0) — graph mounts will
naturally emit `component:mounted` / `component:rendered` events with
`durationMs` from existing perf marks. Consumers get visibility for free.

## 3. `@antv/g6 v5` quick primer

- **Latest line** : v5.x (rewrote from v4 — different API surface, do
  NOT skim v4 docs).
- **Layouts shipped** : `force` (default for networks), `dagre`,
  `antv-dagre`, `d3-force`, `circular`, `grid`, `concentric`, `radial`,
  `mds`, `random`, `combo-combined`, `dendrogram`, `compact-box`,
  `mindmap` (verify exact name during impl — may be a `compact-box`
  config rather than a dedicated layout).
- **Renderer** : Canvas (default, fast) or SVG (DOM-friendly,
  print/export). User picks.
- **Bundle weight** (estimated from `bundlephobia` for v5.0.x) : ~150-200
  KB gzipped for the core + a couple of layouts. Tree-shakable but most
  apps will pull a few layouts.
- **SSR** : NO — needs canvas/SVG DOM, same constraint as Chart.js
  native renderer. Lazy-loaded after `onMount` is the safe pattern.
- **Peer-optional declared** : `peerDependencies` `^5.0.0` +
  `peerDependenciesMeta.optional: true`, mirror of `chart.js`.

## 4. Proposed API

### 4.1 New ComponentType `'graph'`

`mcp-ui-spec` adds `'graph'` to `ComponentTypeSchema` enum + new
`GraphComponentParamsSchema` :

```ts
GraphNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  type: z.string().optional(),              // 'circle' | 'rect' | 'image' | …
  size: z.union([z.number(), z.tuple([z.number(), z.number()])]).optional(),
  weight: z.number().optional(),            // generic ranking signal (importance, frequency, score).
                                            //   Drives default node size if `size` omitted, and
                                            //   acts as the sort key for the `concentric` layout.
  style: z.record(z.unknown()).optional(),  // passthrough G6 NodeStyle
  data: z.record(z.unknown()).optional(),   // arbitrary metadata for tooltips/click handlers
})

GraphEdgeSchema = z.object({
  source: z.string().min(1),                // must match a node.id
  target: z.string().min(1),                // must match a node.id
  label: z.string().optional(),
  type: z.string().optional(),              // 'line' | 'arc' | 'cubic' | 'polyline' | …
  weight: z.number().optional(),            // generic strength signal. Drives default stroke width
                                            //   on canvas, and acts as the attractive force in
                                            //   `force` layouts. Domain semantics opaque to the lib.
  style: z.record(z.unknown()).optional(),
  data: z.record(z.unknown()).optional(),
})

GraphLayoutNameSchema = z.enum([
  'force',          // ← réseau d'organisations (default when edges.length > 0)
  'dagre',          // ← dépendances tools MCP (DAG top-down or left-right)
  'mindmap',        // ← mindmaps in chat answers
  'tree',           // ← simple parent-child tree
  'circular',
  'grid',
  'concentric',
])

GraphComponentParamsSchema = z.object({
  title: z.string().optional(),
  nodes: z.array(GraphNodeSchema).min(1),
  edges: z.array(GraphEdgeSchema).optional().default([]),
  // Layout: shorthand string OR object with G6 passthrough options
  layout: z.union([
    GraphLayoutNameSchema,
    z.object({
      type: GraphLayoutNameSchema,
      options: z.record(z.unknown()).optional(),  // direction, nodeSep, rankSep, …
    }),
  ]).optional(),
  height: z.string().optional(),              // default '400px'
  width: z.string().optional(),               // default '100%'
  rendererPref: z.enum(['canvas', 'svg']).optional(),  // default 'canvas'
  fitView: z.boolean().optional(),            // default true
  enableZoom: z.boolean().optional(),         // default true
  enableDrag: z.boolean().optional(),         // default true (drag nodes)
  className: z.string().optional(),
})
```

### 4.2 Default layout heuristic

When `params.layout` is **omitted** :
- `edges.length === 0` → `'circular'` (nothing to lay out, just show nodes)
- `edges.length > 0` → `'force'` ✅ **confirmed 2026-05-02 by user** —
  universal fallback, looks reasonable for networks, matches the most
  common deposium use case (entity / org networks).

LLMs SHOULD pass `layout: 'dagre'` for hierarchies and `layout: 'mindmap'`
for radial structures. This is documented in the spec README + a recipe.

### 4.3 Optional `params.onNodeClick` callback (consumer-side)

Consumers wire interactivity at the renderer level (NOT in spec —
function, not JSON-serializable) :

```tsx
type GraphComponentParams = z.infer<...> & {
  onNodeClick?: (nodeId: string, node: GraphNode) => void
  onEdgeClick?: (edgeId: string, edge: GraphEdge) => void
}
```

Same pattern as `<TableRenderer>`'s `citationRender` from v5.7.0 :
spec-side carries data, consumer-side wires functions.

## 5. Implementation sketch

### 5.1 `<GraphRenderer>` skeleton

New file `src/components/GraphRenderer.tsx`. Mirrors `ChartJSRenderer.tsx`
+ `MapRenderer.tsx` patterns :

```tsx
import { Component, createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { UIComponent } from '../types'

let g6Modulep: Promise<typeof import('@antv/g6')> | undefined

export async function isG6Available(): Promise<boolean> {
  try {
    if (!g6Modulep) g6Modulep = import('@antv/g6')
    await g6Modulep
    return true
  } catch {
    return false
  }
}

export const GraphRenderer: Component<{ component: UIComponent }> = (props) => {
  const params = () => props.component.params as any
  const [available, setAvailable] = createSignal<boolean | null>(null)
  let containerRef: HTMLDivElement | undefined
  let graphInstance: any | undefined

  onMount(async () => {
    if (!(await isG6Available())) {
      setAvailable(false)
      return
    }
    setAvailable(true)
    const { Graph } = await g6Modulep!
    const layoutCfg = resolveLayout(params())  // helper handles shorthand + heuristic
    graphInstance = new Graph({
      container: containerRef!,
      data: { nodes: params().nodes, edges: params().edges ?? [] },
      layout: layoutCfg,
      autoFit: params().fitView !== false ? 'view' : false,
      behaviors: collectBehaviors(params()),  // drag-canvas, zoom-canvas, drag-element
      renderer: params().rendererPref === 'svg' ? 'svg' : 'canvas',
    })
    await graphInstance.render()
  })

  onCleanup(() => {
    graphInstance?.destroy()
    graphInstance = undefined
  })

  return (
    <Show
      when={available() !== false}
      fallback={
        <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p class="text-sm font-medium text-yellow-900 dark:text-yellow-100">Graph rendering unavailable</p>
          <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
            Install <code>@antv/g6</code> peer dependency to render graph components.
          </p>
        </div>
      }
    >
      <div
        ref={containerRef}
        class={`w-full ${params().className || ''}`}
        style={`height: ${params().height || '400px'}; width: ${params().width || '100%'};`}
      />
    </Show>
  )
}
```

### 5.2 Wire into `UIResourceRenderer` switch

```tsx
<Show when={props.component.type === 'graph'}>
  <GraphRenderer component={props.component} />
</Show>
```

### 5.3 `validation.ts` dispatch

Add to `SPEC_VALIDATORS` :
```ts
graph: { schema: GraphComponentParamsSchema, legacyCode: 'INVALID_GRAPH' },
```

Add to `KNOWN_COMPONENT_TYPES` set. Adds graph to the count : **15/17
ComponentTypes Zod-driven** after this (chart, table, modal still
imperative as documented).

### 5.4 Layout heuristic helper

```ts
function resolveLayout(params: GraphComponentParams) {
  if (typeof params.layout === 'object') {
    return { type: params.layout.type, ...params.layout.options }
  }
  if (typeof params.layout === 'string') {
    return { type: params.layout }
  }
  // Heuristic when layout omitted
  return { type: (params.edges?.length ?? 0) > 0 ? 'force' : 'circular' }
}
```

## 5.5 Design stress-test against the 7 prioritized inspiration cases

> Source : `BRIEF-graph-component-g6-INSPIRATION.md` — both files stay
> LOCAL (untracked) since the package is public and these cases leak
> deposium internals. Listed here to prove the agnostic API covers them
> all without case-specific knobs.

| Case | Layout | Critical fields used | API gap ? |
|---|---|---|---|
| 1.1 Citation provenance graph | `concentric` | `node.weight` (rerank score → ring order), `edge.weight` (rerank → thickness), `node.style` (confidence color) | none |
| 1.2 Conversation thread map | `mindmap` (horizontal) OR `dagre` LR | `node.data` (parent_id, terminal_state), tooltip default | collapse-expand opt-in deferred (G6 behavior, can opt in later via `enableCollapse: true` flag) |
| 1.3 Space membership topology | `force` (or `circular` if <20 nodes) | `node.data` (role badges), `edge.data` (relationship type) | none |
| 2.1 Tenant Access Trust Path | `dagre` top-down | `edge.style` (color encoding HTTP status), `node.data` (resource kind) | none |
| 2.3 Rate Limit Pressure Map | `force` with grouping | `node.weight` (% consumption), `edge.weight` (correlation), passthrough `layout.options.cluster` | none |
| 3.2 Dream sense-making lineage | `tree` bottom-up | `edge.weight` (token contribution → branch width), `node.data` (run id) | none |
| **3.3 BM25 doc-similarity (PRIORITY)** | `concentric` (frequency at center) OR `force` (community detection) | `node.weight` (retrieval count → ring + size), `edge.weight` (co-retrieval count → thickness + force strength), `node.style.fill` (consumer-supplied community color) | community detection itself is consumer responsibility (compute on backend, supply colors via `node.style`) — out of v1 lib scope |

All 7 cases reduce to **`{ nodes, edges, layout }` + `weight` first-class
on both** + style passthrough for visual fine-tuning. The 7-layout enum
hits 5 distinct values (`force`, `dagre`, `concentric`, `mindmap`,
`tree`) ; `circular` + `grid` aren't strictly needed for these cases
but stay in the enum for completeness.

### Implications for v1 implementation order

3.3 BM25 is flagged **priority** in the focus directive. Its hard
requirement is `node.weight` + `edge.weight` driving (a) concentric ring
order, (b) default node size, (c) default edge thickness, (d) force
strength when `layout: 'force'`. **If the v1 implementation has to cut
scope, cut `mindmap` layout polish FIRST and keep `force` + `concentric`
+ `weight` end-to-end working.** All other cases benefit from
`weight` too, so it's a high-leverage minimum viable.

## 6. Mapping use cases → defaults

| User case | Recommended `layout` | Notes |
|---|---|---|
| Réseau d'organisations | `'force'` | Auto if edges present + layout omitted. Force-directed with collision = readable cluster topology. |
| Dépendances tools MCP | `'dagre'` | LLM passes explicitly. Default direction TB ; LLM can override via `layout: { type: 'dagre', options: { rankdir: 'LR' } }`. |
| Mindmap dans chat | `'mindmap'` | LLM passes explicitly. Root-centered radial. May need to verify exact G6 v5 layout name (could be `'compact-box'` or `'mindmap'`). |
| Knowledge graph dense | `'force-atlas2'` | Power user override via `{ type: 'force', options: {...} }` ; we don't expose all 13+ G6 layouts in the enum to keep the spec narrow. |
| Tree / dependency hierarchy simple | `'tree'` or `'dagre'` | LLM picks. |

The 7-layout enum in the spec is **deliberately narrow** — it covers
80% of needs without bloating the type surface. Power users opt in
via the `{ type, options }` object form which passes through to G6.

## 7. Test plan

### 7.1 Spec (`mcp-ui-spec` — ~3 tests)

- `GraphComponentParamsSchema` accepts minimal `{ nodes: [{id:'a'}] }`
- Rejects empty `nodes` array (`min(1)`)
- Accepts both shorthand `layout: 'force'` and object `layout: { type: 'force', options: {...} }`

### 7.2 Renderer (`mcp-ui-solid` — ~6-8 tests)

`@antv/g6` mocked in vitest setup (G6 needs canvas, jsdom doesn't have
one natively — same approach as chart.js mock). Test :

- `<GraphRenderer>` renders fallback UI when `isG6Available()` returns
  false
- With G6 available + `nodes` only → `Graph` constructor called with
  empty `edges` array
- With G6 available + nodes + edges → `Graph.render()` called
- `layout` shorthand `'dagre'` → resolved layout object `{ type: 'dagre' }`
- `layout` object form → options passed through
- `onCleanup` calls `graph.destroy()` (memory leak guard)
- canvas default (rendererPref absent/'canvas') → constructor config has NO `renderer` field (G6 v5 default)
- `rendererPref: 'svg'` → constructor still receives NO string `renderer` (svg degrades to canvas until the g-svg factory is wired)
- Telemetry integration (B.5) : `component:mounted` + `component:rendered`
  fire (durationMs from perf marks)

### 7.3 Integration

- `<UIResourceRenderer>` with a `type: 'graph'` component routes to
  `<GraphRenderer>` (no UNKNOWN_COMPONENT_TYPE)
- `validation.ts` rejects empty `nodes` array with code `INVALID_GRAPH`
- DOMPurify whitelist : N/A (G6 renders to canvas/svg directly, no
  HTML sanitization path)

## 8. Bundle + perf impact

- **Apps that don't install `@antv/g6`** : 0 byte added to mcp-ui-solid
  bundle. The dynamic `import('@antv/g6')` resolves to a bundler-handled
  chunk that's never fetched.
- **Apps that DO install** : ~150-200 KB gzipped fetched on first graph
  mount (asynchronously). Subsequent graphs reuse the loaded module.
- **Render perf** : G6 v5 canvas renderer handles ~1k nodes / 5k edges
  smoothly. We should add a `RESOURCE_LIMIT_EXCEEDED` check in
  `validateGraphComponent` (max 500 nodes default, configurable via
  `ResourceLimits.maxGraphNodes`) similar to chart's `maxDataPoints`.
- **Telemetry** : `component:rendered` will report durationMs that
  includes the async G6 init on first mount. May want a separate
  `graph:layout-computed` event later if deposium asks for it (out of
  scope v1).

## 9. Open questions

1. **G6 v5 mindmap layout name** — needs verification during impl.
   Either `'mindmap'` exists as a dedicated layout, or we map it to
   `'compact-box'` with `{ direction: 'RL' }` style options. If the
   latter, the spec enum still says `'mindmap'` and the resolver
   translates internally.

2. **Edge id requirement** — G6 v5 may require an `id` field on edges
   for hover/click handlers. The spec currently doesn't require it
   (uniqueness via `source + target`). If G6 needs unique edge ids,
   we either auto-generate `${source}-${target}-${i}` in the renderer
   OR add `id` to `GraphEdgeSchema` as required. Recommendation : auto-
   generate, keep spec lean.

3. **Default `behaviors` set** — `'drag-canvas'`, `'zoom-canvas'`,
   `'drag-element'` are sane defaults. But `'click-select'` (highlights
   nodes on click) might be better default for MCP-rendered graphs that
   typically expect interaction. Recommendation : enable click-select
   by default, expose `enableSelect: false` opt-out.

4. **`onNodeClick` / `onEdgeClick` payload shape** — what do consumers
   actually want ? G6 click events return `{ itemType, itemId, item }`.
   Should we surface that raw, or normalize to `{ id, label, data }`
   matching our spec node shape ? Recommendation : normalize, hide G6
   internals.

5. **Resource limits** — proposed `maxGraphNodes: 500`,
   `maxGraphEdges: 2000`. Tight enough to keep canvas perf, loose
   enough for real org networks. Configurable via the existing
   `ValidationOptions.limits` extension. **Confirm with deposium** :
   are there cases where they'd want 1000+ nodes ?

6. **Tooltip / hover behavior** — G6 v5 has `tooltip` plugin. Do we
   wire it by default reading `node.label` + `node.data` ? Or leave
   off and let consumers wire via callbacks ? Recommendation : wire
   default tooltip showing label + data summary, opt-out via prop.

7. **Combos (groupings)** — G6 supports node grouping. Real org
   networks could benefit (group by department). Out of scope v1 ?
   Recommendation : ship without combo support, add in v5.9.0 if
   requested.

8. **Server-side rendering of graph snapshots** — completely out of
   scope. G6 needs DOM. If deposium wants graph thumbnails in static
   contexts (PDF export, email summary), they'd render server-side
   via headless Chrome → PNG, not via mcp-ui-solid.

## 10. Cross-stack — what deposium needs to do

**Phase 1 (one-shot)** — install peer dep + nothing else :
```bash
pnpm --filter deposium-solid add @antv/g6@^5
```

**Phase 2 (per use case)** — emit `type: 'graph'` payloads from MCPs :

```ts
// Org network example
{
  type: 'graph',
  position: { colStart: 1, colSpan: 12 },
  params: {
    title: 'Réseau d\'acteurs Mathilde',
    nodes: extractedEntities.map(e => ({ id: e.id, label: e.name, type: 'circle' })),
    edges: relationships.map(r => ({ source: r.from, target: r.to, label: r.type })),
    // layout omitted → auto 'force'
  }
}

// Tool dependency DAG example
{
  type: 'graph',
  position: { colStart: 1, colSpan: 12 },
  params: {
    title: 'Tool execution chain',
    nodes: chain.map(t => ({ id: t.name, label: t.name })),
    edges: chain.flatMap(t => t.delegates.map(d => ({ source: t.name, target: d }))),
    layout: { type: 'dagre', options: { rankdir: 'TB' } },
    height: '500px',
  }
}

// Mindmap example
{
  type: 'graph',
  position: { colStart: 1, colSpan: 12 },
  params: {
    title: 'Synthèse Mathilde',
    nodes: mindmapNodes,
    edges: mindmapEdges,
    layout: 'mindmap',
    height: '600px',
  }
}
```

**Phase 3 (optional)** — wire `onNodeClick` to open the source-doc
panel for entity nodes (hosts have this hook for citations already).

## 11. Migration / risk

- **Backward compatible** : new ComponentType, no existing API changed.
- **Apps without peer dep** : graph components render the fallback UI
  ("Install @antv/g6 to render graphs") — non-blocking, informative.
- **Apps with peer dep** : graphs render normally. No behavior change
  on other ComponentTypes.
- **Spec bump** : `mcp-ui-spec@5.0.4` (additive enum value + new
  schemas).
- **Solid bump** : `mcp-ui-solid@5.8.0` (minor — new public component
  + ComponentType).
- **CLI bump** : `mcp-ui-cli@5.0.1` (registers `'graph'` as known
  type for `validate` + `generate-types`). ✅ **confirmed 2026-05-02
  by user** — bundled in the v5.8.0 release wave.

## 12. Decision needed before implementation

### Already resolved (2026-05-02)

- ✅ Default layout when edges present + layout omitted = `'force'`
- ✅ `mcp-ui-cli` registers `'graph'` as known type (bundled in v5.8.0
  release wave)
- ✅ Brief itself approved (this section)

### Still open — pick defaults to unblock implementation

1. **GO / NO-GO** on the overall design. Can be partial (e.g. ship
   `force + dagre` only in v1, defer `mindmap` until G6 mindmap
   layout name is verified during impl).
2. **§9 #3 default behaviors** : default `behaviors` set in G6 ctor.
   Proposed : `['drag-canvas', 'zoom-canvas', 'drag-element',
   'click-select']`. Click-select gives nodes a "selected" highlight
   on click — useful for chat contexts where users want to focus on
   one entity. Opt-out via `enableSelect: false` prop. **OK to ship
   this default ?**
3. **§9 #5 resource limits** : proposed `maxGraphNodes: 500`,
   `maxGraphEdges: 2000`. **Are there real deposium use cases where
   you'd emit > 500 nodes ?** (e.g. SIRENE org dump for a whole
   département). If yes, raise the cap to 1000 or 2000.
4. **§9 #6 default tooltip** : G6 has a `tooltip` plugin that shows
   `node.label` + `node.data` summary on hover. Ship enabled by
   default with a `tooltip: false` opt-out, OR ship disabled with
   `tooltip: true` opt-in ? Recommendation : enabled by default
   (typical chat UX expects hover info).
5. **§9 #4 onNodeClick payload** : normalize to `{ id, label, data }`
   matching our spec node shape (recommended) OR pass G6 raw event ?
6. **Deposium emission examples §10** : are the 3 example payloads in
   §10 realistic ? Specifically, for the **mindmap** case, do you
   already have a way to extract a tree structure from Mathilde's
   reasoning, or is that itself a separate PR ?

## 13. References

- `@antv/g6` v5 docs : https://g6.antv.antgroup.com/en/manual
- `mcp-ui-solid/src/components/ChartJSRenderer.tsx` — the lazy-load
  pattern to mirror
- `mcp-ui-solid/src/services/validation.ts` — `SPEC_VALIDATORS` +
  `KNOWN_COMPONENT_TYPES` to extend
- `mcp-ui-solid/CHANGELOG.md` v5.7.0 — last stable shipped
- Companion brief : `docs/briefs/BRIEF-citations-in-table-cells.md` —
  same data-on-spec / behavior-on-solid split, same peer-optional
  pattern (citations is content not heavy, but the api shape pattern
  matches).
- **Inspiration** : `docs/briefs/BRIEF-graph-component-g6-INSPIRATION.md`
  — 9 additional use cases gathered 2026-05-02 from a multi-repo
  brainstorm (chat UX / compliance / observability angles). Validates
  the 7-layout enum against a wider intent space and surfaces 3
  commercial angles (RGPD audit, SOC2 incident response, anti-hallu
  forensics) not covered by the seed use cases above.
