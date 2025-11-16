# @mcp-ui/spec Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-01-14

### Added
- Initial release of `@mcp-ui/spec` package
- JSON Schema v7 specification for component registries
- Zod validation schemas with TypeScript types
- Comprehensive example registry with 3 components:
  - quickchart-bar (Bar chart visualization)
  - metric-card (KPI metric card)
  - data-table (Tabular data display)
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
- **Validation**: Built-in validation for security and performance

### Documentation
- Complete JSON Schema with descriptions
- Example registry with real-world use cases
- TypeScript types for all schema entities
