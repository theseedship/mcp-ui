import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { flush } from 'solid-js'
import { GenerativeUIErrorBoundary } from './GenerativeUIErrorBoundary'

afterEach(cleanup)

describe('GenerativeUIErrorBoundary Solid 2 recovery', () => {
  it('reports the error and resets its boundary when Retry Rendering is clicked', () => {
    let attempts = 0
    const Child = () => {
      if (attempts++ === 0) throw new Error('first render failed')
      return <p>Recovered content</p>
    }
    const onError = vi.fn()
    const { getByText, getByRole } = render(() => (
      <GenerativeUIErrorBoundary componentId="boundary-test" componentType="text" allowRetry onError={onError}>
        <Child />
      </GenerativeUIErrorBoundary>
    ))
    flush()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toMatchObject({ message: 'first render failed', componentId: 'boundary-test' })
    fireEvent.click(getByRole('button', { name: 'Retry Rendering' }))
    flush()
    expect(getByText('Recovered content')).toBeTruthy()
  })

  it('keeps the public custom fallback Error and retry callback contract', () => {
    let attempts = 0
    const Child = () => {
      if (attempts++ === 0) throw new Error('custom failure')
      return <p>Custom recovery</p>
    }
    const fallback = vi.fn((error: Error, retry?: () => void) => (
      <button onClick={retry}>{error.message}</button>
    ))
    const { getByText } = render(() => (
      <GenerativeUIErrorBoundary componentId="custom-boundary" componentType="text" allowRetry fallback={fallback}>
        <Child />
      </GenerativeUIErrorBoundary>
    ))
    expect(fallback.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(fallback.mock.calls[0][1]).toBeTypeOf('function')
    fireEvent.click(getByText('custom failure'))
    flush()
    expect(getByText('Custom recovery')).toBeTruthy()
  })
})
