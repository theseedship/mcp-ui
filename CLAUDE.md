# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP UI is a monorepo containing TypeScript packages for building generative, streaming UI components powered by Model Context Protocol (MCP) servers and LLMs. Packages are published under the `@seed-ship/` npm scope.

## Commands

### Development
```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm dev              # Watch mode for all packages
pnpm test             # Run all tests
pnpm test:watch       # Watch mode for tests
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint
pnpm format           # Prettier formatting
```

### Single Package Operations
```bash
pnpm --filter @seed-ship/mcp-ui-solid test       # Test specific package
pnpm --filter @seed-ship/mcp-ui-spec test:watch  # Watch tests for package
pnpm build:spec       # Build only spec package
pnpm build:solid      # Build only solid package
pnpm build:cli        # Build only CLI package
```

### CLI Tool
```bash
mcp-ui validate <file>                    # Validate component registry
mcp-ui generate-types <input> [output]    # Generate TypeScript from registry
mcp-ui test-examples <file>               # Test registry examples
mcp-ui diff <old> <new>                   # Compare registry versions
```

## Architecture

### Package Structure (pnpm workspace)
```
mcp-ui-spec/     → @seed-ship/mcp-ui-spec   - Zod schemas, JSON schemas, types
mcp-ui-solid/    → @seed-ship/mcp-ui-solid  - SolidJS UI components
mcp-ui-cli/      → @seed-ship/mcp-ui-cli    - CLI tools (depends on spec)
```

### Data Flow
1. **mcp-ui-spec** defines Zod schemas for component validation (ComponentTypeSchema, GridPositionSchema, ComponentRegistrySchema, etc.)
2. **mcp-ui-solid** provides SolidJS renderers that consume components matching those schemas
3. **mcp-ui-cli** uses spec schemas to validate registries and generate TypeScript types

### Component Types
Components are defined in `mcp-ui-spec/src/schemas/index.ts` and rendered by `mcp-ui-solid`:
- `chart`, `table`, `metric`, `text` - Data display
- `composite`, `grid` - Layout containers
- `iframe`, `image`, `link` - Media/navigation
- `action` - Tool call buttons
- `footer`, `carousel`, `artifact` - Specialized displays

### Key Renderers (mcp-ui-solid)
- `UIResourceRenderer` - Static rendering of UILayout/UIComponent
- `StreamingUIRenderer` - SSE-based progressive rendering with streaming hooks
- `GridRenderer` - Nested 12-column CSS Grid layouts
- `ActionRenderer` - Tool call action buttons with MCPActionContext

### Grid System
Uses a 12-column CSS Grid layout. Components specify position via:
```typescript
interface GridPosition {
  colStart: number  // 1-12
  colSpan: number   // 1-12
  rowStart?: number
  rowSpan?: number
}
```

## Conventions

- Commit messages follow Conventional Commits: `type(scope): description`
- Scopes: `solid`, `spec`, `cli`, `docs`, `ci`
- All packages support ESM and CommonJS dual exports
- SSR-compatible (tested with SolidStart, Astro)
