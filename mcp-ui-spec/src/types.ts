/**
 * TypeScript types for component registry specification
 */

// `ComponentType` is inferred from `ComponentTypeSchema` (the single source of
// truth) and re-exported below, so this legacy types entry point can never
// drift from the runtime schema again (audit P1.4). A compile-time parity test
// (`types-parity.test.ts`) enforces the equality.
import type { ComponentType } from './schemas/index'

export interface ComponentRegistry {
  version: '1.0.0'
  metadata?: RegistryMetadata
  components: Component[]
}

export interface RegistryMetadata {
  name?: string
  description?: string
  author?: string
  repository?: string
}

export interface Component {
  id: string
  type: ComponentType
  name: string
  description?: string
  schema: ComponentSchema
  examples: ComponentExample[]
  security?: SecurityConstraints
  performance?: PerformanceConstraints
  tags?: string[]
  version?: string
  deprecated?: boolean
  deprecationMessage?: string
}

// Re-export the schema-inferred union (see the import note above). Previously
// this was a hand-maintained 8-member union that had silently drifted from the
// 21-member `ComponentTypeSchema` (missing `graph`, `map`, `grid`, `form`, …).
export type { ComponentType }

export interface ComponentSchema {
  type: 'object'
  required?: string[]
  properties: Record<string, unknown>
  additionalProperties?: boolean
}

export interface ComponentExample {
  name: string
  description?: string
  params: Record<string, unknown>
  position?: GridPosition
}

export interface GridPosition {
  colStart: number
  colSpan: number
  rowStart?: number
  rowSpan?: number
}

export interface SecurityConstraints {
  requiresAuth?: boolean
  allowedDomains?: string[]
  maxIframeDepth?: number
  sandboxFlags?: SandboxFlag[]
}

export type SandboxFlag =
  | 'allow-scripts'
  | 'allow-same-origin'
  | 'allow-forms'
  | 'allow-popups'
  | 'allow-modals'

export interface PerformanceConstraints {
  maxRenderTime?: number
  maxDataSize?: number
}
