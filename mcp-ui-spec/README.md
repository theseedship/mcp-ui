# @seed-ship/mcp-ui-spec

Component registry specification and validation schemas for MCP UI. Part of the MCP UI ecosystem.

[![npm version](https://img.shields.io/npm/v/@seed-ship/mcp-ui-spec.svg)](https://www.npmjs.com/package/@seed-ship/mcp-ui-spec)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`@seed-ship/mcp-ui-spec` provides the schema definitions and validation utilities for MCP UI component registries. It includes both Zod schemas for runtime validation and JSON Schema for tooling integration.

## Installation

```bash
pnpm add @seed-ship/mcp-ui-spec
```

## Quick Start

### Zod Validation (Recommended)

```typescript
import { ComponentRegistrySchema, ComponentSchema } from '@seed-ship/mcp-ui-spec'

// Validate a full registry
const result = ComponentRegistrySchema.safeParse(myRegistry)
if (!result.success) {
  console.error('Validation errors:', result.error.issues)
}

// Validate a single component
const componentResult = ComponentSchema.safeParse(myComponent)
```

### JSON Schema Validation

```typescript
import registrySchema from '@seed-ship/mcp-ui-spec/schemas/component-registry-v1.json'
import Ajv from 'ajv'

const ajv = new Ajv()
const validate = ajv.compile(registrySchema)

if (!validate(myRegistry)) {
  console.error(validate.errors)
}
```

## Exported Schemas

### Zod Schemas (10 total)

| Schema | Description |
|--------|-------------|
| `ComponentRegistrySchema` | Root registry object with version and components |
| `ComponentSchema` | Individual component definition |
| `ComponentExampleSchema` | Working example for a component |
| `GridPositionSchema` | 12-column grid positioning |
| `SecurityConstraintsSchema` | Security configuration (auth, domains, sandbox) |
| `PerformanceConstraintsSchema` | Performance limits (render time, data size) |
| `ComponentTypeSchema` | Enum of supported component types |
| `SandboxFlagSchema` | Iframe sandbox permissions |
| `RegistryMetadataSchema` | Optional registry metadata |
| `ComponentSchemaSchema` | JSON Schema definition for component params |

### TypeScript Types

All schemas export inferred TypeScript types:

```typescript
import type {
  ComponentRegistry,
  Component,
  ComponentExample,
  GridPosition,
  SecurityConstraints,
  PerformanceConstraints,
  ComponentType,
  SandboxFlag,
  RegistryMetadata
} from '@seed-ship/mcp-ui-spec'
```

## Component Types

The spec supports **11 component types**:

| Type | Description | Renderer |
|------|-------------|----------|
| `chart` | Data visualizations (bar, line, pie, etc.) | ChartRenderer |
| `table` | Tabular data display | TableRenderer |
| `metric` | KPI cards with trends | MetricRenderer |
| `text` | Markdown text blocks | TextRenderer |
| `composite` | Nested component layouts | UIResourceRenderer |
| `image` | Image display with captions | ImageRenderer |
| `link` | External link cards | LinkRenderer |
| `iframe` | Sandboxed embedded content | IframeRenderer |
| `action` | Interactive buttons | ActionRenderer |
| `artifact` | Downloadable files | ArtifactRenderer |
| `carousel` | Scrollable component list | CarouselRenderer |
| `footer` | Metadata display | FooterRenderer |

## Registry Format

```typescript
interface ComponentRegistry {
  version: '1.0.0'
  metadata?: {
    name?: string
    description?: string
    author?: string
    repository?: string  // URL format
  }
  components: Component[]  // At least 1 required
}

interface Component {
  id: string              // kebab-case: /^[a-z0-9-]+$/
  type: ComponentType     // One of 11 types
  name: string
  description?: string
  schema: {               // JSON Schema for params
    type: 'object'
    required: string[]
    properties: Record<string, unknown>
    additionalProperties?: boolean
  }
  examples: ComponentExample[]  // At least 1 required
  security?: SecurityConstraints
  performance?: PerformanceConstraints
  tags?: string[]         // kebab-case tags
  version?: string        // semver: /^\d+\.\d+\.\d+$/
  deprecated?: boolean
  deprecationMessage?: string
}
```

## Features

### Grid Positioning (12-column)

Components support a responsive 12-column grid layout:

```typescript
interface GridPosition {
  colStart: number   // 1-12: starting column
  colSpan: number    // 1-12: columns to span
  rowStart?: number  // Row start (optional)
  rowSpan?: number   // Rows to span (default: 1)
}

// Example: Full-width component
{ colStart: 1, colSpan: 12 }

// Example: Two-column layout
{ colStart: 1, colSpan: 6 }   // Left half
{ colStart: 7, colSpan: 6 }   // Right half
```

### Security Constraints

Configure security requirements per component:

```typescript
interface SecurityConstraints {
  requiresAuth?: boolean           // Default: false
  allowedDomains?: string[]        // Domain whitelist
  maxIframeDepth?: number          // 0-3, default: 1
  sandboxFlags?: SandboxFlag[]     // Iframe permissions
}

type SandboxFlag =
  | 'allow-scripts'
  | 'allow-same-origin'
  | 'allow-forms'
  | 'allow-popups'
  | 'allow-modals'
```

### Performance Constraints

Set performance limits per component:

```typescript
interface PerformanceConstraints {
  maxRenderTime?: number   // Milliseconds, min: 100, default: 5000
  maxDataSize?: number     // Bytes, min: 1024, default: 102400 (100KB)
}
```

### Component Deprecation

Mark components as deprecated with optional migration messages:

```typescript
{
  "id": "old-chart",
  "type": "chart",
  "deprecated": true,
  "deprecationMessage": "Use quickchart-bar instead",
  // ...
}
```

### Component Versioning

Individual components support semantic versioning:

```typescript
{
  "id": "quickchart-bar",
  "version": "2.1.0",
  // ...
}
```

## Example Registry

```json
{
  "version": "1.0.0",
  "metadata": {
    "name": "My Component Registry",
    "description": "Custom MCP UI components",
    "author": "Your Name"
  },
  "components": [
    {
      "id": "quickchart-bar",
      "type": "chart",
      "name": "Bar Chart",
      "description": "Renders a bar chart via QuickChart.io",
      "version": "1.0.0",
      "schema": {
        "type": "object",
        "required": ["labels", "data"],
        "properties": {
          "labels": { "type": "array", "items": { "type": "string" } },
          "data": { "type": "array", "items": { "type": "number" } },
          "title": { "type": "string" }
        }
      },
      "examples": [
        {
          "name": "Simple Bar Chart",
          "description": "A basic bar chart example",
          "params": {
            "labels": ["Q1", "Q2", "Q3", "Q4"],
            "data": [100, 150, 120, 180],
            "title": "Quarterly Revenue"
          },
          "position": { "colStart": 1, "colSpan": 6 }
        }
      ],
      "security": {
        "requiresAuth": false,
        "allowedDomains": ["quickchart.io"]
      },
      "performance": {
        "maxRenderTime": 3000,
        "maxDataSize": 51200
      },
      "tags": ["chart", "visualization", "quickchart"]
    }
  ]
}
```

## Runtime Payload Identity

> **Note** — this section concerns *runtime* payloads (`UILayout` / `UIComponent`
> objects emitted by an LLM and passed to a renderer), distinct from the
> `Component` *registry* definitions documented above. The runtime types live
> in [`@seed-ship/mcp-ui-solid`](../mcp-ui-solid) but the identity contract
> below is part of the spec.

### `id` is obligatoire on well-formed payloads

Every `UILayout` and every `UIComponent` emitted by a producer **MUST** carry
a non-empty string `id`. The id is used by renderers as the `<For>` key, by
host apps for telemetry correlation, and by debug tooling to detect
double-mounts of the same content.

```ts
// ✅ Well-formed
const layout: UILayout = {
  id: 'dashboard-2024-Q3',
  components: [
    { id: 'metric-revenue', type: 'metric', position: {...}, params: {...} },
    { id: 'chart-trend',    type: 'chart',  position: {...}, params: {...} },
  ],
  grid: { columns: 12, gap: '1rem' },
}
```

The id should be **stable across renders for the same logical content** —
NOT a `Date.now()`-derived counter, NOT a `Math.random()` token, NOT a UUID
re-generated per render. A producer that cannot provide a stable id should
either derive one from the content hash or omit the field entirely (see
fallback policy below).

### Fallback policy for "bare" payloads

Renderers MUST gracefully accept payloads without an `id` (e.g. a producer
emitting a chart config directly, or a host app pre-shaping a third-party
JSON response). When `id` is missing or empty, the renderer **MUST** derive
a stable key from the content itself — typically a hash of the normalized
payload — and **MUST NOT** generate a timestamp- or counter-based identifier
that would change on every render.

`@seed-ship/mcp-ui-solid` exports the canonical implementation as
`getUiResourceStableKey(content): string` :

- If `content.id` is a non-empty string → returned verbatim
- Otherwise → FNV-1a hash of the content with `id` and `metadata.generatedAt`
  stripped (the timestamp is excluded so the key is stable across re-emissions
  of the same logical layout)

Host apps that pre-process payloads before passing them to a renderer (e.g.
to wrap a bare chart config into a layout) should reuse this helper so the
keys they produce match what the renderer would compute internally.

```ts
import { getUiResourceStableKey } from '@seed-ship/mcp-ui-solid'

const key = getUiResourceStableKey(barePayload)
// → 'dashboard-2024-Q3' (passthrough)  or  'a4f3b91' (FNV-1a, 7 chars base36)
```

### Why this matters

Without a stable identity contract :

- `<For>` reconciliation re-mounts components on every render, blowing away
  internal state (chart instances, expanded rows, scroll position).
- Double-mount detection is impossible — the same logical content gets a
  new key every render and any registry-based guard sees only "new" entries.
- Cross-instance telemetry can't correlate events to a specific layout.

These are framework-parent concerns that cannot be papered over by the
renderer alone — the spec calls them out so producers and host apps wire
identity correctly upstream.

## Related Packages

| Package | Description |
|---------|-------------|
| [`@seed-ship/mcp-ui-solid`](../mcp-ui-solid) | SolidJS UI components |
| [`@seed-ship/mcp-ui-cli`](../mcp-ui-cli) | CLI for validation and type generation |

## Versioning

This package follows [Semantic Versioning](https://semver.org/). See [CHANGELOG.md](./CHANGELOG.md) for release notes.

**Current Version:** 1.1.0

## License

MIT
