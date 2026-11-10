/**
 * Tests for scratchpad-store — v5.2.0 createScratchpadStore factory + provider
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import {
  createScratchpadStore,
  dispatchScratchpad,
  useScratchpadState,
  ScratchpadStoreProvider,
} from './scratchpad-store'
import type { ScratchpadEvent } from '../types/chat-bus'

const createEvent = (id: string, title: string): ScratchpadEvent => ({
  id,
  action: 'create',
  title,
  sections: [],
  status: 'ready',
})

describe('createScratchpadStore — v5.2.0', () => {
  beforeEach(() => {
    cleanup()
    // Silence the info/warn logs that dispatch emits
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('two stores do not share state', () => {
    const storeA = createScratchpadStore()
    const storeB = createScratchpadStore()

    storeA.dispatch(createEvent('a', 'Store A'))

    expect(storeA.state()?.id).toBe('a')
    expect(storeA.state()?.title).toBe('Store A')
    expect(storeB.state()).toBeNull()
  })

  it('close() resets state independently per store', () => {
    const storeA = createScratchpadStore()
    const storeB = createScratchpadStore()

    storeA.dispatch(createEvent('a', 'Store A'))
    storeB.dispatch(createEvent('b', 'Store B'))

    storeA.close()

    expect(storeA.state()).toBeNull()
    expect(storeB.state()?.id).toBe('b')
  })

  it('pinned flag is per-store', () => {
    const storeA = createScratchpadStore()
    const storeB = createScratchpadStore()

    storeA.dispatch({ ...createEvent('a', 'A'), pinned: true })
    storeB.dispatch({ ...createEvent('b', 'B'), pinned: false })

    expect(storeA.pinned()).toBe(true)
    expect(storeB.pinned()).toBe(false)
  })

  it('commits consecutive parser updates synchronously without changing section merge semantics', () => {
    const store = createScratchpadStore()
    const section = (id: string, title: string) => ({
      id, title, type: 'message' as const, content: title, editable: false, source: 'agent' as const,
    })
    store.dispatch({ ...createEvent('stream', 'Scratchpad'), sections: [section('a', 'First')] })
    store.dispatch({ id: 'stream', action: 'update', sectionMode: 'append', sections: [section('b', 'Second')] })
    expect(store.state()?.sections.map((value) => value.id)).toEqual(['a', 'b'])
    store.dispatch({ id: 'stream', action: 'update', sectionMode: 'upsert', sections: [section('a', 'Updated')] })
    expect(store.state()?.sections.map((value) => value.title)).toEqual(['Updated', 'Second'])
    store.dispatch({ id: 'different-stream', action: 'update', sections: [] })
    expect(store.state()?.sections).toHaveLength(2)
    store.dispatch({ id: 'stream', action: 'update', sections: [section('c', 'Replacement')], pinned: true })
    expect(store.state()?.sections.map((value) => value.id)).toEqual(['c'])
    expect(store.pinned()).toBe(true)
    store.close()
    expect(store.state()).toBeNull()
    expect(store.pinned()).toBe(false)
  })

  it('ScratchpadStoreProvider without store prop creates a fresh store', () => {
    let capturedState: ReturnType<typeof useScratchpadState> | null = null

    const Child = () => {
      capturedState = useScratchpadState()
      return <div>child</div>
    }

    render(() => (
      <ScratchpadStoreProvider>
        <Child />
      </ScratchpadStoreProvider>
    ))

    expect(capturedState).not.toBeNull()
    expect(capturedState!.state()).toBeNull()
    expect(capturedState!.pinned()).toBe(false)
  })

  it('ScratchpadStoreProvider with explicit store prop binds children to it', () => {
    const scoped = createScratchpadStore()
    scoped.dispatch(createEvent('scoped', 'Scoped title'))

    let capturedState: ReturnType<typeof useScratchpadState> | null = null
    const Child = () => {
      capturedState = useScratchpadState()
      return <div>child</div>
    }

    render(() => (
      <ScratchpadStoreProvider store={scoped}>
        <Child />
      </ScratchpadStoreProvider>
    ))

    expect(capturedState!.state()?.id).toBe('scoped')
    expect(capturedState!.state()?.title).toBe('Scoped title')
  })

  it('useScratchpadState outside provider falls back to module singleton', () => {
    // Reset singleton first by writing a unique id, then verifying dispatch lands on it
    dispatchScratchpad(createEvent('singleton-test', 'Singleton'))

    let capturedState: ReturnType<typeof useScratchpadState> | null = null
    const Child = () => {
      capturedState = useScratchpadState()
      return <div>child</div>
    }

    render(() => <Child />)

    expect(capturedState!.state()?.id).toBe('singleton-test')
    // Cleanup: close singleton for test isolation
    capturedState!.close()
  })

  it('dispatchScratchpad (module fn) only writes to singleton, not scoped stores', () => {
    const scoped = createScratchpadStore()
    dispatchScratchpad(createEvent('global', 'Global'))

    // scoped store is still empty
    expect(scoped.state()).toBeNull()

    // and the singleton carries the dispatched event
    let singletonSnap: ReturnType<typeof useScratchpadState> | null = null
    const Child = () => {
      singletonSnap = useScratchpadState()
      return <div>child</div>
    }
    render(() => <Child />)
    expect(singletonSnap!.state()?.id).toBe('global')
    // Cleanup
    singletonSnap!.close()
  })
})
