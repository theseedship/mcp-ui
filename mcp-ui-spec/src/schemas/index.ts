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

// Component types (synced with mcp-ui-solid v1.2.6)
export const ComponentTypeSchema = z.enum([
  'chart',
  'table',
  'metric',
  'text',
  'composite',
  'grid',           // Phase 5.0: Nested grid layouts
  'iframe',
  'image',
  'link',
  'action',         // Phase 5.0: Tool call actions
  'footer',         // Phase 5.0: Metadata footer
  'carousel',
  'artifact',
  'form',           // Sprint 1: Form component
  'modal',          // Sprint 3: Modal/dialog component
  'action-group',   // Sprint 3: Action grouping component
  'image-gallery',  // Sprint 5: Image gallery with lightbox
  'video',          // Sprint 5: Video embed (YouTube, Vimeo, direct)
  'code',           // Sprint 6: Syntax highlighted code block
  'map',            // Sprint 6: Interactive map (Leaflet)
])

// Form field option schema (for select, radio)
export const FormFieldOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string(),
  disabled: z.boolean().optional(),
})

// Form field type schema
export const FormFieldTypeSchema = z.enum([
  'text',
  'email',
  'password',
  'number',
  'date',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'autocomplete',
  'range',
  'tags',
  'toggle',
  'fieldset',
])

// Show when operator schema
export const ShowWhenOperatorSchema = z.enum([
  'equals',
  'notEquals',
  'in',
  'notIn',
  'contains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'lessThan',
  'isEmpty',
  'isNotEmpty',
  'isTrue',
  'isFalse',
])

// Show when condition schema
export const ShowWhenConditionSchema = z.object({
  field: z.string().min(1),
  operator: ShowWhenOperatorSchema,
  value: z.any().optional(),
})

// Form field schema
export const FormFieldSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  type: FormFieldTypeSchema,
  label: z.string().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  required: z.boolean().optional(),
  disabled: z.boolean().optional(),
  defaultValue: z.any().optional(),
  // Text/textarea specific
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  pattern: z.string().optional(),
  // Number specific
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  // Date specific
  minDate: z.string().optional(),
  maxDate: z.string().optional(),
  // Select/Radio specific
  options: z.array(FormFieldOptionSchema).optional(),
  // Multi-select (v2.6.0)
  multiple: z.boolean().optional(),
  // Autocomplete specific (v2.6.0)
  apiUrl: z.string().url().optional(),
  searchParam: z.string().optional(),
  labelField: z.string().optional(),
  valueField: z.string().optional(),
  extraParams: z.record(z.string()).optional(),
  minChars: z.number().int().min(0).optional(),
  debounceMs: z.number().int().min(0).optional(),
  // Dependent field (v2.7.0)
  dependsOn: z.object({
    field: z.string(),
    apiUrl: z.string(),
    labelField: z.string(),
    valueField: z.string(),
    extraParams: z.record(z.string()).optional(),
  }).optional(),
  // Field status — API capability indicator (v2.11.0)
  fieldStatus: z.enum(['required', 'optional', 'unsupported', 'unknown']).optional(),
  statusReason: z.string().optional(),
  // Checkbox specific
  checkboxLabel: z.string().optional(),
  // Textarea specific
  rows: z.number().int().min(1).max(20).optional(),
  // Conditional visibility
  showWhen: ShowWhenConditionSchema.optional(),
})

// Form submit action schema
export const FormSubmitActionSchema = z.object({
  toolName: z.string().min(1),
  params: z.record(z.unknown()).optional(),
})

// Form component params schema
export const FormComponentParamsSchema = z.object({
  title: z.string().optional(),
  fields: z.array(FormFieldSchema).min(1),
  submitLabel: z.string().optional(),
  showReset: z.boolean().optional(),
  submitAction: FormSubmitActionSchema.optional(),
  // Persistence options (Sprint 4)
  persistKey: z.string().optional(),
  excludeFromPersistence: z.array(z.string()).optional(),
  persistExpiresIn: z.number().int().positive().optional(),
  layout: z.enum(['vertical', 'horizontal', 'inline']).optional(),
})

// Modal size schema (Sprint 3)
export const ModalSizeSchema = z.enum(['sm', 'md', 'lg', 'xl', 'full'])

// Modal component params schema (Sprint 3)
export const ModalComponentParamsSchema = z.object({
  title: z.string().optional(),
  size: ModalSizeSchema.optional(),
  showClose: z.boolean().optional(),
  closeOnEscape: z.boolean().optional(),
  closeOnBackdrop: z.boolean().optional(),
  maxHeight: z.string().optional(),
  // Note: content and footer are UIComponent references, validated separately
})

// Action group layout schema (Sprint 3)
export const ActionGroupLayoutSchema = z.enum([
  'horizontal',
  'vertical',
  'space-between',
  'end',
  'center',
])

// Action group gap schema (Sprint 3)
export const ActionGroupGapSchema = z.enum(['none', 'sm', 'md', 'lg'])

// Action component params schema (for action-group)
export const ActionParamsSchema = z.object({
  label: z.string().min(1),
  type: z.enum(['button', 'link']).optional(),
  action: z.enum(['tool-call', 'link', 'submit']).optional(),
  toolName: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  url: z.string().optional(),
  variant: z.enum(['primary', 'secondary', 'outline', 'ghost', 'danger']).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
  icon: z.string().optional(),
  disabled: z.boolean().optional(),
})

// Action group component params schema (Sprint 3)
export const ActionGroupParamsSchema = z.object({
  actions: z.array(ActionParamsSchema).min(1),
  layout: ActionGroupLayoutSchema.optional(),
  gap: ActionGroupGapSchema.optional(),
  fullWidth: z.boolean().optional(),
  label: z.string().optional(),
})

// Gallery image schema (Sprint 5)
export const GalleryImageSchema = z.object({
  url: z.string().url(),
  thumbnail: z.string().url().optional(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  srcset: z.string().optional(),
  sizes: z.string().optional(),
})

// Image gallery columns schema (Sprint 5)
export const ImageGalleryColumnsSchema = z.enum(['2', '3', '4', '5']).transform(Number) as unknown as z.ZodType<2 | 3 | 4 | 5>

// Image gallery gap schema (Sprint 5)
export const ImageGalleryGapSchema = z.enum(['none', 'sm', 'md', 'lg'])

// Image gallery aspect ratio schema (Sprint 5)
export const ImageGalleryAspectRatioSchema = z.enum(['1:1', '16:9', '4:3', 'auto'])

// Image gallery params schema (Sprint 5)
export const ImageGalleryParamsSchema = z.object({
  title: z.string().optional(),
  images: z.array(GalleryImageSchema).min(1),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  gap: ImageGalleryGapSchema.optional(),
  aspectRatio: ImageGalleryAspectRatioSchema.optional(),
  lightbox: z.boolean().optional(),
  showCaptions: z.boolean().optional(),
})

// Video aspect ratio schema (Sprint 5)
export const VideoAspectRatioSchema = z.enum(['16:9', '4:3', '1:1', '21:9'])

// Video component params schema (Sprint 5)
export const VideoComponentParamsSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  caption: z.string().optional(),
  poster: z.string().url().optional(),
  aspectRatio: VideoAspectRatioSchema.optional(),
  autoplay: z.boolean().optional(),
  controls: z.boolean().optional(),
  loop: z.boolean().optional(),
  muted: z.boolean().optional(),
  startTime: z.number().int().min(0).optional(),
})

// Code component params schema (Sprint 6)
export const CodeComponentParamsSchema = z.object({
  code: z.string(),
  language: z.string().optional(),
  filename: z.string().optional(),
  showLineNumbers: z.boolean().optional(),
  startLine: z.number().optional(),
  highlightLines: z.array(z.number()).optional(),
  maxHeight: z.string().optional(),
  theme: z.enum(['light', 'dark']).optional(),
})

// Map marker schema (Sprint 6)
export const MapMarkerSchema = z.object({
  position: z.tuple([z.number(), z.number()]),
  tooltip: z.string().optional(),
  popup: z.string().optional(),
})

// Map component params schema (Sprint 6)
export const MapComponentParamsSchema = z.object({
  center: z.tuple([z.number(), z.number()]).optional(),
  zoom: z.number().optional(),
  markers: z.array(MapMarkerSchema).optional(),
  height: z.string().optional(),
  fitBounds: z.boolean().optional(),
  zoomControl: z.boolean().optional(),
  scrollWheelZoom: z.boolean().optional(),
  tileLayer: z.string().optional(),
  attribution: z.string().optional(),
})

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

// Form types (Sprint 1)
export type FormFieldOption = z.infer<typeof FormFieldOptionSchema>
export type FormFieldType = z.infer<typeof FormFieldTypeSchema>
export type FormField = z.infer<typeof FormFieldSchema>
export type FormSubmitAction = z.infer<typeof FormSubmitActionSchema>
export type FormComponentParams = z.infer<typeof FormComponentParamsSchema>

// Conditional field types (Sprint 2)
export type ShowWhenOperator = z.infer<typeof ShowWhenOperatorSchema>
export type ShowWhenCondition = z.infer<typeof ShowWhenConditionSchema>

// Modal types (Sprint 3)
export type ModalSize = z.infer<typeof ModalSizeSchema>
export type ModalComponentParams = z.infer<typeof ModalComponentParamsSchema>

// Action group types (Sprint 3)
export type ActionGroupLayout = z.infer<typeof ActionGroupLayoutSchema>
export type ActionGroupGap = z.infer<typeof ActionGroupGapSchema>
export type ActionParams = z.infer<typeof ActionParamsSchema>
export type ActionGroupParams = z.infer<typeof ActionGroupParamsSchema>

// Image gallery types (Sprint 5)
export type GalleryImage = z.infer<typeof GalleryImageSchema>
export type ImageGalleryGap = z.infer<typeof ImageGalleryGapSchema>
export type ImageGalleryAspectRatio = z.infer<typeof ImageGalleryAspectRatioSchema>
export type ImageGalleryParams = z.infer<typeof ImageGalleryParamsSchema>

// Video types (Sprint 5)
export type VideoAspectRatio = z.infer<typeof VideoAspectRatioSchema>
export type VideoComponentParams = z.infer<typeof VideoComponentParamsSchema>

// Code types (Sprint 6)
export type CodeComponentParams = z.infer<typeof CodeComponentParamsSchema>

// Map types (Sprint 6)
export type MapMarker = z.infer<typeof MapMarkerSchema>
export type MapComponentParams = z.infer<typeof MapComponentParamsSchema>
