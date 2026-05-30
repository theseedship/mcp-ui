/**
 * DegradedFallback — the middle rung of the renderer fallback ladder
 * (audit 2026-05-30, P2.5).
 *
 * Each heavy renderer (graph / map / chart) follows the same contract:
 *   1. native render when its peer lib is available and succeeds;
 *   2. **degraded but useful** view when the native render throws — this
 *      component: a visible notice + a plain data table so the user still
 *      sees the underlying data instead of a blank space;
 *   3. (the caller also emits a `component:error` telemetry event).
 *
 * Pure / presentational — no peer deps, no side effects — so a render-path
 * failure in a heavy lib can never cascade into the fallback itself, and it
 * is trivially unit-testable. Rows/cells are rendered as text; callers are
 * responsible for stringifying complex cell values.
 */

import { Component, For, Show } from 'solid-js';

export interface DegradedFallbackProps {
  /** Short, human-readable reason the native render was skipped/failed. */
  message: string;
  /**
   * Column headers for the degraded data table. When omitted (or empty),
   * only the notice banner is shown.
   */
  columns?: string[];
  /** Row data — each row is an array of cells aligned to `columns`. */
  rows?: Array<Array<string | number>>;
  /**
   * Caption under the table. Defaults to a generic
   * "interactive view unavailable" line.
   */
  caption?: string;
  /** Max rows to render before truncating (default 50). */
  maxRows?: number;
}

export const DegradedFallback: Component<DegradedFallbackProps> = (props) => {
  const maxRows = () => props.maxRows ?? 50;
  const allRows = () => props.rows ?? [];
  const shownRows = () => allRows().slice(0, maxRows());
  const hiddenCount = () => Math.max(0, allRows().length - shownRows().length);
  const hasTable = () => (props.columns?.length ?? 0) > 0 && allRows().length > 0;

  return (
    <div
      class="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20"
      role="alert"
    >
      <p class="text-sm font-medium text-amber-900 dark:text-amber-100">{props.message}</p>
      <p class="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
        {props.caption ?? 'Showing the underlying data — the interactive view is unavailable.'}
      </p>

      <Show when={hasTable()}>
        <div class="mt-2 max-h-64 overflow-auto rounded border border-amber-200 dark:border-amber-800">
          <table class="w-full border-collapse text-left text-xs">
            <thead class="sticky top-0 bg-amber-100 dark:bg-amber-900/40">
              <tr>
                <For each={props.columns}>
                  {(col) => (
                    <th class="px-2 py-1 font-medium text-amber-900 dark:text-amber-100">{col}</th>
                  )}
                </For>
              </tr>
            </thead>
            <tbody>
              <For each={shownRows()}>
                {(row) => (
                  <tr class="border-t border-amber-100 dark:border-amber-800/60">
                    <For each={props.columns}>
                      {(_col, i) => (
                        <td class="px-2 py-1 text-amber-800 dark:text-amber-200">
                          {String(row[i()] ?? '')}
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <Show when={hiddenCount() > 0}>
          <p class="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
            +{hiddenCount()} more rows not shown.
          </p>
        </Show>
      </Show>
    </div>
  );
};
