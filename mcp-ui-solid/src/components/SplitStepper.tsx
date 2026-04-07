/**
 * SplitStepper — parallel agent steppers side by side
 * v4.1.0: AITL sprint — 2-3 columns, synthesis row at bottom
 *
 * @experimental
 */

import { For, Show } from 'solid-js'
import type { SplitStepperContent } from '../types/chat-bus'

export interface SplitStepperProps {
  content: SplitStepperContent
}

const STEP_ICONS: Record<string, string> = {
  done: '\u2705',
  active: '\uD83D\uDD04',
  pending: '\u23F3',
  skipped: '\u23ED\uFE0F',
  error: '\u274C',
}

const AGENT_STATUS_COLORS: Record<string, string> = {
  done: 'border-green-400 dark:border-green-600',
  active: 'border-blue-400 dark:border-blue-500',
  pending: 'border-gray-300 dark:border-gray-600',
  error: 'border-red-400 dark:border-red-600',
}

export function SplitStepper(props: SplitStepperProps) {
  const c = () => props.content

  if (typeof console !== 'undefined') {
    console.info('[MCP-UI:SplitStepper] mounted', {
      agents: c().agents.map(a => `${a.id}:${a.status}`),
      synthesis: c().synthesis?.status,
    })
  }

  return (
    <div class="split-stepper">
      {/* Agent columns */}
      <div class="grid gap-3" style={{ "grid-template-columns": `repeat(${Math.min(c().agents.length, 3)}, 1fr)` }}>
        <For each={c().agents}>
          {(agent) => (
            <div class={`rounded-lg border-2 ${AGENT_STATUS_COLORS[agent.status] || AGENT_STATUS_COLORS.pending} p-3`}>
              {/* Agent header */}
              <div class="flex items-center gap-2 mb-2">
                <span class="font-medium text-sm text-gray-900 dark:text-white truncate">{agent.name}</span>
                <span class={`w-2 h-2 rounded-full flex-shrink-0 ${
                  agent.status === 'done' ? 'bg-green-500' :
                  agent.status === 'active' ? 'bg-blue-500 animate-pulse' :
                  agent.status === 'error' ? 'bg-red-500' :
                  'bg-gray-400'
                }`} />
              </div>

              {/* Steps */}
              <div class="space-y-1">
                <For each={agent.steps}>
                  {(step) => (
                    <div class="flex items-center gap-2 text-xs">
                      <span class="flex-shrink-0 w-4 text-center">{STEP_ICONS[step.status] || STEP_ICONS.pending}</span>
                      <span classList={{
                        'text-gray-900 dark:text-white font-medium': step.status === 'active',
                        'text-gray-500 dark:text-gray-400': step.status !== 'active',
                        'line-through opacity-50': step.status === 'skipped',
                      }}>
                        {step.label}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Synthesis row */}
      <Show when={c().synthesis}>
        {(syn) => (
          <div class={`mt-3 p-3 rounded-lg border-2 text-center ${
            syn().status === 'done' ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/10' :
            syn().status === 'active' ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/10' :
            'border-dashed border-gray-300 dark:border-gray-600'
          }`}>
            <div class="flex items-center justify-center gap-2 text-sm">
              <Show when={syn().status === 'active'}>
                <div class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </Show>
              <Show when={syn().status === 'done'}>
                <span>{STEP_ICONS.done}</span>
              </Show>
              <Show when={syn().status === 'pending'}>
                <span class="text-gray-400">{STEP_ICONS.pending}</span>
              </Show>
              <span classList={{
                'font-medium text-blue-700 dark:text-blue-300': syn().status === 'active',
                'font-medium text-green-700 dark:text-green-300': syn().status === 'done',
                'text-gray-500 dark:text-gray-400': syn().status === 'pending',
              }}>
                {syn().label}
              </span>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
