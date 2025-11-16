# @mcp-ui/cli Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-01-14

### Added
- Initial release of `@mcp-ui/cli` package
- Command-line interface for component registry operations
- `validate` command: Validates registries against JSON Schema and Zod
- `generate-types` command: Generates TypeScript types from component schemas
- `test-examples` command: Tests all component examples for validity
- `diff` command: Compares registry versions for breaking changes

### Features
- **Dual Validation**: Both JSON Schema (Ajv) and Zod validation
- **Type Generation**: Automatic TypeScript type generation with json-schema-to-typescript
- **Example Testing**: Validates all component examples against schemas
- **Breaking Change Detection**: Semantic diff with breaking/non-breaking classification
- **Beautiful Output**: Colorful terminal output with chalk and ora spinners
- **Exit Codes**: Proper exit codes for CI/CD integration
- **Verbose Mode**: Detailed output for debugging

### Commands

#### validate
```bash
mcp-ui validate <file> [--strict] [--verbose]
```
Validates a component registry against both JSON Schema and Zod schemas.

#### generate-types
```bash
mcp-ui generate-types <input> [output] [--namespace <name>] [--export-all]
```
Generates TypeScript types from component schemas.

#### test-examples
```bash
mcp-ui test-examples <file> [--component <id>] [--verbose]
```
Tests all examples in a component registry.

#### diff
```bash
mcp-ui diff <old> <new> [--json] [--fail-on-breaking]
```
Compares two registry versions for breaking changes.

### Dependencies
- commander: CLI framework
- ajv: JSON Schema validation
- zod: Runtime TypeScript validation
- json-schema-to-typescript: Type generation
- chalk: Terminal colors
- ora: Spinners

### Installation
```bash
pnpm add -D @mcp-ui/cli
```

### Usage
```bash
# Validate a registry
mcp-ui validate ./my-registry.json

# Generate types
mcp-ui generate-types ./my-registry.json ./types.ts

# Test examples
mcp-ui test-examples ./my-registry.json

# Check for breaking changes
mcp-ui diff ./old-registry.json ./new-registry.json --fail-on-breaking
```
