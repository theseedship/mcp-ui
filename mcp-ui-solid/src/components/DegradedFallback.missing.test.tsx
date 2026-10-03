/** <DegradedFallback> — the optional `missing` matrix (v6.24.0). */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@solidjs/testing-library';
import { DegradedFallback } from './DegradedFallback';
import { MCPUIStringsProvider } from '../context/MCPUIStringsContext';

afterEach(() => cleanup());

const columns = ['', 'S'];
const rows = [
  ['A', ''],
  ['B', 2],
];

describe('<DegradedFallback missing>', () => {
  it('renders a flagged cell as the missing-value mark, and one legend under the table', () => {
    const { container } = render(() => (
      <DegradedFallback message="failed" columns={columns} rows={rows} missing={[[false, true], [false, false]]} />
    ));
    const cells = container.querySelectorAll('tbody tr:first-child td');
    expect(cells[0].textContent).toBe('A');
    expect(cells[1].querySelector('[data-mcp-missing-value]')).not.toBeNull();
    expect(cells[1].textContent).toContain('Missing value');
    expect(container.querySelectorAll('[data-mcp-missing-value]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-mcp-missing-legend]')).toHaveLength(1);
    expect(container.querySelector('tbody tr:nth-child(2)')?.textContent).toBe('B2');
  });

  it('is byte-identical without the prop, or with nothing flagged', () => {
    const bare = render(() => <DegradedFallback message="failed" columns={columns} rows={rows} />);
    const bareHtml = bare.container.innerHTML;
    cleanup();
    const none = render(() => (
      <DegradedFallback message="failed" columns={columns} rows={rows} missing={[[false, false], [false, false]]} />
    ));
    expect(none.container.innerHTML).toBe(bareHtml);
    expect(bareHtml).not.toContain('data-mcp-missing');
  });

  it('shows no legend when the only missing cell is truncated away', () => {
    const many = Array.from({ length: 4 }, (_, i) => [`r${i}`, i]);
    const missing = many.map((_r, i) => [false, i === 3]);
    const { container } = render(() => (
      <DegradedFallback message="failed" columns={columns} rows={many} missing={missing} maxRows={2} />
    ));
    expect(container.querySelector('[data-mcp-missing-value]')).toBeNull();
    expect(container.querySelector('[data-mcp-missing-legend]')).toBeNull();
  });

  it('shows the legend when a shown row is flagged although rows are truncated', () => {
    const many = Array.from({ length: 4 }, (_, i) => [`r${i}`, i]);
    const missing = many.map((_r, i) => [false, i === 0]);
    const { container } = render(() => (
      <DegradedFallback message="failed" columns={columns} rows={many} missing={missing} maxRows={2} />
    ));
    expect(container.querySelectorAll('[data-mcp-missing-legend]')).toHaveLength(1);
  });

  it('draws a flag outside the columns nowhere, and uses the localized wording', () => {
    const { container } = render(() => (
      <MCPUIStringsProvider strings={{ missingValue: 'Valeur manquante', missingValueLegend: '« {marker} » = manquant' }}>
        <DegradedFallback message="échec" columns={columns} rows={rows} missing={[[true, true, true]]} />
      </MCPUIStringsProvider>
    ));
    expect(container.querySelectorAll('[data-mcp-missing-value]')).toHaveLength(2);
    expect(container.textContent).toContain('Valeur manquante');
    expect(container.querySelector('[data-mcp-missing-legend]')?.textContent).toBe('« - » = manquant');
  });
});
