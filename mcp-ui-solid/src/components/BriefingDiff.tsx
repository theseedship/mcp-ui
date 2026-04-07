/**
 * BriefingDiff — highlight changes between two briefings
 * v4.1.0: AITL sprint — added/removed/changed entries with color coding
 *
 * @experimental
 */

import { For, Show } from 'solid-js'
import type { BriefingDiffContent } from '../types/chat-bus'

export interface BriefingDiffProps {
  content: BriefingDiffContent
}

const CHANGE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  added: { icon: '+', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-900/10' },
  removed: { icon: '\u2212', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/10' },
  changed: { icon: '\u2194', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/10' },
}

export function BriefingDiff(props: BriefingDiffProps) {
  const c = () => props.content

  if (typeof console !== 'undefined') {
    console.info('[MCP-UI:BriefingDiff] mounted', {
      changes: c().changes.length,
      stats: c().stats,
    })
  }

  return (
    <div class="briefing-diff space-y-2">
      {/* Header */}
      <Show when={c().title || c().previousDate || c().currentDate}>
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <Show when={c().title}><span class="font-medium">{c().title}</span></Show>
          <Show when={c().previousDate && c().currentDate}>
            <span>{c().previousDate} &rarr; {c().currentDate}</span>
          </Show>
        </div>
      </Show>

      {/* Stats summary */}
      <Show when={c().stats}>
        {(stats) => (
          <div class="flex items-center gap-3 text-xs">
            <Show when={stats().added > 0}>
              <span class="text-green-600 dark:text-green-400">+{stats().added} added</span>
            </Show>
            <Show when={stats().removed > 0}>
              <span class="text-red-600 dark:text-red-400">{stats().removed} removed</span>
            </Show>
            <Show when={stats().changed > 0}>
              <span class="text-amber-600 dark:text-amber-400">{stats().changed} changed</span>
            </Show>
          </div>
        )}
      </Show>

      {/* Change list */}
      <div class="space-y-1">
        <For each={c().changes}>
          {(change) => {
            const cfg = CHANGE_CONFIG[change.type] || CHANGE_CONFIG.changed
            return (
              <div class={`flex items-start gap-2 px-2 py-1.5 rounded ${cfg.bg}`}>
                <span class={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${cfg.color}`}>
                  {cfg.icon}
                </span>
                <div class="flex-1 min-w-0">
                  <span class={`text-sm font-medium ${cfg.color}`}>{change.label}</span>
                  <Show when={change.type === 'changed' && change.previous && change.current}>
                    <div class="mt-0.5 text-xs">
                      <span class="text-red-500 line-through">{change.previous}</span>
                      <span class="mx-1 text-gray-400">&rarr;</span>
                      <span class="text-green-600 dark:text-green-400">{change.current}</span>
                    </div>
                  </Show>
                  <Show when={change.type === 'added' && change.current}>
                    <div class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{change.current}</div>
                  </Show>
                  <Show when={change.type === 'removed' && change.previous}>
                    <div class="mt-0.5 text-xs text-gray-500 line-through">{change.previous}</div>
                  </Show>
                </div>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}
