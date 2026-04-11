# @seed-ship/mcp-ui-solid

SolidJS components + chat toolkit for MCP-generated UI. Part of the [MCP UI ecosystem](https://github.com/theseedship/mcp-ui).

[![npm version](https://img.shields.io/npm/v/@seed-ship/mcp-ui-solid.svg)](https://www.npmjs.com/package/@seed-ship/mcp-ui-solid)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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
} from '@seed-ship/mcp-ui-solid'

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
