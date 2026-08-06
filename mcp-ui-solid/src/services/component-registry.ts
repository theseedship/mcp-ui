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
 * Code Block Registry Entry
 */
export const CodeRegistry: ComponentRegistryEntry = {
  type: 'code',
  name: 'CodeBlock',
  description:
    'Render syntax-highlighted code blocks with line numbers, copy button, and word wrap toggle. Supports all languages via highlight.js auto-detection. Best for displaying source code, configuration files, CLI output, or API responses.',
  schema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'The code content to display' },
      language: { type: 'string', description: 'Programming language for syntax highlighting (auto-detected if omitted)' },
      filename: { type: 'string', description: 'Filename shown in header bar' },
      showLineNumbers: { type: 'boolean', description: 'Show line numbers (default: true)' },
      startLine: { type: 'number', description: 'Starting line number (default: 1)' },
      maxHeight: { type: 'string', description: 'CSS max-height for scrollable code blocks' },
      theme: { type: 'string', enum: ['light', 'dark'], description: 'Color theme (follows system preference by default)' },
    },
    required: ['code'],
  },
  examples: [
    {
      query: 'Show me how to connect to the API',
      component: {
        id: 'example-code-1',
        type: 'code',
        position: { colStart: 1, colSpan: 8 },
        params: {
          code: 'const client = new MCPClient({ url: "https://api.example.com" });\nawait client.connect();\nconst result = await client.query("SELECT * FROM documents");',
          language: 'typescript',
          filename: 'example.ts',
        },
      },
    },
  ],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Map Registry Entry
 */
const MAP_LAT_LNG_POINT_SCHEMA = {
  oneOf: [
    {
      type: 'array',
      items: { type: 'number' },
      minItems: 2,
      maxItems: 2,
      description: '[latitude, longitude] tuple',
    },
    {
      type: 'object',
      properties: {
        lat: { type: 'number' },
        lng: { type: 'number' },
      },
      required: ['lat', 'lng'],
      description: '{ lat, lng } object',
    },
  ],
}

const MAP_GEOJSON_SCHEMA = {
  type: 'object',
  description: 'GeoJSON FeatureCollection, Feature, or Geometry',
}

const MAP_GEOJSON_STYLE_SCHEMA = {
  type: 'object',
  properties: {
    fillColor: { type: 'string' },
    fillOpacity: { type: 'number' },
    strokeColor: { type: 'string' },
    strokeWeight: { type: 'number' },
    strokeOpacity: { type: 'number' },
    choroplethField: { type: 'string' },
    choroplethScale: {
      type: 'array',
      items: {
        type: 'array',
        items: { oneOf: [{ type: 'number' }, { type: 'string' }] },
        minItems: 2,
        maxItems: 2,
      },
    },
    choroplethFallback: { type: 'string' },
  },
}

const MAP_POPUP_SCHEMA = {
  type: 'object',
  properties: {
    titleField: { type: 'string' },
    fields: { type: 'array', items: { type: 'string' } },
    template: {
      type: 'string',
      description: 'Trusted-host HTML template; ignored on the default untrusted renderer path',
    },
  },
}

export const MapRegistry: ComponentRegistryEntry = {
  type: 'map',
  name: 'InteractiveMap',
  description:
    'Render interactive maps on the default OpenStreetMap base layer (using Leaflet internally) from already-resolved markers, GeoJSON, named layers, clustering, or PMTiles. The renderer does not geocode place names.',
  schema: {
    type: 'object',
    properties: {
      center: {
        ...MAP_LAT_LNG_POINT_SCHEMA,
        description: 'Initial map center as [lat, lng] or { lat, lng }',
      },
      zoom: { type: 'number', description: 'Initial zoom level (default: 13)' },
      markers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            position: MAP_LAT_LNG_POINT_SCHEMA,
            tooltip: { type: 'string' },
            popup: { type: 'string' },
          },
          required: ['position'],
        },
      },
      height: { type: 'string', description: 'CSS height (default: 400px)' },
      fitBounds: { type: 'boolean', description: 'Auto-fit to rendered markers and features' },
      zoomControl: { type: 'boolean', description: 'Show Leaflet zoom controls' },
      scrollWheelZoom: { type: 'boolean', description: 'Allow scroll-wheel zoom' },
      tileLayer: {
        type: 'string',
        description:
          'Optional base tile URL template (defaults to OpenStreetMap); the host remains responsible for network policy',
      },
      attribution: { type: 'string', description: 'Base-map attribution' },
      className: { type: 'string', description: 'Custom CSS class' },
      geojson: MAP_GEOJSON_SCHEMA,
      geojsonStyle: MAP_GEOJSON_STYLE_SCHEMA,
      popup: MAP_POPUP_SCHEMA,
      layers: {
        type: 'array',
        description: 'Named GeoJSON overlays',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            visible: { type: 'boolean' },
            geojson: MAP_GEOJSON_SCHEMA,
            style: MAP_GEOJSON_STYLE_SCHEMA,
            popup: MAP_POPUP_SCHEMA,
          },
          required: ['name', 'geojson'],
        },
      },
      clustering: {
        oneOf: [
          { type: 'boolean' },
          {
            type: 'object',
            properties: {
              maxClusterRadius: { type: 'number' },
              spiderfyOnMaxZoom: { type: 'boolean' },
              showCoverageOnHover: { type: 'boolean' },
              disableClusteringAtZoom: { type: 'number' },
              animateAddingMarkers: { type: 'boolean' },
            },
          },
        ],
        description: 'Enable marker clustering or provide cluster options',
      },
      pmtiles: {
        type: 'object',
        description: 'PMTiles vector-tile overlay (requires the optional protomaps-leaflet peer)',
        properties: {
          url: { type: 'string' },
          attribution: { type: 'string' },
          paintRules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                dataLayer: { type: 'string' },
                symbolizer: { type: 'string', enum: ['polygon', 'line', 'circle'] },
                color: { type: 'string' },
                width: { type: 'number' },
                opacity: { type: 'number' },
              },
              required: ['dataLayer', 'symbolizer'],
            },
          },
          labelRules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                dataLayer: { type: 'string' },
                textField: { type: 'string' },
                fontSize: { type: 'number' },
              },
              required: ['dataLayer', 'textField'],
            },
          },
          maxZoom: { type: 'number' },
          minZoom: { type: 'number' },
        },
        required: ['url'],
      },
    },
    required: [],
  },
  examples: [
    {
      query: 'Show office locations on a map',
      component: {
        id: 'example-map-1',
        type: 'map',
        position: { colStart: 1, colSpan: 12 },
        params: {
          center: [48.8566, 2.3522],
          zoom: 5,
          markers: [
            { position: [48.8566, 2.3522], tooltip: 'Paris', popup: 'HQ — 120 employees' },
            { position: [51.5074, -0.1278], tooltip: 'London', popup: 'UK Office — 45 employees' },
          ],
          fitBounds: true,
        },
      },
    },
  ],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Graph Registry Entry (v6.12.0 — audit P1.5)
 */
export const GraphRegistry: ComponentRegistryEntry = {
  type: 'graph',
  name: 'NodeLinkGraph',
  description:
    'Render a node-link graph (entities and their relationships) with @antv/g6. Best for provenance/source chains, dependency or process graphs, and ontology-lite entity/relation views. Degrades to an edge table when the graph engine is unavailable.',
  schema: {
    type: 'object',
    properties: {
      nodes: {
        type: 'array',
        description: 'Graph nodes (at least one required)',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            group: { type: 'string' },
          },
          required: ['id'],
        },
      },
      edges: {
        type: 'array',
        description: 'Edges between node ids',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            target: { type: 'string' },
            label: { type: 'string' },
            weight: { type: 'number' },
          },
          required: ['source', 'target'],
        },
      },
      layout: {
        type: 'string',
        enum: ['force', 'radial', 'grid', 'dagre', 'circular'],
        description: 'Layout algorithm (default: force)',
      },
      directed: { type: 'boolean', description: 'Render edges as directed (arrows)' },
    },
    required: ['nodes'],
  },
  examples: [
    {
      query: 'Show how this figure was derived',
      component: {
        id: 'example-graph-1',
        type: 'graph',
        position: { colStart: 1, colSpan: 12 },
        params: {
          directed: true,
          layout: 'dagre',
          nodes: [
            { id: 'claim', label: 'Population = 522 250', group: 'claim' },
            { id: 'source', label: 'INSEE 2021', group: 'source' },
          ],
          edges: [{ source: 'claim', target: 'source', label: 'derived from' }],
        },
      },
    },
  ],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Form Registry Entry
 */
export const FormRegistry: ComponentRegistryEntry = {
  type: 'form',
  name: 'Form',
  description:
    'Render interactive forms with text inputs, selects, checkboxes, date pickers, and conditional fields. Supports persistence, validation, and submit actions that trigger MCP tool calls.',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Form title' },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            label: { type: 'string' },
            type: { type: 'string', enum: ['text', 'number', 'email', 'password', 'textarea', 'select', 'checkbox', 'radio', 'date'] },
            required: { type: 'boolean' },
            placeholder: { type: 'string' },
            options: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } } } },
          },
          required: ['name', 'label', 'type'],
        },
      },
      submitLabel: { type: 'string', description: 'Submit button text (default: "Submit")' },
      layout: { type: 'string', enum: ['vertical', 'horizontal', 'inline'] },
    },
    required: ['fields'],
  },
  examples: [
    {
      query: 'Create a document upload form',
      component: {
        id: 'example-form-1',
        type: 'form',
        position: { colStart: 1, colSpan: 6 },
        params: {
          title: 'Upload Document',
          fields: [
            { name: 'title', label: 'Document Title', type: 'text', required: true },
            { name: 'category', label: 'Category', type: 'select', options: [{ label: 'Report', value: 'report' }, { label: 'Invoice', value: 'invoice' }] },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ],
          submitLabel: 'Upload',
        },
      },
    },
  ],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Modal Registry Entry
 */
export const ModalRegistry: ComponentRegistryEntry = {
  type: 'modal',
  name: 'Modal',
  description:
    'Render a dialog overlay with Portal rendering. Supports sizes from small to fullscreen, close on Escape/backdrop, and nested content. Best for confirmations, detail views, and focused interactions.',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Modal header title' },
      size: { type: 'string', enum: ['sm', 'md', 'lg', 'xl', 'full'], description: 'Modal width (default: md)' },
      showClose: { type: 'boolean', description: 'Show close button (default: true)' },
      closeOnEscape: { type: 'boolean', description: 'Close on Escape key (default: true)' },
      closeOnBackdrop: { type: 'boolean', description: 'Close on backdrop click (default: true)' },
      maxHeight: { type: 'string', description: 'CSS max-height for scrollable content' },
    },
    required: [],
  },
  examples: [
    {
      query: 'Show document details in a dialog',
      component: {
        id: 'example-modal-1',
        type: 'modal',
        position: { colStart: 1, colSpan: 12 },
        params: {
          title: 'Document Details',
          size: 'lg',
        },
      },
    },
  ],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Action Group Registry Entry
 */
export const ActionGroupRegistry: ComponentRegistryEntry = {
  type: 'action-group',
  name: 'ActionGroup',
  description:
    'Render a group of action buttons in horizontal, vertical, or grid layout. Each action triggers an MCP tool call. Best for presenting multiple related actions like CRUD operations or workflow steps.',
  schema: {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            toolName: { type: 'string' },
            params: { type: 'object' },
            variant: { type: 'string', enum: ['primary', 'secondary', 'danger', 'ghost'] },
            icon: { type: 'string' },
          },
          required: ['label', 'toolName'],
        },
      },
      layout: { type: 'string', enum: ['horizontal', 'vertical', 'grid'], description: 'Button layout' },
      label: { type: 'string', description: 'Group label' },
    },
    required: ['actions'],
  },
  examples: [
    {
      query: 'Show actions for this document',
      component: {
        id: 'example-action-group-1',
        type: 'action-group',
        position: { colStart: 1, colSpan: 6 },
        params: {
          label: 'Document Actions',
          actions: [
            { label: 'Download', type: 'button', action: 'tool-call', toolName: 'document_download', params: { id: '123' }, variant: 'primary' },
            { label: 'Share', type: 'button', action: 'tool-call', toolName: 'document_share', params: { id: '123' }, variant: 'secondary' },
            { label: 'Delete', type: 'button', action: 'tool-call', toolName: 'document_delete', params: { id: '123' }, variant: 'danger' },
          ],
          layout: 'horizontal',
        },
      },
    },
  ],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Image Gallery Registry Entry
 */
export const ImageGalleryRegistry: ComponentRegistryEntry = {
  type: 'image-gallery',
  name: 'ImageGallery',
  description:
    'Render a grid of images with lightbox overlay for fullscreen viewing. Supports captions, configurable columns, aspect ratios, and keyboard navigation in lightbox mode.',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Gallery title' },
      images: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Image URL' },
            alt: { type: 'string', description: 'Alt text' },
            caption: { type: 'string', description: 'Caption text' },
            thumbnail: { type: 'string', description: 'Thumbnail URL (optional, falls back to url)' },
          },
          required: ['url'],
        },
      },
      columns: { type: 'number', enum: [2, 3, 4, 5], description: 'Grid columns (default: 3)' },
      aspectRatio: { type: 'string', enum: ['1:1', '16:9', '4:3', 'auto'] },
      lightbox: { type: 'boolean', description: 'Enable lightbox overlay (default: true)' },
    },
    required: ['images'],
  },
  examples: [
    {
      query: 'Show document thumbnails',
      component: {
        id: 'example-gallery-1',
        type: 'image-gallery',
        position: { colStart: 1, colSpan: 12 },
        params: {
          title: 'Recent Documents',
          images: [
            { url: '/thumbnails/doc1.png', alt: 'Q4 Report', caption: 'Q4 Report — 24 pages' },
            { url: '/thumbnails/doc2.png', alt: 'Invoice #4521', caption: 'Invoice #4521' },
          ],
          columns: 4,
        },
      },
    },
  ],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Video Registry Entry
 */
export const VideoRegistry: ComponentRegistryEntry = {
  type: 'video',
  name: 'Video',
  description:
    'Embed video from YouTube, Vimeo, or direct URLs. Auto-detects provider from URL and renders appropriate embed. Supports aspect ratios, autoplay, and start time.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Video URL (YouTube, Vimeo, or direct)' },
      title: { type: 'string', description: 'Video title' },
      caption: { type: 'string', description: 'Caption below video' },
      aspectRatio: { type: 'string', enum: ['16:9', '4:3', '1:1', '21:9'], description: 'Aspect ratio (default: 16:9)' },
      autoplay: { type: 'boolean', description: 'Auto-play video' },
      startTime: { type: 'number', description: 'Start time in seconds' },
    },
    required: ['url'],
  },
  examples: [
    {
      query: 'Show the product demo video',
      component: {
        id: 'example-video-1',
        type: 'video',
        position: { colStart: 1, colSpan: 8 },
        params: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Product Demo',
          aspectRatio: '16:9',
        },
      },
    },
  ],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Iframe Registry Entry
 */
export const IframeRegistry: ComponentRegistryEntry = {
  type: 'iframe',
  name: 'Iframe',
  description:
    'Embed external content via sandboxed iframe. Domain whitelist enforced for security. Supports Mermaid diagrams, Excalidraw, GitHub Gists, Figma, and 60+ whitelisted domains.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to embed (must be on whitelist)' },
      title: { type: 'string', description: 'Iframe title for accessibility' },
      height: { type: 'string', description: 'CSS height (default: 400px)' },
      sandbox: { type: 'string', description: 'Sandbox attribute (default: restrictive)' },
    },
    required: ['url'],
  },
  examples: [
    {
      query: 'Show the architecture diagram',
      component: {
        id: 'example-iframe-1',
        type: 'iframe',
        position: { colStart: 1, colSpan: 12 },
        params: {
          url: 'https://mermaid.ink/svg/graph+TD;A-->B;B-->C',
          title: 'Architecture Diagram',
          height: '500px',
        },
      },
    },
  ],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Image Registry Entry
 */
export const ImageRegistry: ComponentRegistryEntry = {
  type: 'image',
  name: 'Image',
  description:
    'Render a single image with optional alt text, caption, and link. Best for logos, screenshots, diagrams, or any standalone visual content.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Image URL' },
      alt: { type: 'string', description: 'Alt text for accessibility' },
      title: { type: 'string', description: 'Image title / heading' },
      width: { type: 'string', description: 'CSS width' },
      height: { type: 'string', description: 'CSS height' },
    },
    required: ['url'],
  },
  examples: [
    {
      query: 'Show the company logo',
      component: {
        id: 'example-image-1',
        type: 'image',
        position: { colStart: 1, colSpan: 4 },
        params: {
          url: '/images/logo.png',
          alt: 'Company Logo',
        } as any,
      },
    },
  ],
  limits: DEFAULT_RESOURCE_LIMITS,
}

/**
 * Link Registry Entry
 */
export const LinkRegistry: ComponentRegistryEntry = {
  type: 'link',
  name: 'Link',
  description:
    'Render a styled link card with title, description, and URL. Best for navigation, references, and external resource links.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Link destination URL' },
      label: { type: 'string', description: 'Link display text' },
      description: { type: 'string', description: 'Link description' },
      icon: { type: 'string', description: 'Icon identifier' },
    },
    required: ['url', 'label'],
  },
  examples: [
    {
      query: 'Link to the API documentation',
      component: {
        id: 'example-link-1',
        type: 'link',
        position: { colStart: 1, colSpan: 4 },
        params: {
          url: 'https://docs.example.com/api',
          label: 'API Documentation',
          description: 'Full reference for the REST API',
        } as any,
      },
    },
  ],
  limits: DEFAULT_RESOURCE_LIMITS,
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
  // v2.2.5: Complete registry
  ['code', CodeRegistry],
  ['map', MapRegistry],
  ['graph', GraphRegistry], // v6.12.0: audit P1.5 — registry/schema parity

  ['form', FormRegistry],
  ['modal', ModalRegistry],
  ['action-group', ActionGroupRegistry],
  ['image-gallery', ImageGalleryRegistry],
  ['video', VideoRegistry],
  ['iframe', IframeRegistry],
  ['image', ImageRegistry],
  ['link', LinkRegistry],
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
