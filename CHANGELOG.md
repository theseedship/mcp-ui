# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.4] - 2026-03-31

### Changed
- Updated README with v2.2.x features and current package versions
- Added CHANGELOG with full release history

## [2.2.3] - 2026-03-31

### Security
- **dompurify** 3.3.0 → 3.3.3 — mutation-XSS via Re-Contextualization (HIGH)
- **ajv** 8.17.1 → 8.18.0 — ReDoS with `$data` option (HIGH)
- **picomatch** 4.0.3 → 4.0.4 — Method Injection + ReDoS
- **flatted** 3.3.3 → 3.4.2 — Prototype Pollution via `parse()`
- **minimatch** 10.2.2 → 10.2.5 — ReDoS via GLOBSTAR segments

## [2.2.1] - 2026-03-31

### Fixed
- **ComponentRegistry validation** — `validateAgainstRegistry()` returns warnings (not errors) for types without registry entries. Known-but-unvalidated types pass through; truly unknown types (typos) still rejected.
- **HTML links in table cells** — `renderCellValue` detects raw HTML (`<a>` tags, citation links) and sanitizes via DOMPurify. Prevents XSS on plain text path.
- **ExpandableWrapper DOM reparenting** — Content physically moved between inline and modal (not duplicated), preserving Chart.js canvas refs.
- **Table export/expand button collision** — Export dropdown offset to avoid overlap with expand button.

### Added
- **ExpandableWrapper component** — Generic Portal-based fullscreen expand. Escape/backdrop close, optional copy-to-clipboard. Integrated into Table, Chart, Code renderers.
- **Table export** — `exportable` prop with dropdown: Copy TSV / Download CSV / Download JSON. RFC 4180 compliant CSV.
- **Chart export** — `exportable` prop for PNG download. `height` prop (default `250px`).
- **CodeBlock word wrap** — Toggle button next to Copy with active state indicator.

## [2.1.3] - 2026-03-20

### Security
- Patched minimatch CVE-2026-26996
- Upgraded to Node 22

## [2.1.2] - 2026-03-19

### Security
- Patched lodash and seroval vulnerabilities

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
