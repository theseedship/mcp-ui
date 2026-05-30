/**
 * Tests for <DegradedFallback> — the middle rung of the renderer fallback
 * ladder (P2.5). Pure presentational component, no peers, no async.
 */

import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { DegradedFallback } from './DegradedFallback';

describe('<DegradedFallback>', () => {
  it('shows the message and a default caption', () => {
    const { getByText, container } = render(() => (
      <DegradedFallback message="Graph rendering failed" />
    ));
    expect(getByText('Graph rendering failed')).toBeTruthy();
    expect(container.textContent).toContain('interactive view is unavailable');
    cleanup();
  });

  it('renders a table when columns + rows are provided', () => {
    const { container } = render(() => (
      <DegradedFallback
        message="failed"
        columns={['Source', 'Target', 'Label']}
        rows={[
          ['a', 'b', 'rel'],
          ['b', 'c', ''],
        ]}
      />
    ));
    const headers = container.querySelectorAll('th');
    expect(headers).toHaveLength(3);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.textContent).toContain('rel');
    cleanup();
  });

  it('shows no table when columns are empty', () => {
    const { container } = render(() => <DegradedFallback message="failed" rows={[['x']]} />);
    expect(container.querySelector('table')).toBeNull();
    cleanup();
  });

  it('truncates rows past maxRows and notes the remainder', () => {
    const rows = Array.from({ length: 5 }, (_, i) => [String(i)]);
    const { container } = render(() => (
      <DegradedFallback message="failed" columns={['n']} rows={rows} maxRows={2} />
    ));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.textContent).toContain('+3 more rows');
    cleanup();
  });

  it('uses a custom caption when provided', () => {
    const { container } = render(() => (
      <DegradedFallback message="failed" caption="custom caption here" />
    ));
    expect(container.textContent).toContain('custom caption here');
    cleanup();
  });
});
