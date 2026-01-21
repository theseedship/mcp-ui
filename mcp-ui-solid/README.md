# @seed-ship/mcp-ui-solid

SolidJS components for rendering MCP-generated UI resources. Part of the MCP UI ecosystem.

[![npm version](https://img.shields.io/npm/v/@seed-ship/mcp-ui-solid.svg)](https://www.npmjs.com/package/@seed-ship/mcp-ui-solid)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What's New in v2.0.0

### Highlights

- **Configurable Iframe Whitelist** - Control iframe security with `IframePolicy`: `strict`, `extend`, or `allow-all`
- **60+ Whitelisted Domains** - Expanded default whitelist for business use cases
- **New Component Types** - Forms, Modals, Action Groups, Image Gallery, Video, Code, Map
- **Table Virtualization** - Handle 10,000+ rows with smooth scrolling
- **Map Clustering** - Auto-cluster markers for large datasets
- **Native Chart.js Support** - Optional direct Chart.js rendering (no iframe)

### Configurable Iframe Security

```typescript
import { validateComponent, DEFAULT_IFRAME_DOMAINS } from '@seed-ship/mcp-ui-solid'

// Default: strict whitelist
validateComponent(component)

// Extend whitelist with custom domains
validateComponent(component, {
  iframePolicy: 'extend',
  customIframeDomains: ['my-trusted-site.com']
})

// Disable whitelist (use with caution)
validateComponent(component, { iframePolicy: 'allow-all' })

// View default whitelist
console.log(DEFAULT_IFRAME_DOMAINS)
```

### Whitelisted Domains (v2.0.0)

| Category | Domains |
|----------|---------|
| **Video** | youtube.com, vimeo.com, loom.com, cloudflarestream.com, streamable.com |
| **Diagrams** | mermaid.live, excalidraw.com, lucidchart.com, figma.com, miro.com |
| **Code** | github.com, gitlab.com, codepen.io, codesandbox.io, stackblitz.com, replit.com |
| **Google** | docs, sheets, slides, drive, maps, datastudio, lookerstudio |
| **Business** | notion.so, airtable.com, calendly.com, typeform.com, cal.com |
| **Analytics** | tableau.com, powerbi.com, observablehq.com |
| **Design** | canva.com, figma.com |
| **Maps** | maps.google.com, openstreetmap.org |
| **Previews** | vercel.app, netlify.app |
| **E-commerce** | amazon.com, amazon.fr, amazon.de, amazon.co.uk, etc. |

---

## Overview

`@seed-ship/mcp-ui-solid` provides a complete rendering solution for MCP (Model Context Protocol) generated UIs. It enables AI/LLM systems to generate structured, interactive dashboards that are rendered with SolidJS.

**Key Use Cases:**
- Render AI-generated dashboards and reports
- Display streaming UI components progressively
- Build interactive data visualizations from MCP resources

## Installation

```bash
pnpm add @seed-ship/mcp-ui-solid
# or
npm install @seed-ship/mcp-ui-solid
```

**Peer Dependencies:**
- `solid-js` ^1.9.0

## Quick Start

```tsx
import { UIResourceRenderer, StreamingUIRenderer } from '@seed-ship/mcp-ui-solid'

// Static rendering of a pre-built layout
function Dashboard() {
  const layout = {
    id: 'dashboard-1',
    type: 'composite',
    components: [
      {
        type: 'metric',
        id: 'revenue',
        title: 'Total Revenue',
        value: '$125,430',
        trend: { direction: 'up', value: '+12%' },
        position: { x: 0, y: 0, width: 4, height: 1 }
      },
      {
        type: 'chart',
        id: 'sales-chart',
        chartType: 'line',
        data: { /* chart data */ },
        position: { x: 0, y: 1, width: 8, height: 2 }
      }
    ]
  }

  return <UIResourceRenderer content={layout} />
}

// Streaming rendering from an MCP server
function StreamingDashboard() {
  return (
    <StreamingUIRenderer
      query="Show me quarterly revenue trends"
      spaceIds={['analytics-space']}
      onComplete={(metadata) => console.log('Render complete', metadata)}
      onError={(error) => console.error('Render failed', error)}
    />
  )
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your SolidJS App                         │
├─────────────────────────────────────────────────────────────┤
│  UIResourceRenderer        │  StreamingUIRenderer           │
│  (static layouts)          │  (progressive SSE streaming)   │
├─────────────────────────────────────────────────────────────┤
│                    Component Registry                       │
│  ┌─────────┬─────────┬────────┬──────────┬───────────────┐ │
│  │ Chart   │ Table   │ Metric │ Text     │ Image/Link... │ │
│  │Renderer │Renderer │Renderer│Renderer  │ Renderers     │ │
│  └─────────┴─────────┴────────┴──────────┴───────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Validation │ Error Boundaries │ Grid Layout (12-col)       │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Core Renderers

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `UIResourceRenderer` | Static layout rendering | `content`, `className` |
| `StreamingUIRenderer` | Progressive SSE streaming | `query`, `spaceIds`, `onComplete`, `onError` |
| `GenerativeUIErrorBoundary` | Error isolation with retry | `fallback`, `onError` |

### Data Display Renderers

| Component | Type | Description |
|-----------|------|-------------|
| `ChartRenderer` | `chart` | Line, bar, pie, area charts (Chart.js) |
| `TableRenderer` | `table` | Data tables with sorting, markdown links |
| `MetricRenderer` | `metric` | KPI cards with trends and sparklines |
| `TextRenderer` | `text` | Markdown-enabled text blocks |
| `ImageRenderer` | `image` | Responsive images with lazy loading |
| `LinkRenderer` | `link` | External links with security attributes |
| `IframeRenderer` | `iframe` | Secure iframe embedding (sandboxed) |

### Layout Renderers

| Component | Type | Description |
|-----------|------|-------------|
| `GridRenderer` | `grid` | **NEW v1.2.0** - Nested CSS Grid layouts for complex dashboards |

### Interactive Renderers

| Component | Type | Description |
|-----------|------|-------------|
| `ActionRenderer` | `action` | Interactive buttons with MCP tool calls |
| `ArtifactRenderer` | `artifact` | File download/preview |
| `CarouselRenderer` | `carousel` | Image/content carousel |
| `FooterRenderer` | `footer` | Metadata and attribution display (auto-injected)

## Exports

### Main Export

```typescript
import {
  UIResourceRenderer,
  StreamingUIRenderer,
  GenerativeUIErrorBoundary,
  // Individual renderers
  ChartRenderer,
  TableRenderer,
  MetricRenderer,
  TextRenderer,
  ActionRenderer,
  // ...
} from '@seed-ship/mcp-ui-solid'
```

### Hooks

```typescript
import { useStreamingUI, useAction, useToolAction } from '@seed-ship/mcp-ui-solid'

// Streaming hook
const { components, isComplete, error, metadata } = useStreamingUI({
  query: 'Show revenue data',
  spaceIds: ['space-1']
})

// Action hooks (NEW v1.2.0)
const { execute, isExecuting, lastError } = useAction()
await execute('search.hub', { query: 'revenue Q4' })

// Bound to specific tool
const { execute: searchExecute } = useToolAction('search.hub')
await searchExecute({ query: 'test' })
```

### Context Provider (NEW v1.2.0)

```typescript
import { MCPActionProvider, useMCPAction } from '@seed-ship/mcp-ui-solid'

// Wrap your app to enable typed action dispatch
function App() {
  return (
    <MCPActionProvider
      spaceIds={['space-123']}
      macroId="dashboard_template"
      onAction={(req, res) => auditLog(req, res)}
      onWebhook={(event) => triggerN8n(event)}
    >
      <UIResourceRenderer content={layout} />
    </MCPActionProvider>
  )
}

// Inside any component
function ActionButton() {
  const { executeAction, isExecuting } = useMCPAction()

  return (
    <button
      onClick={() => executeAction({ toolName: 'search.hub', params: { query: 'test' } })}
      disabled={isExecuting()}
    >
      Search
    </button>
  )
}
```

### Validation (SSR-Safe)

```typescript
// Safe to import on server - no browser APIs
import { validateUIResource, validateLayout } from '@seed-ship/mcp-ui-solid/validation'

const result = validateUIResource(resource)
if (!result.valid) {
  console.error(result.errors)
}
```

### Types Only (SSR-Safe)

```typescript
// Type-only imports - no runtime code
import type { UIResource, UIComponent, GridPosition } from '@seed-ship/mcp-ui-solid/types-only'
```

## SSR Compatibility

This package is fully SSR-compatible with SolidStart, Astro, and other SSR frameworks.

### For SolidStart Users

Add `conditions` to your `app.config.ts` for optimal SSR behavior:

```typescript
// app.config.ts
import { defineConfig } from '@solidjs/start/config'

export default defineConfig({
  vite: {
    resolve: {
      conditions: ['solid', 'development', 'browser']
    }
  }
})
```

### Why This Matters

The `"solid"` condition enables Vite to use source exports, which are compiled in the same context as your app. This prevents:
- Hydration mismatches between server and client
- Module resolution conflicts with `solid-js/web`
- SSR crashes from client-only APIs

### SSR-Safe Imports

For server-side code, use the dedicated sub-exports:

```typescript
// Server-side file (.server.ts)
import type { UIResource } from '@seed-ship/mcp-ui-solid/types-only'
import { validateUIResource } from '@seed-ship/mcp-ui-solid/validation'

// These imports don't trigger browser APIs
```

## Grid System

Components use a 12-column responsive grid:

```typescript
interface GridPosition {
  x: number      // Column start (0-11)
  y: number      // Row start
  width: number  // Columns span (1-12)
  height: number // Rows span
}

// Example: Full-width header
{ x: 0, y: 0, width: 12, height: 1 }

// Example: Two columns
{ x: 0, y: 1, width: 6, height: 2 }  // Left half
{ x: 6, y: 1, width: 6, height: 2 }  // Right half
```

## Advanced Usage

### Nested Grid Layouts (NEW v1.2.0)

Use `GridRenderer` for complex dashboard layouts:

```typescript
const dashboardLayout = {
  id: 'dashboard',
  type: 'grid',
  params: {
    columns: 12,
    gap: '1rem',
    areas: [
      ['header', 'header', 'header'],
      ['sidebar', 'main', 'main'],
      ['footer', 'footer', 'footer']
    ],
    children: [
      { id: 'nav', type: 'text', params: { content: 'Navigation' }, position: { colStart: 1, colSpan: 3 } },
      { id: 'content', type: 'chart', params: { /* ... */ }, position: { colStart: 4, colSpan: 9 } }
    ]
  }
}
```

### Auto-Footer (NEW v1.2.0)

Footers are automatically injected when `layout.metadata` contains execution info:

```typescript
const layout = {
  id: 'report',
  components: [/* ... */],
  metadata: {
    executionTime: 1234,      // Shows "1234ms"
    sourceCount: 5,           // Shows "5 sources"
    llmModel: 'gpt-4',        // Shows model name
    // hideFooter: true       // Opt-out of auto-footer
  }
}
// Footer automatically added showing "Powered by Deposium | 1234ms | gpt-4 | 5 sources"
```

### Custom Component Registry

```typescript
import { registerComponent } from '@seed-ship/mcp-ui-solid'

// Register a custom renderer
registerComponent('custom-widget', (props) => {
  return <div class="custom-widget">{props.content}</div>
})
```

### Error Handling

```tsx
import { GenerativeUIErrorBoundary } from '@seed-ship/mcp-ui-solid'

<GenerativeUIErrorBoundary
  fallback={(error, reset) => (
    <div>
      <p>Something went wrong: {error.message}</p>
      <button onClick={reset}>Try Again</button>
    </div>
  )}
  onError={(error) => {
    // Log to error tracking service
    Sentry.captureException(error)
  }}
>
  <UIResourceRenderer content={layout} />
</GenerativeUIErrorBoundary>
```

### Streaming with Custom SSE Endpoint

```tsx
import { useStreamingUI } from '@seed-ship/mcp-ui-solid/hooks'

function CustomStreaming() {
  const { components, isComplete } = useStreamingUI({
    endpoint: '/api/custom-mcp/stream',
    query: 'Generate report',
    headers: {
      'Authorization': 'Bearer token'
    }
  })

  return (
    <div>
      {components().map(comp => (
        <UIResourceRenderer content={comp} />
      ))}
    </div>
  )
}
```

## Related Packages

| Package | Description |
|---------|-------------|
| [`@seed-ship/mcp-ui-spec`](../mcp-ui-spec) | JSON schemas and Zod validators |
| [`@seed-ship/mcp-ui-cli`](../mcp-ui-cli) | CLI for validation and type generation |

## Versioning

This package follows [Semantic Versioning](https://semver.org/). See [CHANGELOG.md](./CHANGELOG.md) for release notes.

**Current Version:** 2.0.1

## License

MIT
