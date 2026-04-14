/**
 * Scratchpad Store — singleton reactive state for HITL scratchpad
 * v3.0.3: Eliminates ChatBus relay chain race condition
 *
 * @experimental
 *
 * Parser calls dispatchScratchpad() → store updates → ScratchpadPanel reads reactively.
 * Zero bus, zero relay, zero race condition.
 *
 * **Known limitation (v4.3.9):** This store is a module-level singleton, not
 * a context-scoped factory. Two `ScratchpadPanel` instances in the same app
 * will share the same state. Multi-panel scenarios (e.g. chat + admin dashboard
 * both showing scratchpads simultaneously) are unsupported. Host apps that need
 * isolated scratchpads should not reuse this store — wait for v4.4.0 which
 * will expose `createScratchpadStore()` factory for per-panel instances.
 */

import { createStore, produce } from 'solid-js/store'
import type { ScratchpadState, ScratchpadEvent, ScratchpadSection } from '../types/chat-bus'

const [scratchpadStore, setScratchpadStore] = createStore<{
  current: ScratchpadState | null
  pinned: boolean
}>({ current: null, pinned: false })

/**
 * Hook for the COMPONENT — reads the scratchpad state reactively.
 *
 * @example
 * const { state, pinned, close } = useScratchpadState()
 * <Show when={state()}>
 *   <ScratchpadPanel state={state()!} pinned={pinned()} onClose={close} />
 * </Show>
 */
export function useScratchpadState() {
  return {
    state: () => scratchpadStore.current,
    pinned: () => scratchpadStore.pinned,
    close: () => setScratchpadStore({ current: null, pinned: false }),
  }
}

/**
 * Function for the PARSER/STORE — mutates the scratchpad state.
 * Called from the SSE callback, no bus needed.
 *
 * @example
 * // In your SSE parser callback — ONE LINE
 * onScratchpad: (data) => dispatchScratchpad(data as ScratchpadEvent)
 */
export function dispatchScratchpad(event: ScratchpadEvent): void {
  // DX1: lifecycle logging
  if (event.action === 'create') {
    console.info(
      `%c[MCP-UI] dispatchScratchpad%c create id=${event.id} sections=${event.sections?.length || 0} status=${event.status || 'loading'}${event.pinned ? ' pinned' : ''}`,
      'color: #10b981; font-weight: bold', 'color: inherit'
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
      'color: #3b82f6; font-weight: bold', 'color: inherit'
    )
    setScratchpadStore(produce((s) => {
      if (!s.current || s.current.id !== event.id) {
        console.warn(`[MCP-UI] dispatchScratchpad: update for id=${event.id} but current is ${s.current?.id || 'null'}. Ignoring.`)
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
            const idx = s.current.sections.findIndex((sec: ScratchpadSection) => sec.id === incoming.id)
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
    }))
  } else if (event.action === 'close') {
    console.info(`%c[MCP-UI] dispatchScratchpad%c close id=${event.id}`, 'color: #6b7280; font-weight: bold', 'color: inherit')
    setScratchpadStore({ current: null, pinned: false })
  }
}
