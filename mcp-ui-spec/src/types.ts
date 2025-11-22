/**
 * TypeScript types for component registry specification
 */

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

export type ComponentType =
  | 'chart'
  | 'table'
  | 'metric'
  | 'text'
  | 'composite'
  | 'iframe'
  | 'image'
  | 'link'

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
