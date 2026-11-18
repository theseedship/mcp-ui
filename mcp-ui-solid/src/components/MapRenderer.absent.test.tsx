import { render, waitFor } from '@solidjs/testing-library';
import { expect, it, vi } from 'vitest';
import { MapRenderer } from './MapRenderer';

vi.mock('leaflet', () => { throw new Error('optional leaflet peer absent'); });

it('renders an explicit fallback when the optional map engine is unavailable', async () => {
  const { container } = render(() => <MapRenderer params={{ markers: [{ position: [10, 20] }] }} />);
  await waitFor(() => expect(container.textContent).toContain('Map library could not be loaded.'));
  expect(container.querySelector('table')).toBeTruthy();
});
