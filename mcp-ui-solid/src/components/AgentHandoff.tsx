/**
 * AgentHandoff — visualizes agent-to-agent transfer
 * v4.1.0: AITL sprint — "Extracteur -> Analyste : 47 entites transmises"
 *
 * @experimental
 */

import { Show } from 'solid-js'
import type { AgentHandoffContent } from '../types/chat-bus'

export interface AgentHandoffProps {
  content: AgentHandoffContent
}

const AVATAR_MAP: Record<string, string> = {
  scales: '\u2696\uFE0F', chart: '\uD83D\uDCC8', search: '\uD83D\uDD0D',
  document: '\uD83D\uDCC4', brain: '\uD83E\uDDE0', shield: '\uD83D\uDEE1\uFE0F',
  globe: '\uD83C\uDF10', robot: '\uD83E\uDD16',
}

function getAvatar(key?: string): string {
  if (!key) return '\uD83E\uDD16'
  return AVATAR_MAP[key] || key
}

export function AgentHandoff(props: AgentHandoffProps) {
  const c = () => props.content

  if (typeof console !== 'undefined') {
    console.info('[MCP-UI:Handoff] agent transfer', {
      from: c().from.id, to: c().to.id, dataKeys: c().dataKeys,
    })
  }

  return (
    <div class="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-blue-50 via-transparent to-purple-50 dark:from-blue-900/10 dark:via-transparent dark:to-purple-900/10 border border-gray-200 dark:border-gray-700">
      {/* From agent */}
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <span class="text-lg">{getAvatar(c().from.avatar)}</span>
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{c().from.name}</span>
      </div>

      {/* Arrow + data */}
      <div class="flex-1 flex flex-col items-center gap-0.5">
        <div class="flex items-center gap-1 text-gray-400 dark:text-gray-500">
          <div class="h-px flex-1 bg-gray-300 dark:bg-gray-600 min-w-[20px]" />
          <span class="text-xs">&rarr;</span>
          <div class="h-px flex-1 bg-gray-300 dark:bg-gray-600 min-w-[20px]" />
        </div>
        <Show when={c().summary || c().itemCount}>
          <span class="text-[10px] text-gray-500 dark:text-gray-400 text-center">
            {c().summary || `${c().itemCount} items`}
          </span>
        </Show>
      </div>

      {/* To agent */}
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <span class="text-lg">{getAvatar(c().to.avatar)}</span>
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{c().to.name}</span>
      </div>
    </div>
  )
}
