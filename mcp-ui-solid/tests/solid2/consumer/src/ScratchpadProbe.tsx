import { createSignal, Show } from 'solid-js'
import { ScratchpadPanel } from '@seed-ship/mcp-ui-solid'
import type { ScratchpadState } from '@seed-ship/mcp-ui-solid'

const initialState: ScratchpadState = {
  id: 'solid2-consumer-scratchpad',
  title: 'Scratchpad host prop probe',
  sections: [],
  filters: {},
  agentMessages: [],
  status: 'processing',
}

export function ScratchpadProbe() {
  const [state, setState] = createSignal(initialState)
  const [pinned, setPinned] = createSignal(true)
  const [debugEnabled, setDebugEnabled] = createSignal(false)
  const [mounted, setMounted] = createSignal(true)
  const [closeCount, setCloseCount] = createSignal(0)

  return <section id="scratchpad-probe">
    <button id="scratchpad-toggle-pin" onClick={() => setPinned(value => !value)}>Toggle scratchpad pin</button>
    <button id="scratchpad-toggle-debug" onClick={() => setDebugEnabled(value => !value)}>Toggle scratchpad debug</button>
    <button id="scratchpad-complete" onClick={() => setState(current => ({ ...current, status: 'complete' }))}>Complete scratchpad</button>
    <button id="scratchpad-unmount" onClick={() => setMounted(false)}>Unmount scratchpad</button>
    <output id="scratchpad-close-count">{closeCount()}</output>
    <Show when={mounted()}>
      <ScratchpadPanel
        state={state()}
        pinned={state().status === 'complete' ? false : pinned()}
        debug={debugEnabled() ? true : false}
        debugOverlay={true}
        autoCloseDelay={40}
        onClose={() => setCloseCount(count => count + 1)}
      />
    </Show>
  </section>
}
