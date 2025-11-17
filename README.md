# MCP UI Components

> **Official UI component library for Model Context Protocol (MCP) servers**

A collection of TypeScript packages for building generative, streaming user interfaces powered by MCP servers and LLMs.

[![npm version](https://img.shields.io/npm/v/@mcp-ui/solid.svg)](https://www.npmjs.com/package/@mcp-ui/solid)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📦 Packages

This monorepo contains three packages:

### [@mcp-ui/solid](./mcp-ui-solid)
**SolidJS components for rendering MCP-generated UI**
- 🎨 `UIResourceRenderer` - Render static and composite MCP resources
- 📡 `StreamingUIRenderer` - Progressive streaming UI with SSE
- 🛡️ Error boundaries and fallback handling
- 🎯 TypeScript-first with full type safety

```bash
npm install @mcp-ui/solid
```

### [@mcp-ui/spec](./mcp-ui-spec)
**Component registry specification and JSON schemas**
- 📋 Zod schemas for MCP UI resources
- 🔍 TypeScript types generated from schemas
- ✅ Validation utilities
- 📖 JSON Schema definitions

```bash
npm install @mcp-ui/spec
```

### [@mcp-ui/cli](./mcp-ui-cli)
**CLI tools for MCP UI development**
- ✨ `mcp-ui validate` - Validate component registries
- 🔧 `mcp-ui generate-types` - Generate TypeScript definitions
- 🧪 `mcp-ui test-examples` - Test example components
- 📊 `mcp-ui diff` - Detect breaking changes

```bash
npm install -g @mcp-ui/cli
```

## 🚀 Quick Start

### Using with SolidJS

```tsx
import { UIResourceRenderer } from '@mcp-ui/solid';
import type { UIResource } from '@mcp-ui/spec';

function MyComponent() {
  const resource: UIResource = {
    type: 'composite',
    layout: 'grid',
    components: [
      {
        type: 'chart',
        chartType: 'line',
        data: { /* ... */ }
      }
    ]
  };

  return <UIResourceRenderer resource={resource} />;
}
```

### Streaming UI with SSE

```tsx
import { StreamingUIRenderer } from '@mcp-ui/solid';

function StreamingDemo() {
  return (
    <StreamingUIRenderer
      endpoint="/api/mcp/generative-ui-stream"
      onComplete={(resources) => console.log('Rendered:', resources)}
    />
  );
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

# Check for breaking changes
mcp-ui diff v1.0.0 v2.0.0
```

## 🏗️ Development

This is a pnpm workspace monorepo. To get started:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Watch mode for development
pnpm dev

# Type checking
pnpm typecheck

# Lint all packages
pnpm lint
```

### Package Scripts

Each package has the following scripts:
- `pnpm build` - Build production bundle
- `pnpm dev` - Watch mode for development
- `pnpm test` - Run unit tests
- `pnpm typecheck` - TypeScript type checking
- `pnpm lint` - ESLint checking
- `pnpm clean` - Remove build artifacts

### Monorepo Scripts

Root-level commands that run across all packages:

```bash
pnpm build              # Build all packages
pnpm build:spec         # Build only @mcp-ui/spec
pnpm build:cli          # Build only @mcp-ui/cli
pnpm build:solid        # Build only @mcp-ui/solid
pnpm test               # Test all packages
pnpm clean              # Clean all build artifacts
pnpm publish:all        # Publish all packages to npm
pnpm publish:dry        # Dry run publish
pnpm version:patch      # Bump patch version
pnpm version:minor      # Bump minor version
pnpm version:major      # Bump major version
```

## 📚 Documentation

- **[Architecture Overview](./docs/ARCHITECTURE.md)** - System design and patterns
- **[Component Registry Spec](./mcp-ui-spec/README.md)** - Registry format and schemas
- **[SolidJS Components](./mcp-ui-solid/README.md)** - Component API reference
- **[CLI Reference](./mcp-ui-cli/README.md)** - Command-line tool docs

## 🔧 Integration Examples

### Deposium Integration

This library was originally developed for the Deposium MCP server. See the integration guide:

```typescript
// In your MCP server
import { validateRegistry } from '@mcp-ui/spec';

const registry = await loadComponentRegistry();
const validation = validateRegistry(registry);

if (!validation.valid) {
  throw new Error(`Invalid registry: ${validation.errors}`);
}
```

### Custom MCP Server

```typescript
import { ComponentRegistry } from '@mcp-ui/spec';
import type { UIResource } from '@mcp-ui/spec';

const registry: ComponentRegistry = {
  version: '1.0.0',
  components: [
    {
      type: 'chart',
      name: 'sales-chart',
      // ... component definition
    }
  ]
};
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm test`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `test:` - Test updates
- `refactor:` - Code refactoring

## 📄 License

MIT © TSS

See [LICENSE](./LICENSE) for details.

## 🔗 Links

- **GitHub**: [theseedship/mcp-ui](https://github.com/theseedship/mcp-ui)
- **npm**: [@mcp-ui/*](https://www.npmjs.com/search?q=%40mcp-ui)
- **Issues**: [GitHub Issues](https://github.com/theseedship/mcp-ui/issues)
- **Discussions**: [GitHub Discussions](https://github.com/theseedship/mcp-ui/discussions)

## 🌟 Roadmap

- [x] Phase 0: Renderer foundation with feature flags
- [x] Phase 1: LLM decision engine + registry
- [x] Phase 2: Progressive streaming UI with SSE
- [x] Phase 3: Package migration to npm
- [ ] Phase 4: Production hardening & E2E tests
- [ ] Phase 5: Advanced components (forms, tables, visualizations)
- [ ] Phase 6: Framework adapters (React, Vue, Svelte)

## 💡 Philosophy

MCP UI is designed around these principles:

1. **Type Safety** - TypeScript-first with runtime validation
2. **Framework Agnostic Core** - Spec package works everywhere
3. **Progressive Enhancement** - Streaming UI with graceful fallbacks
4. **Developer Experience** - Great DX with CLI tools and clear APIs
5. **Security First** - CSP-compliant, iframe sandboxing, validation

---

**Built with ❤️ by [The Seed Ship](https://github.com/theseedship)**
