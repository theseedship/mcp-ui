/**
 * Component Registry Service
 * Phase 0: Static registry with Quickchart and Table definitions
 * Phase 1: Dynamic registry populated from /api/mcp/tools/list
 *
 * Provides component schemas for LLM prompt engineering
 */

import type { ComponentRegistryEntry, ComponentType } from '../types'
import { DEFAULT_RESOURCE_LIMITS } from './validation'

/**
 * Quickchart Component Registry Entry
 * Based on Quickchart API documentation
 */
export const QuickchartRegistry: ComponentRegistryEntry = {
  type: 'chart',
  name: 'Quickchart',
  description:
    'Render charts using Quickchart.io API. Supports bar, line, pie, doughnut, radar, and scatter charts. Best for visualizing numerical data with 2-10 data series and up to 1000 data points.',
  schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['bar', 'line', 'pie', 'doughnut', 'radar', 'scatter'],
        description: 'Chart type',
      },
      title: {
        type: 'string',
        description: 'Chart title (optional)',
      },
      data: {
        type: 'object',
        properties: {
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'X-axis labels',
          },
          datasets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                data: {
                  type: 'array',
                  items: { type: 'number' },
                },
                backgroundColor: {
                  oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
                },
                borderColor: {
                  oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
                },
                borderWidth: { type: 'number' },
              },
              required: ['label', 'data'],
            },
          },
        },
        required: ['labels', 'datasets'],
      },
      options: {
        type: 'object',
        description: 'Chart.js options for customization',
      },
    },
    required: ['type', 'data'],
  },
  examples: [
    {
      query: 'Show me document types distribution',
      component: {
        id: 'example-bar-1',
        type: 'chart',
        position: { colStart: 1, colSpan: 6 },
        params: {
          type: 'bar',
          title: 'Document Types',
          data: {
            labels: ['PDF', 'DOCX', 'TXT', 'XLSX'],
            datasets: [
              {
                label: 'Count',
                data: [245, 189, 123, 98],
                backgroundColor: ['rgba(59, 130, 246, 0.8)'],
              },
            ],
          },
        },
      },
    },
    {
      query: 'Display upload trends over the last week',
      component: {
        id: 'example-line-1',
        type: 'chart',
        position: { colStart: 1, colSpan: 6 },
        params: {
          type: 'line',
          title: 'Upload Trends',
          data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [
              {
                label: 'Uploads',
                data: [42, 38, 51, 47, 63, 29, 15],
                borderColor: 'rgb(59, 130, 246)',
              },
            ],
          },
          options: {
            tension: 0.4,
          },
        },
      },
    },
  ],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Table Component Registry Entry
 */
export const TableRegistry: ComponentRegistryEntry = {
  type: 'table',
  name: 'DataTable',
  description:
    'Render tabular data with sortable columns and pagination. Best for displaying structured records with up to 100 rows. Supports column width customization and cell formatting.',
  schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Table title (optional)',
      },
      columns: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Data key for this column' },
            label: { type: 'string', description: 'Column header label' },
            sortable: { type: 'boolean', description: 'Whether column is sortable' },
            width: { type: 'string', description: 'CSS width (e.g., "30%")' },
          },
          required: ['key', 'label'],
        },
        minItems: 1,
      },
      rows: {
        type: 'array',
        items: {
          type: 'object',
          description: 'Row data matching column keys',
        },
        maxItems: 100,
      },
      pagination: {
        type: 'object',
        properties: {
          currentPage: { type: 'number' },
          pageSize: { type: 'number' },
          totalRows: { type: 'number' },
        },
      },
    },
    required: ['columns', 'rows'],
  },
  examples: [
    {
      query: 'Show me the most recent documents',
      component: {
        id: 'example-table-1',
        type: 'table',
        position: { colStart: 1, colSpan: 8 },
        params: {
          title: 'Recent Documents',
          columns: [
            { key: 'name', label: 'Name', sortable: true, width: '40%' },
            { key: 'type', label: 'Type', sortable: true, width: '15%' },
            { key: 'size', label: 'Size', width: '15%' },
            { key: 'modified', label: 'Modified', sortable: true, width: '30%' },
          ],
          rows: [
            { name: 'Report.pdf', type: 'PDF', size: '2.4 MB', modified: '2 hours ago' },
            { name: 'Slides.pptx', type: 'PPTX', size: '8.7 MB', modified: '1 day ago' },
          ],
        },
      },
    },
  ],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Metric Card Component Registry Entry
 */
export const MetricRegistry: ComponentRegistryEntry = {
  type: 'metric',
  name: 'MetricCard',
  description:
    'Display a single metric with optional trend indicator. Best for KPIs, statistics, and summary numbers. Supports trend direction (up/down/neutral) and subtitles.',
  schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Metric title',
      },
      value: {
        oneOf: [{ type: 'string' }, { type: 'number' }],
        description: 'Metric value',
      },
      unit: {
        type: 'string',
        description: 'Unit of measurement (optional)',
      },
      trend: {
        type: 'object',
        properties: {
          value: { type: 'number', description: 'Percentage change' },
          direction: { type: 'string', enum: ['up', 'down', 'neutral'] },
        },
      },
      subtitle: {
        type: 'string',
        description: 'Additional context (optional)',
      },
    },
    required: ['title', 'value'],
  },
  examples: [
    {
      query: 'Show total document count',
      component: {
        id: 'example-metric-1',
        type: 'metric',
        position: { colStart: 1, colSpan: 3 },
        params: {
          title: 'Total Documents',
          value: '1,247',
          trend: {
            value: 12.5,
            direction: 'up',
          },
          subtitle: '+142 this month',
        },
      },
    },
  ],
  limits: {
    maxDataPoints: 1,
    maxTableRows: 1,
    maxPayloadSize: 5 * 1024, // 5KB
    renderTimeout: 1000, // 1s
  },
}

/**
 * Text Component Registry Entry
 */
export const TextRegistry: ComponentRegistryEntry = {
  type: 'text',
  name: 'TextBlock',
  description:
    'Render text content with optional markdown support. Best for explanations, summaries, and context. Supports basic HTML formatting.',
  schema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Text content (HTML allowed, will be sanitized)',
      },
      markdown: {
        type: 'boolean',
        description: 'Whether content is markdown (not yet implemented)',
      },
      className: {
        type: 'string',
        description: 'Custom CSS classes',
      },
    },
    required: ['content'],
  },
  examples: [
    {
      query: 'Explain the document distribution',
      component: {
        id: 'example-text-1',
        type: 'text',
        position: { colStart: 1, colSpan: 12 },
        params: {
          content:
            '<p>Your document library contains <strong>1,247 files</strong> across 5 different formats. PDFs represent the largest category at 35% of total storage.</p>',
        },
      },
    },
  ],
  limits: {
    maxDataPoints: 1,
    maxTableRows: 1,
    maxPayloadSize: 10 * 1024, // 10KB
    renderTimeout: 1000, // 1s
  },
}

// ============================================================================
// Sprint 4: Additional Component Registry Entries
// ============================================================================

/**
 * Grid Component Registry Entry
 * Nested CSS Grid layout for organizing multiple components
 */
export const GridRegistry: ComponentRegistryEntry = {
  type: 'grid',
  name: 'GridLayout',
  description:
    'Nested CSS Grid layout for organizing multiple components. Supports named areas, responsive columns (1-12), and custom gap spacing. Best for complex dashboard layouts and template builder.',
  schema: {
    type: 'object',
    properties: {
      columns: {
        type: 'number',
        description: 'Number of columns (default: 12)',
      },
      gap: {
        type: 'string',
        description: 'Gap between items (e.g., "1rem")',
      },
      minRowHeight: {
        type: 'string',
        description: 'Minimum row height (optional)',
      },
      areas: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'string' },
        },
        description: 'CSS Grid template areas for named regions',
      },
      children: {
        type: 'array',
        items: { type: 'object' },
        description: 'Child UIComponents to render within the grid',
      },
    },
    required: ['children'],
  },
  examples: [],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Action Component Registry Entry
 * Interactive button or link that triggers tool calls
 */
export const ActionRegistry: ComponentRegistryEntry = {
  type: 'action',
  name: 'ActionButton',
  description:
    'Interactive button or link that triggers tool calls or navigation. Best for user interactions, form submissions, and workflow triggers.',
  schema: {
    type: 'object',
    properties: {
      label: {
        type: 'string',
        description: 'Button text',
      },
      type: {
        type: 'string',
        enum: ['button', 'link'],
        description: 'Render as button or link',
      },
      action: {
        type: 'string',
        enum: ['tool-call', 'link', 'submit'],
        description: 'Action type to perform',
      },
      toolName: {
        type: 'string',
        description: 'Tool name to call (for tool-call action)',
      },
      params: {
        type: 'object',
        description: 'Parameters to pass to the tool',
      },
      url: {
        type: 'string',
        description: 'URL for link action',
      },
      variant: {
        type: 'string',
        enum: ['primary', 'secondary', 'outline', 'ghost', 'danger'],
        description: 'Visual style variant',
      },
      size: {
        type: 'string',
        enum: ['sm', 'md', 'lg'],
        description: 'Button size',
      },
      disabled: {
        type: 'boolean',
        description: 'Whether the action is disabled',
      },
    },
    required: ['label', 'type', 'action'],
  },
  examples: [],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Footer Component Registry Entry
 * Display execution metadata like timing and source count
 */
export const FooterRegistry: ComponentRegistryEntry = {
  type: 'footer',
  name: 'FooterSection',
  description:
    'Footer section displaying execution metadata. Best for showing timing, model info, and source counts. Auto-injected by layouts when metadata is provided.',
  schema: {
    type: 'object',
    properties: {
      poweredBy: {
        type: 'string',
        description: 'Powered by text (optional)',
      },
      executionTime: {
        type: 'number',
        description: 'Execution time in milliseconds',
      },
      model: {
        type: 'string',
        description: 'LLM model used',
      },
      sourceCount: {
        type: 'number',
        description: 'Number of sources used',
      },
      customText: {
        type: 'string',
        description: 'Custom footer text',
      },
      links: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            url: { type: 'string' },
          },
        },
        description: 'Footer links',
      },
    },
  },
  examples: [],
  limits: {
    maxDataPoints: 1,
    maxTableRows: 1,
    maxPayloadSize: 5 * 1024,
    renderTimeout: 1000,
  },
}

/**
 * Carousel Component Registry Entry
 * Display multiple items with horizontal scrolling
 */
export const CarouselRegistry: ComponentRegistryEntry = {
  type: 'carousel',
  name: 'Carousel',
  description:
    'Horizontal carousel for displaying multiple items with snap scrolling and navigation buttons. Best for showcasing related content, image galleries, or card collections.',
  schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of UIComponents to display in carousel',
      },
      height: {
        type: 'string',
        description: 'Carousel height (optional)',
      },
    },
    required: ['items'],
  },
  examples: [],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Artifact Component Registry Entry
 * Display downloadable artifacts like generated files
 */
export const ArtifactRegistry: ComponentRegistryEntry = {
  type: 'artifact',
  name: 'Artifact',
  description:
    'Display downloadable artifacts like generated files or exports. Shows filename, size, and download button. Best for CSV exports, PDF reports, and generated documents.',
  schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Download URL for the artifact',
      },
      filename: {
        type: 'string',
        description: 'Display filename',
      },
      mimeType: {
        type: 'string',
        description: 'MIME type (e.g., "text/csv", "application/pdf")',
      },
      size: {
        type: 'number',
        description: 'File size in bytes',
      },
      description: {
        type: 'string',
        description: 'Description of the artifact',
      },
    },
    required: ['url', 'filename', 'mimeType'],
  },
  examples: [],
  limits: {
    maxDataPoints: 1,
    maxTableRows: 1,
    maxPayloadSize: 5 * 1024,
    renderTimeout: 1000,
  },
}

/**
 * Component Registry - All components indexed by type
 */
export const ComponentRegistry: Map<ComponentType, ComponentRegistryEntry> = new Map([
  ['chart', QuickchartRegistry],
  ['table', TableRegistry],
  ['metric', MetricRegistry],
  ['text', TextRegistry],
  // Sprint 4 additions
  ['grid', GridRegistry],
  ['action', ActionRegistry],
  ['footer', FooterRegistry],
  ['carousel', CarouselRegistry],
  ['artifact', ArtifactRegistry],
])

/**
 * Get component registry entry by type
 */
export function getComponentEntry(type: ComponentType): ComponentRegistryEntry | undefined {
  return ComponentRegistry.get(type)
}

/**
 * Get all component types
 */
export function getAllComponentTypes(): ComponentType[] {
  return Array.from(ComponentRegistry.keys())
}

/**
 * Get registry as JSON for LLM context
 */
export function getRegistryForLLM(): string {
  const entries = Array.from(ComponentRegistry.values()).map((entry) => ({
    type: entry.type,
    name: entry.name,
    description: entry.description,
    schema: entry.schema,
    examples: entry.examples.map((ex) => ({
      query: ex.query,
      component: ex.component,
    })),
    limits: entry.limits,
  }))

  return JSON.stringify(entries, null, 2)
}

/**
 * Validate component against registry schema
 * (Future: Use Zod for runtime validation)
 */
export function validateAgainstRegistry(
  componentType: ComponentType,
  params: any
): { valid: boolean; errors?: string[]; warnings?: string[] } {
  const entry = getComponentEntry(componentType)
  if (!entry) {
    // Warn but don't block — renderer may exist even without registry entry
    return { valid: true, warnings: [`No registry entry for type: ${componentType}`] }
  }

  // Basic validation (Phase 1 will add Zod schema validation)
  const required = entry.schema.required || []
  const missing = required.filter((key: string) => !(key in params))

  if (missing.length > 0) {
    return {
      valid: false,
      errors: missing.map((key: string) => `Missing required field: ${key}`),
    }
  }

  return { valid: true }
}
