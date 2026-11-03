import { render, waitFor } from '@solidjs/testing-library';
import { expect, it, vi } from 'vitest';
import { ChartJSRenderer } from './ChartJSRenderer';
import type { UIComponent } from '../types';

const pending = vi.hoisted(() => ({
  release: undefined as (() => void) | undefined,
  construct: vi.fn(),
}));
vi.mock('chart.js/auto', async () => {
  await new Promise<void>((resolve) => { pending.release = resolve; });
  return { default: pending.construct };
});

it('does not construct a chart when its optional import resolves after disposal', async () => {
  const component: UIComponent = {
    id: 'late-chart', type: 'chart', position: { colStart: 1, colSpan: 6 },
    params: { type: 'bar', data: { labels: ['A'], datasets: [{ data: [1] }] } },
  };
  const { unmount } = render(() => <ChartJSRenderer component={component} />);
  await waitFor(() => expect(pending.release).toBeTypeOf('function'));
  unmount();
  pending.release!();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(pending.construct).not.toHaveBeenCalled();
});
