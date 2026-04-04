/**
 * useChatBus — SolidJS hook + context provider for the Chat Bus
 * v2.4.0: Event-driven chat toolkit
 *
 * @experimental — This API may change without major bump until v2.5.0.
 */

import { createContext, useContext, onCleanup, type ParentComponent } from 'solid-js'
import { createChatBus } from '../services/chat-bus'
import type { ChatBus } from '../types/chat-bus'

// ─── Context ─────────────────────────────────────────────────

const ChatBusContext = createContext<ChatBus>()

/**
 * @experimental
 * Provider that creates and shares a ChatBus with all children.
 * Cleans up all listeners on unmount.
 *
 * @example
 * <ChatBusProvider>
 *   <ChatInterfaceStreaming />
 *   <BriefingPanel />
 *   <AgentRouter />
 * </ChatBusProvider>
 */
export const ChatBusProvider: ParentComponent<{ bus?: ChatBus }> = (props) => {
  const bus = props.bus ?? createChatBus()

  onCleanup(() => {
    bus.events.clear()
  })

  return (
    <ChatBusContext.Provider value={bus}>
      {props.children}
    </ChatBusContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────

/**
 * @experimental
 * Access the ChatBus from any child component.
 * Must be used within a `<ChatBusProvider>`.
 *
 * @example
 * function BriefingPanel() {
 *   const bus = useChatBus()
 *
 *   bus.events.on('onBriefing', (event) => {
 *     addBriefing(event.briefing)
 *   })
 *
 *   return <div>...</div>
 * }
 *
 * @example
 * function AgentRouter() {
 *   const bus = useChatBus()
 *
 *   bus.events.on('onStreamEnd', (event) => {
 *     if (event.metadata.needs_clarification) {
 *       bus.commands.exec('showChatPrompt', {
 *         type: 'choice',
 *         title: 'Quelle periode ?',
 *         config: { options: [...] }
 *       })
 *     }
 *   })
 * }
 */
export function useChatBus(): ChatBus {
  const bus = useContext(ChatBusContext)
  if (!bus) {
    throw new Error('useChatBus must be used within a <ChatBusProvider>')
  }
  return bus
}
