# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial monorepo setup with pnpm workspaces
- Migrated packages from deposium_MCPs to standalone repository
- GitHub Actions for automated npm publishing
- Comprehensive documentation and examples

### Changed
- Updated repository URLs to https://github.com/theseedship/mcp-ui
- Configured monorepo with pnpm-workspace.yaml
- Added root-level package.json with workspace scripts

### Fixed
- Package.json repository links now point to correct location

## [1.0.0] - 2025-11-14

### Added
- **@mcp-ui/solid** (v1.0.0) - SolidJS components for MCP UI
  - UIResourceRenderer component
  - StreamingUIRenderer component
  - Error boundaries and fallbacks
  - Hooks: useStreamingUI
  - 5,771 lines of code

- **@mcp-ui/spec** (v1.0.0) - Component registry specification
  - Zod schemas for validation
  - TypeScript type definitions
  - JSON Schema exports
  - 1,631 lines of code

- **@mcp-ui/cli** (v1.0.0) - Development tooling
  - `mcp-ui validate` command
  - `mcp-ui generate-types` command
  - `mcp-ui test-examples` command
  - `mcp-ui diff` command
  - 1,652 lines of code

### Migration Notes
- Packages previously located at `deposium_MCPs/packages/mcp-ui-*`
- Now available as standalone npm packages
- Use `workspace:*` protocol for internal dependencies
- Full backward compatibility maintained

---

**Note**: Version 1.0.0 represents the initial stable release after migration from the Deposium monorepo.
