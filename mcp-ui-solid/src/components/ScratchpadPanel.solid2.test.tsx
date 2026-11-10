import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { createMemo, createSignal, flush } from 'solid-js'
import { ScratchpadPanel } from './ScratchpadPanel'
import type { ScratchpadState } from '../types/chat-bus'

const initialState: ScratchpadState = {
  id: 'solid2-lazy-props',
  title: 'Lazy host props',
  sections: [],
  filters: {},
  agentMessages: [],
  status: 'processing',
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ScratchpadPanel Solid 2 lazy host props', () => {
  it('mounts a compiler-lazy conditional pinned prop and keeps complete auto-close reactive', () => {
    const [condition, setCondition] = createSignal(false)
    const [pinned, setPinned] = createSignal(true)
    const [debugEnabled, setDebugEnabled] = createSignal(false)
    const [state, setState] = createSignal(initialState)
    const onClose = vi.fn()

    // This JSX is deliberately host-shaped: @solidjs/vite-plugin compiles the
    // conditional prop getter. Do not precompute or hoist the prop in the app.
    const view = render(() => <ScratchpadPanel
      state={state()}
      pinned={condition() ? false : pinned()}
      debug={debugEnabled() ? true : false}
      autoCloseDelay={50}
      onClose={onClose}
    />)
    expect(view.container.firstElementChild?.classList.contains('sticky')).toBe(true)
    expect(vi.mocked(console.info).mock.calls.filter(([message]) => String(message).includes('Scratchpad created'))).toHaveLength(1)

    setDebugEnabled(true)
    flush()
    setState(current => ({ ...current, status: 'complete' }))
    flush()
    expect(vi.mocked(console.log)).toHaveBeenCalledWith('[ScratchpadPanel:solid2-lazy-props] state', expect.objectContaining({ status: 'complete' }))
    vi.advanceTimersByTime(50)
    expect(onClose).not.toHaveBeenCalled()

    setPinned(false)
    flush()
    expect(view.container.firstElementChild?.classList.contains('sticky')).toBe(false)
    vi.advanceTimersByTime(50)
    expect(onClose).toHaveBeenCalledTimes(1)

    setPinned(true)
    flush()
    setCondition(true)
    flush()
    expect(view.container.firstElementChild?.classList.contains('sticky')).toBe(false)
    view.unmount()
    vi.advanceTimersByTime(50)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    expect(vi.mocked(console.info).mock.calls.filter(([message]) => String(message).includes('Scratchpad created'))).toHaveLength(1)
  })

  it('permits owner-backed first-read memos for pinned and debug without losing debug updates', () => {
    const [pinned, setPinned] = createSignal(true)
    const [debug, setDebug] = createSignal(true)
    const [state, setState] = createSignal(initialState)
    let pinnedMemo: (() => boolean) | undefined
    let debugMemo: (() => boolean) | undefined
    let pinnedFirstReads = 0
    let debugFirstReads = 0

    // Compiler-equivalent lazy prop accessors: the host creates a memo on the
    // first getter read, so reading either prop in a forbidden scope throws.
    const readPinned = () => {
      if (!pinnedMemo) {
        pinnedFirstReads++
        pinnedMemo = createMemo(() => pinned())
      }
      return pinnedMemo()
    }
    const readDebug = () => {
      if (!debugMemo) {
        debugFirstReads++
        debugMemo = createMemo(() => debug())
      }
      return debugMemo()
    }

    const view = render(() => <ScratchpadPanel state={state()} pinned={readPinned()} debug={readDebug()} />)
    expect(pinnedFirstReads).toBe(1)
    expect(debugFirstReads).toBe(1)
    expect(view.container.firstElementChild?.classList.contains('sticky')).toBe(true)
    expect(vi.mocked(console.log)).toHaveBeenCalledWith('[ScratchpadPanel:solid2-lazy-props] state', expect.any(Object))

    setPinned(false)
    setDebug(false)
    flush()
    expect(view.container.firstElementChild?.classList.contains('sticky')).toBe(false)
    vi.mocked(console.log).mockClear()
    setState(current => ({ ...current, status: 'ready' }))
    flush()
    expect(console.log).not.toHaveBeenCalled()
    view.unmount()
  })
})
