# @seed-ship/mcp-ui-solid Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2025-11-26

### Added - Sprint 4: Public Exports & Registry

#### Component Exports (NEW)
- **FooterRenderer**: Now publicly exported for custom footer implementations
- **ActionRenderer**: Interactive button/link component with tool-call support
- **ArtifactRenderer**: Downloadable artifact display with filename, size, MIME type
- **CarouselRenderer**: Horizontal carousel with snap scrolling and navigation
- **GridRenderer**: Nested CSS Grid layout for complex dashboard templates

#### Component Registry Entries (NEW)
- Added 5 new registry entries in `component-registry.ts`:
  - `grid`: Nested CSS Grid layout with columns, gap, areas, children
  - `action`: Interactive button/link with tool-call, link, submit actions
  - `footer`: Metadata display with executionTime, model, sourceCount
  - `carousel`: Horizontal item carousel with snap scrolling
  - `artifact`: Downloadable file display with URL, filename, mimeType, size

### Technical
- All Sprint 4 components now available via main package export
- Registry entries enable LLM prompt engineering with schema definitions
- Full TypeScript types exported for all new components

## [1.2.1] - 2025-11-25

### Fixed
- Minor build fixes and dependency updates

## [1.2.0] - 2025-11-25

### Added - Phase 5.0 Quick Wins

#### GridRenderer (NEW)
- **Nested CSS Grid layouts** for complex template builder layouts
- Supports `columns`, `gap`, `minRowHeight`, and `areas` configuration
- Recursive rendering of child components via `UIResourceRenderer`
- Enables sidebar + main + footer dashboard layouts

#### MCPActionContext + useAction() (NEW)
- **Context Provider pattern** replaces CustomEvent for action dispatch
- `MCPActionProvider` wrapper for orchestration (Mastra integration ready)
- `useAction()` hook with execute, isExecuting state, and error handling
- `useMCPActionSafe()` for components outside provider (fallback to CustomEvent)
- `useToolAction()` for binding to specific tool names
- Typed `ActionRequest` and `ActionResult` interfaces
- Support for audit callbacks (`onAction`) and webhook events (`onWebhook`)

#### FooterRenderer Auto-Injection (NEW)
- Automatically inject footer when layout has metadata (executionTime, sourceCount, llmModel)
- Opt-out via `layout.metadata.hideFooter: true`
- Respects explicit footer components if already present
- Shows "Powered by Deposium" with execution metrics

### Changed
- **ActionRenderer refactored** to use `useAction()` hook internally
- Added loading spinner state during tool-call execution
- Button auto-disables while action is executing

### Types
- Added `GridComponentParams` interface for grid configuration
- Added `footer`, `carousel`, `artifact` to `ComponentType` union
- Extended `UILayout.metadata` with `executionTime`, `sourceCount`, `hideFooter`
- New exports: `MCPActionProvider`, `MCPActionContext`, `useMCPAction`, `useAction`, `useToolAction`

### Technical
- New directories: `src/context/`, `src/hooks/useAction.ts`
- Full TypeScript support with strict types
- SSR-compatible with `isServer` guards

## [1.1.0] - 2025-11-25

### Documentation
- **Comprehensive README Rewrite**: Complete documentation overhaul
  - Added architecture diagram and SSR guide
  - Documented all 12 component renderers with examples
  - Added conditional export setup for SolidStart
  - Included troubleshooting section for common SSR issues
- **CHANGELOG Catch-up**: Added 33 missing version entries (v1.0.11 to v1.0.43)
- **Phase 5 Roadmap**: Documented planned advanced components

### Notes
- This minor version bump marks a documentation milestone
- No code changes - all functionality identical to v1.0.43

## [1.0.43] - 2025-11-25

### Fixed
- **Object-to-Link Conversion**: Handle object values in `renderCellValue()` for table cells
  - Backend/LLM may send `{url, name}` objects instead of markdown strings
  - Previous: `String(value)` produced `[object Object]` in cells and broken URLs
  - Now: Auto-converts objects with `url` property to clickable HTML links
  - Supports `name`, `label`, or `title` as link text (falls back to URL)
  - Objects without `url` but with `name/label/title` render as plain text
  - Other objects are serialized with `JSON.stringify()`

### Technical Details
```typescript
// Before: "[object Object]" displayed, broken links
// After: Proper clickable links
if (value.url) {
  const label = value.name || value.label || value.title || value.url
  return `<a href="${sanitizedUrl}">${sanitizedLabel}</a>`
}
```

## [1.0.42] - 2025-11-25

### Added
- **Source Exports via "solid" Condition**: Add direct source exports for SolidStart SSR compatibility
  - New `"solid"` condition in package.json exports points to TypeScript source files
  - Allows Vite/SolidStart to compile components in the same context as the app
  - Fixes SSR hydration mismatches when compiled separately
  - **Requires**: Consuming app must add `conditions: ['solid']` in Vite config

### Technical Details
```json
{
  "exports": {
    ".": {
      "solid": "./src/index.ts",      // ← Source for SolidStart
      "import": "./dist/index.js",    // ← Compiled for other bundlers
    }
  }
}
```

### Migration Notes
For SolidStart users on Railway/SSR platforms, add to `app.config.ts`:
```typescript
resolve: {
  conditions: ['solid', 'development', 'browser']
}
```

## [1.0.41] - 2025-11-25

### Changed
- Switch from SSR to DOM mode for client-side rendering experiments
- Reverted in v1.0.42

## [1.0.40] - 2025-11-25

### Improved
- **Smart Cell Rendering**: Enhanced `renderCellValue()` with better markdown/link detection
  - Extract actual URL from markdown links before validation
  - Support image URLs in markdown format
  - Improved detection of URLs without protocol prefix

## [1.0.39] - 2025-11-24

### Fixed
- Rebuild with fresh `dist/` containing createEffect fix from v1.0.38
- Clean rebuild to ensure all SSR fixes are included in the package

## [1.0.38] - 2025-11-24

### Fixed
- **SSR Compatibility**: Replace `onMount` with `createEffect` for better SSR behavior
  - `createEffect` runs on both server and client
  - More predictable execution timing
  - Fixes certain edge cases in streaming UI

## [1.0.37] - 2025-11-24

### Fixed
- **SSR Mode Restoration**: Restore `generate: 'ssr'` mode for Railway Node 22 compatibility
  - Previous version accidentally reverted to DOM mode
  - Re-enables proper SSR compilation for server environments

## [1.0.36] - 2025-11-24

### Fixed
- **SSR Guard Improvement**: Use `typeof window` check instead of `isServer` import
  - More reliable detection in mixed environments
  - Fixes edge cases where `isServer` wasn't properly tree-shaken

## [1.0.35] - 2025-11-24

### Fixed
- **SSR Guard in useStreamingUI**: Add SSR guard to `fetch()` calls in useStreamingUI hook
  - Prevents SSR crashes when hook is instantiated during server render
  - `fetch` is guarded to only execute client-side

## [1.0.34] - 2025-11-24

### Fixed
- **Client-Only API Guards**: Use `onMount` pattern for all client-only APIs in GenerativeUIErrorBoundary
  - Consistent pattern across all components
  - Prevents accidental server-side execution

## [1.0.33] - 2025-11-24

### Fixed
- **Railway SSR Fix**: Wrap client APIs in GenerativeUIErrorBoundary for Railway SSR
  - Additional guards for browser-only code
  - Improved compatibility with Railway's Node.js environment

## [1.0.32] - 2025-11-24

### Fixed
- **CustomEvent SSR Fix**: Wrap CustomEvent in `onMount` for Railway SSR compatibility
  - `CustomEvent` constructor doesn't exist in Node.js
  - Now only created client-side during mount

## [1.0.31] - 2025-11-24

### Fixed
- Fix build configuration and TypeScript declarations
- Update pnpm-lock.yaml for v1.0.31 dependencies
- Ensure all type definitions are properly exported

## [1.0.30] - 2025-11-24

### Improved
- **Table Rendering**: Improve table rendering with markdown support
  - Tables now parse markdown links in cell values
  - Better export path configuration
  - Enhanced styling for table cells

## [1.0.29] - 2025-11-24

### Added
- **SSR-Safe Type Imports**: Add `/types-only` sub-export for SSR-safe type imports
  - Allows importing types without triggering component code
  - Useful for server-side type checking

```typescript
// SSR-safe type import
import type { UIResource } from '@seed-ship/mcp-ui-solid/types-only'
```

## [1.0.28] - 2025-11-24

### Fixed
- **Validation Entry Point**: Compile validation.ts as proper entry point
  - Fixes import errors when using `/validation` export

## [1.0.27] - 2025-11-24

### Fixed
- **Validation Imports**: validation.ts imports from dist instead of src
  - Prevents source-map resolution issues

## [1.0.26] - 2025-11-24

### Changed
- Version bump (synced with mcp-ui-spec v1.0.15, mcp-ui-cli v1.0.14)

## [1.0.25] - 2025-11-23

### Added
- **Validation Sub-Export**: Add `/validation` sub-export for SSR-safe imports
  - Validation utilities available without loading UI components
  - Useful for server-side schema validation

```typescript
import { validateUIResource } from '@seed-ship/mcp-ui-solid/validation'
```

### Fixed
- Add SSR compatibility checks for client-only APIs throughout codebase

## [1.0.24] - 2025-11-23

### Improved
- **Table Styling**: Improve table rendering with better styling
  - Enhanced header styling
  - Better cell padding and borders
  - Improved responsive behavior

## [1.0.23] - 2025-11-23

### Changed
- Version bump for npm publication with updated token
- Synchronized with mcp-ui-spec v1.0.12, mcp-ui-cli v1.0.11

## [1.0.22] - 2025-11-23

### Changed
- Version bump for npm publication
- Synchronized with mcp-ui-spec v1.0.11, mcp-ui-cli v1.0.10

## [1.0.21] - 2025-11-23

### Added
- **New Renderers**: Four new component renderers for enhanced UI capabilities
  - `ActionRenderer`: Interactive buttons with callback support
  - `ArtifactRenderer`: File/download artifact display
  - `CarouselRenderer`: Image/content carousel with navigation
  - `FooterRenderer`: Metadata and footer information display
- **Validation Enhancements**: Extended validation for new component types

### Technical Details
ActionRenderer example:
```typescript
<ActionRenderer
  action={{
    type: 'action',
    label: 'Download Report',
    actionType: 'download',
    payload: { fileId: '123' }
  }}
  onAction={(action) => handleAction(action)}
/>
```

## [1.0.18] - 2025-11-22

### Changed
- Version bump for npm publication
- Synchronized with mcp-ui-spec v1.0.8, mcp-ui-cli v1.0.8

## [1.0.17] - 2025-11-22

### Added
- **Component Type Validation**: Add validation for iframe, image, link component types
  - Schema validation for `iframe` with src and sandbox attributes
  - Schema validation for `image` with src, alt, and dimensions
  - Schema validation for `link` with href and text

## [1.0.16] - 2025-11-22

### Fixed
- **SSR Compatibility**: Fix SSR compatibility by using CSS strings instead of style objects
  - Vite's solid plugin generates different code for style objects vs strings
  - CSS strings avoid the `setStyleProperty` issue in SSR

## [1.0.15] - 2025-11-22

### Changed
- Version bump for npm publication

## [1.0.13] - 2025-11-17

### Added
- **New Renderers**: Add iframe, image, and link renderers to mcp-ui-solid
  - `IframeRenderer`: Secure iframe embedding with sandbox support
  - `ImageRenderer`: Responsive image display with lazy loading
  - `LinkRenderer`: External link rendering with proper security attributes
- **Markdown Support**: Add markdown rendering to TextRenderer
  - Uses `marked` library for parsing
  - Sanitizes output with DOMPurify

### Technical Details
```typescript
// TextRenderer now supports markdown
<TextRenderer
  component={{
    type: 'text',
    content: '# Hello\n\nThis is **markdown**!'
  }}
/>
```

## [1.0.12] - 2025-11-17

### Added
- **Markdown in TextRenderer**: Basic markdown support using `marked` library
  - Headings, bold, italic, links, lists
  - Code blocks with syntax highlighting
  - Sanitized HTML output

### Fixed
- Composite layout detection in UIResourceRenderer
- Optional chaining for componentId in error display
- Defensive position check in validateGridPosition
- Defensive position checks in UIResourceRenderer

---

## [1.0.10] - 2025-11-17

### Fixed
- **CONDITIONAL EXPORTS FIX**: Added `"solid"` condition to all package.json exports
  - This completes the SSR fix started in v1.0.9
  - Allows Vite's SSR resolver to correctly identify which module to load in server vs browser contexts
  - Without this, module resolution conflicts occurred even with SSR-compatible compilation
  - Follows SolidJS library best practices for proper module resolution

### Technical Details
**The Missing Piece in v1.0.9:**
- v1.0.9 correctly changed `generate: 'ssr'` in vite.config.ts
- BUT package.json exports didn't include the `"solid"` condition
- This caused Vite to load the same build for both SSR and browser
- Result: Module resolution conflicts with `solid-js/web` during SSR

**How Conditional Exports Fix This:**
```json
{
  "./components": {
    "solid": "./dist/components/index.js",
    "import": "./dist/components/index.js",
    "require": "./dist/components/index.cjs"
  }
}
```

### Why This Matters
- **v1.0.8**: Added `isServer` guards (fixed symptoms)
- **v1.0.9**: Changed to SSR compilation mode (fixed compilation)
- **v1.0.10**: Added conditional exports (fixed module resolution)

## [1.0.9] - 2025-11-17

### Fixed
- **ROOT CAUSE SSR FIX**: Changed vite-plugin-solid configuration to use SSR-compatible compilation mode
  - Updated `generate: 'dom'` → `generate: 'ssr'` in vite.config.ts
  - Updated `hydratable: false` → `hydratable: true` in vite.config.ts
  - This prevents module-level `template()` calls that crash in SSR environments

### Technical Details
- **SSR mode** compiles JSX to server-safe string rendering
- **Hydratable mode** enables client-side hydration after SSR
- No module-level browser API calls that crash in Node.js

## [1.0.8] - 2025-11-16

### Fixed
- **CRITICAL SSR FIX**: Added `isServer` guards to all browser APIs in `GenerativeUIErrorBoundary.tsx`
  - Browser APIs: `performance.now()`, `navigator.userAgent`, `window.innerWidth/height`
  - These APIs don't exist in Node.js SSR environment

## [1.0.7] - 2025-11-16

### Fixed
- **CRITICAL SSR FIX**: Replaced `ref` callback with `onMount` to eliminate `use()` directive
  - `use` is NOT exported from `solid-js/web` in Node/SSR environment
  - Solution: Replaced `ref` callback with `onMount()` which is SSR-safe

## [1.0.6] - 2025-11-16

### Fixed
- Add `solid-js` to devDependencies for tests to pass in CI/CD

## [1.0.5] - 2025-11-16 (UNPUBLISHED)

### Fixed
- **CRITICAL SSR FIX**: Replaced dynamic style objects with CSS strings

### Changed
- Updated `vite` from ^5.0.10 to ^6.3.6
- Updated `vite-plugin-solid` from ^2.8.2 to ^2.11.8
- Updated `vitest` from ^1.1.0 to ^4.0.8
- Updated `solid-js` peerDependency from ^1.8.0 to ^1.9.0

## [1.0.0] - 2025-01-14

### Added
- Initial release of `@seed-ship/mcp-ui-solid` package
- `UIResourceRenderer` component for static dashboard rendering
- `StreamingUIRenderer` component for progressive streaming rendering
- `GenerativeUIErrorBoundary` for error isolation and retry logic
- `useStreamingUI` hook for SSE connection management
- Component validation and layout validation services
- Component registry system
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
