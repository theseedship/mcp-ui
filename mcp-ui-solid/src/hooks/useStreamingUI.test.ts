/**
 * useStreamingUI — behavioral coverage for the SSE streaming engine.
 *
 * The hook POSTs to /api/mcp/generative-ui-stream and reads an SSE-formatted body via
 * `response.body.getReader()`. These tests stub `fetch` + the reader to drive
 * scripted `status` / `component` / `complete` / `error` events and assert the
 * four behaviors that had zero coverage: progressive accumulation, out-of-order
 * buffering/reorder, terminal (non-recoverable) error, and recoverable-error
 * reconnect with backoff.
 *
 * The hook auto-starts streaming on creation, so `fetch` is stubbed before the
 * hook is instantiated inside a reactive root.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRoot, flush } from 'solid-js'
import { useStreamingUI, type UseStreamingUIOptions } from './useStreamingUI'

const T = '2026-07-03T00:00:00.000Z'

/** One SSE message: an `event:` line + a `data:` line + a blank terminator. */
function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/** A `component` event payload with the given sequence id. */
function comp(seq: number, type = 'metric') {
  return {
    componentId: `c${seq}`,
    sequenceId: seq,
    component: { id: `c${seq}`, type, position: { colStart: 1, colSpan: 12 }, params: {} },
    position: { colStart: 1, colSpan: 12 },
  }
}

/** A `complete` event payload (CompleteMetadata). */
function completeMeta() {
  return {
    layoutId: 'L1',
    componentsCount: 2,
    executionTimeMs: 1234,
    firstTokenMs: 100,
    provider: 'mock',
    model: 'test',
    cached: false,
  }
}

/**
 * A `fetch` stub. Each entry in `callSpecs` scripts one call (subsequent calls
 * reuse the last entry) — either an HTTP failure (`ok: false`) or a readable
 * body that yields the given SSE chunks then closes.
 */
function makeFetchStub(callSpecs: Array<{ ok?: boolean; errorBody?: unknown; chunks?: string[] }>) {
  let call = 0
  return vi.fn(async () => {
    const spec = callSpecs[Math.min(call, callSpecs.length - 1)]
    call++
    if (spec.ok === false) {
      return { ok: false, json: async () => spec.errorBody ?? { message: 'http error' } }
    }
    const encoder = new TextEncoder()
    const chunks = spec.chunks ?? []
    let i = 0
    const reader = {
      read: async () =>
        i < chunks.length
          ? { done: false, value: encoder.encode(chunks[i++]) }
          : { done: true, value: undefined },
    }
    return { ok: true, body: { getReader: () => reader } }
  })
}

const disposers: Array<() => void> = []

/** Instantiate the hook inside a reactive root; returns its public API. */
function renderHook(options: UseStreamingUIOptions) {
  let api!: ReturnType<typeof useStreamingUI>
  createRoot((dispose) => {
    disposers.push(dispose)
    api = useStreamingUI(options)
  })
  return api
}

describe('useStreamingUI', () => {
  afterEach(() => {
    while (disposers.length) disposers.pop()!()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('accumulates components in sequence order and finalizes on complete', async () => {
    const onComplete = vi.fn()
    const onComponentReceived = vi.fn()
    vi.stubGlobal(
      'fetch',
      makeFetchStub([
        {
          chunks: [
            sse('status', { message: 'Working', timestamp: T, totalComponents: 2 }),
            sse('component', comp(0, 'metric')),
            sse('component', comp(1, 'text')),
            sse('complete', completeMeta()),
          ],
        },
      ])
    )

    const api = renderHook({ query: 'revenue', onComplete, onComponentReceived })

    await vi.waitFor(() => expect(api.metadata()).not.toBeNull())

    expect(api.components().map((c) => c.id)).toEqual(['c0', 'c1'])
    expect(api.progress().totalCount).toBe(2)
    expect(api.progress().receivedCount).toBe(2)
    expect(api.metadata()?.executionTime).toBe(1234) // executionTimeMs aliased
    expect(api.isStreaming()).toBe(false)
    expect(api.isLoading()).toBe(false)
    expect(onComponentReceived).toHaveBeenCalledTimes(2)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('buffers an out-of-order component and flushes in sequence order', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub([
        {
          chunks: [
            sse('status', { message: 's', timestamp: T }),
            sse('component', comp(1, 'text')), // arrives before its predecessor
            sse('component', comp(0, 'metric')), // unblocks the buffer
            sse('complete', completeMeta()),
          ],
        },
      ])
    )

    const api = renderHook({ query: 'q' })

    await vi.waitFor(() => expect(api.components().length).toBe(2))
    // Despite arriving 1-then-0, they surface in sequence order.
    expect(api.components().map((c) => c.id)).toEqual(['c0', 'c1'])
  })

  it('surfaces a non-recoverable error and does not reconnect', async () => {
    const onError = vi.fn()
    const fetchStub = makeFetchStub([
      { chunks: [sse('error', { error: 'fatal', message: 'boom', recoverable: false })] },
    ])
    vi.stubGlobal('fetch', fetchStub)

    const api = renderHook({ query: 'q', onError })

    await vi.waitFor(() => expect(api.error()).not.toBeNull())
    expect(api.error()?.message).toBe('boom')
    expect(api.isStreaming()).toBe(false)
    expect(api.isLoading()).toBe(false)
    expect(onError).toHaveBeenCalledTimes(1)

    // A non-recoverable error schedules no retry — fetch stays at one call.
    await new Promise((r) => setTimeout(r, 30))
    expect(fetchStub).toHaveBeenCalledTimes(1)
  })

  it('reconnects with backoff after a recoverable error, then recovers', async () => {
    const onError = vi.fn()
    const fetchStub = makeFetchStub([
      // 1st connection: recoverable error → schedules a reconnect (backoff 1000ms)
      { chunks: [sse('error', { error: 'net', message: 'transient', recoverable: true })] },
      // 2nd connection: succeeds
      {
        chunks: [
          sse('status', { message: 'retry', timestamp: T }),
          sse('component', comp(0, 'metric')),
          sse('complete', completeMeta()),
        ],
      },
    ])
    vi.stubGlobal('fetch', fetchStub)

    const api = renderHook({ query: 'q', onError })

    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    // The reconnect fires a second fetch and the stream recovers.
    await vi.waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(2), { timeout: 2500 })
    await vi.waitFor(() => expect(api.metadata()).not.toBeNull(), { timeout: 2500 })

    expect(api.error()).toBeNull() // reconnect resets error state
    expect(api.components().map((c) => c.id)).toEqual(['c0'])
  })

  it('stops one instance without affecting another or accepting late reader callbacks', async () => {
    const connections: Array<{
      signal: AbortSignal
      deliver: (chunk: string) => void
      cancel: ReturnType<typeof vi.fn>
    }> = []
    const encoder = new TextEncoder()
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      let pendingRead!: (value: ReadableStreamReadResult<Uint8Array>) => void
      const cancel = vi.fn(async () => {})
      const reader = {
        read: () => new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) => { pendingRead = resolve }),
        cancel,
      }
      connections.push({
        signal: init.signal as AbortSignal,
        deliver: (chunk) => pendingRead({ done: false, value: encoder.encode(chunk) }),
        cancel,
      })
      return { ok: true, body: { getReader: () => reader } }
    }))
    const onFirstComplete = vi.fn()
    const onSecondComplete = vi.fn()
    const onError = vi.fn()
    const first = renderHook({ query: 'first', onComplete: onFirstComplete, onError })
    const second = renderHook({ query: 'second', onComplete: onSecondComplete, onError })
    flush()
    await vi.waitFor(() => expect(connections).toHaveLength(2))
    first.stopStreaming()
    flush()
    expect(connections[0].signal.aborted).toBe(true)
    expect(connections[0].cancel).toHaveBeenCalledTimes(1)
    expect(connections[1].signal.aborted).toBe(false)
    connections[0].deliver(sse('component', comp(0)) + sse('complete', completeMeta()))
    connections[1].deliver(sse('component', comp(0)) + sse('complete', completeMeta()))
    await vi.waitFor(() => expect(onSecondComplete).toHaveBeenCalledTimes(1))
    expect(onFirstComplete).not.toHaveBeenCalled()
    expect(first.components()).toEqual([])
    expect(first.isStreaming()).toBe(false)
    expect(second.components()).toHaveLength(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('publishes each event before callbacks inspect state, including several events in one chunk', async () => {
    const seen: number[] = []
    const onComponentReceived = vi.fn(() => { seen.push(api.components().length) })
    const onComplete = vi.fn(() => {
      expect(api.isStreaming()).toBe(false)
      expect(api.isLoading()).toBe(false)
      expect(api.metadata()?.executionTime).toBe(1234)
      expect(api.progress().receivedCount).toBe(2)
    })
    vi.stubGlobal('fetch', makeFetchStub([{ chunks: [
      sse('component', comp(0)) + sse('component', comp(1)) + sse('complete', completeMeta()),
    ] }]))
    const api = renderHook({ query: 'q', onComponentReceived, onComplete })
    flush()
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(seen).toEqual([1, 2])
  })

  it.each(['stop', 'dispose'] as const)('cancels a pending reconnect on %s', async (operation) => {
    vi.useFakeTimers()
    const onError = vi.fn()
    const fetchStub = makeFetchStub([
      { chunks: [sse('error', { error: 'net', message: 'transient', recoverable: true })] },
    ])
    vi.stubGlobal('fetch', fetchStub)
    const api = renderHook({ query: 'q', onError })
    flush()
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    if (operation === 'stop') api.stopStreaming()
    else disposers.pop()!()
    flush()
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetchStub).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(1)
  })
})
