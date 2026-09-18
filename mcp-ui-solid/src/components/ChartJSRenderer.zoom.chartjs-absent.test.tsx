/**
 * Chart zoom with the `chart.js` peer itself missing (v6.22.0).
 *
 * `chartjs-plugin-zoom` can be installed without `chart.js` — they are two
 * independent optional peers, and a host that installs the plugin but forgets
 * the library (or ships a build where only the plugin resolves) walks straight
 * into the registration path: the plugin imports fine, then `loadChartJS()`
 * rejects underneath it.
 *
 * The plugin effect is fire-and-forget (`void ensureZoomPlugin().then(…)`) —
 * there is no caller to hand a rejection to and nothing useful it could do
 * with one, since the chart's own render effect already reports the missing
 * library through `onError` and the degraded table. So `ensureZoomPlugin` must
 * absorb it: an unhandled rejection in a consumer's app, from an optional
 * feature they did not ask for, is a bug report they cannot act on.
 *
 * Making the import reject needs its own module registry, hence a file of its
 * own — same reason as `ChartJSRenderer.zoom-absent.test.tsx`.
 */

import { cleanup, render, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UIComponent } from '../types';
import { MCPUIConfigProvider } from '../context/MCPUIConfigContext';
import { ChartJSRenderer } from './ChartJSRenderer';

const zoomPlugin = vi.hoisted(() => ({ id: 'zoom' }));

// The plugin is there…
vi.mock('chartjs-plugin-zoom', () => ({ default: zoomPlugin }));

// …the library it plugs into is not. Throwing from the factory makes
// `import('chart.js/auto')` reject, exactly like an uninstalled peer.
vi.mock('chart.js/auto', () => {
  throw new Error('chart.js not installed (test mock)');
});

function chartComponent(): UIComponent {
  return {
    id: 'chart-no-chartjs',
    type: 'chart',
    position: { colStart: 1, colSpan: 6 },
    params: {
      type: 'bar',
      title: 'Quarterly sales',
      data: { labels: ['Q1', 'Q2'], datasets: [{ label: 'Revenue', data: [10, 20] }] },
      exportable: false,
    },
  } as UIComponent;
}

/** Let Node reach the end of a turn, which is when it judges a rejection unhandled. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('<ChartJSRenderer> zoom when chart.js itself is unimportable', () => {
  afterEach(() => cleanup());

  it('degrades to the data table without an unhandled rejection from the zoom effect', async () => {
    const rejections: unknown[] = [];
    const record = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', record);

    const onError = vi.fn();

    try {
      const { getByRole, queryByLabelText } = render(() => (
        // `'always'` so the plugin effect runs on the inline chart: the
        // rejection must not depend on anyone opening the modal.
        <MCPUIConfigProvider config={{ chartZoom: 'always' }}>
          <ChartJSRenderer component={chartComponent()} onError={onError} />
        </MCPUIConfigProvider>
      ));

      // The chart's own effect reports the missing library — that path is the
      // one the host is meant to see.
      await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(getByRole('table')).toBeTruthy();

      // Zoom simply is not on offer; it does not become a second error.
      expect(queryByLabelText('Zoom in')).toBeNull();
      expect(queryByLabelText('Reset zoom')).toBeNull();

      await settle();
      await settle();
      expect(rejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', record);
    }
  });
});
