/**
 * GraphRenderer (v6.0.0) — generic node-link visualization powered by
 * `@antv/g6 ^5` (peer-optional). Same lazy-load pattern as
 * `ChartJSRenderer` and `MapRenderer` : the heavy lib is dynamically
 * imported only on first mount, and apps that don't install the peer
 * see an informative fallback instead of a crash.
 *
 * Spec : `@seed-ship/mcp-ui-spec@5.0.4` exports `GraphComponentParamsSchema`,
 * `GraphNode`, `GraphEdge`, `GraphLayoutName`, `GraphLayout`,
 * `GraphComponentParams` — the shape consumed here. Domain semantics
 * (`weight` etc.) are opaque to this renderer ; consumers decide what
 * the values mean.
 *
 * Copy + export : the renderer ships with `<ExpandableWrapper>` (default
 * copy = JSON of `{nodes, edges}`) plus a 3-format export menu — **PNG**
 * (visual snapshot via the underlying canvas/SVG), **Mermaid** (markdown
 * / GitHub-renderable `flowchart` syntax), **JSON** (raw reimportable
 * data). All three are computed lazily on click.
 */

import { Component, createSignal, onSettled, flush, Show, For } from 'solid-js';
import type { UIComponent } from '../types';
import type { GraphComponentParams, GraphLayout } from '@seed-ship/mcp-ui-spec';
import { ExpandableWrapper, useExpanded } from './ExpandableWrapper';
import { PortalDropdownMenu } from './PortalDropdownMenu';
import { DegradedFallback } from './DegradedFallback';
import { graphToDegradedTable } from '../utils/degraded-projections';
import { escapeHtml } from '../utils/escape-html';
import { useTelemetry } from '../context/MCPUITelemetryContext';
import { formatMCPUIString, useMCPUIStrings } from '../context/MCPUIStringsContext';
import { observeTheme, readThemeTokens } from '../utils/theme';

const GRAPH_THEME_TOKENS = [
  ...Array.from({ length: 8 }, (_, i) => `--mcp-ui-chart-${i + 1}`),
  '--mcp-ui-chart-grid',
  '--mcp-ui-chart-axis',
  '--mcp-ui-chart-label',
] as const;

/** G6's option mappers outrank datum.style, so explicitly retain the latter. */
function graphThemeOptions(p: GraphComponentParams, tokens: Record<string, string | undefined>) {
  const nodeIndices = new Map(p.nodes.map((node, index) => [node.id, index]));
  return {
    node: {
      style: (datum: any) => {
        const index = nodeIndices.get(datum.id) ?? 0;
        const fill = tokens[`--mcp-ui-chart-${(index % 8) + 1}`];
        return {
          ...(fill ? { fill } : {}),
          ...(tokens['--mcp-ui-chart-axis'] ? { stroke: tokens['--mcp-ui-chart-axis'] } : {}),
          ...(tokens['--mcp-ui-chart-label'] ? { labelFill: tokens['--mcp-ui-chart-label'] } : {}),
          ...datum.style,
        };
      },
    },
    edge: {
      style: (datum: any) => ({
        ...(tokens['--mcp-ui-chart-grid'] ? { stroke: tokens['--mcp-ui-chart-grid'] } : {}),
        ...(tokens['--mcp-ui-chart-label'] ? { labelFill: tokens['--mcp-ui-chart-label'] } : {}),
        ...datum.style,
      }),
    },
  };
}

// Module-scoped lazy import promise — first call triggers the dynamic
// import, subsequent calls reuse the resolved module.
let g6ModulePromise: Promise<typeof import('@antv/g6')> | undefined;

/**
 * Whether the `@antv/g6` peer dependency is installed and importable.
 * Resolves to `true` when the lib is available, `false` otherwise.
 *
 * Mirrors `isChartJSAvailable()` from `ChartJSRenderer`.
 */
export async function isG6Available(): Promise<boolean> {
  try {
    if (!g6ModulePromise) {
      g6ModulePromise = import('@antv/g6');
    }
    await g6ModulePromise;
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the spec layout shorthand or object form into the config object
 * G6 v5 expects. When `layout` is omitted, picks `'force'` if edges are
 * present (universal default) or `'circular'` otherwise.
 */
function resolveLayout(params: GraphComponentParams): { type: string; [key: string]: unknown } {
  const layout: GraphLayout | undefined = params.layout;
  if (layout === undefined) {
    const hasEdges = (params.edges?.length ?? 0) > 0;
    return { type: hasEdges ? 'force' : 'circular' };
  }
  if (typeof layout === 'string') {
    return { type: layout };
  }
  // Object form: spread the passthrough options alongside `type`.
  return { type: layout.type, ...(layout.options ?? {}) };
}

/**
 * Build the G6 v5 `Graph` constructor config from the component params.
 *
 * Pure (no DOM/lib side effects beyond reading `container`), so it can be
 * unit-tested directly without a jsdom render — this is the contract the
 * 2026-05-30 audit (P0.2) wants locked.
 *
 * ⚠️ G6 v5's `renderer` is a factory `(layer) => IRenderer`, NOT a string
 * (that was the v4 contract). Passing the string `'canvas'` / `'svg'` makes
 * G6 throw `renderer is not a function` — and because the default path used
 * to pass the string `'canvas'`, EVERY graph crashed, not just svg. So we
 * **omit `renderer` entirely**: G6 then uses its built-in canvas renderer
 * (documented default `() => new CanvasRenderer()`).
 *
 * `rendererPref: 'svg'` is reserved but NOT wired yet — a real G6 v5 SVG
 * renderer needs the `@antv/g-svg` factory (a transitive dep of `@antv/g6`,
 * not statically resolvable at build time). Until that's wired behind proper
 * optional-peer resolution, svg degrades to the canvas default with a
 * one-time warning. It must NEVER inject a string `renderer`.
 */
export function buildGraphConfig(
  p: GraphComponentParams,
  container?: HTMLElement,
  tokens: Record<string, string | undefined> = {}
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    container,
    data: { nodes: p.nodes, edges: p.edges ?? [] },
    layout: resolveLayout(p),
    behaviors: resolveBehaviors(p),
  };
  if (GRAPH_THEME_TOKENS.some((name) => tokens[name])) {
    Object.assign(config, graphThemeOptions(p, tokens));
  }

  if (p.rendererPref === 'svg') {
    console.warn(
      '[MCP-UI] GraphRenderer: rendererPref "svg" is not yet supported; using the default canvas renderer.'
    );
  }

  if (p.fitView !== false) {
    config.autoFit = 'view';
  }

  if (p.tooltip !== false) {
    config.plugins = [
      {
        type: 'tooltip',
        getContent: (_evt: unknown, items: any[]) => {
          const item = items?.[0];
          if (!item) return '';
          const label = item.label ?? item.id ?? '';
          const data = item.data ? JSON.stringify(item.data) : '';
          // G6 may position HTML outside our subtree. Resolve effective host
          // values at hover time, rather than relying on portal inheritance.
          const theme = readThemeTokens(container, ['--mcp-ui-surface', '--mcp-ui-fg', '--mcp-ui-border']);
          const styles = ['padding:4px 8px'];
          if (theme['--mcp-ui-surface']) styles.push(`background-color:${theme['--mcp-ui-surface']}`);
          if (theme['--mcp-ui-fg']) styles.push(`color:${theme['--mcp-ui-fg']}`);
          if (theme['--mcp-ui-border']) styles.push(`border:1px solid ${theme['--mcp-ui-border']}`);
          return `<div style="${escapeHtml(styles.join(';'))}"><strong>${escapeHtml(String(label))}</strong>${
            data ? `<br><span style="font-size:11px;opacity:0.7">${escapeHtml(data)}</span>` : ''
          }</div>`;
        },
      },
    ];
  }

  return config;
}

/**
 * Build the G6 v5 `behaviors` array from the params interactivity flags.
 * Defaults : drag-canvas + zoom-canvas + drag-element + click-select.
 * Any flag set to `false` opts out.
 */
function resolveBehaviors(params: GraphComponentParams): string[] {
  const behaviors: string[] = [];
  if (params.enableDrag !== false) behaviors.push('drag-element');
  if (params.enableZoom !== false) {
    behaviors.push('zoom-canvas', 'drag-canvas');
  }
  if (params.enableSelect !== false) behaviors.push('click-select');
  return behaviors;
}

/**
 * Pick a sensible Mermaid `flowchart` direction from the resolved layout.
 * `dagre` / `tree` / `mindmap` are top-down hierarchies → TD ; everything
 * else (force, concentric, circular, grid) → LR (default mermaid).
 */
function mermaidDirection(layoutType: string): 'TD' | 'LR' {
  return layoutType === 'dagre' || layoutType === 'tree' || layoutType === 'mindmap' ? 'TD' : 'LR';
}

/**
 * Sanitize a string for use inside a Mermaid node label. Mermaid breaks
 * on raw quotes / brackets / pipes ; we strip the worst offenders.
 */
function mermaidLabel(s: string): string {
  return s
    .replace(/["[\]|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert the graph data to Mermaid `flowchart` syntax. The edge label
 * carries the optional `weight` prefix when present (e.g. `|3| label`).
 */
function toMermaid(params: GraphComponentParams): string {
  const layoutType = resolveLayout(params).type;
  const dir = mermaidDirection(layoutType);
  const lines: string[] = [`flowchart ${dir}`];
  for (const n of params.nodes) {
    const label = mermaidLabel(n.label ?? n.id);
    lines.push(`  ${n.id}["${label}"]`);
  }
  for (const e of params.edges ?? []) {
    const labelParts: string[] = [];
    if (e.weight !== undefined) labelParts.push(String(e.weight));
    if (e.label) labelParts.push(mermaidLabel(e.label));
    const labelText = labelParts.join(' · ');
    if (labelText) {
      lines.push(`  ${e.source} -->|${labelText}| ${e.target}`);
    } else {
      lines.push(`  ${e.source} --> ${e.target}`);
    }
  }
  return lines.join('\n');
}

function toJSON(params: GraphComponentParams): string {
  return JSON.stringify({ nodes: params.nodes, edges: params.edges ?? [] }, null, 2);
}

function downloadBlob(content: string | Blob, filename: string, mimeType?: string): void {
  const blob =
    typeof content === 'string' ? new Blob([content], { type: mimeType ?? 'text/plain' }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface GraphRendererProps {
  component: UIComponent;
  /**
   * Forwarded to the underlying `<ExpandableWrapper>` (v6.3.1).
   * @see ExpandableWrapperProps.toolbarVariant
   */
  toolbarVariant?: 'hover' | 'always-visible';
}

export const GraphRenderer: Component<GraphRendererProps> = (props) => {
  const strings = useMCPUIStrings();
  const params = () => props.component.params as GraphComponentParams;
  const isExpanded = useExpanded();
  const telemetry = useTelemetry();
  const [available, setAvailable] = createSignal<boolean | null>(null);
  const [error, setError] = createSignal<string | undefined>();
  const [exportMenuOpen, setExportMenuOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;
  // v6.4.0 — trigger ref consumed by <PortalDropdownMenu> for positioning
  let exportTriggerRef: HTMLButtonElement | undefined;
  // Loosely typed because G6 is a peer-optional — we don't pull its
  // types into the bundle just to type a transient local handle.
  let graphInstance: any | undefined;
  let stopTheme: (() => void) | undefined;
  let disposed = false;

  onSettled(() => {
    void (async () => {
    const g6Available = await isG6Available();
    if (disposed) return;
    // The canvas lives behind <Show>. This imperative engine boundary must
    // observe the committed DOM before reading its ref, not a staged write.
    flush(() => setAvailable(g6Available));
    if (!g6Available || !containerRef) return;

    try {
      const { Graph } = await g6ModulePromise!;
      if (disposed || !containerRef) return;
      const p = params();
      let tokens = readThemeTokens(containerRef, GRAPH_THEME_TOKENS);
      const config = buildGraphConfig(p, containerRef, tokens);

      graphInstance = new (Graph as any)(config);
      await graphInstance.render();
      if (disposed) return;
      const syncTheme = () => {
        if (!graphInstance || disposed) return;
        const next = readThemeTokens(containerRef, GRAPH_THEME_TOKENS);
        if (GRAPH_THEME_TOKENS.every((name) => next[name] === tokens[name])) return;
        tokens = next;
        graphInstance.setOptions(graphThemeOptions(p, tokens));
        // draw() updates styles without rerunning force layout or auto-fit.
        void Promise.resolve(graphInstance.draw()).catch(() => {});
      };
      stopTheme = observeTheme(containerRef, syncTheme);
      // Rendering/layout is async: a host may have switched themes while it
      // was in flight, before the observer could be attached.
      syncTheme();
    } catch (err) {
      if (disposed) return;
      const message = err instanceof Error ? err.message : strings.graphRenderError;
      setError(message);
      // Fallback ladder (P2.5): the native G6 render threw — emit telemetry
      // so the failure is observable, then degrade to the edge/node table
      // below instead of leaving a blank canvas.
      telemetry?.dispatch({
        type: 'render:error',
        errorMessage: message,
        id: props.component.id ?? '',
        componentType: 'graph',
        ts: Date.now(),
      });
    }
    })();
    return () => {
    disposed = true;
    stopTheme?.();
    try {
      graphInstance?.destroy();
    } catch {
      // G6 destroy can throw on already-destroyed instances or partial
      // init failures — silent because the component is unmounting anyway.
    }
    graphInstance = undefined;
    };
  });

  // ─── Export handlers ────────────────────────────────────────────────
  const handleExportJSON = () => {
    downloadBlob(toJSON(params()), `${graphFilenameStem(params())}.json`, 'application/json');
    setExportMenuOpen(false);
  };

  const handleExportMermaid = () => {
    downloadBlob(toMermaid(params()), `${graphFilenameStem(params())}.mmd`, 'text/plain');
    setExportMenuOpen(false);
  };

  const handleExportPNG = async () => {
    if (!graphInstance) return;
    try {
      // G6 v5 exposes `toDataURL()` on the graph instance.
      const dataUrl: string = await graphInstance.toDataURL?.('image/png');
      if (!dataUrl) {
        // Fallback: try to grab the underlying canvas directly.
        const canvas = containerRef?.querySelector('canvas');
        if (canvas) {
          const url = (canvas as HTMLCanvasElement).toDataURL('image/png');
          await downloadDataUrl(url, `${graphFilenameStem(params())}.png`);
        } else {
          setError(strings.graphPngUnsupported);
        }
      } else {
        await downloadDataUrl(dataUrl, `${graphFilenameStem(params())}.png`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : strings.graphPngExportFailed);
    }
    setExportMenuOpen(false);
  };

  return (
    <Show
      when={available() === true}
      fallback={
        <Show
          when={available() === false}
          fallback={
            // Loading skeleton while we determine peer availability
            <div class="w-full p-4 bg-[color:var(--mcp-ui-surface-muted,var(--color-gray-50,#f9fafb))] dark:bg-[color:var(--mcp-ui-surface,color-mix(in_oklab,var(--color-gray-800,#1f2937)_40%,transparent))] border border-[color:var(--mcp-ui-border,var(--color-gray-200,#e5e7eb))] dark:border-[color:var(--mcp-ui-border,var(--color-gray-700,#374151))] rounded-lg animate-pulse">
              <div class="h-4 w-32 bg-[color:var(--mcp-ui-surface-muted,var(--color-gray-200,#e5e7eb))] dark:bg-[color:var(--mcp-ui-surface-muted,var(--color-gray-700,#374151))] rounded mb-2" />
              <div class="h-3 w-48 bg-[color:var(--mcp-ui-surface-muted,var(--color-gray-200,#e5e7eb))] dark:bg-[color:var(--mcp-ui-surface-muted,var(--color-gray-700,#374151))] rounded" />
            </div>
          }
        >
          <div class="w-full p-4 bg-[color:var(--mcp-ui-warning-soft,var(--color-yellow-50))] dark:bg-[color:var(--mcp-ui-warning-soft,color-mix(in_oklab,var(--color-yellow-900)_20%,transparent))] border border-[color:var(--mcp-ui-warning-border,var(--color-yellow-200))] dark:border-[color:var(--mcp-ui-warning-border,var(--color-yellow-800))] rounded-lg">
            <p class="text-sm font-medium text-[color:var(--mcp-ui-warning,var(--color-yellow-900))] dark:text-[color:var(--mcp-ui-warning,var(--color-yellow-100))]">
              {strings.graphUnavailable}
            </p>
            <p class="text-xs text-[color:var(--mcp-ui-warning,var(--color-yellow-700))] dark:text-[color:var(--mcp-ui-warning,var(--color-yellow-300))] mt-1">
              Install <code>@antv/g6</code> peer dependency to render <code>type: "graph"</code>{' '}
              components.
            </p>
          </div>
        </Show>
      }
    >
      <ExpandableWrapper
        title={params().title ?? strings.graphTitle}
        copyData={toJSON(params())}
        copyLabel={strings.graphCopy}
        toolbarVariant={props.toolbarVariant}
      >
        <div
          class={`relative w-full ${params().className ?? ''} ${
            isExpanded() ? 'flex-1 min-h-0 flex flex-col' : ''
          }`}
        >
          {/* Export menu — top-right, mirrors TableRenderer's pattern */}
          <div class="absolute right-2 top-2 z-10">
            <button
              ref={exportTriggerRef}
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              class="px-2 py-1 text-xs bg-[color:var(--mcp-ui-surface,var(--color-white,#fff))] dark:bg-[color:var(--mcp-ui-surface,var(--color-gray-800,#1f2937))] border border-[color:var(--mcp-ui-border,var(--color-gray-200,#e5e7eb))] dark:border-[color:var(--mcp-ui-border,var(--color-gray-600,#4b5563))] rounded shadow-[var(--mcp-ui-shadow,var(--shadow-sm))] hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-50,#f9fafb))] dark:hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-700,#374151))] text-[color:var(--mcp-ui-fg,var(--color-gray-700,#374151))] dark:text-[color:var(--mcp-ui-fg,var(--color-gray-300,#d1d5db))]"
              title={strings.graphExport}
              aria-label={strings.graphExport}
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen() ? 'true' : 'false'}
            >
              {strings.graphExportMenu}
            </button>
            <PortalDropdownMenu
              open={exportMenuOpen()}
              onClose={() => setExportMenuOpen(false)}
              trigger={exportTriggerRef}
              width={176}
              class="text-xs"
            >
              <For
                each={[
                  {
                    label: strings.graphDownloadPng,
                    onClick: handleExportPNG,
                    hint: strings.graphDownloadPngHint,
                  },
                  {
                    label: strings.graphDownloadMermaid,
                    onClick: handleExportMermaid,
                    hint: strings.graphDownloadMermaidHint,
                  },
                  {
                    label: strings.graphDownloadJson,
                    onClick: handleExportJSON,
                    hint: strings.graphDownloadJsonHint,
                  },
                ]}
              >
                {(item) => (
                  <button
                    type="button"
                    onClick={item.onClick}
                    class="w-full text-left px-3 py-2 hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-100,#f3f4f6))] dark:hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-700,#374151))] text-[color:var(--mcp-ui-fg,var(--color-gray-700,#374151))] dark:text-[color:var(--mcp-ui-fg,var(--color-gray-300,#d1d5db))] border-b border-[color:var(--mcp-ui-border,var(--color-gray-100,#f3f4f6))] dark:border-[color:var(--mcp-ui-border,var(--color-gray-700,#374151))] last:border-b-0"
                  >
                    <div class="font-medium">{item.label}</div>
                    <div class="text-[10px] text-[color:var(--mcp-ui-fg-muted,var(--color-gray-500,#6b7280))] dark:text-[color:var(--mcp-ui-fg-subtle,var(--color-gray-400,#9ca3af))]">
                      {item.hint}
                    </div>
                  </button>
                )}
              </For>
            </PortalDropdownMenu>
          </div>

          {/* Native G6 canvas — hidden once a render error degrades us. */}
          <div
            ref={containerRef}
            class={`mcp-ui-root bg-[color:var(--mcp-ui-surface,var(--color-white,#fff))] dark:bg-[color:var(--mcp-ui-surface,var(--color-gray-800,#1f2937))] rounded-lg shadow-[var(--mcp-ui-shadow,var(--shadow-sm))] border border-[color:var(--mcp-ui-border,var(--color-gray-200,#e5e7eb))] dark:border-[color:var(--mcp-ui-border,var(--color-gray-700,#374151))] overflow-hidden ${
              error() ? 'hidden' : ''
            } ${isExpanded() ? 'flex-1 min-h-0' : ''}`}
            style={
              isExpanded()
                ? `height: 100%; width: ${params().width ?? '100%'};`
                : `height: ${params().height ?? '400px'}; width: ${params().width ?? '100%'};`
            }
          />
          {/* Fallback ladder (P2.5): degrade to an edge/node table on error
              rather than showing a bare message. Export menu stays usable. */}
          <Show when={error()}>
            <DegradedFallback
              message={formatMCPUIString(strings.graphRenderFailed, { error: String(error()) })}
              caption={strings.graphDegradedCaption}
              {...graphToDegradedTable(params(), {
                source: strings.degradedColSource,
                target: strings.degradedColTarget,
                label: strings.degradedColLabel,
                node: strings.degradedColNode,
              })}
            />
          </Show>
        </div>
      </ExpandableWrapper>
    </Show>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────

function graphFilenameStem(params: GraphComponentParams): string {
  const base = (params.title ?? 'graph').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '');
  return base || 'graph';
}

async function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  downloadBlob(blob, filename);
}

// Re-export for tests + consumers that want to compose their own export menu
export { toMermaid as graphToMermaid, toJSON as graphToJSON };
