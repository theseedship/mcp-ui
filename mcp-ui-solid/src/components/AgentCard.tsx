/**
 * AgentCard — Agent identity + status display
 * v4.1.0: AITL sprint — shows avatar, name, status, capabilities, current step
 *
 * @experimental
 */

import { Show, For } from 'solid-js'
import type { AgentCardContent } from '../types/chat-bus'
import { useMCPUIStrings } from '../context/MCPUIStringsContext'

export interface AgentCardProps {
  content: AgentCardContent
}

const AVATAR_MAP: Record<string, string> = {
  scales: '\u2696\uFE0F',
  chart: '\uD83D\uDCC8',
  search: '\uD83D\uDD0D',
  document: '\uD83D\uDCC4',
  brain: '\uD83E\uDDE0',
  shield: '\uD83D\uDEE1\uFE0F',
  globe: '\uD83C\uDF10',
  robot: '\uD83E\uDD16',
}

/**
 * Status styling. The record stays module-level, but it carries a
 * `labelKey` rather than English: the label is resolved from
 * `useMCPUIStrings()` at render time so a host provider can localize it.
 */
type AgentStatusLabelKey =
  | 'agentStatusIdle'
  | 'agentStatusRunning'
  | 'agentStatusWaiting'
  | 'agentStatusDone'
  | 'agentStatusError'

const STATUS_CONFIG: Record<
  string,
  { labelKey: AgentStatusLabelKey; color: string; pulse: boolean }
> = {
  idle: { labelKey: 'agentStatusIdle', color: 'bg-gray-400', pulse: false },
  running: { labelKey: 'agentStatusRunning', color: 'bg-blue-500', pulse: true },
  waiting: { labelKey: 'agentStatusWaiting', color: 'bg-amber-500', pulse: true },
  done: { labelKey: 'agentStatusDone', color: 'bg-green-500', pulse: false },
  error: { labelKey: 'agentStatusError', color: 'bg-red-500', pulse: false },
}

export function AgentCard(props: AgentCardProps) {
  const strings = useMCPUIStrings()
  const c = () => props.content
  const status = () => STATUS_CONFIG[c().status] || STATUS_CONFIG.idle
  const avatar = () => AVATAR_MAP[c().avatar || ''] || c().avatar || '\uD83E\uDD16'

  if (typeof console !== 'undefined') {
    console.info('[MCP-UI:AgentCard] mounted', {
      agentId: c().agentId, status: c().status, capabilities: c().capabilities,
    })
  }

  return (
    <div class="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-800/50">
      {/* Avatar */}
      <div class="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl">
        {avatar()}
      </div>

      {/* Info */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-medium text-sm text-gray-900 dark:text-white truncate">{c().name}</span>
          {/* Status dot */}
          <span class={`inline-block w-2 h-2 rounded-full ${status().color} ${status().pulse ? 'animate-pulse' : ''}`} title={strings[status().labelKey]} />
          <span class="text-xs text-gray-500 dark:text-gray-400">{strings[status().labelKey]}</span>
        </div>

        {/* Model */}
        <Show when={c().model}>
          <span class="text-xs text-gray-400 dark:text-gray-500">{c().model}</span>
        </Show>

        {/* Capabilities */}
        <Show when={c().capabilities && c().capabilities!.length > 0}>
          <div class="flex flex-wrap gap-1 mt-1.5">
            <For each={c().capabilities}>
              {(cap) => (
                <span class="px-1.5 py-0.5 text-[10px] rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                  {cap}
                </span>
              )}
            </For>
          </div>
        </Show>

        {/* Current step */}
        <Show when={c().currentStep && c().status === 'running'}>
          <div class="mt-1.5 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
            <div class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            {c().currentStep!.label}
          </div>
        </Show>
      </div>
    </div>
  )
}

/**
 * AgentStatusBadge — compact pulse badge for scratchpad header
 */
export interface AgentStatusBadgeProps {
  agentName: string
  status: 'idle' | 'running' | 'waiting' | 'done' | 'error'
}

export function AgentStatusBadge(props: AgentStatusBadgeProps) {
  const strings = useMCPUIStrings()
  const status = () => STATUS_CONFIG[props.status] || STATUS_CONFIG.idle

  return (
    <span class="inline-flex items-center gap-1.5 text-xs">
      <span class={`w-2 h-2 rounded-full ${status().color} ${status().pulse ? 'animate-pulse' : ''}`} />
      <span class="text-gray-600 dark:text-gray-300">{props.agentName}</span>
      <span class="text-gray-400 dark:text-gray-500">{strings[status().labelKey]}</span>
    </span>
  )
}
