# @seed-ship/mcp-ui-solid

SolidJS components + chat toolkit for MCP-generated UI. Part of the [MCP UI ecosystem](https://github.com/theseedship/mcp-ui).

[![npm version](https://img.shields.io/npm/v/@seed-ship/mcp-ui-solid.svg)](https://www.npmjs.com/package/@seed-ship/mcp-ui-solid)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What's New in v5.2.0 (`mcp-ui-solid` only)

- **`createChatPromptController()`** primitive — closes the v5.1.0 boilerplate. Owns resolver closure + `AbortSignal` wiring + re-entrance. Consumers write `bus.commands.handle('showChatPrompt', ctrl.handle)` + `<Show when={ctrl.activePrompt()}>{cfg => <ChatPrompt ... />}</Show>`. `PromptReplacedError` exported for `instanceof` checks.
- **`createScratchpadStore()`** factory + `ScratchpadStoreProvider` + `ScratchpadStoreContext` — isolated scratchpad state per subtree. `useScratchpadState()` now context-aware with module-singleton fallback (zero-breaking for v4.x).
- **`<FeedbackInline>`** — per-message thumbs up/down, non-blocking. Complements `ChatPrompt` (modal) and `ScratchpadPanel` feedback section (panel-side).
- **`onElicitation` event + `elicitationToPromptConfig()` helper** — MCP `elicitation/create` (spec 2025-06-18) mapped to `ChatPromptConfig`. Smart mapping : single boolean → confirm, single enum ≤4 → choice, everything else → form with per-property field inference.
- **29 new tests** (438 → 467). Scope doc : `docs/2026/r&d/mcpui-v5.2.0-scope.md` in the Deposium project.

## What's New in v5.1.0 (`mcp-ui-solid` only)

- **`optionRenderer` render prop** on `ChoicePromptConfig` — take full control of option bodies (confidence badges, rich layouts). mcp-ui still wraps the returned JSX in its own `<button>` with `onClick` + focus handling. See `optionRenderer (v5.1.0)` tests in `ChatPrompt.test.tsx` for usage.
- **Generic `ChoicePromptConfig<TMeta>`** — `ChoiceOption<TMeta>` flows through so your renderer closures get strongly-typed `option.metadata` without casting. Default `TMeta = Record<string, unknown>` keeps the non-generic shape valid for existing callers.
- **`buttonClass?` + `containerClass?`** escape hatches on `ChoicePromptConfig` — Tailwind class extensions that append to mcp-ui's defaults for light cosmetic tweaks without writing a full renderer.
- **`type="button"` on option buttons** — prevents accidental form submission when a `ChatPrompt` is nested inside an HTML `<form>`.
- **`ChatPrompt` + `showChatPrompt` JSDoc rewritten** — explicitly states the consumer contract : no default handler, Promise wiring is host-side, `AbortSignal` rejects with `DOMException('AbortError')` per Web Platform convention, re-entrance policy is host-enforced. Now available as a one-call primitive via `createChatPromptController()` in v5.2.0.

## What's New in v5.0.0

Synchronized major release — `@seed-ship/mcp-ui-solid`, `@seed-ship/mcp-ui-spec`, and `@seed-ship/mcp-ui-cli` all move to 5.0.0.

**Sprint 52 multi-agent primitives** (new)
- `ChoicePromptConfig.options[].metadata?` — opaque metadata preserved through the `showChatPrompt` roundtrip (confidence, source tags, etc.).
- `clarificationToPromptConfig()` — universal `ClarificationEvent → ChatPromptConfig` bridge. Legacy runtime `file_id` auto-migrated into `metadata.file_id`.
- `createMockChatBus()` — new `src/testing/` entry point with FIFO prompt responses and spy hooks. Test agent flows without rendering any UI.

**Breaking**
- `ClarificationEvent.options[].file_id` removed from the TypeScript type (was deprecated in v4.3.9). Runtime fallback still works via `clarificationToPromptConfig()`.
- `ChatPromptConfig.type = 'select'` / `SelectPromptConfig` removed (dead code — never had a rendering branch).

Everything rolled up from the 4.x series is documented in the previous section below.

## What's New in v4.3

- **Prefilled Forms** — Fields render with pre-populated values + source indicators (detected/inferred/default/user)
- **`prefillMode: "resolve"`** — Autocomplete fields accept display names ("Paris"), resolve to codes ("75056") client-side
- **Smart tag display** — Select/autocomplete show labels not codes for prefilled values
- **Prefill summary** — "N champs pré-remplis sur M" shown when fields are prefilled
- **Auto-submit toast** — Compact summary with countdown when ALL fields are prefilled
- **`valueFormat` validation** — Regex-based format validation on form values (e.g. `"^\\d{5}$"` for INSEE codes)
- **Autocomplete valueField guarantee** — Always submits resolved code, never display text

### Prefilled Form Example

```tsx
// SSE payload — server sends prefill + source on each field
{
  fields: [
    {
      name: 'departement', type: 'select',
      options: [{ value: '69', label: 'Rhône' }, ...],
      prefill: '69',
      displayHint: 'Rhône — déduit de Lyon',
      source: 'inferred',
      muted: true,
    },
    {
      name: 'commune', type: 'autocomplete',
      apiUrl: 'https://geo.api.gouv.fr/communes',
      searchParam: 'nom', labelField: 'nom', valueField: 'code',
      prefill: ['Lyon'],
      prefillMode: 'resolve', // MCP-UI resolves "Lyon" → code "69123"
      source: 'detected',
      muted: true,
    },
    {
      name: 'type_bien', type: 'select',
      options: [{ value: '', label: 'Tous' }, ...],
      // No prefill — user must choose
    },
  ],
  autoSubmitDelay: 3000, // optional countdown + toast when all prefilled
}
```

## What's New in v4.0.0

- **Data Verification Layer** - Anti-hallucination: `validateAgainstSource()` detects ~90% of numerical hallucinations, zero LLM cost, <1ms
- **VerifiedText component** - Inline badges (verified/hallucinated) with highlight, strip, annotate modes
- **DataPreviewSection** - Paginated data table with CSV/JSON export, source attribution, FR locale formatting
- **GeoJSON maps** - Polygon/line/point rendering, choropleth coloring, feature popups, multi-layer support
- **PMTiles** - Vector tiles for large datasets (>5000 features) via optional `protomaps-leaflet`
- **Time-series charts** - `timeAxis` config for date-based x-axis in ChartJSRenderer
- **18 scratchpad section types** - Added verified_text, data_preview, map, chart (was 14)
- **19 component renderers** - chart, table, metric, code, map, form, modal, gallery, video, iframe + more

## Installation

```bash
pnpm add @seed-ship/mcp-ui-solid
# or
npm install @seed-ship/mcp-ui-solid
```

**Peer dependencies:** `solid-js` ^1.9.0

**Optional peer deps** (install as needed):
- `chart.js` — native chart rendering
- `leaflet` + `leaflet.markercluster` — maps
- `highlight.js` — code syntax highlighting
- `protomaps-leaflet` — PMTiles vector tiles
- `@duckdb/duckdb-wasm` — DuckDB plugin
- `@tanstack/solid-virtual` — table virtualization

## Quick Start

### Static UI Rendering

```tsx
import { UIResourceRenderer } from '@seed-ship/mcp-ui-solid'

function Dashboard() {
  const layout = {
    id: 'dashboard-1',
    type: 'composite',
    components: [
      {
        type: 'metric',
        id: 'revenue',
        title: 'Revenue',
        value: '$125,430',
        position: { colStart: 1, colSpan: 4 }
      },
      {
        type: 'chart',
        id: 'trends',
        params: { type: 'line', data: { labels: ['Q1','Q2','Q3'], datasets: [{ label: 'Sales', data: [10,20,30] }] } },
        position: { colStart: 5, colSpan: 8 }
      }
    ]
  }

  return <UIResourceRenderer content={layout} />
}
```

### Streaming UI with SSE

```tsx
import { StreamingUIRenderer } from '@seed-ship/mcp-ui-solid'

function StreamingDashboard() {
  return (
    <StreamingUIRenderer
      query="Show me quarterly revenue trends"
      spaceIds={['analytics-space']}
      onComplete={(metadata) => console.log('Complete', metadata)}
    />
  )
}
```

## Data Verification — Anti-Hallucination (v4.0.0)

### validateAgainstSource — Pure function

Detects numerical hallucinations by comparing LLM text against source data. Zero dependencies, <1ms.

```typescript
import { validateAgainstSource } from '@seed-ship/mcp-ui-solid'

const rows = [
  { type: 'Appartement', ventes: 22306, prix_m2: 3337 },
  { type: 'Maison', ventes: 2492, prix_m2: 4230 },
]

const result = validateAgainstSource(
  "On observe 22 306 ventes a 3 337 EUR/m2. En 2023, 18 245 ventes.",
  rows
)

// result.valid === false
// result.hallucinated === [{ value: 18245, closest: 22306, distance: 0.18 }]
// result.confidence === 0.67
```

Options: `tolerance` (default 1%), `ignoreColumns`, `ignorePatterns` (years, postal codes ignored by default).

### useDataValidator — Reactive hook

```tsx
import { useDataValidator } from '@seed-ship/mcp-ui-solid'

const { valid, confidence, hallucinatedCount } = useDataValidator(
  () => llmText(),
  () => sourceRows(),
  { tolerance: 0.02 }
)
```

### VerifiedText — Inline badges

```tsx
import { VerifiedText } from '@seed-ship/mcp-ui-solid'

<VerifiedText
  text={llmResponse}
  validation={validationResult}
  mode="highlight"  // or "strip" | "annotate"
  onHallucinationClick={(item) => console.log('Hallucinated:', item)}
/>
```

### DataPreviewSection — Source data table

```tsx
import { DataPreviewSection } from '@seed-ship/mcp-ui-solid'

<DataPreviewSection content={{
  columns: [
    { key: 'type', label: 'Type', type: 'string' },
    { key: 'ventes', label: 'Ventes', type: 'number' },
    { key: 'prix_m2', label: 'Prix moy. EUR/m2', type: 'number' },
  ],
  rows: sourceRows,
  source: 'data.gouv.fr - Stats DVF',
  freshness: 'Donnees 2025',
  exportable: true,
  pageSize: 25,
}} />
```

## GeoJSON Maps (v4.0.0)

### GeoJSON + Choropleth + Popups

```tsx
import { MapRenderer } from '@seed-ship/mcp-ui-solid'

<MapRenderer params={{
  geojson: featureCollection,
  geojsonStyle: {
    choroplethField: 'prix_m2',
    choroplethScale: [
      [2000, '#eff3ff'],
      [3000, '#6baed6'],
      [5000, '#084594'],
    ],
    fillOpacity: 0.7,
  },
  popup: {
    titleField: 'name',
    fields: ['prix_m2', 'ventes'],
  },
  fitBounds: true,
  height: '500px',
}} />
```

### Multi-layer Maps

```tsx
<MapRenderer params={{
  layers: [
    { name: 'Parcelles', geojson: parcelles, visible: true,
      style: { choroplethField: 'prix', choroplethScale: [[100, '#fee'], [500, '#c00']] } },
    { name: 'Risques', geojson: risques, visible: false,
      style: { fillColor: 'orange', fillOpacity: 0.3 } },
  ],
  fitBounds: true,
}} />
```

### PMTiles — Large Datasets

```tsx
<MapRenderer params={{
  pmtiles: {
    url: 'https://cdn.example.com/data.pmtiles',
    paintRules: [
      { dataLayer: 'buildings', symbolizer: 'polygon', color: '#3388ff', opacity: 0.6 },
    ],
    maxZoom: 16,
  },
  center: [43.6, 3.87],
  zoom: 12,
}} />
```

Requires `protomaps-leaflet` peer dependency.

## Time-Series Charts (v4.0.0)

```tsx
<ChartJSRenderer component={{
  id: 'ndvi-timeline',
  type: 'chart',
  position: { colStart: 1, colSpan: 12 },
  params: {
    type: 'line',
    data: {
      labels: ['2024-01-15', '2024-02-15', '2024-03-15', '2024-04-15'],
      datasets: [{
        label: 'NDVI',
        data: [0.45, 0.42, 0.55, 0.68],
        borderColor: '#10b981',
        fill: true,
        tension: 0.3,
      }],
    },
    timeAxis: {
      unit: 'month',
      tooltipFormat: 'MMM yyyy',
    },
    exportable: true,
  },
}} />
```

## Chat Bus — Agent Interactions (`@experimental`)

Bidirectional event/command system for agent-driven chat interactions. Your app keeps full control of its chat UI — the bus adds structured interactivity on top.

### Architecture

```
                    +----------------------+
                    |   AGENT LAYER        |
                    |  (your app logic)    |
                    +--+----------+-------+
              events   |          | commands
                       v          v
+--------------------------------------------------+
|   Chat Messages (your app renders these)          |
|   + UIResourceRenderer for MCP components         |
+--------------------------------------------------+
|   ChatPrompt (MCP-UI) - choice | confirm | form   |
+--------------------------------------------------+
|   Chat Input (your app controls this)             |
+--------------------------------------------------+
```

### Usage

```tsx
import { ChatBusProvider, useChatBus, ChatPrompt, createChatBus } from '@seed-ship/mcp-ui-solid'

// 1. Wrap your app
function App() {
  return (
    <ChatBusProvider>
      <ChatInterface />
      <AgentRouter />
    </ChatBusProvider>
  )
}

// 2. Bridge your SSE events to the bus
function ChatInterface() {
  const bus = useChatBus()
  const [activePrompt, setActivePrompt] = createSignal(null)

  onSSEEvent('done', (data) =>
    bus.events.emit('onStreamEnd', { streamKey: 'main', metadata: data }))

  bus.commands.handle('injectPrompt', (text) => setInputValue(text))
  bus.commands.handle('showChatPrompt', (config) => setActivePrompt(config))

  return (
    <div>
      <Messages />
      <Show when={activePrompt()}>
        <ChatPrompt config={activePrompt()!} onSubmit={handleResponse} onDismiss={() => setActivePrompt(null)} />
      </Show>
      <TextInput />
    </div>
  )
}
```

### Event Types (18) / Command Types (11)

See [Chat Bus documentation](https://github.com/theseedship/mcp-ui#chat-bus--agent-interactions-experimental) for the full event/command reference.

### Bridging external clarification events (v4.3.9)

When your MCP server emits a clarification event via SSE (e.g. a `_pause`
frame asking the user to disambiguate intent), convert it to a `ChatPrompt`
using the universal `clarificationToPromptConfig` helper — no app-specific
glue required:

```tsx
import { clarificationToPromptConfig } from '@seed-ship/mcp-ui-solid'

// In your SSE parser, when you decode a clarification frame:
bus.events.emit('onClarificationNeeded', {
  streamKey: 'main',
  clarification: {
    question: 'Which space do you mean?',
    options: [
      { value: 'sp-1', label: 'Immobilier', metadata: { confidence: 0.9 } },
      { value: 'sp-2', label: 'Santé',      metadata: { confidence: 0.6 } },
    ],
    type: 'intent_disambiguate', // opaque tag for host routing
  },
})

// Wire the event to a prompt:
bus.events.on('onClarificationNeeded', async ({ clarification }) => {
  const response = await bus.commands.exec(
    'showChatPrompt',
    clarificationToPromptConfig(clarification)
  )
  // POST response.value to your /api/agent-resume endpoint, etc.
})
```

Legacy `option.file_id` is automatically migrated into `metadata.file_id`.
Arbitrary `metadata` (confidence scores, source tags, ...) flows through
unchanged and can be rendered by a custom `ChoiceBody` wrapper.

### ChatPromptResponse — dismissed / aborted / answered

Every `ChatPrompt` exchange ends in one of three outcomes:

| Outcome | How | `response.dismissed` | Promise |
|---------|-----|----------------------|---------|
| Explicit answer | Click a choice / submit a form | `undefined` | resolves |
| Dismissed | Click the X icon, click Cancel (confirm type) | `true` | resolves |
| Aborted | Host app rejects the Promise via `AbortSignal` | *(n/a — never resolves)* | rejects with `DOMException('AbortError')` |

> **v5.2.0** — use `createChatPromptController()` (below). The manual pattern
> documented after it is kept for context and for consumers who prefer full
> control over the resolver lifecycle.

#### Recommended — `createChatPromptController()` (v5.2.0)

```tsx
import { Show } from 'solid-js'
import {
  ChatPrompt,
  useChatBus,
  createChatPromptController,
  PromptReplacedError,
} from '@seed-ship/mcp-ui-solid'

function HitlHost() {
  const bus = useChatBus()
  const ctrl = createChatPromptController()
  bus.commands.handle('showChatPrompt', ctrl.handle)

  return (
    <Show when={ctrl.activePrompt()}>
      {(cfg) => (
        <ChatPrompt
          config={cfg()}
          onSubmit={ctrl.resolveActive}
          onDismiss={ctrl.dismissActive}
        />
      )}
    </Show>
  )
}
```

Caller-side, re-entrance and abort are standard :

```ts
try {
  const response = await bus.commands.exec('showChatPrompt', config, ac.signal)
  // ...
} catch (err) {
  if (err instanceof PromptReplacedError) return           // superseded by a newer prompt
  if (err instanceof Error && err.name === 'AbortError') return  // navigation killed it
  throw err
}
```

`ctrl.abort(reason?)` is also available for programmatic cancellation
(modal close, route change, ...).

#### Manual wiring (v5.1.0 reference pattern)

Equivalent to the controller above — useful if you want full control over
the resolver closure, or if you're maintaining a v5.1.0 codebase :

```tsx
import { createSignal } from 'solid-js'
import { useChatBus } from '@seed-ship/mcp-ui-solid'
import type { ChatPromptConfig, ChatPromptResponse } from '@seed-ship/mcp-ui-solid'

function HitlHost() {
  const bus = useChatBus()
  const [activePrompt, setActivePrompt] = createSignal<ChatPromptConfig | null>(null)

  // Mutable resolver + optional abort cleanup — one prompt at a time
  let active: {
    resolve: (response: ChatPromptResponse) => void
    reject: (err: unknown) => void
    cleanupAbort?: () => void
  } | null = null

  bus.commands.handle('showChatPrompt', (config, signal) => {
    // Re-entrance: auto-reject any previous in-flight prompt
    if (active) {
      const stale = active
      active = null
      stale.reject(new Error('PromptReplaced'))
      stale.cleanupAbort?.()
    }

    // Already-aborted signal → reject synchronously, never render
    if (signal?.aborted) {
      return Promise.reject(new DOMException('Prompt aborted', 'AbortError'))
    }

    return new Promise<ChatPromptResponse>((resolve, reject) => {
      const onAbort = () => {
        setActivePrompt(null)
        active = null
        reject(new DOMException('Prompt aborted', 'AbortError'))
      }
      signal?.addEventListener('abort', onAbort, { once: true })

      active = {
        resolve,
        reject,
        cleanupAbort: () => signal?.removeEventListener('abort', onAbort),
      }
      setActivePrompt(config)
    })
  })

  const handleSubmit = (response: ChatPromptResponse) => {
    const a = active
    active = null
    setActivePrompt(null)
    a?.cleanupAbort?.()
    a?.resolve(response)
  }

  const handleDismiss = () => {
    const a = active
    active = null
    setActivePrompt(null)
    a?.cleanupAbort?.()
    a?.resolve({ type: 'choice', value: '', label: '', dismissed: true })
  }

  return (
    <Show when={activePrompt()}>
      <ChatPrompt config={activePrompt()!} onSubmit={handleSubmit} onDismiss={handleDismiss} />
    </Show>
  )
}
```

Consumer-side the error is standard and branch-able without any mcp-ui import:

```ts
try {
  const response = await bus.commands.exec('showChatPrompt', config, ctrl.signal)
  // ...
} catch (err) {
  if (err instanceof Error && err.name === 'AbortError') return  // navigation killed it
  throw err
}
```

v5.2.0 collapses this to a single `createChatPromptController()` call — see
above. Prefer the controller unless you have a reason to manage the
lifecycle yourself.

### correlationId — host-propagated (v4.3.9)

`ChatEventBase.correlationId` is opaque to mcp-ui. When an agent calls
`sendPrompt('...')` the returned string is a correlation ID — the host app's
SSE parser must forward this value into every subsequent event emission
(`onToken`, `onStreamEnd`, etc.) so agents can match responses back to their
original prompts. mcp-ui does not auto-propagate it across the bus.

## ScratchpadPanel — HITL/AITL Shared Workspace (`@experimental`)

A shared workspace where agent and human collaborate in real-time. 18 section types:

| Type | Renders | Use case |
|------|---------|----------|
| `data` | Key-value pairs | Dataset info |
| `filter` | Editable chips | Active filters |
| `preview` | Count + mini-table | Live result count |
| `message` | Agent bubble | Explanations |
| `action` | Buttons | Validate, refine |
| `steps` | Stepper | Guided workflow |
| `form` | FormFieldRenderer | Interactive params |
| `understanding` | Confidence badges | Agent comprehension |
| `feedback` | Thumbs up/down | User validation |
| `prompt` | Query + params | Agent interpretation |
| `stepper` | Progress stepper | Multi-turn progress |
| `error` | Error card | Error display + retry |
| `source_card` | Source info card | Data source details |
| `diff` | Before/after diff | Change preview |
| `verified_text` | Inline badges | Data verification |
| `data_preview` | Paginated table | Source data display |
| `map` | GeoJSON map | Geographic data |
| `chart` | Chart.js chart | Time-series, analytics |

### Direct store (recommended)

```tsx
import { dispatchScratchpad, useScratchpadState } from '@seed-ship/mcp-ui-solid'

// In your SSE callback — ONE LINE
onScratchpad: (data) => dispatchScratchpad(data as ScratchpadEvent)

// In your component
const { state, pinned, close } = useScratchpadState()
```

## Component Renderers (19 types)

| Type | Features |
|------|----------|
| `chart` | Bar, line, pie, scatter, bubble, polarArea, time-series. Native Chart.js or Quickchart fallback. PNG export. |
| `table` | Sortable, pagination, virtualization (10K+), CSV/TSV/JSON export |
| `metric` | KPI cards with trends and sparklines |
| `text` | Markdown via marked.js |
| `code` | Syntax highlighting (highlight.js), line numbers, word wrap |
| `map` | Leaflet: markers, clustering, GeoJSON, choropleth, popups, multi-layer, PMTiles |
| `form` | 18 field types, conditional fields, persistence, tool call submit |
| `modal` | Portal overlay, sizes sm-full, Escape/backdrop close |
| `image-gallery` | Grid layout, lightbox, keyboard nav |
| `video` | YouTube/Vimeo/direct URL |
| `iframe` | Tiered sandbox, 80+ whitelisted domains |
| `image` | Responsive with lazy loading |
| `link` | Styled link cards |
| `action` | Tool call buttons |
| `action-group` | Grouped actions with layout options |
| `grid` | Nested 12-column CSS Grid |
| `carousel` | Content carousel |
| `artifact` | File download/preview |
| `footer` | Metadata display |

## SSR Compatibility

Fully SSR-compatible with SolidStart, Astro, etc. Add to `app.config.ts`:

```typescript
export default defineConfig({
  vite: { resolve: { conditions: ['solid', 'development', 'browser'] } }
})
```

## Exports

```typescript
// Components
import {
  UIResourceRenderer, StreamingUIRenderer, GenerativeUIErrorBoundary,
  ExpandableWrapper, ComponentToolbar,
  ChatPrompt, ScratchpadPanel,
  VerifiedText, DataPreviewSection,
} from '@seed-ship/mcp-ui-solid'

// Data Verification
import { validateAgainstSource } from '@seed-ship/mcp-ui-solid'
import { useDataValidator } from '@seed-ship/mcp-ui-solid'

// Chat Bus
import {
  ChatBusProvider, useChatBus,
  dispatchScratchpad, useScratchpadState,
  createChatBus, createEventEmitter, createCommandHandler,
  clarificationToPromptConfig,  // v4.3.9 — universal ClarificationEvent → ChatPromptConfig bridge
} from '@seed-ship/mcp-ui-solid'

// Testing utilities (v4.3.9)
import { createMockChatBus } from '@seed-ship/mcp-ui-solid'

// Validation + Security
import {
  validateComponent, validateLayout,
  getIframeSandbox, DEFAULT_IFRAME_DOMAINS, TRUSTED_IFRAME_DOMAINS,
} from '@seed-ship/mcp-ui-solid'

// Types
import type {
  DataValidation, HallucinatedNumber, DataValidationOptions,
  VerifiedTextContent, DataPreviewContent, MapSectionContent,
  MapGeoJSONStyle, MapPopupConfig, MapLayer, MapPMTilesConfig,
  ChatBus, ChatEvents, ChatCommands,
  ScratchpadState, ScratchpadSection, ScratchpadEvent,
  UIComponent, UILayout, ComponentType,
} from '@seed-ship/mcp-ui-solid'
```

## Related Packages

| Package | Description |
|---------|-------------|
| [`@seed-ship/mcp-ui-spec`](https://www.npmjs.com/package/@seed-ship/mcp-ui-spec) | Zod schemas and JSON Schema definitions |
| [`@seed-ship/mcp-ui-cli`](https://www.npmjs.com/package/@seed-ship/mcp-ui-cli) | CLI: validate, generate-types, test-examples |

## License

MIT — **Built by [The Seed Ship](https://github.com/theseedship)**
