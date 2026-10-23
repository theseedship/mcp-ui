import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { flush } from 'solid-js'
import { FormRenderer } from './FormRenderer'
import { FormFieldRenderer } from './FormFieldRenderer'
import type { FormComponentParams, UIComponent } from '../types'

vi.mock('../hooks/useAction', () => ({ useAction: () => ({ execute: vi.fn().mockResolvedValue({ success: true }) }) }))
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.unstubAllGlobals() })

const form = (params: FormComponentParams): UIComponent => ({
  id: 'migration-form', type: 'form', position: { colStart: 1, colSpan: 12 }, params,
})

describe('form Solid 2 lifecycle', () => {
  it('merges restored persistence with committed prefill and defaults', () => {
    localStorage.setItem('mcp-ui-form:migration', JSON.stringify({ version: 1, timestamp: Date.now(), data: { city: 'Stored Paris' } }))
    const { getByLabelText } = render(() => <FormRenderer component={form({
      persistKey: 'migration', fields: [
        { name: 'city', type: 'text', label: 'City', prefill: 'Initial city' },
        { name: 'year', type: 'text', label: 'Year', defaultValue: '2026' },
      ],
    })} />)
    flush()
    expect((getByLabelText('City') as HTMLInputElement).value).toBe('Stored Paris')
    expect((getByLabelText('Year') as HTMLInputElement).value).toBe('2026')
  })

  it('cancels countdown after input and disposes its interval on unmount', () => {
    vi.useFakeTimers()
    const onSubmit = vi.fn()
    const { getByRole, queryByText, unmount } = render(() => <FormRenderer component={form({
      autoSubmitDelay: 5000, fields: [{ name: 'city', type: 'text', label: 'City', required: true, prefill: 'Paris' }],
    })} onSubmit={onSubmit} />)
    expect(queryByText('Submit in 5s...')).toBeTruthy()
    fireEvent.input(getByRole('textbox'), { target: { value: 'Lyon' } })
    flush()
    expect(queryByText('Submit in 5s...')).toBeNull()
    vi.advanceTimersByTime(6000)
    flush()
    expect(onSubmit).not.toHaveBeenCalled()
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('displays a resolved single prefill label without reading a staged map write', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ label: 'Paris label', code: '75056' }] }))
    const onChange = vi.fn()
    const { getByRole } = render(() => <FormFieldRenderer field={{
      name: 'city', label: 'City', type: 'autocomplete', prefill: 'Paris', prefillMode: 'resolve',
      apiUrl: 'https://example.invalid/search', searchParam: 'q', labelField: 'label', valueField: 'code',
    }} value="" onChange={onChange} />)
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('75056')
      expect((getByRole('textbox') as HTMLInputElement).value).toBe('Paris label')
    })
  })
})
