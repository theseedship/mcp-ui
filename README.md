# MCP UI Components

> **UI component library for Model Context Protocol (MCP) servers**

A collection of TypeScript packages for building generative, streaming user interfaces powered by MCP servers and LLMs.

[![npm version](https://img.shields.io/npm/v/@seed-ship/mcp-ui-solid.svg)](https://www.npmjs.com/package/@seed-ship/mcp-ui-solid)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What's New

**6.21.0 (`mcp-ui-solid`):** The library's iframes now work on a host serving
`Cross-Origin-Embedder-Policy: credentialless`. The `iframe` component and
`VideoRenderer`'s YouTube / Vimeo embed carry the boolean `credentialless`
attribute whenever their host is **not** in `TRUSTED_IFRAME_DOMAINS` — trusted
hosts deliberately keep their cookies and stay blocked under COEP rather than
render a login screen. A new `<MCPUIConfigProvider>` (`iframeCredentialless`,
`customTrustedIframeDomains`, `iframeFallbackLink`) lets a host override all
of it, a new `isTrustedIframeDomain()` export exposes the decision, and a new
`iframeOpenInNewTab` chrome string labels the "open in a new tab" link shown
under an embed COEP may have blocked silently. Chrome/Edge 110+ honour the
attribute, Firefox ignores it, Safari ignores the COEP value entirely. Also
fixed: `IframeRenderer` called `getIframeSandbox()` without options, so a
host's custom trusted domains never reached the sandbox.

**6.20.0 (`mcp-ui-solid`):** Every user-visible chrome string now reads from
`MCPUIStrings` (components, via `useMCPUIStrings()`) or an exported
`messages`/`labels` option (runtime-free adapters, services, helpers), except
the exclusion policy in `mcp-ui-solid/CHANGELOG.md` (P1–P8: keyboard key caps,
the OpenStreetMap attribution, developer/peer-dependency diagnostics,
file-format acronyms and HTTP verbs,
components with their own `labels`/`messages` prop, hook-level errors and
`console.*`, and LLM-facing registry examples), plus a new exported
`formatMCPUIString()` helper for hosts that render their own chrome and a
new `messages` option on `connectorResultToUILayout()` for the connector
adapter's own degraded-state text. `MCPUIStrings` now covers 270 keys in
total, and the runtime-free helpers (`macroRunToScratchpadState`,
`validateFieldValue` / `validateFormData`, the degraded-table projections and
`chartToDataTable`) take their English as a trailing optional `messages` /
`labels` parameter with an exported default table. `PresentationFeedback`
stays localizable through its own documented `labels` prop. Five chrome defaults change from French to English for hosts with
no `MCPUIStringsProvider` mounted:
`tableSearchPlaceholder` (`"Rechercher dans le tableau..."` →
`"Search the table..."`), `verifiedStripLabel` (`"[non vérifié]"` →
`"[unverified]"`), `scratchpadEdit` (`"Modifier"` → `"Edit"`),
`citationUnresolved` (`"[réf. {id}]"` → `"[ref. {id}]"`), and
`formPrefilledOne`/`formPrefilledMany` (`"{count} champ(s) pré-rempli(s) sur
{total}"` → `"{count} field(s) pre-filled out of {total}"`); the connector
adapter's degraded-state text also moves from French to English
(`DEFAULT_CONNECTOR_MESSAGES`, overridable via the new `messages` option).
Number / date formatting and sorting now follow the new `locale` key
(default `'en-US'`; previously `'fr-FR'` / `'fr'` or the runtime locale).
See
[`mcp-ui-solid/README.md`](./mcp-ui-solid/README.md#internationalization-i18n--mcpuistrings)
for the full key table and a French example dictionary, and
[`mcp-ui-solid/CHANGELOG.md`](./mcp-ui-solid/CHANGELOG.md) for details.

**6.19.1 (`mcp-ui-solid`):** `FeedbackInline` accessible names now follow `MCPUIStringsProvider` (were hardcoded English).

**6.19.0 (`mcp-ui-solid`) / 5.0.1 (`mcp-ui-cli`) — sanitization, a11y & packaging:**
`sanitizeHtml()` is now the single sanitizer for every sink that carries
untrusted markup (the `text` component, table cells, `ui://` resources),
closing a raw-markup gap in the `text` component's non-markdown path (the
`code` component's own `<code innerHTML>` sink binds highlight.js output or
`escapeHtml()`'d source directly, not through `sanitizeHtml()`). Documented
SSR contract: on the server the sink emits `escapeHtml()`'d text — for the
`text` component specifically, the escaped **markdown source** — and block
structure (tables, lists, headings) appears only after the client upgrades to
sanitized rich HTML on mount, so the region reflows post-hydration. Accessible
table pagination (`data-mcp-ui-action="page-prev" | "page-next" | "page-size"`)
and labeled grid regions, stable `data-mcp-ui-portal` hooks, a new
dependency-free `@seed-ship/mcp-ui-solid/adapters/presentation` subpath, and a
much smaller published package (the npm tarball shrank from 39.8 MB / 5428
files to 5.6 MB unpacked / 671 files, 1.3 MB packed; `solid-js` is a required
peer again — pnpm/npm 7+ auto-install it). `mcp-ui-cli` 5.0.1 fixes a
`workspace:*` spec pin that could pull a duplicate `@seed-ship/mcp-ui-spec`
alongside `mcp-ui-solid`. See
[`mcp-ui-solid/CHANGELOG.md`](./mcp-ui-solid/CHANGELOG.md) and
[`mcp-ui-cli/CHANGELOG.md`](./mcp-ui-cli/CHANGELOG.md) for details.

**6.18.0 — presentation foundations:** three opt-in composition helpers
(comparison, geography, evidence), container-responsive read-only grids,
native chart/data switching, and chart/table/graph catalogue parity.
See the [integration handoff](./mcp-ui-solid/docs/briefs/VISUALIZATION-FOUNDATION-2026-09-14.md).
This work does not add automatic MCP selection or shared host filters.

**Current line — `mcp-ui-solid` 6.21.0** (post-`5.0.0`, audit-driven visual-renderer
& streaming hardening; `mcp-ui-spec` 5.6.0). Highlights from 6.18.0 — see
[`mcp-ui-solid/CHANGELOG.md`](./mcp-ui-solid/CHANGELOG.md) for the full list
including 6.19.0:

- **`graph` primitive** — node-link visualization powered by `@antv/g6` (peer-optional), first-class in the `UIComponent` params union.
- **Renderer fallback ladder** — no silent blanks: a failed heavy renderer degrades to a local data table + visible notice, and an unknown component type shows an explicit "Unsupported component type" notice.
- **Security hardening** — map popups/tooltips escaped by default (`allowHtmlPopups` is a host opt-in) and the external quickchart.io chart fallback is now an explicit host opt-in (`allowQuickchartFallback`, default off).
- **Map contract parity** — public map coordinates accept `[lat, lng]` or `{ lat, lng }`; the component registry now advertises the complete GeoJSON, layer, clustering and PMTiles contract.
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

Maintainers: GitHub Actions **stages** new npm versions; a successful workflow
does not make them public. Approve them in npmjs.com **Staged Packages** with
2FA, Spec before Solid. See [npm release instructions](./.github/NPM_SETUP.md)
for token setup, tags, and recovery of an interrupted release.

This monorepo contains three packages published under `@seed-ship/`:

| Package | Version | Description |
|---------|---------|-------------|
| [`@seed-ship/mcp-ui-solid`](./mcp-ui-solid) | 6.21.0 | SolidJS components for rendering MCP-generated UI |
| [`@seed-ship/mcp-ui-spec`](./mcp-ui-spec) | 5.6.0 | JSON schemas and Zod validators |
| [`@seed-ship/mcp-ui-cli`](./mcp-ui-cli) | 5.0.1 | CLI for validation and type generation |

### @seed-ship/mcp-ui-solid

**SolidJS components + chat toolkit for MCP-generated UI**

- **20 component renderers** - chart, table, metric, text, code, map, graph, form, modal, image-gallery, video, iframe, image, link, action, action-group, grid, carousel, artifact, footer
- **Data Verification** - `validateAgainstSource()`, `VerifiedText`, `DataPreviewSection` for anti-hallucination
- **OpenStreetMap + GeoJSON maps** - OSM base map, choropleth, popups, multi-layer, PMTiles support
- **Chat Bus** (`@experimental`) - Bidirectional event/command bus for agent interactions
- **ChatPrompt** (`@experimental`) - Structured interactions above chat input (choice, confirm, form)
- `UIResourceRenderer` + `StreamingUIRenderer` - Static and SSE-based progressive rendering
- `ExpandableWrapper` - Fullscreen expand for tables, charts, code (DOM reparenting)
- `ComponentToolbar` - Unified toolbar with copy, download, expand, wordwrap actions
- **Tiered iframe sandbox** - `allow-same-origin` only for trusted domains
- **Complete validation** - All 20 renderer types validated, scatter/bubble/time-series chart support
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

`mcp-ui-solid`'s published `dist/` is a DOM (client) Solid build; importing it
on a server throws "Client-only API called on the server side." SSR is
supported when the host instead compiles the package from `src/` via the
`solid` export condition (`vite-plugin-solid`) and lists it in
`ssr.noExternal`. For SolidStart, add to `app.config.ts`:

```typescript
export default defineConfig({
  vite: {
    resolve: {
      conditions: ['solid', 'development', 'browser']
    },
    ssr: { noExternal: ['@seed-ship/mcp-ui-solid'] }
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
