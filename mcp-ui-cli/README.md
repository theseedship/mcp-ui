# @seed-ship/mcp-ui-cli

CLI tools for validating and managing MCP UI component registries. Part of the MCP UI ecosystem.

[![npm version](https://img.shields.io/npm/v/@seed-ship/mcp-ui-cli.svg)](https://www.npmjs.com/package/@seed-ship/mcp-ui-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
# Global installation (recommended for CLI usage)
pnpm add -g @seed-ship/mcp-ui-cli

# Local installation (for programmatic use)
pnpm add -D @seed-ship/mcp-ui-cli
```

## Commands

The CLI provides 4 commands for registry management:

### validate

Validates a component registry against both Zod and JSON Schema specifications.

```bash
mcp-ui validate <file> [options]
```

**Arguments:**
- `<file>` - Path to registry JSON file

**Options:**
- `--strict` - Enable strict validation mode (all errors reported)
- `--verbose` - Show detailed validation output with registry summary

**Features:**
- **Dual validation**: Validates against both Zod schemas and JSON Schema (Ajv)
- **Verbose mode**: Displays registry version, component count, and component list
- **Detailed errors**: Shows path-based error locations (e.g., `components[0].schema.required`)

**Example:**
```bash
# Basic validation
mcp-ui validate ./my-registry.json

# Strict mode with verbose output
mcp-ui validate ./my-registry.json --strict --verbose
```

---

### generate-types

Generates TypeScript type definitions from a component registry.

```bash
mcp-ui generate-types <input> [output] [options]
```

**Arguments:**
- `<input>` - Path to registry JSON file
- `[output]` - Output file path (optional, defaults to stdout)

**Options:**
- `--namespace <name>` - Wrap generated types in a namespace
- `--export-all` - Export all generated types

**Features:**
- Converts component IDs to TypeScript type names (kebab-case to PascalCase)
- Uses `json-schema-to-typescript` for accurate type generation
- Adds auto-generation header comment

**Example:**
```bash
# Generate types to stdout
mcp-ui generate-types ./registry.json

# Generate to file with namespace
mcp-ui generate-types ./registry.json ./types/components.d.ts --namespace MCPComponents --export-all
```

---

### test-examples

Tests all component examples in a registry for validity.

```bash
mcp-ui test-examples <file> [options]
```

**Arguments:**
- `<file>` - Path to registry JSON file

**Options:**
- `--component <id>` - Test only a specific component (by ID)
- `--verbose` - Show detailed test output

**Features:**
- Validates each example against its component schema
- Color-coded results (✓ pass, ✗ fail)
- Returns exit code 1 if any examples fail (CI-friendly)

**Example:**
```bash
# Test all examples
mcp-ui test-examples ./registry.json

# Test specific component only
mcp-ui test-examples ./registry.json --component quickchart-bar --verbose
```

---

### diff

Compares two registry versions and detects breaking changes.

```bash
mcp-ui diff <old> <new> [options]
```

**Arguments:**
- `<old>` - Path to old registry JSON file
- `<new>` - Path to new registry JSON file

**Options:**
- `--json` - Output diff as JSON (for programmatic parsing)
- `--fail-on-breaking` - Exit with error code 1 if breaking changes found

**Breaking Changes Detected:**
- Component removal
- Component type changes
- New required fields added
- Major version changes

**Non-Breaking Changes Detected:**
- Component addition
- Component deprecation
- Removed required fields
- Minor/patch version changes

**Example:**
```bash
# Basic diff
mcp-ui diff ./registry-v1.json ./registry-v2.json

# CI/CD usage with fail-on-breaking
mcp-ui diff ./old.json ./new.json --fail-on-breaking --json
```

---

## Programmatic API

All commands are available as functions for programmatic use:

```typescript
import {
  validateCommand,
  generateTypesCommand,
  testExamplesCommand,
  diffCommand
} from '@seed-ship/mcp-ui-cli'

// Validate a registry
const isValid = await validateCommand('./registry.json', { strict: true })

// Generate types
const types = await generateTypesCommand('./registry.json', undefined, { exportAll: true })

// Test examples
const results = await testExamplesCommand('./registry.json', { component: 'chart' })

// Compare registries
const diff = await diffCommand('./old.json', './new.json', { json: true })
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Validate Registry

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install CLI
        run: npm install -g @seed-ship/mcp-ui-cli

      - name: Validate Registry
        run: mcp-ui validate ./registry.json --strict

      - name: Test Examples
        run: mcp-ui test-examples ./registry.json

      - name: Check Breaking Changes
        run: mcp-ui diff ./registry-main.json ./registry.json --fail-on-breaking
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Validation failed / Breaking changes detected / Examples failed |

## Related Packages

| Package | Description |
|---------|-------------|
| [`@seed-ship/mcp-ui-solid`](../mcp-ui-solid) | SolidJS UI components |
| [`@seed-ship/mcp-ui-spec`](../mcp-ui-spec) | JSON schemas and Zod validators |

## Versioning

This package follows [Semantic Versioning](https://semver.org/). See [CHANGELOG.md](./CHANGELOG.md) for release notes.

**Current Version:** 1.1.0

## License

MIT
