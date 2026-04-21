/**
 * Scratchpad Store — reactive state for HITL scratchpad
 *
 * @experimental
 *
 * **v5.2.0 :** the store is now a factory (`createScratchpadStore()`) with a
 * module-level singleton kept as default. Two consumption modes :
 *
 * 1. **Singleton mode (default, zero-config)** — `dispatchScratchpad(event)` +
 *    `useScratchpadState()` read/write the module singleton. This is the v4.x
 *    path and keeps working unchanged.
 *
 * 2. **Multi-instance mode** — wrap a subtree in `<ScratchpadStoreProvider>`
 *    (it creates a scoped `ScratchpadStoreHandle` internally, or use your own
 *    via the `store` prop). `useScratchpadState()` auto-detects the context
 *    and reads from it; `ScratchpadPanel` mounted inside the provider reads
 *    the scoped store. Non-reactive callers (SSE parsers) should pass the
 *    handle explicitly — do NOT try to reach context from a non-reactive
 *    scope.
 */

import { createContext, useContext, type ParentComponent, type JSX } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import type { ScratchpadState, ScratchpadEvent, ScratchpadSection } from '../types/chat-bus'

// ─── Handle shape ─────────────────────────────────────────────

export interface ScratchpadStoreHandle {
  /** Mutate the store from an SSE/parser callback. */
  dispatch: (event: ScratchpadEvent) => void
  /** Reactive accessor for the current scratchpad state (null when closed). */
  state: () => ScratchpadState | null
  /** Reactive accessor for the pinned flag. */
  pinned: () => boolean
  /** Close the scratchpad (equivalent to dispatching an action='close'). */
  close: () => void
}

// ─── Factory ──────────────────────────────────────────────────

/**
 * Create an isolated scratchpad store instance.
 *
 * Use this when you need two or more scratchpads live at the same time
 * (e.g. chat scratchpad + admin dashboard scratchpad). Pair with
 * `<ScratchpadStoreProvider store={...}>` to scope a SolidJS subtree.
 *
 * @experimental
 * @since v5.2.0
 */
export function createScratchpadStore(): ScratchpadStoreHandle {
  const [scratchpadStore, setScratchpadStore] = createStore<{
    current: ScratchpadState | null
    pinned: boolean
  }>({ current: null, pinned: false })

  const dispatch = (event: ScratchpadEvent): void => {
    if (event.action === 'create') {
      console.info(
        `%c[MCP-UI] dispatchScratchpad%c create id=${event.id} sections=${event.sections?.length || 0} status=${event.status || 'loading'}${event.pinned ? ' pinned' : ''}`,
        'color: #10b981; font-weight: bold',
        'color: inherit'
      )
      setScratchpadStore({
        current: {
          id: event.id,
          title: event.title || '',
          sections: event.sections || [],
          filters: event.filters || {},
          preview: event.preview,
          agentMessages: event.agentMessages || [],
          status: event.status || 'loading',
          previewEndpoint: (event as any).previewEndpoint,
          previewDebounce: (event as any).previewDebounce,
          previewMethod: (event as any).previewMethod,
          previewHeaders: (event as any).previewHeaders,
          turn: (event as any).turn,
          totalTurns: (event as any).totalTurns,
          turnHistory: (event as any).turnHistory,
        },
        pinned: event.pinned || false,
      })
    } else if (event.action === 'update') {
      console.info(
        `%c[MCP-UI] dispatchScratchpad%c update id=${event.id} sectionMode=${event.sectionMode || 'replace'} sections=${event.sections?.length || 0} status=${event.status || '-'}`,
        'color: #3b82f6; font-weight: bold',
        'color: inherit'
      )
      setScratchpadStore(
        produce((s) => {
          if (!s.current || s.current.id !== event.id) {
            console.warn(
              `[MCP-UI] dispatchScratchpad: update for id=${event.id} but current is ${s.current?.id || 'null'}. Ignoring.`
            )
            return
          }

          if (event.sections) {
            const mode = event.sectionMode || 'replace'
            if (mode === 'replace') {
              s.current.sections = event.sections
            } else if (mode === 'append') {
              s.current.sections = [...s.current.sections, ...event.sections]
            } else if (mode === 'upsert') {
              let matchCount = 0
              for (const incoming of event.sections) {
                const idx = s.current.sections.findIndex(
                  (sec: ScratchpadSection) => sec.id === incoming.id
                )
                if (idx >= 0) {
                  s.current.sections[idx] = incoming
                  matchCount++
                } else {
                  s.current.sections.push(incoming)
                }
              }
              if (matchCount === 0 && event.sections.length > 0) {
                console.warn(
                  `[MCP-UI] dispatchScratchpad: sectionMode='upsert' but no IDs matched. ` +
                    `Incoming: [${event.sections.map((s: ScratchpadSection) => s.id).join(', ')}] ` +
                    `Existing: [${s.current.sections.map((s: ScratchpadSection) => s.id).join(', ')}]. All appended.`
                )
              }
            }
          }
          if (event.agentMessages) s.current.agentMessages = event.agentMessages
          if (event.status) s.current.status = event.status
          if (event.filters) s.current.filters = event.filters
          if (event.preview) s.current.preview = event.preview
          if (event.pinned != null) s.pinned = event.pinned
          if ((event as any).turnHistory) s.current.turnHistory = (event as any).turnHistory
          if ((event as any).turn != null) s.current.turn = (event as any).turn
        })
      )
    } else if (event.action === 'close') {
      console.info(
        `%c[MCP-UI] dispatchScratchpad%c close id=${event.id}`,
        'color: #6b7280; font-weight: bold',
        'color: inherit'
      )
      setScratchpadStore({ current: null, pinned: false })
    }
  }

  return {
    dispatch,
    state: () => scratchpadStore.current,
    pinned: () => scratchpadStore.pinned,
    close: () => setScratchpadStore({ current: null, pinned: false }),
  }
}

// ─── Module-level singleton (v4.x-compatible default) ─────────

const defaultStore: ScratchpadStoreHandle = createScratchpadStore()

/**
 * Function for the PARSER/STORE — mutates the **module-level singleton**
 * scratchpad state. Use this when you only need one scratchpad at a time
 * (single-instance consumer, the v4.x pattern).
 *
 * For multi-instance scenarios, prefer `createScratchpadStore()` and pass the
 * handle around explicitly.
 *
 * @example
 * // In your SSE parser callback — ONE LINE
 * onScratchpad: (data) => dispatchScratchpad(data as ScratchpadEvent)
 */
export function dispatchScratchpad(event: ScratchpadEvent): void {
  defaultStore.dispatch(event)
}

// ─── Context (v5.2.0) ─────────────────────────────────────────

/**
 * Context for a scoped scratchpad store. Populated by
 * `<ScratchpadStoreProvider>`. Read by `useScratchpadState()` with automatic
 * fallback to the module-level singleton when the context is absent.
 *
 * @experimental
 * @since v5.2.0
 */
export const ScratchpadStoreContext = createContext<ScratchpadStoreHandle | undefined>(undefined)

/**
 * Provide a scoped `ScratchpadStoreHandle` to a SolidJS subtree. Children
 * reading via `useScratchpadState()` or rendering a `<ScratchpadPanel>` will
 * bind to this store instead of the module singleton.
 *
 * If no `store` prop is passed, a fresh store is created for the provider's
 * lifetime. Pass `store` explicitly when you need the handle outside the
 * tree (e.g. in an SSE parser that lives at the app root).
 *
 * @experimental
 * @since v5.2.0
 *
 * @example
 * const chatStore = createScratchpadStore()
 * const adminStore = createScratchpadStore()
 *
 * <ScratchpadStoreProvider store={chatStore}>
 *   <ChatInterface />
 * </ScratchpadStoreProvider>
 * <ScratchpadStoreProvider store={adminStore}>
 *   <AdminDashboard />
 * </ScratchpadStoreProvider>
 */
export const ScratchpadStoreProvider: ParentComponent<{
  store?: ScratchpadStoreHandle
}> = (props): JSX.Element => {
  const store = props.store ?? createScratchpadStore()
  return (
    <ScratchpadStoreContext.Provider value={store}>{props.children}</ScratchpadStoreContext.Provider>
  )
}

// ─── Reactive hook (context-aware) ────────────────────────────

/**
 * Hook for the COMPONENT — reads the scratchpad state reactively.
 *
 * **v5.2.0 :** if called inside a `<ScratchpadStoreProvider>`, reads the
 * scoped handle; otherwise falls back to the module singleton. Old v4.x
 * consumers keep working unchanged.
 *
 * @example
 * const { state, pinned, close } = useScratchpadState()
 * <Show when={state()}>
 *   <ScratchpadPanel state={state()!} pinned={pinned()} onClose={close} />
 * </Show>
 */
export function useScratchpadState(): {
  state: () => ScratchpadState | null
  pinned: () => boolean
  close: () => void
} {
  const scoped = useContext(ScratchpadStoreContext)
  const handle = scoped ?? defaultStore
  return {
    state: handle.state,
    pinned: handle.pinned,
    close: handle.close,
  }
}
