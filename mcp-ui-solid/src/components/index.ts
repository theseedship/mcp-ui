/**
 * MCP UI Solid - Components
 *
 * SolidJS components for rendering MCP-generated UI resources
 */

export { UIResourceRenderer } from './UIResourceRenderer'
export type { UIResourceRendererProps } from './UIResourceRenderer'

export { StreamingUIRenderer } from './StreamingUIRenderer'
export type { StreamingUIRendererProps } from './StreamingUIRenderer'

export { GenerativeUIErrorBoundary } from './GenerativeUIErrorBoundary'
export type { GenerativeUIErrorBoundaryProps } from './GenerativeUIErrorBoundary'

// Sprint 4: Export additional renderers
export { FooterRenderer } from './FooterRenderer'
export type { FooterComponentParams } from './FooterRenderer'

export { ActionRenderer } from './ActionRenderer'
export type { ActionRendererProps } from './ActionRenderer'

export { ArtifactRenderer } from './ArtifactRenderer'
export type { ArtifactComponentParams } from './ArtifactRenderer'

export { CarouselRenderer } from './CarouselRenderer'
export type { CarouselRendererProps } from './CarouselRenderer'

export { GridRenderer } from './GridRenderer'
export type { GridRendererProps, GridComponentParams } from './GridRenderer'

// Default exports for lazy loading compatibility
export { UIResourceRenderer as default } from './UIResourceRenderer'
