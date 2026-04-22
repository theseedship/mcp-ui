/**
 * Tests for server-capabilities-store — v5.3.0
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { createEffect, createRoot } from 'solid-js'
import {
  createServerCapabilitiesStore,
  setServerCapabilities,
  useServerCapabilities,
  ServerCapabilitiesProvider,
} from './server-capabilities-store'
import type { ServerInitializeInfo } from './server-capabilities-store'

const sampleInfo: ServerInitializeInfo = {
  protocolVersion: '2025-06-18',
  serverInfo: { name: 'deposium-mcp', version: '1.4.2' },
  capabilities: {
    tools: { listChanged: true },
    prompts: { listChanged: false },
    resources: { listChanged: true, subscribe: false },
  },
  instructions: 'Use deposium_chat for synthesis questions.',
}

describe('createServerCapabilitiesStore — v5.3.0', () => {
  beforeEach(() => {
    cleanup()
    setServerCapabilities(null) // reset module singleton between tests
  })

  it('two factory stores do not share state', () => {
    const storeA = createServerCapabilitiesStore()
    const storeB = createServerCapabilitiesStore()

    storeA.set(sampleInfo)

    expect(storeA.info()?.serverInfo.name).toBe('deposium-mcp')
    expect(storeB.info()).toBeNull()
  })

  it('accessors return null until set is called', () => {
    const store = createServerCapabilitiesStore()

    expect(store.info()).toBeNull()
    expect(store.capabilities()).toBeNull()
    expect(store.serverInfo()).toBeNull()
    expect(store.protocolVersion()).toBeNull()
    expect(store.hasCapability('tools')).toBe(false)
  })

  it('set(info) populates all derived accessors', () => {
    const store = createServerCapabilitiesStore()
    store.set(sampleInfo)

    expect(store.protocolVersion()).toBe('2025-06-18')
    expect(store.serverInfo()?.version).toBe('1.4.2')
    expect(store.capabilities()?.tools?.listChanged).toBe(true)
  })

  it('set(null) clears the store', () => {
    const store = createServerCapabilitiesStore()
    store.set(sampleInfo)
    expect(store.info()).not.toBeNull()

    store.set(null)
    expect(store.info()).toBeNull()
    expect(store.hasCapability('tools')).toBe(false)
  })

  it('hasCapability returns true for present keys, false for absent', () => {
    const store = createServerCapabilitiesStore()
    store.set(sampleInfo)

    expect(store.hasCapability('tools')).toBe(true)
    expect(store.hasCapability('prompts')).toBe(true)
    expect(store.hasCapability('resources')).toBe(true)
    expect(store.hasCapability('logging')).toBe(false)
    expect(store.hasCapability('completions')).toBe(false)
    expect(store.hasCapability('experimental')).toBe(false)
  })
})

describe('setServerCapabilities + useServerCapabilities (singleton path)', () => {
  beforeEach(() => {
    cleanup()
    setServerCapabilities(null)
  })

  it('useServerCapabilities falls back to module singleton outside provider', () => {
    setServerCapabilities(sampleInfo)

    let captured: ReturnType<typeof useServerCapabilities> | null = null
    const Probe = () => {
      captured = useServerCapabilities()
      return null
    }
    render(() => <Probe />)

    expect(captured).not.toBeNull()
    expect(captured!.serverInfo()?.name).toBe('deposium-mcp')
    expect(captured!.hasCapability('tools')).toBe(true)
  })

  it('singleton state survives across renders', () => {
    setServerCapabilities(sampleInfo)

    const captures: Array<string | undefined> = []
    const Probe = () => {
      const { serverInfo } = useServerCapabilities()
      captures.push(serverInfo()?.name)
      return null
    }
    render(() => <Probe />)
    render(() => <Probe />)

    expect(captures).toEqual(['deposium-mcp', 'deposium-mcp'])
  })
})

describe('ServerCapabilitiesProvider scoping', () => {
  beforeEach(() => {
    cleanup()
    setServerCapabilities(null)
  })

  it('provider with explicit store overrides the singleton for descendants', () => {
    setServerCapabilities(sampleInfo) // singleton has deposium-mcp

    const scopedStore = createServerCapabilitiesStore()
    scopedStore.set({
      ...sampleInfo,
      serverInfo: { name: 'other-mcp', version: '0.1.0' },
    })

    let inside: string | undefined
    let outside: string | undefined

    const Inside = () => {
      inside = useServerCapabilities().serverInfo()?.name
      return null
    }
    const Outside = () => {
      outside = useServerCapabilities().serverInfo()?.name
      return null
    }

    render(() => (
      <>
        <Outside />
        <ServerCapabilitiesProvider store={scopedStore}>
          <Inside />
        </ServerCapabilitiesProvider>
      </>
    ))

    expect(outside).toBe('deposium-mcp')
    expect(inside).toBe('other-mcp')
  })

  it('provider without store creates a fresh isolated handle', () => {
    setServerCapabilities(sampleInfo)

    let inside: ReturnType<typeof useServerCapabilities> | null = null
    const Inside = () => {
      inside = useServerCapabilities()
      return null
    }
    render(() => (
      <ServerCapabilitiesProvider>
        <Inside />
      </ServerCapabilitiesProvider>
    ))

    expect(inside).not.toBeNull()
    expect(inside!.info()).toBeNull() // fresh, not the singleton's state
  })

  it('set() updates trigger reactive effects', () => {
    const store = createServerCapabilitiesStore()
    const captures: Array<string | null> = []

    let dispose: (() => void) | undefined
    createRoot((d) => {
      dispose = d
      createEffect(() => {
        captures.push(store.serverInfo()?.name ?? null)
      })
    })

    // Initial effect run
    expect(captures).toEqual([null])

    store.set(sampleInfo)
    expect(captures).toEqual([null, 'deposium-mcp'])

    store.set({ ...sampleInfo, serverInfo: { name: 'renamed', version: '2.0.0' } })
    expect(captures).toEqual([null, 'deposium-mcp', 'renamed'])

    store.set(null)
    expect(captures).toEqual([null, 'deposium-mcp', 'renamed', null])

    dispose?.()
  })
})
