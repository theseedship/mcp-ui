import { cleanup, render } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSignal, type JSX } from 'solid-js'
import { MCPUIMathProvider, type MathRenderer, useMCPUIMath } from './MCPUIMathContext'

function capture(ui: (probe: () => JSX.Element) => JSX.Element) {
  let value: ReturnType<typeof useMCPUIMath>
  const Probe = () => {
    value = useMCPUIMath()
    return <span>probe</span>
  }
  render(() => ui(() => <Probe />))
  return value!()
}

describe('MCPUIMathProvider', () => {
  beforeEach(() => cleanup())

  it('is disabled by default', () => {
    expect(capture((probe) => probe())).toBeUndefined()
  })

  it('provides the renderer unchanged', () => {
    const renderer: MathRenderer = (tex) => `<math>${tex}</math>`
    expect(capture((probe) => <MCPUIMathProvider renderMath={renderer}>{probe()}</MCPUIMathProvider>))
      .toBe(renderer)
  })

  it('keeps the provider prop reactive', () => {
    let setRenderer!: (renderer: MathRenderer | null) => void
    let accessor!: ReturnType<typeof useMCPUIMath>
    const Probe = () => {
      accessor = useMCPUIMath()
      return <span>probe</span>
    }
    const Host = () => {
      const [renderer, set] = createSignal<MathRenderer | null>(null)
      setRenderer = (next) => set(() => next)
      return <MCPUIMathProvider renderMath={renderer()}><Probe /></MCPUIMathProvider>
    }
    render(() => <Host />)
    expect(accessor()).toBeUndefined()
    const next: MathRenderer = () => '<math />'
    setRenderer(next)
    expect(accessor()).toBe(next)
  })

  it.each([undefined, null])('disables an inherited renderer with %s', (renderMath) => {
    const outer: MathRenderer = () => '<math />'
    const captured = capture((probe) => (
      <MCPUIMathProvider renderMath={outer}>
        <MCPUIMathProvider renderMath={renderMath}>{probe()}</MCPUIMathProvider>
      </MCPUIMathProvider>
    ))
    expect(captured).toBeUndefined()
  })
})
