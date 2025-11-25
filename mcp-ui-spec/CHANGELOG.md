# @seed-ship/mcp-ui-spec Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-11-25

### Changed - Phase 5.0 Quick Wins

#### ComponentType Enum Expansion
- **Synchronized with mcp-ui-solid v1.2.0**
- Expanded from 5 types to 13 types:
  - `chart`, `table`, `metric`, `text`, `composite` (existing)
  - `grid` - Nested CSS Grid layouts (NEW)
  - `iframe` - Embedded content
  - `image` - Image display
  - `link` - Clickable links
  - `action` - Tool call buttons (NEW)
  - `footer` - Metadata footer (NEW)
  - `carousel` - Horizontal scrolling
  - `artifact` - Downloadable files

### Notes
- Full backward compatibility with existing registries
- New types support Phase 5.0 template builder features

## [1.1.0] - 2025-11-25

### Documentation
- **Comprehensive README Rewrite**: Complete documentation overhaul
  - Fixed npm scope from `@mcp-ui/spec` to `@seed-ship/mcp-ui-spec`
  - Documented all 10 exported Zod schemas
  - Documented all 11 component types with renderer mappings
  - Added full registry format specification
  - Added Grid Positioning, Security Constraints, Performance Constraints docs
  - Added deprecation and versioning documentation
  - Included complete example registry JSON

### Notes
- This minor version bump marks a documentation milestone
- No schema changes - all validation identical to v1.0.15

## [1.0.15] - 2025-11-24

### Changed
- Version bump (synchronized with mcp-ui-solid v1.0.26, mcp-ui-cli v1.0.14)

## [1.0.14] - 2025-11-23

### Changed
- Version bump (synchronized with mcp-ui-solid v1.0.25, mcp-ui-cli v1.0.13)

## [1.0.12] - 2025-11-23

### Changed
- Version bump for npm publication with updated token
- Synchronized with mcp-ui-solid v1.0.23, mcp-ui-cli v1.0.11

## [1.0.11] - 2025-11-23

### Changed
- Version bump (synchronized with mcp-ui-solid v1.0.22, mcp-ui-cli v1.0.10)

## [1.0.10] - 2025-11-23

### Added
- **Validation Enhancements**: Extended Zod schemas for new component types
  - Action component validation
  - Artifact component validation
  - Carousel component validation
  - Footer component validation

### Changed
- Synchronized with mcp-ui-solid v1.0.21, mcp-ui-cli v1.0.9

## [1.0.8] - 2025-11-22

### Changed
- Version bump (synchronized with mcp-ui-solid v1.0.18, mcp-ui-cli v1.0.8)

## [1.0.7] - 2025-11-22

### Changed
- Version bump

## [1.0.5] - 2025-11-22

### Added
- **New Component Types**: Added Zod schemas for iframe, image, link components
  - `IframeComponentSchema` with src and sandbox validation
  - `ImageComponentSchema` with src, alt, dimensions
  - `LinkComponentSchema` with href and text

### Changed
- Version bump for npm publication

## [1.0.2] - 2025-11-17

### Changed
- Migrate to `@seed-ship` npm scope
- Updated package name from `@mcp-ui/spec` to `@seed-ship/mcp-ui-spec`

## [1.0.1] - 2025-11-16

### Fixed
- Add type definitions generation for all packages

## [1.0.0] - 2025-01-14

### Added
- Initial release of `@seed-ship/mcp-ui-spec` package
- JSON Schema v7 specification for component registries
- Zod validation schemas with TypeScript types
- Comprehensive example registry with components:
  - `quickchart-bar` (Bar chart visualization)
  - `metric-card` (KPI metric card)
  - `data-table` (Tabular data display)
- Security constraints specification:
  - Authentication requirements
  - Domain whitelisting
  - Iframe sandboxing
  - Maximum nesting depth
- Performance constraints:
  - Maximum render time limits
  - Maximum data size limits
- Component versioning and deprecation support
- Grid positioning system (12-column layout)

### Features
- **JSON Schema**: Industry-standard v7 schema for validation
- **Zod Integration**: Runtime validation with TypeScript inference
- **Type Safety**: Complete TypeScript definitions
- **Examples**: Working examples for each component type
- **Extensible**: Easy to add new component types
