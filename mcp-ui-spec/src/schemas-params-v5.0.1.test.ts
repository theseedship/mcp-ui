/**
 * Tests for the 9 primitive component params schemas added in v5.0.1.
 *
 * Each schema gets:
 *   - 1 valid example that parses cleanly (mirrors what mcp-ui-solid renderers
 *     actually consume today)
 *   - 1+ invalid examples that produce a ZodError on the expected path
 *
 * These prepare PR2 (mcp-ui-solid validation.ts → spec-driven Zod refactor).
 */

import { describe, it, expect } from 'vitest'
import {
  ChartComponentParamsSchema,
  TableComponentParamsSchema,
  MetricComponentParamsSchema,
  TextComponentParamsSchema,
  IframeComponentParamsSchema,
  ImageComponentParamsSchema,
  LinkComponentParamsSchema,
  CarouselComponentParamsSchema,
  ArtifactComponentParamsSchema,
} from './schemas'

describe('ChartComponentParamsSchema (v5.0.1)', () => {
  it('parses a valid bar chart', () => {
    const result = ChartComponentParamsSchema.safeParse({
      type: 'bar',
      title: 'Sales Q1',
      data: {
        labels: ['Jan', 'Feb', 'Mar'],
        datasets: [{ label: 'Revenue', data: [100, 200, 150] }],
      },
      renderer: 'auto',
    })
    expect(result.success).toBe(true)
  })

  it('parses {x,y} datasets (Chart.js scatter shape)', () => {
    const result = ChartComponentParamsSchema.safeParse({
      type: 'scatter',
      data: {
        labels: [],
        datasets: [{ label: 'pts', data: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }],
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown chart type', () => {
    const result = ChartComponentParamsSchema.safeParse({
      type: 'pyramid',
      data: { labels: [], datasets: [] },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('type')
    }
  })

  it('rejects missing data', () => {
    const result = ChartComponentParamsSchema.safeParse({ type: 'bar' })
    expect(result.success).toBe(false)
  })
})

describe('TableComponentParamsSchema (v5.0.1)', () => {
  it('parses a valid table', () => {
    const result = TableComponentParamsSchema.safeParse({
      title: 'Users',
      columns: [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'age', label: 'Age' },
      ],
      rows: [{ name: 'Alice', age: 30 }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts virtualize as boolean OR options object', () => {
    expect(
      TableComponentParamsSchema.safeParse({
        columns: [{ key: 'a', label: 'A' }],
        rows: [],
        virtualize: true,
      }).success
    ).toBe(true)

    expect(
      TableComponentParamsSchema.safeParse({
        columns: [{ key: 'a', label: 'A' }],
        rows: [],
        virtualize: { enabled: true, rowHeight: 32, threshold: 50 },
      }).success
    ).toBe(true)
  })

  it('rejects empty columns array', () => {
    const result = TableComponentParamsSchema.safeParse({
      columns: [],
      rows: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects column with empty key', () => {
    const result = TableComponentParamsSchema.safeParse({
      columns: [{ key: '', label: 'X' }],
      rows: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('MetricComponentParamsSchema (v5.0.1)', () => {
  it('parses with required title + value', () => {
    expect(
      MetricComponentParamsSchema.safeParse({ title: 'Revenue', value: 1234 }).success
    ).toBe(true)

    expect(
      MetricComponentParamsSchema.safeParse({ title: 'Status', value: 'OK' }).success
    ).toBe(true)
  })

  it('parses with trend', () => {
    const result = MetricComponentParamsSchema.safeParse({
      title: 'MoM',
      value: 5,
      trend: { value: 12, direction: 'up' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing title', () => {
    const result = MetricComponentParamsSchema.safeParse({ value: 42 })
    expect(result.success).toBe(false)
  })

  it('rejects empty title (matches validation.ts truthy check)', () => {
    const result = MetricComponentParamsSchema.safeParse({ title: '', value: 42 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid trend direction', () => {
    const result = MetricComponentParamsSchema.safeParse({
      title: 'X',
      value: 1,
      trend: { value: 1, direction: 'sideways' },
    })
    expect(result.success).toBe(false)
  })
})

describe('TextComponentParamsSchema (v5.0.1)', () => {
  it('parses with required content', () => {
    expect(TextComponentParamsSchema.safeParse({ content: 'hi' }).success).toBe(true)
  })

  it('parses with markdown flag', () => {
    expect(
      TextComponentParamsSchema.safeParse({ content: '# Title', markdown: true }).success
    ).toBe(true)
  })

  it('rejects missing content', () => {
    expect(TextComponentParamsSchema.safeParse({}).success).toBe(false)
  })

  it('rejects empty content', () => {
    expect(TextComponentParamsSchema.safeParse({ content: '' }).success).toBe(false)
  })
})

describe('IframeComponentParamsSchema (v5.0.1)', () => {
  it('parses with required url', () => {
    expect(
      IframeComponentParamsSchema.safeParse({ url: 'https://quickchart.io/chart?c=...' }).success
    ).toBe(true)
  })

  it('accepts relative + localhost URLs (whitelist is enforced separately)', () => {
    expect(IframeComponentParamsSchema.safeParse({ url: 'http://localhost:3000' }).success).toBe(true)
    expect(IframeComponentParamsSchema.safeParse({ url: '/embed/abc' }).success).toBe(true)
  })

  it('rejects missing url', () => {
    expect(IframeComponentParamsSchema.safeParse({}).success).toBe(false)
  })
})

describe('ImageComponentParamsSchema (v5.0.1)', () => {
  it('parses with required url', () => {
    expect(
      ImageComponentParamsSchema.safeParse({
        url: 'https://example.com/img.png',
        alt: 'Logo',
      }).success
    ).toBe(true)
  })

  it('rejects empty url', () => {
    expect(ImageComponentParamsSchema.safeParse({ url: '' }).success).toBe(false)
  })
})

describe('LinkComponentParamsSchema (v5.0.1)', () => {
  it('parses with url + label', () => {
    expect(
      LinkComponentParamsSchema.safeParse({
        url: 'https://example.com',
        label: 'Open',
        description: 'External resource',
      }).success
    ).toBe(true)
  })

  it('rejects missing url', () => {
    expect(LinkComponentParamsSchema.safeParse({ label: 'oops' }).success).toBe(false)
  })
})

describe('CarouselComponentParamsSchema (v5.0.1)', () => {
  it('parses with non-empty items (items kept opaque, validated by renderer)', () => {
    const result = CarouselComponentParamsSchema.safeParse({
      items: [{ id: 'a', type: 'metric', position: { colStart: 1, colSpan: 6 }, params: {} }],
      height: '300px',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty items array', () => {
    expect(CarouselComponentParamsSchema.safeParse({ items: [] }).success).toBe(false)
  })

  it('rejects missing items', () => {
    expect(CarouselComponentParamsSchema.safeParse({}).success).toBe(false)
  })
})

describe('ArtifactComponentParamsSchema (v5.0.1)', () => {
  it('parses a valid artifact', () => {
    const result = ArtifactComponentParamsSchema.safeParse({
      url: 'https://artifacts.example.com/file.csv',
      filename: 'export.csv',
      mimeType: 'text/csv',
      size: 4096,
      description: 'Q1 export',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing filename', () => {
    expect(
      ArtifactComponentParamsSchema.safeParse({
        url: 'https://x',
        mimeType: 'application/pdf',
      }).success
    ).toBe(false)
  })

  it('rejects negative size', () => {
    expect(
      ArtifactComponentParamsSchema.safeParse({
        url: 'https://x',
        filename: 'a.txt',
        mimeType: 'text/plain',
        size: -1,
      }).success
    ).toBe(false)
  })
})
