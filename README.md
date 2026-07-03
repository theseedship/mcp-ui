# MCP UI Components

> **UI component library for Model Context Protocol (MCP) servers**

A collection of TypeScript packages for building generative, streaming user interfaces powered by MCP servers and LLMs.

[![npm version](https://img.shields.io/npm/v/@seed-ship/mcp-ui-solid.svg)](https://www.npmjs.com/package/@seed-ship/mcp-ui-solid)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What's New

**Current line — `mcp-ui-solid` 6.x** (post-`5.0.0`, audit-driven visual-renderer
& streaming hardening; `mcp-ui-spec` 5.5.0). Highlights — see
[`mcp-ui-solid/CHANGELOG.md`](./mcp-ui-solid/CHANGELOG.md) for the full list:

- **`graph` primitive** — node-link visualization powered by `@antv/g6` (peer-optional), first-class in the `UIComponent` params union.
- **Renderer fallback ladder** — no silent blanks: a failed heavy renderer degrades to a local data table + visible notice, and an unknown component type shows an explicit "Unsupported component type" notice.
- **Security hardening** — map popups/tooltips escaped by default (`allowHtmlPopups` is a host opt-in) and the external quickchart.io chart fallback is now an explicit host opt-in (`allowQuickchartFallback`, default off).
- **Larger payloads** — default payload-size limit raised 50 KB → 512 KB.
- **Single-source component types** — solid's `ComponentType` is derived from the spec enum (no more manual drift).

### v5.0.0 (synchronized major release)

Synchronized major release — all three packages bumped in lockstep.

**Sprint 52 multi-agent primitives** (new)
- `ChoicePromptConfig.options[].metadata?` — free-form metadata (confidence, source, tags) preserved through the `showChatPrompt` roundtrip.
- `ClarificationEvent.options[].metadata?` + `type?` — extension points for host routing. Legacy `file_id` **removed** (runtime-migrated by `clarificationToPromptConfig`).
- `clarificationToPromptConfig()` — universal `ClarificationEvent → ChatPromptConfig` bridge exported from the root package.
- `createMockChatBus()` — new `mcp-ui-solid/src/testing/` entry point with FIFO prompt responses and spy hooks for testing agent flows without rendering any UI.
- Documented known limitations (`showChatPrompt` non-reentrant, scratchpad store singleton, `correlationId` host-propagated) — fixes planned for v5.1.0.

**Prefilled Forms & PPR** (rolled up from 4.2.x / 4.3.x)
- `prefill` / `displayHint` / `source` / `muted` / `autoSubmitDelay` on form fields with visual source badges.
- `prefillMode: 'resolve'` — autocomplete fields accept display names, resolved to codes client-side.
- `valueFormat` regex validator + autocomplete `valueField` guarantee.
- Debug trace panel for HITL forms (`debugTrace` on `ScratchpadPanel`).

**Table UX polish** (rolled up from 4.3.x)
- Context-aware pagination (compact in chat, full `pageSize` in fullscreen via `useExpanded()` context).
- Page size selector in fullscreen (10 / 30 / 60 / 100 / All).
- Client-side search filter with accent-insensitive matching, 200ms debounce, and match highlighting (`bg-yellow-200` / `bg-[#222F49]`).
- Sticky header, smart scrollbar (400px chat, calc viewport fullscreen), default export = CSV.

**Data Verification Layer** (4.0.0)
- `validateAgainstSource()` numerical hallucination detector, `<1ms`, `$0.00`.
- `VerifiedText`, `DataPreviewSection`, `useDataValidator` hook.

**Breaking changes**
- `ClarificationEvent.options[].file_id` removed from the TypeScript type (still runtime-migrated by `clarificationToPromptConfig`).
- `ChatPromptConfig.type = 'select'` / `SelectPromptConfig` removed (dead code, never had a rendering branch).

See [CHANGELOG.md](./CHANGELOG.md) for the full history including every 4.x release rolled up into v5.0.0.

---

## Packages

This monorepo contains three packages published under `@seed-ship/`:

| Package | Version | Description |
|---------|---------|-------------|
| [`@seed-ship/mcp-ui-solid`](./mcp-ui-solid) | 6.16.0 | SolidJS components for rendering MCP-generated UI |
| [`@seed-ship/mcp-ui-spec`](./mcp-ui-spec) | 5.5.0 | JSON schemas and Zod validators |
| [`@seed-ship/mcp-ui-cli`](./mcp-ui-cli) | 5.0.0 | CLI for validation and type generation |

### @seed-ship/mcp-ui-solid

**SolidJS components + chat toolkit for MCP-generated UI**

- **19 component renderers** - chart, table, metric, text, code, map, form, modal, image-gallery, video, iframe, image, link, action, action-group, grid, carousel, artifact, footer
- **Data Verification** - `validateAgainstSource()`, `VerifiedText`, `DataPreviewSection` for anti-hallucination
- **GeoJSON maps** - Choropleth, popups, multi-layer, PMTiles support
- **Chat Bus** (`@experimental`) - Bidirectional event/command bus for agent interactions
- **ChatPrompt** (`@experimental`) - Structured interactions above chat input (choice, confirm, form)
- `UIResourceRenderer` + `StreamingUIRenderer` - Static and SSE-based progressive rendering
- `ExpandableWrapper` - Fullscreen expand for tables, charts, code (DOM reparenting)
- `ComponentToolbar` - Unified toolbar with copy, download, expand, wordwrap actions
- **Tiered iframe sandbox** - `allow-same-origin` only for trusted domains
- **Complete validation** - All 19 types validated, scatter/bubble/time-series chart support
- TypeScript-first, SSR-compatible (SolidStart, Astro)

```bash
pnpm add @seed-ship/mcp-ui-solid
```

### @seed-ship/mcp-ui-spec

**Component registry specification and JSON schemas**

- Zod schemas for MCP UI resources
- TypeScript types generated from schemas
- Validation utilities
- JSON Schema definitions

```bash
pnpm add @seed-ship/mcp-ui-spec
```

### @seed-ship/mcp-ui-cli

**CLI tools for MCP UI development**

- `mcp-ui validate` - Validate component registries
- `mcp-ui generate-types` - Generate TypeScript definitions
- `mcp-ui test-examples` - Test example components

```bash
pnpm add -g @seed-ship/mcp-ui-cli
```

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
        position: { x: 0, y: 0, width: 4, height: 1 }
      },
      {
        type: 'chart',
        id: 'trends',
        chartType: 'line',
        data: { /* chart data */ },
        position: { x: 0, y: 1, width: 8, height: 2 }
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

### Chat Bus — Agent Interactions (`@experimental`)

The Chat Bus provides a bidirectional event/command system for agent-driven chat interactions. The host app keeps full control of its chat UI — the bus adds structured interactivity on top.

```tsx
import { ChatBusProvider, useChatBus, ChatPrompt, createChatBus } from '@seed-ship/mcp-ui-solid'

// 1. Wrap your app with the provider
function App() {
  return (
    <ChatBusProvider>
      <ChatInterface />
      <AgentRouter />
    </ChatBusProvider>
  )
}

// 2. Host app bridges SSE events to the bus
function ChatInterface() {
  const bus = useChatBus()

  // Bridge SSE callbacks → bus events
  onSSEEvent('token', (data) => bus.events.emit('onToken', { streamKey: 'main', token: data.token }))
  onSSEEvent('done', (data) => bus.events.emit('onStreamEnd', { streamKey: 'main', metadata: data }))
  onSSEEvent('ui_layout', (data) => bus.events.emit('onUILayout', { streamKey: 'main', layout: data }))

  // Handle commands from agents
  bus.commands.handle('injectPrompt', (text) => setInputValue(text))
  bus.commands.handle('sendPrompt', (text) => { setInputValue(text); handleSend(); return crypto.randomUUID() })
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

// 3. Agents consume events and emit commands
function AgentRouter() {
  const bus = useChatBus()

  bus.events.on('onStreamEnd', (event) => {
    if (event.metadata.needs_clarification) {
      bus.commands.exec('showChatPrompt', {
        type: 'choice',
        title: 'Which period?',
        config: {
          options: [
            { value: '2024', label: '2024' },
            { value: '2025', label: '2025' },
          ]
        }
      })
    }
  })

  // Throttle onToken for performance (C3)
  bus.events.on('onToken', (event) => {
    updateProgressIndicator(event.token)
  }, { throttle: 100 })

  return null
}
```

### ChatPrompt — Structured Interactions (`@experimental`)

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
  config: {
    message: 'This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Keep',
    variant: 'danger',
  }
}} onSubmit={handleResponse} />

// Form — quick fields with validation
<ChatPrompt config={{
  type: 'form',
  title: 'Additional info',
  config: {
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'select',
        options: [{ label: 'Report', value: 'report' }, { label: 'Invoice', value: 'invoice' }] },
    ],
    submitLabel: 'Send',
  }
}} onSubmit={handleResponse} />
```

### CLI Usage

```bash
# Validate a component registry
mcp-ui validate ./registry.json

# Generate TypeScript types
mcp-ui generate-types ./schemas/

# Test examples
mcp-ui test-examples ./examples/
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      Your Application                             │
│                                                                   │
│   ┌─ Chat Messages ──────────────────────────────────────────┐   │
│   │  Rendered by your app (markdown, citations, etc.)         │   │
│   │  + UIResourceRenderer for MCP components                  │   │
│   └───────────────────────────────────────────────────────────┘   │
│                         ▲ events              commands ▼          │
│   ┌─────────────────────┴──────────────────────┴─────────────┐   │
│   │                    Chat Bus                               │   │
│   │  Events: onToken, onStreamEnd, onUILayout, onBriefing...  │   │
│   │  Commands: injectPrompt, sendPrompt, showChatPrompt...    │   │
│   └───────────────────────────────────────────────────────────┘   │
│                         ▲                      ▼                  │
│   ┌─ ChatPrompt ────────┴──────────────────────┴─────────────┐   │
│   │  Choice buttons | Confirm dialog | Quick form             │   │
│   └───────────────────────────────────────────────────────────┘   │
│   ┌─ Your Chat Input ────────────────────────────────────────┐   │
│   │  Textarea, connectors, modes, voice (you control this)    │   │
│   └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│   ┌─ Agent Layer (your app) ─────────────────────────────────┐   │
│   │  AgentRouter, personas, briefings — consumes bus events   │   │
│   └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘

Packages:
  mcp-ui-solid  ─── Components + Chat Bus + Validation
  mcp-ui-spec   ─── Zod schemas & JSON Schema definitions
  mcp-ui-cli    ─── CLI: validate, generate-types, test-examples
```

## Development

This is a pnpm workspace monorepo:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck
```

### Package Scripts

```bash
pnpm build              # Build all packages
pnpm test               # Test all packages
pnpm clean              # Clean all build artifacts
pnpm version:patch      # Bump patch version
```

## SSR Compatibility

All packages are SSR-compatible. For SolidStart, add to `app.config.ts`:

```typescript
export default defineConfig({
  vite: {
    resolve: {
      conditions: ['solid', 'development', 'browser']
    }
  }
})
```

See [mcp-ui-solid README](./mcp-ui-solid/README.md#ssr-compatibility) for details.

## Roadmap

- [x] **Phase 0**: Renderer foundation
- [x] **Phase 1**: LLM decision engine + registry
- [x] **Phase 2**: Progressive streaming UI with SSE
- [x] **Phase 3**: npm package publication (@seed-ship scope)
- [x] **Phase 4**: SSR compatibility + Production hardening
- [x] **Phase 5**: Advanced components (forms, modals, maps, galleries, video, code)
- [x] **Phase 6**: Chat Bus + ChatPrompt (agent interactions toolkit)
- [x] **Phase 7**: Data Verification Layer + GeoJSON maps + time-series
- [x] **Phase 8**: AITL agent toolkit (agent cards, split steppers, handoffs, briefing diffs)
- [x] **Phase 9**: Prefilled forms + Progressive Parameter Resolution (source badges, `prefillMode: 'resolve'`, `valueFormat`, auto-submit toast)
- [x] **Phase 10**: Table UX polish (context-aware pagination, search filter, sticky header, match highlighting)
- [x] **Phase 11** (v5.0.0): Sprint 52 multi-agent primitives (`clarificationToPromptConfig`, `createMockChatBus`, metadata extension points)
- [x] **Phase 12** (v5.2.0): Multi-instance scratchpad factory (`createScratchpadStore`) + re-entrant `showChatPrompt` (`createChatPromptController`) + AbortSignal wiring
- [x] **v6.x** (post-Phase 12): Visual-renderer & ontology hardening — `graph` (G6), map XSS hardening, quickchart opt-in, renderer fallback ladder (see [`mcp-ui-solid/CHANGELOG.md`](./mcp-ui-solid/CHANGELOG.md))
- [ ] **Phase 13**: Framework adapters (React, Vue, Svelte)

## Links

- **npm**: [@seed-ship/mcp-ui-solid](https://www.npmjs.com/package/@seed-ship/mcp-ui-solid)
- **GitHub**: [theseedship/mcp-ui](https://github.com/theseedship/mcp-ui)

## License

MIT

---

**Built by [The Seed Ship](https://github.com/theseedship)**
