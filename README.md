# MCP UI Components

> **UI component library for Model Context Protocol (MCP) servers**

A collection of TypeScript packages for building generative, streaming user interfaces powered by MCP servers and LLMs.

[![npm version](https://img.shields.io/npm/v/@seed-ship/mcp-ui-solid.svg)](https://www.npmjs.com/package/@seed-ship/mcp-ui-solid)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What's New in v2.2.x

- **ExpandableWrapper** - Generic fullscreen expand for tables, charts, and code blocks (DOM reparenting, no duplication)
- **Table Export** - CSV/TSV/JSON download dropdown with configurable formats and filename
- **Chart Export** - PNG download via `canvas.toDataURL` + configurable chart height
- **CodeBlock Improvements** - Word wrap toggle, filename header bar
- **HTML in Table Cells** - Raw HTML links and citation attributes preserved via DOMPurify sanitization
- **Lenient Validation** - Known component types without registry entries pass with warnings, typos still rejected

See [CHANGELOG.md](./CHANGELOG.md) for full details.

---

## Packages

This monorepo contains three packages published under `@seed-ship/`:

| Package | Version | Description |
|---------|---------|-------------|
| [`@seed-ship/mcp-ui-solid`](./mcp-ui-solid) | 2.2.4 | SolidJS components for rendering MCP-generated UI |
| [`@seed-ship/mcp-ui-spec`](./mcp-ui-spec) | 2.0.0 | JSON schemas and Zod validators |
| [`@seed-ship/mcp-ui-cli`](./mcp-ui-cli) | 2.0.0 | CLI for validation and type generation |

### @seed-ship/mcp-ui-solid

**SolidJS components for rendering MCP-generated UI**

- `UIResourceRenderer` - Render static and composite MCP resources
- `StreamingUIRenderer` - Progressive streaming UI with SSE
- Error boundaries and fallback handling
- TypeScript-first with full type safety
- **SSR-compatible** with SolidStart, Astro, etc.

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
┌────────────────────────────────────────────────────────────────┐
│                     MCP UI Ecosystem                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌──────────────────┐    ┌──────────────────┐                │
│   │  mcp-ui-solid    │    │  Your MCP Server │                │
│   │  (SolidJS UI)    │◄───│  (generates UI)  │                │
│   └────────┬─────────┘    └──────────────────┘                │
│            │                                                   │
│            ▼                                                   │
│   ┌──────────────────┐                                        │
│   │  mcp-ui-spec     │  ◄── Shared schemas & types            │
│   │  (Zod + JSON)    │                                        │
│   └────────┬─────────┘                                        │
│            │                                                   │
│            ▼                                                   │
│   ┌──────────────────┐                                        │
│   │  mcp-ui-cli      │  ◄── Validation & code generation      │
│   │  (CLI tools)     │                                        │
│   └──────────────────┘                                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
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
- [ ] **Phase 6**: Framework adapters (React, Vue, Svelte)

## Links

- **npm**: [@seed-ship/mcp-ui-solid](https://www.npmjs.com/package/@seed-ship/mcp-ui-solid)
- **GitHub**: [theseedship/mcp-ui](https://github.com/theseedship/mcp-ui)

## License

MIT

---

**Built by [The Seed Ship](https://github.com/theseedship)**
