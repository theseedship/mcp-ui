# @seed-ship/mcp-ui-cli Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-11-25

### Documentation
- **Comprehensive README Rewrite**: Complete documentation overhaul
  - Fixed npm scope from `@mcp-ui/cli` to `@seed-ship/mcp-ui-cli`
  - Removed non-existent `create-component` command (was documented but never implemented)
  - Documented all 4 commands with full options and examples
  - Added Programmatic API section with TypeScript examples
  - Added CI/CD Integration section with GitHub Actions example
  - Documented exit codes for automation

### Notes
- This minor version bump marks a documentation milestone
- No CLI changes - all commands identical to v1.0.14

## [1.0.14] - 2025-11-24

### Changed
- Version bump (synchronized with mcp-ui-solid v1.0.26, mcp-ui-spec v1.0.15)

## [1.0.13] - 2025-11-23

### Changed
- Version bump (synchronized with mcp-ui-solid v1.0.25, mcp-ui-spec v1.0.14)

## [1.0.11] - 2025-11-23

### Changed
- Version bump for npm publication with updated token
- Synchronized with mcp-ui-solid v1.0.23, mcp-ui-spec v1.0.12

## [1.0.10] - 2025-11-23

### Changed
- Version bump (synchronized with mcp-ui-solid v1.0.22, mcp-ui-spec v1.0.11)

## [1.0.9] - 2025-11-23

### Changed
- Version bump (synchronized with mcp-ui-solid v1.0.21, mcp-ui-spec v1.0.10)

## [1.0.8] - 2025-11-22

### Changed
- Version bump (synchronized with mcp-ui-solid v1.0.18, mcp-ui-spec v1.0.8)

## [1.0.6] - 2025-11-22

### Changed
- Version bump for npm publication

## [1.0.5] - 2025-11-22

### Changed
- Version bump

## [1.0.2] - 2025-11-17

### Changed
- Migrate to `@seed-ship` npm scope
- Updated package name from `@mcp-ui/cli` to `@seed-ship/mcp-ui-cli`

## [1.0.1] - 2025-11-16

### Fixed
- Add type definitions generation for all packages
- Correct schema validation tests

## [1.0.0] - 2025-01-14

### Added
- Initial release of `@seed-ship/mcp-ui-cli` package
- Command-line interface for component registry operations
- `validate` command: Validates registries against JSON Schema and Zod
- `generate-types` command: Generates TypeScript types from component schemas
- `test-examples` command: Tests all component examples for validity
- `diff` command: Compares registry versions for breaking changes

### Features
- **Dual Validation**: Both JSON Schema (Ajv) and Zod validation
- **Type Generation**: Automatic TypeScript type generation
- **Example Testing**: Validates all component examples against schemas
- **Breaking Change Detection**: Semantic diff with classification
- **Beautiful Output**: Colorful terminal output with chalk and ora spinners
- **CI/CD Ready**: Proper exit codes for automation

### Commands

```bash
# Validate a registry
mcp-ui validate <file> [--strict] [--verbose]

# Generate TypeScript types
mcp-ui generate-types <input> [output] [--namespace <name>]

# Test examples
mcp-ui test-examples <file> [--component <id>] [--verbose]

# Check for breaking changes
mcp-ui diff <old> <new> [--json] [--fail-on-breaking]
```
