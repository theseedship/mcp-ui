import { describe, expect, it } from 'vitest'
import { connectorResultToUILayout } from './connector'

describe('connector lenient envelope with real Zod records', () => {
  it('keeps primary, supplemental, and actions for an unknown schema version', () => {
    const result = connectorResultToUILayout({
      schemaVersion: 'connector-dynamic-result/v2',
      connectorId: 'future-connector',
      toolName: 'future.search',
      query: 'example',
      primary: { id: 'primary', type: 'text', params: { content: 'Primary' } },
      supplemental: [{ id: 'supplemental', type: 'text', params: { content: 'More' } }],
      actions: [{ label: 'Open', action: 'open-url', url: 'https://example.com' }],
    })

    expect(result.id).toBe('connector-degraded-future-connector')
    expect(result.components.map((component) => component.id)).toEqual([
      'connector-version-warning',
      'primary',
      'supplemental',
      'connector-actions',
    ])
    expect(result.components[3].type).toBe('action-group')
  })

  it('returns an explicit degraded notice when a record is not an object', () => {
    const result = connectorResultToUILayout({
      schemaVersion: 'connector-dynamic-result/v2',
      connectorId: 'future-connector',
      toolName: 'future.search',
      query: 'example',
      primary: ['not a component record'],
    })

    expect(result.id).toBe('connector-degraded')
    expect(result.components[0].id).toBe('connector-degraded-notice')
  })
})
