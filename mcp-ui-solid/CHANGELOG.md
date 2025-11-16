# @mcp-ui/solid Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-14

### Added
- Initial release of `@mcp-ui/solid` package
- `UIResourceRenderer` component for static dashboard rendering
- `StreamingUIRenderer` component for progressive streaming rendering
- `GenerativeUIErrorBoundary` for error isolation and retry logic
- `useStreamingUI` hook for SSE connection management
- Component validation and layout validation services
- Component registry system
- Internal logger utility (self-contained)
- Full TypeScript support with comprehensive types
- 12-column responsive grid layout system
- Support for chart, table, metric, and text components

### Features
- **Progressive Streaming**: Components appear incrementally via SSE
- **Error Boundaries**: Graceful error handling with retry capability
- **Validation**: Built-in component and layout validation
- **Type Safety**: Full TypeScript definitions
- **Performance**: TTFB <500ms, optimized rendering
- **Responsive**: 12-column grid with flexible positioning
- **Clean API**: Simple, intuitive component interfaces
- **Zero Config**: Works out of the box with sensible defaults

### Documentation
- README with installation and usage examples
- JSDoc comments for all public APIs
- TypeScript definitions for IntelliSense support
