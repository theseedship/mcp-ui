# @seed-ship/mcp-ui-solid

SolidJS components + chat toolkit for MCP-generated UI. Part of the [MCP UI ecosystem](https://github.com/theseedship/mcp-ui).

[![npm version](https://img.shields.io/npm/v/@seed-ship/mcp-ui-solid.svg)](https://www.npmjs.com/package/@seed-ship/mcp-ui-solid)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What's New in v2.13.0

- **Multi-source scratchpad** - `sectionMode` (replace/append/upsert) for multi-tour without re-sending all sections. `mergeScratchpadSections()` helper. `stepper` section type for multi-source progress. Action aliases auto-close.
- **Smart field status** - `fieldStatus` per field: `required`/`unsupported`/`unknown`. `statusReason` explains why.
- **Universal HITL protocol** - ScratchpadPanel for ALL connectors with `onSubmit`, error+retry, feedback
- **HITL multi-tour** - Turn state, progression stepper, understanding/feedback/prompt sections
- **Interactive filter chips** - Click to edit (text or select), "+" to add filters
- **Embedded forms** - FormFieldRenderer in scratchpad with depends_on reactive fields
- **Preview auto-refresh** - `previewEndpoint` + configurable method/headers + debounce
- **Chat Bus** (`@experimental`) - Bidirectional event/command bus (18 events, 11 commands)
- **19 component renderers** - chart, table, metric, code, map, form, modal, gallery, video, iframe + more

## Installation

```bash
pnpm add @seed-ship/mcp-ui-solid
# or
npm install @seed-ship/mcp-ui-solid
```

**Peer dependencies:** `solid-js` ^1.9.0

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

## Chat Bus — Agent Interactions (`@experimental`)

Bidirectional event/command system for agent-driven chat interactions. Your app keeps full control of its chat UI — the bus adds structured interactivity on top.

### Architecture

```
                    ┌──────────────────────┐
                    │   AGENT LAYER        │
                    │  (your app logic)    │
                    └──┬──────────────┬────┘
              events   │              │ commands
                       ▼              ▼
┌──────────────────────────────────────────────────┐
│   Chat Messages (your app renders these)          │
│   + UIResourceRenderer for MCP components         │
├──────────────────────────────────────────────────┤
│   ChatPrompt (MCP-UI) — choice | confirm | form   │
├──────────────────────────────────────────────────┤
│   Chat Input (your app controls this)             │
└──────────────────────────────────────────────────┘
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

  // Bridge SSE → bus events
  onSSEEvent('done', (data) =>
    bus.events.emit('onStreamEnd', { streamKey: 'main', metadata: data }))
  onSSEEvent('ui_layout', (data) =>
    bus.events.emit('onUILayout', { streamKey: 'main', layout: data }))

  // Handle commands from agents
  bus.commands.handle('injectPrompt', (text) => setInputValue(text))
  bus.commands.handle('sendPrompt', (text) => {
    setInputValue(text); handleSend(); return crypto.randomUUID()
  })
  bus.commands.handle('showChatPrompt', (config) => setActivePrompt(config))

  return (
    <div>
      <Messages />
      <Show when={activePrompt()}>
        <ChatPrompt
          config={activePrompt()!}
          onSubmit={(response) => {
            bus.events.emit('onChatPromptResponse', { streamKey: 'main', response })
            setActivePrompt(null)
          }}
          onDismiss={() => setActivePrompt(null)}
        />
      </Show>
      <TextInput />
    </div>
  )
}

// 3. Agents react to events and emit commands
function AgentRouter() {
  const bus = useChatBus()

  bus.events.on('onStreamEnd', (event) => {
    if (event.metadata.needs_clarification) {
      bus.commands.exec('showChatPrompt', {
        type: 'choice',
        title: 'Which period?',
        config: { options: [{ value: '2024', label: '2024' }, { value: '2025', label: '2025' }] }
      })
    }
  })

  return null
}
```

### Event Types (15)

| Event | Payload | Description |
|-------|---------|-------------|
| `onToken` | `{ token }` | Streaming text token (use throttle) |
| `onStreamStart` | `{}` | Stream started |
| `onStreamEnd` | `{ metadata }` | Stream completed with metadata |
| `onError` | `{ error }` | Stream error |
| `onUILayout` | `{ layout }` | MCP UI component to render |
| `onCitation` | `{ citation }` | Citation reference |
| `onToolCall` | `{ tool }` | Tool execution status |
| `onSuggestions` | `{ items }` | Suggestion chips |
| `onChatPromptResponse` | `{ response }` | User responded to ChatPrompt |
| `onClarificationNeeded` | `{ clarification }` | Needs user clarification |
| `onAgentSwitch` | `{ agent }` | Active agent changed |
| `onBriefing` | `{ briefing }` | Briefing update |
| `onCapabilityChange` | `{ capabilities }` | Agent capabilities changed |
| `onCustomEvent` | `{ type, data }` | App-specific event |

All events carry `ChatEventBase` (`streamKey`, `conversationId?`, `correlationId?`) for multi-stream support.

### Command Types (10)

| Command | Args | Returns | Description |
|---------|------|---------|-------------|
| `injectPrompt` | `text` | void | Fill input without sending |
| `sendPrompt` | `text, metadata?` | `correlationId` | Fill + send, returns correlation ID |
| `appendPrompt` | `text` | void | Append to current input |
| `showChatPrompt` | `config, signal?` | `Promise<Response>` | Show structured prompt (AbortSignal for cleanup) |
| `dismissChatPrompt` | — | void | Close active prompt |
| `showSuggestions` | `items` | void | Show suggestion chips |
| `toggleConnector` | `id, enabled` | void | Toggle a connector |
| `setMode` | `mode` | void | Change chat mode |
| `scrollToMessage` | `messageId` | void | Scroll to message |
| `notify` | `message, type?` | void | Show notification |

### Throttle + StreamKey Filtering

```typescript
// Throttle hot-path events (recommended for onToken)
bus.events.on('onToken', handler, { throttle: 100 })

// Filter by stream (multi-stream support)
bus.events.on('onStreamEnd', handler, { streamKey: 'stream-1' })
```

## ChatPrompt — Structured Interactions (`@experimental`)

Three subtypes for common agent interaction patterns:

```tsx
// Choice — buttons with optional icons and descriptions
<ChatPrompt config={{
  type: 'choice',
  title: 'Export format?',
  config: {
    options: [
      { value: 'pdf', label: 'PDF', icon: '📄' },
      { value: 'csv', label: 'CSV', icon: '📊', description: 'Raw data' },
    ],
    layout: 'horizontal', // or 'vertical' | 'grid'
  }
}} onSubmit={handleResponse} />

// Confirm — with danger variant
<ChatPrompt config={{
  type: 'confirm',
  title: 'Delete 47 documents?',
  config: { message: 'This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' }
}} onSubmit={handleResponse} />

// Form — quick fields with validation
<ChatPrompt config={{
  type: 'form',
  title: 'Additional info',
  config: {
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'select',
        options: [{ label: 'Report', value: 'report' }] },
    ],
    submitLabel: 'Send',
  }
}} onSubmit={handleResponse} />

// Multi-select — dropdown checkboxes + chips (v2.6.0)
<ChatPrompt config={{
  type: 'form',
  title: 'DVF Parameters',
  config: {
    fields: [
      { name: 'years', label: 'Years', type: 'select', multiple: true,
        options: [{ label: '2024', value: '2024' }, { label: '2023', value: '2023' }, { label: '2022', value: '2022' }] },
    ],
    submitLabel: 'Search',
  }
}} onSubmit={handleResponse} />
// → response.value = { years: ["2024", "2023"] }

// Autocomplete — API fetch for large datasets (v2.6.0)
<ChatPrompt config={{
  type: 'form',
  title: 'Select commune',
  config: {
    fields: [
      { name: 'commune', label: 'Commune', type: 'autocomplete',
        apiUrl: 'https://geo.api.gouv.fr/communes', searchParam: 'nom',
        labelField: 'nom', valueField: 'code',
        extraParams: { fields: 'nom,code', limit: '10' }, minChars: 2 },
    ],
    submitLabel: 'Search',
  }
}} onSubmit={handleResponse} />
// → type "Mont" → dropdown [Montpellier, Montreuil, ...]
// → response.value = { commune: "34172" }
```

## ScratchpadPanel — HITL/AITL Shared Workspace (`@experimental`)

A shared workspace where agent and human collaborate in real-time. The agent fills sections (data, filters, preview), the human can edit filters and validate. Works for both HITL (human supervises agent) and AITL (agent supervises human/other agent).

```tsx
import { ScratchpadPanel } from '@seed-ship/mcp-ui-solid'
import type { ScratchpadState } from '@seed-ship/mcp-ui-solid'

function WorkspaceView() {
  const [state, setState] = createSignal<ScratchpadState>(/* from SSE */)

  // Listen for scratchpad SSE events
  bus.events.on('onScratchpad', (event) => {
    if (event.scratchpad.action === 'create') setState(event.scratchpad)
    if (event.scratchpad.action === 'update') setState(prev => ({ ...prev, ...event.scratchpad }))
  })

  return (
    <ScratchpadPanel
      state={state()}
      onFilterChange={(filters) => {
        // Send updated filters to agent
        fetch('/api/chat-stream/scratchpad-update', {
          method: 'POST',
          body: JSON.stringify({ id: state().id, filters })
        })
      }}
      onAction={(action) => {
        if (action === 'validate') bus.commands.exec('sendPrompt', 'Valider et synthetiser')
      }}
    />
  )
}
```

### Section Types

| Type | Renders | Editable | Use case |
|------|---------|:--------:|----------|
| `data` | Key-value pairs | No | Dataset info, column list |
| `filter` | Editable chips + remove | Yes | Active filters (dept, year) |
| `preview` | Count badge + summary + mini-table | No | Live result count |
| `message` | Agent bubble (info/question/warning) | No | Agent explanations |
| `action` | Buttons (primary/danger/default) | No | Validate, refine, change |
| `steps` | Stepper with embedded content | No | Guided workflow |
| `form` | Full FormFieldRenderer (select, autocomplete, depends_on) | Yes | Interactive parameters |
| `understanding` | Confidence badges (high/medium/low) + warnings | No | Agent comprehension display |
| `feedback` | Thumbs up/down + optional comment | Yes | Validate/reject agent approach |
| `prompt` | Original query + extracted params + plan | Optional | Agent interpretation |

### Status Badges

`loading` → `ready` → `waiting_human` (pulsing) → `processing` → `complete`

## Component Renderers (19 types)

| Type | Renderer | Features |
|------|----------|----------|
| `chart` | ChartJSRenderer | Bar, line, pie, scatter, bubble, polarArea. Native Chart.js or Quickchart fallback. PNG export, configurable height. |
| `table` | TableRenderer | Sortable columns, pagination, virtualization (10K+ rows). CSV/TSV/JSON export. |
| `metric` | MetricRenderer | KPI cards with trends and sparklines |
| `text` | TextRenderer | Markdown rendering via marked.js |
| `code` | CodeBlockRenderer | Syntax highlighting (highlight.js), line numbers, word wrap toggle, filename header |
| `map` | MapRenderer | Leaflet maps with markers, clustering, auto-fit bounds |
| `form` | FormRenderer | Conditional fields, persistence, tool call submit |
| `modal` | ModalRenderer | Portal overlay, sizes sm-full, Escape/backdrop close |
| `image-gallery` | ImageGalleryRenderer | Grid layout, lightbox overlay, keyboard navigation |
| `video` | VideoRenderer | YouTube/Vimeo/direct URL, auto-detect provider |
| `iframe` | IframeRenderer | Tiered sandbox, 80+ whitelisted domains |
| `image` | ImageRenderer | Responsive with lazy loading |
| `link` | LinkRenderer | Styled link cards |
| `action` | ActionRenderer | Tool call buttons |
| `action-group` | ActionGroupRenderer | Grouped actions with layout options |
| `grid` | GridRenderer | Nested 12-column CSS Grid |
| `carousel` | CarouselRenderer | Content carousel |
| `artifact` | ArtifactRenderer | File download/preview |
| `footer` | FooterRenderer | Metadata display |

All wrapped with `ExpandableWrapper` (fullscreen expand via DOM reparenting) where applicable.

## Iframe Security

Tiered sandbox system — trusted domains get `allow-same-origin`, untrusted get restrictive sandbox:

```typescript
import { getIframeSandbox, DEFAULT_IFRAME_DOMAINS, TRUSTED_IFRAME_DOMAINS } from '@seed-ship/mcp-ui-solid'

// Automatic — IframeRenderer uses getIframeSandbox() internally
// Manual usage:
const sandbox = getIframeSandbox('https://docs.google.com/spreadsheets/...')
// → "allow-scripts allow-popups allow-same-origin allow-forms" (trusted)

const sandbox2 = getIframeSandbox('https://quickchart.io/chart?...')
// → "allow-scripts allow-popups" (untrusted — no same-origin)
```

**80+ whitelisted domains** including: Google services, YouTube, Vimeo, GitHub, Figma, Notion, Stripe, Polar.sh, HubSpot, data.gouv.fr, and more.

## Validation

All 19 component types validated, including:
- **Chart**: scatter/bubble (no labels required), time-series `{x,y}`, data type validation
- **Table**: columns + rows structure
- **Video**: URL + domain whitelist
- **Form/Carousel/Gallery/ActionGroup**: non-empty arrays
- **Code/Map/Artifact**: required content

```typescript
import { validateComponent, validateLayout } from '@seed-ship/mcp-ui-solid'

const result = validateComponent(component)
if (!result.valid) console.error(result.errors)
```

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
  ExpandableWrapper, ComponentToolbar, ChatPrompt, ScratchpadPanel,
} from '@seed-ship/mcp-ui-solid'

// Chat Bus
import {
  ChatBusProvider, useChatBus,
  createChatBus, createEventEmitter, createCommandHandler,
} from '@seed-ship/mcp-ui-solid'

// Validation + Security
import {
  validateComponent, validateLayout, validateIframeDomain,
  getIframeSandbox, DEFAULT_IFRAME_DOMAINS, TRUSTED_IFRAME_DOMAINS,
  ComponentRegistry,
} from '@seed-ship/mcp-ui-solid'

// Types
import type {
  ChatBus, ChatEvents, ChatCommands,
  ChatPromptConfig, ChatPromptResponse,
  AgentContext, BriefingEvent,
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
