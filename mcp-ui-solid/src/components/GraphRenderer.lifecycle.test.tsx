import { render, waitFor } from '@solidjs/testing-library';
import { expect, it, vi } from 'vitest';
import { GraphRenderer } from './GraphRenderer';
import type { UIComponent } from '../types';

const pending = vi.hoisted(() => ({
  release: undefined as (() => void) | undefined,
  construct: vi.fn(),
}));
vi.mock('@antv/g6', async () => {
  await new Promise<void>((resolve) => { pending.release = resolve; });
  return { Graph: pending.construct };
});

it('does not construct a graph when its optional import resolves after disposal', async () => {
  const component: UIComponent = {
    id: 'late-graph', type: 'graph', position: { colStart: 1, colSpan: 6 },
    params: { nodes: [{ id: 'a' }] },
  };
  const { unmount } = render(() => <GraphRenderer component={component} />);
  await waitFor(() => expect(pending.release).toBeTypeOf('function'));
  unmount();
  pending.release!();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(pending.construct).not.toHaveBeenCalled();
});
