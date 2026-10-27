import { render, waitFor } from '@solidjs/testing-library';
import { expect, it, vi } from 'vitest';
import { MapRenderer } from './MapRenderer';

const pending = vi.hoisted(() => ({
  release: undefined as (() => void) | undefined,
  construct: vi.fn(),
}));
vi.mock('leaflet', async () => {
  await new Promise<void>((resolve) => { pending.release = resolve; });
  return { default: { map: pending.construct } };
});
vi.mock('leaflet/dist/leaflet.css', () => ({}));

it('does not construct a map when its optional import resolves after disposal', async () => {
  const { unmount } = render(() => <MapRenderer params={{ markers: [] }} />);
  await waitFor(() => expect(pending.release).toBeTypeOf('function'));
  unmount();
  pending.release!();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(pending.construct).not.toHaveBeenCalled();
});
