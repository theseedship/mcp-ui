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

// Sprint 1: Form components
export { FormRenderer } from './FormRenderer'
export type { FormRendererProps } from './FormRenderer'

export { FormFieldRenderer } from './FormFieldRenderer'
export type { FormFieldRendererProps } from './FormFieldRenderer'

// Sprint 3: UX Improvements
export { ModalRenderer } from './ModalRenderer'
export type { ModalRendererProps } from './ModalRenderer'

export { ActionGroupRenderer } from './ActionGroupRenderer'
export type { ActionGroupRendererProps } from './ActionGroupRenderer'

// Sprint 4: State & Charts
export { ChartJSRenderer, isChartJSAvailable } from './ChartJSRenderer'
export type { ChartJSRendererProps } from './ChartJSRenderer'

// Sprint 5: Media Components
export { LightboxOverlay } from './LightboxOverlay'
export type { LightboxOverlayProps } from './LightboxOverlay'

export { ImageGalleryRenderer } from './ImageGalleryRenderer'
export type { ImageGalleryRendererProps } from './ImageGalleryRenderer'

export { VideoRenderer, isSupportedVideoUrl, getVideoProvider } from './VideoRenderer'
export type { VideoRendererProps } from './VideoRenderer'

// Sprint 6: Code & Maps
export { CodeBlockRenderer } from './CodeBlockRenderer'
export type { CodeBlockRendererProps } from './CodeBlockRenderer'

export { MapRenderer } from './MapRenderer'
export type { MapRendererProps } from './MapRenderer'

// Data Verification (v3.1.0 — anti-hallucination)
export { VerifiedText } from './VerifiedText'
export type { VerifiedTextProps } from './VerifiedText'

export { DataPreviewSection } from './DataPreviewSection'
export type { DataPreviewSectionProps } from './DataPreviewSection'

// Sprint Ultimate: RenderContext for circular dependency resolution
export { RenderContext, RenderProvider, useRenderContext } from './RenderContext'
export type { RenderContextValue, RenderComponentFn } from './RenderContext'

// Default exports for lazy loading compatibility
export { UIResourceRenderer as default } from './UIResourceRenderer'
