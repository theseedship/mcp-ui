/**
 * VerifiedText — renders LLM text with inline verification badges
 * v3.1.0: Highlights verified vs hallucinated numbers
 *
 * @experimental
 *
 * Modes:
 * - highlight: ✅/⚠️ badges next to numbers (default)
 * - strip: replaces hallucinated numbers with [non vérifié]
 * - annotate: tooltip on hover with closest source number
 */

import { createMemo, For } from 'solid-js'
import type { DataValidation, HallucinatedNumber } from '../types/chat-bus'

export interface VerifiedTextProps {
  text: string
  validation: DataValidation
  /** Display mode (default: 'highlight') */
  mode?: 'highlight' | 'strip' | 'annotate'
  /** Callback when a hallucinated number is clicked */
  onHallucinationClick?: (item: HallucinatedNumber) => void
}

interface TextSegment {
  type: 'text' | 'verified' | 'hallucinated'
  content: string
  item?: HallucinatedNumber
}

/**
 * Build annotated segments by splitting text at number positions.
 * Verified numbers get ✅, hallucinated get ⚠️.
 */
function buildAnnotatedSegments(text: string, validation: DataValidation): TextSegment[] {
  // Build position maps
  const hallucinatedPositions = new Map<number, HallucinatedNumber>()
  for (const h of validation.hallucinated) {
    hallucinatedPositions.set(h.position, h)
  }

  const verifiedPositions = new Set<number>()
  for (const n of validation.llmNumbers) {
    if (!hallucinatedPositions.has(n.position)) {
      verifiedPositions.add(n.position)
    }
  }

  // Build all number positions sorted
  const allPositions = validation.llmNumbers
    .map(n => ({ position: n.position, length: n.context.length - 20 })) // approximate original match length
    .sort((a, b) => a.position - b.position)

  // Re-extract number lengths from text for precise splitting
  const numberRegex = /\d[\d\s,.]*\d|\d+/g
  const matches: Array<{ start: number; end: number }> = []
  let m: RegExpExecArray | null
  while ((m = numberRegex.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length })
  }

  // Build a lookup from position → match
  const matchByPosition = new Map<number, { start: number; end: number }>()
  for (const match of matches) {
    matchByPosition.set(match.start, match)
  }

  // Build segments
  const segments: TextSegment[] = []
  let cursor = 0

  for (const num of validation.llmNumbers) {
    const match = matchByPosition.get(num.position)
    if (!match) continue

    // Text before this number
    if (match.start > cursor) {
      segments.push({ type: 'text', content: text.slice(cursor, match.start) })
    }

    const numberText = text.slice(match.start, match.end)
    const hallucinated = hallucinatedPositions.get(num.position)

    if (hallucinated) {
      segments.push({ type: 'hallucinated', content: numberText, item: hallucinated })
    } else {
      segments.push({ type: 'verified', content: numberText })
    }

    cursor = match.end
  }

  // Remaining text
  if (cursor < text.length) {
    segments.push({ type: 'text', content: text.slice(cursor) })
  }

  return segments
}

export function VerifiedText(props: VerifiedTextProps) {
  const mode = () => props.mode || 'highlight'

  const segments = createMemo<TextSegment[]>(() => {
    if (!props.validation || props.validation.valid) {
      return [{ type: 'text' as const, content: props.text }]
    }
    return buildAnnotatedSegments(props.text, props.validation)
  })

  return (
    <div class="verified-text text-sm leading-relaxed">
      <For each={segments()}>
        {(seg) => {
          if (seg.type === 'text') {
            return <span>{seg.content}</span>
          }

          if (seg.type === 'verified') {
            return (
              <span
                class="inline-flex items-center gap-0.5 px-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300"
                title="Verified against source data"
              >
                {seg.content}
                <span class="text-xs opacity-70" aria-label="verified">&#x2705;</span>
              </span>
            )
          }

          // hallucinated
          const h = seg.item!
          const tooltipText = () => {
            if (h.closest != null && h.distance != null) {
              return `Not found in source data. Closest: ${h.closest} (${Math.round(h.distance * 100)}% off)`
            }
            return 'Not found in source data'
          }

          if (mode() === 'strip') {
            return (
              <span
                class="inline-flex items-center px-1 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 italic text-xs"
                title={tooltipText()}
              >
                [non v&eacute;rifi&eacute;]
              </span>
            )
          }

          return (
            <span
              class="inline-flex items-center gap-0.5 px-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 cursor-help"
              title={tooltipText()}
              onClick={() => props.onHallucinationClick?.(h)}
              role={props.onHallucinationClick ? 'button' : undefined}
            >
              {seg.content}
              <span class="text-xs" aria-label="unverified">&#x26A0;&#xFE0F;</span>
            </span>
          )
        }}
      </For>

      {/* Confidence bar */}
      {props.validation && !props.validation.valid && (
        <div class="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <div class="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              classList={{
                'bg-green-500': props.validation.confidence >= 0.8,
                'bg-amber-500': props.validation.confidence >= 0.5 && props.validation.confidence < 0.8,
                'bg-red-500': props.validation.confidence < 0.5,
              }}
              style={{ width: `${Math.round(props.validation.confidence * 100)}%` }}
            />
          </div>
          <span>
            {Math.round(props.validation.confidence * 100)}% verified
            ({props.validation.hallucinated.length} unverified)
          </span>
        </div>
      )}
    </div>
  )
}
