# @mcp-ui/cli

CLI tools for validating and generating MCP UI component registries.

## Installation

```bash
pnpm add -D @mcp-ui/cli
```

## Commands

### Validate Registry

```bash
mcp-ui validate registry.json
```

Validates a component registry against the JSON Schema specification.

### Generate TypeScript Types

```bash
mcp-ui generate-types registry.json --output types/
```

Generates TypeScript type definitions from a component registry.

### Test Examples

```bash
mcp-ui test-examples registry.json
```

Validates all component examples in the registry.

### Create Component

```bash
mcp-ui create-component quickchart-line
```

Creates a new component template.

### Check Breaking Changes

```bash
mcp-ui diff registry-old.json registry-new.json
```

Compares two registry files and reports breaking changes.

## Usage in CI

```yaml
# .github/workflows/validate.yml
- name: Validate Component Registry
  run: pnpm mcp-ui validate registry.json
```

## Documentation

See the [full documentation](../../docs/features/generative-ui/) for more details.

## License

MIT
