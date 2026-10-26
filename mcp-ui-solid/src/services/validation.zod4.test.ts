import { describe, expect, it, vi } from 'vitest'
import { MetricComponentParamsSchema } from '@seed-ship/mcp-ui-spec'
import { DEFAULT_RESOURCE_LIMITS, validateComponent } from './validation'
import type { UIComponent } from '../types'

const metric: UIComponent = {
  id: 'metric',
  type: 'metric',
  position: { colStart: 1, colSpan: 12 },
  params: { title: 'Score', value: 1 },
}

describe('Solid validation with real Zod schemas', () => {
  it('preserves legacy code and params path for a Zod issue', () => {
    const result = validateComponent({ ...metric, params: { title: '', value: 1 } })

    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'INVALID_METRIC', path: 'params.title' })
    )
  })

  it('accepts a valid metric without errors', () => {
    expect(validateComponent(metric)).toEqual({ valid: true, errors: undefined })
  })

  it('records the pre-existing parser call after a payload-size error', () => {
    const parse = vi.spyOn(MetricComponentParamsSchema, 'safeParse')
    try {
      const result = validateComponent(metric, {
        limits: { ...DEFAULT_RESOURCE_LIMITS, maxPayloadSize: 1 },
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'PAYLOAD_TOO_LARGE', path: 'component' })
      )
      expect(parse).toHaveBeenCalledOnce()
      expect(parse).toHaveBeenCalledWith(metric.params)
    } finally {
      parse.mockRestore()
    }
  })
})
