/**
 * Tests for `errorMode` prop on `<UIResourceRenderer>` — v5.4.0 (B.3)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { UIResourceRenderer } from './UIResourceRenderer'
import type { UIComponent, RendererError } from '../types'

// A component that fails `validateComponent()` — colStart=99 violates the 1-12 grid range
const invalidComponent: UIComponent = {
  id: 'broken-1',
  type: 'metric',
  position: { colStart: 99, colSpan: 1 },
  params: { value: 42 },
}

const validComponent: UIComponent = {
  id: 'ok-1',
  type: 'metric',
  position: { colStart: 1, colSpan: 6 },
  params: { title: 'OK', value: 42 },
}

describe('<UIResourceRenderer errorMode> — v5.4.0', () => {
  beforeEach(() => {
    cleanup()
  })

  it("default (no prop) = 'block': renders the red Validation Error card", () => {
    const { getByText } = render(() => <UIResourceRenderer content={invalidComponent} />)
    expect(getByText('Validation Error')).toBeTruthy()
  })

  it("errorMode='block' explicitly: same as default", () => {
    const { getByText } = render(() => (
      <UIResourceRenderer content={invalidComponent} errorMode="block" />
    ))
    expect(getByText('Validation Error')).toBeTruthy()
  })

  it("errorMode='inline-warn': renders compact yellow chip, no big red card", () => {
    const { container, queryByText } = render(() => (
      <UIResourceRenderer content={invalidComponent} errorMode="inline-warn" />
    ))
    expect(queryByText('Validation Error')).toBeNull()

    const chip = container.querySelector('[role="alert"][aria-label="Component validation warning"]')
    expect(chip).toBeTruthy()
    expect(chip!.textContent).toContain('Invalid metric')
    // tooltip carries the error message
    expect(chip!.getAttribute('title')).toBeTruthy()
  })

  it("errorMode='silent': renders nothing in the slot, no error UI", () => {
    const { container, queryByText, queryByRole } = render(() => (
      <UIResourceRenderer content={invalidComponent} errorMode="silent" />
    ))
    expect(queryByText('Validation Error')).toBeNull()
    expect(queryByRole('alert')).toBeNull()
    // The slot wrapper is still in the DOM (grid layout) but has no error UI inside
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it("onError still fires for ALL three modes (consumer can always log)", () => {
    const errors: RendererError[] = []
    const onError = (e: RendererError) => errors.push(e)

    cleanup()
    render(() => (
      <UIResourceRenderer content={invalidComponent} errorMode="block" onError={onError} />
    ))
    cleanup()
    render(() => (
      <UIResourceRenderer content={invalidComponent} errorMode="inline-warn" onError={onError} />
    ))
    cleanup()
    render(() => (
      <UIResourceRenderer content={invalidComponent} errorMode="silent" onError={onError} />
    ))

    expect(errors.length).toBe(3)
    expect(errors.every((e) => e.type === 'validation')).toBe(true)
    expect(errors.every((e) => e.componentId === 'broken-1')).toBe(true)
  })

  it("valid components render normally regardless of errorMode", () => {
    const { queryByText } = render(() => (
      <UIResourceRenderer content={validComponent} errorMode="inline-warn" />
    ))
    // No error UI for a valid component
    expect(queryByText('Validation Error')).toBeNull()
    expect(queryByText('Invalid metric')).toBeNull()
  })
})
