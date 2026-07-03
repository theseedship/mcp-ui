/**
 * MCP UI Solid - Components
 *
 * SolidJS components for rendering MCP-generated UI resources
 */

export { UIResourceRenderer } from './UIResourceRenderer'
export type { UIResourceRendererProps } from './UIResourceRenderer'

export { StreamingUIRenderer } from './StreamingUIRenderer'
export type { StreamingUIRendererProps } from './StreamingUIRenderer'

// Presentation feedback (v6.6.0 — R3, distinct from FeedbackInline)
export {
  PresentationFeedback,
  DEFAULT_PRESENTATION_FEEDBACK_LABELS,
} from './PresentationFeedback'
export type {
  PresentationFeedbackProps,
  PresentationFeedbackLabels,
} from './PresentationFeedback'

export { GenerativeUIErrorBoundary } from './GenerativeUIErrorBoundary'
export type { GenerativeUIErrorBoundaryProps } from './GenerativeUIErrorBoundary'

// Sprint 4: Export additional renderers
export { FooterRenderer } from './FooterRenderer'
export type { FooterComponentParams } from './FooterRenderer'

// NOTE: kept as a published `./components` subpath export for backward compat.
// This is a legacy stub superseded by the inline ActionRenderer in
// UIResourceRenderer; slated for removal in the next MAJOR (not a minor).
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

// Agent AITL (v4.1.0)
export { AgentCard, AgentStatusBadge } from './AgentCard'
export type { AgentCardProps, AgentStatusBadgeProps } from './AgentCard'

export { SplitStepper } from './SplitStepper'
export type { SplitStepperProps } from './SplitStepper'

export { AgentHandoff } from './AgentHandoff'
export type { AgentHandoffProps } from './AgentHandoff'

export { BriefingDiff } from './BriefingDiff'
export type { BriefingDiffProps } from './BriefingDiff'

// Data Verification (v3.1.0 — anti-hallucination)
export { VerifiedText } from './VerifiedText'
export type { VerifiedTextProps } from './VerifiedText'

export { DataPreviewSection } from './DataPreviewSection'
export type { DataPreviewSectionProps } from './DataPreviewSection'

// Sprint Ultimate: RenderContext for circular dependency resolution
export { RenderContext, RenderProvider, useRenderContext } from './RenderContext'
export type { RenderContextValue, RenderComponentFn } from './RenderContext'

// MCP elicitation (v5.3.0)
export { ElicitationForm } from './ElicitationForm'
export type { ElicitationFormProps } from './ElicitationForm'

// v6.4.0 — Portal-mounted dropdown (used by table + graph Export menus)
export { PortalDropdownMenu } from './PortalDropdownMenu'
export type { PortalDropdownMenuProps } from './PortalDropdownMenu'

// Default exports for lazy loading compatibility
export { UIResourceRenderer as default } from './UIResourceRenderer'
