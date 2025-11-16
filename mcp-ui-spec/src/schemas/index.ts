/**
 * Zod validation schemas for component registry
 */

import { z } from 'zod'

// Grid position schema
export const GridPositionSchema = z.object({
  colStart: z.number().int().min(1).max(12),
  colSpan: z.number().int().min(1).max(12),
  rowStart: z.number().int().min(1).optional(),
  rowSpan: z.number().int().min(1).default(1).optional(),
})

// Component types
export const ComponentTypeSchema = z.enum(['chart', 'table', 'metric', 'text', 'composite'])

// Sandbox flags
export const SandboxFlagSchema = z.enum([
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-popups',
  'allow-modals',
])

// Security constraints
export const SecurityConstraintsSchema = z.object({
  requiresAuth: z.boolean().default(false).optional(),
  allowedDomains: z.array(z.string()).optional(),
  maxIframeDepth: z.number().int().min(0).max(3).default(1).optional(),
  sandboxFlags: z.array(SandboxFlagSchema).optional(),
})

// Performance constraints
export const PerformanceConstraintsSchema = z.object({
  maxRenderTime: z.number().int().min(100).default(5000).optional(),
  maxDataSize: z.number().int().min(1024).default(102400).optional(),
})

// Component schema (JSON Schema definition)
export const ComponentSchemaSchema = z.object({
  type: z.literal('object'),
  required: z.array(z.string()).optional(),
  properties: z.record(z.unknown()),
  additionalProperties: z.boolean().optional(),
})

// Component example
export const ComponentExampleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  params: z.record(z.unknown()),
  position: GridPositionSchema.optional(),
})

// Component definition
export const ComponentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  type: ComponentTypeSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  schema: ComponentSchemaSchema,
  examples: z.array(ComponentExampleSchema).min(1),
  security: SecurityConstraintsSchema.optional(),
  performance: PerformanceConstraintsSchema.optional(),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).optional(),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
  deprecated: z.boolean().default(false).optional(),
  deprecationMessage: z.string().optional(),
})

// Registry metadata
export const RegistryMetadataSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  repository: z.string().url().optional(),
})

// Component registry
export const ComponentRegistrySchema = z.object({
  version: z.literal('1.0.0'),
  metadata: RegistryMetadataSchema.optional(),
  components: z.array(ComponentSchema).min(1),
})

// Export types inferred from schemas
export type ComponentRegistry = z.infer<typeof ComponentRegistrySchema>
export type Component = z.infer<typeof ComponentSchema>
export type ComponentExample = z.infer<typeof ComponentExampleSchema>
export type GridPosition = z.infer<typeof GridPositionSchema>
export type SecurityConstraints = z.infer<typeof SecurityConstraintsSchema>
export type PerformanceConstraints = z.infer<typeof PerformanceConstraintsSchema>
export type ComponentType = z.infer<typeof ComponentTypeSchema>
export type SandboxFlag = z.infer<typeof SandboxFlagSchema>
