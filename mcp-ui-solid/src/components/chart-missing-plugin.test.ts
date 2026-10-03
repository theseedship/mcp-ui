/**
 * chart-missing-plugin — the Chart.js pieces added for missing values (v6.24.0),
 * driven with a fake canvas context and a fake chart / dataset meta / elements.
 */

import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_MCPUI_STRINGS } from '../context/MCPUIStringsContext';
import {
  MISSING_BAR_FALLBACK_COLOR,
  MISSING_BAR_STUB_LENGTH,
  NO_DATA_TEXT_COLOR,
  applyUnitAxisTitle,
  createMissingLegendGenerator,
  createMissingValuesPlugin,
  createTooltipLabel,
  drawMissingBarStubs,
  drawNoDataText,
  isStackedChart,
  missingNoteKind,
  withDatasetsNoGapSpan,
} from './chart-missing-plugin';

const strings = () => DEFAULT_MCPUI_STRINGS;

function fakeCtx() {
  const calls: Array<[string, ...unknown[]]> = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
    };
  const ctx: any = {
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    rect: record('rect'),
    clip: record('clip'),
    setLineDash: record('setLineDash'),
    strokeRect: record('strokeRect'),
    fillText: record('fillText'),
  };
  return { ctx, calls, names: () => calls.map((c) => c[0]) };
}

interface FakeBar {
  x: number;
  y: number;
  base: number;
  width: number;
  height: number;
  horizontal?: boolean;
}

const element = (bar: FakeBar, finalOverride?: Partial<FakeBar>) => ({
  ...bar,
  getProps: vi.fn((_keys: string[], final: boolean) => ({ ...bar, ...(final ? finalOverride : {}) })),
});

const AREA = { left: 40, top: 10, right: 340, bottom: 210, width: 300, height: 200 };

function fakeChart(
  ctx: unknown,
  datasets: Array<{ data: unknown[]; borderColor?: unknown }>,
  metas: Array<{ type: string; data: unknown[]; vScale?: unknown; iScale?: unknown }>,
  extra: Record<string, unknown> = {}
) {
  return {
    ctx,
    chartArea: AREA,
    data: { datasets },
    getDatasetMeta: (i: number) => metas[i],
    isDatasetVisible: () => true,
    ...extra,
  };
}

describe('drawMissingBarStubs', () => {
  it('strokes a dashed stub at the base of a missing vertical bar, as thick as the bar', () => {
    const { ctx, calls, names } = fakeCtx();
    const bar = element({ x: 100, y: 210, base: 210, width: 30, height: 0 });
    const chart = fakeChart(
      ctx,
      [{ data: [5, null], borderColor: '#f00' }],
      [{ type: 'bar', data: [element({ x: 60, y: 100, base: 210, width: 30, height: 110 }), bar] }]
    );
    drawMissingBarStubs(chart);

    // Only the missing slot is drawn, and final positions are read.
    expect(bar.getProps).toHaveBeenCalledWith(['x', 'y', 'base', 'width', 'height'], true);
    expect(calls.filter((c) => c[0] === 'strokeRect')).toEqual([
      ['strokeRect', 85, 210 - MISSING_BAR_STUB_LENGTH, 30, MISSING_BAR_STUB_LENGTH],
    ]);
    expect(calls).toContainEqual(['setLineDash', [4, 3]]);
    expect(ctx.strokeStyle).toBe('#f00');
    expect(ctx.lineWidth).toBe(1);
    // Clipped to the chart area, inside one save/restore.
    expect(calls).toContainEqual(['rect', 40, 10, 300, 200]);
    expect(names().indexOf('clip')).toBeGreaterThan(names().indexOf('save'));
    expect(names().indexOf('clip')).toBeLessThan(names().indexOf('strokeRect'));
    expect(names().filter((n) => n === 'save')).toHaveLength(1);
    expect(names().filter((n) => n === 'restore')).toHaveLength(1);
    expect(names()[names().length - 1]).toBe('restore');
  });

  it('draws a horizontal stub (indexAxis y) whose thickness is the bar height', () => {
    const { ctx, calls } = fakeCtx();
    const bar = element({ x: 40, y: 80, base: 40, width: 0, height: 24, horizontal: true });
    drawMissingBarStubs(fakeChart(ctx, [{ data: [null] }], [{ type: 'bar', data: [bar] }]));
    expect(calls.filter((c) => c[0] === 'strokeRect')).toEqual([
      ['strokeRect', 40, 68, MISSING_BAR_STUB_LENGTH, 24],
    ]);
  });

  it('runs the stub toward the middle of the chart area when the base is at the top / right', () => {
    const { ctx, calls } = fakeCtx();
    const top = element({ x: 100, y: 10, base: 10, width: 20, height: 0 });
    const right = element({ x: 340, y: 80, base: 340, width: 0, height: 20, horizontal: true });
    drawMissingBarStubs(
      fakeChart(ctx, [{ data: [null] }, { data: [null] }], [
        { type: 'bar', data: [top] },
        { type: 'bar', data: [right] },
      ])
    );
    const rects = calls.filter((c) => c[0] === 'strokeRect');
    expect(rects[0]).toEqual(['strokeRect', 90, 10, 20, MISSING_BAR_STUB_LENGTH]);
    expect(rects[1]).toEqual(['strokeRect', 340 - MISSING_BAR_STUB_LENGTH, 70, MISSING_BAR_STUB_LENGTH, 20]);
  });

  it('uses the final position of an animating bar', () => {
    const { ctx, calls } = fakeCtx();
    const bar = element({ x: 0, y: 0, base: 0, width: 10, height: 0 }, { x: 150, y: 210, base: 210, width: 40 });
    drawMissingBarStubs(fakeChart(ctx, [{ data: [null] }], [{ type: 'bar', data: [bar] }]));
    expect(calls.find((c) => c[0] === 'strokeRect')).toEqual([
      'strokeRect',
      130,
      210 - MISSING_BAR_STUB_LENGTH,
      40,
      MISSING_BAR_STUB_LENGTH,
    ]);
  });

  it('picks the dataset border colour per index, and falls back to grey', () => {
    const { ctx } = fakeCtx();
    const strokes: string[] = [];
    Object.defineProperty(ctx, 'strokeStyle', {
      set: (v: string) => strokes.push(v),
      get: () => undefined,
    });
    const el = () => element({ x: 100, y: 210, base: 210, width: 30, height: 0 });
    drawMissingBarStubs(
      fakeChart(
        ctx,
        [
          { data: [1, null], borderColor: ['#a', '#b'] },
          { data: [null], borderColor: undefined },
          { data: [null], borderColor: () => '#fn' },
        ],
        [
          { type: 'bar', data: [el(), el()] },
          { type: 'bar', data: [el()] },
          { type: 'bar', data: [el()] },
        ]
      )
    );
    expect(strokes).toEqual(['#b', MISSING_BAR_FALLBACK_COLOR, MISSING_BAR_FALLBACK_COLOR]);
  });

  it('draws nothing for non-bar datasets, hidden datasets, present values or unusable geometry', () => {
    const { ctx, calls } = fakeCtx();
    const el = () => element({ x: 100, y: 210, base: 210, width: 30, height: 0 });
    drawMissingBarStubs(
      fakeChart(
        ctx,
        [{ data: [null] }, { data: [null] }, { data: [4] }, { data: [null] }, { data: [null] }],
        [
          { type: 'line', data: [el()] },
          { type: 'bar', data: [el()] },
          { type: 'bar', data: [el()] },
          { type: 'bar', data: [element({ x: NaN, y: 1, base: 1, width: 3, height: 0 })] },
          { type: 'bar', data: [] },
        ],
        { isDatasetVisible: (i: number) => i !== 1 }
      )
    );
    expect(calls).toEqual([]);
  });

  it('treats a mixed chart per dataset meta type, and a bar controller without meta.type', () => {
    const { ctx, calls } = fakeCtx();
    const el = () => element({ x: 100, y: 210, base: 210, width: 30, height: 0 });
    drawMissingBarStubs(
      fakeChart(
        ctx,
        [{ data: [null] }, { data: [null] }],
        [
          { type: 'line', data: [el()] },
          { type: undefined as any, data: [el()], controller: { constructor: { id: 'bar' } } } as any,
        ]
      )
    );
    expect(calls.filter((c) => c[0] === 'strokeRect')).toHaveLength(1);
  });

  it('never throws on a partial chart', () => {
    expect(() => drawMissingBarStubs(undefined)).not.toThrow();
    expect(() => drawMissingBarStubs({})).not.toThrow();
    expect(() => drawMissingBarStubs({ ctx: fakeCtx().ctx, chartArea: AREA, data: {} })).not.toThrow();
  });
});

describe('drawMissingBarStubs on stacked bars', () => {
  // A stacked bar has no baseline of its own: it starts where the series below
  // ends, so a dashed stub at the axis would point at the wrong series.
  const stacked = (stackedFlag: boolean) => ({ options: { stacked: stackedFlag } });
  const missingBar = () => element({ x: 100, y: 210, base: 210, width: 30, height: 0 });

  it.each([
    ['value scale (meta.vScale.options.stacked)', { vScale: stacked(true) }],
    ['index scale (meta.iScale.options.stacked)', { iScale: stacked(true) }],
    ['both scales', { vScale: stacked(true), iScale: stacked(true) }],
  ])('draws nothing for a missing bar when the %s is stacked', (_name, scales) => {
    const { ctx, calls } = fakeCtx();
    const bar = missingBar();
    drawMissingBarStubs(fakeChart(ctx, [{ data: [null] }], [{ type: 'bar', data: [bar], ...scales }]));
    expect(calls).toEqual([]);
    // Skipped before any geometry is read.
    expect(bar.getProps).not.toHaveBeenCalled();
  });

  it('still draws the stub when the scales are present but not stacked', () => {
    const { ctx, calls } = fakeCtx();
    drawMissingBarStubs(
      fakeChart(
        ctx,
        [{ data: [null] }],
        [{ type: 'bar', data: [missingBar()], vScale: stacked(false), iScale: stacked(false) }]
      )
    );
    expect(calls.filter((c) => c[0] === 'strokeRect')).toHaveLength(1);
  });

  it('decides per dataset: a stacked dataset is skipped, an unstacked one next to it is drawn', () => {
    const { ctx, calls } = fakeCtx();
    drawMissingBarStubs(
      fakeChart(
        ctx,
        [{ data: [null] }, { data: [null] }],
        [
          { type: 'bar', data: [missingBar()], vScale: stacked(true) },
          { type: 'bar', data: [missingBar()], vScale: stacked(false) },
        ]
      )
    );
    expect(calls.filter((c) => c[0] === 'strokeRect')).toHaveLength(1);
  });

  it('draws nothing through the plugin hook either', () => {
    const { ctx, calls } = fakeCtx();
    const plugin = createMissingValuesPlugin({ allMissing: false, getNoDataText: () => 'nothing' });
    plugin.afterDatasetsDraw(
      fakeChart(
        ctx,
        [{ data: [null] }],
        [{ type: 'bar', data: [missingBar()], vScale: stacked(true), iScale: stacked(true) }]
      )
    );
    expect(calls).toEqual([]);
  });
});

describe('drawNoDataText', () => {
  it('centres the text in the chart area, in 12px grey', () => {
    const { ctx, calls } = fakeCtx();
    drawNoDataText({ ctx, chartArea: AREA }, 'No chart data', 'Inter');
    expect(calls.find((c) => c[0] === 'fillText')).toEqual(['fillText', 'No chart data', 190, 110]);
    expect(ctx.font).toBe('12px Inter');
    expect(ctx.fillStyle).toBe(NO_DATA_TEXT_COLOR);
    expect(ctx.textAlign).toBe('center');
    expect(ctx.textBaseline).toBe('middle');
    expect(calls[0][0]).toBe('save');
    expect(calls[calls.length - 1][0]).toBe('restore');
  });

  it('falls back to sans-serif and ignores an empty text', () => {
    const { ctx, calls } = fakeCtx();
    drawNoDataText({ ctx, chartArea: AREA }, 'x');
    expect(ctx.font).toBe('12px sans-serif');
    const second = fakeCtx();
    drawNoDataText({ ctx: second.ctx, chartArea: AREA }, '');
    expect(second.calls).toEqual([]);
    expect(calls.length).toBeGreaterThan(0);
  });
});

describe('createMissingValuesPlugin', () => {
  it('draws the stubs, and the no-data text only when every series is missing', () => {
    const lazy = vi.fn(() => 'nothing');
    const make = (allMissing: boolean) =>
      createMissingValuesPlugin({ allMissing, getNoDataText: lazy, getFontFamily: () => 'Inter' });

    const a = fakeCtx();
    const bar = element({ x: 100, y: 210, base: 210, width: 30, height: 0 });
    const chart = (ctx: unknown) => fakeChart(ctx, [{ data: [null] }], [{ type: 'bar', data: [bar] }]);
    make(false).afterDatasetsDraw(chart(a.ctx));
    expect(a.names()).toContain('strokeRect');
    expect(a.names()).not.toContain('fillText');
    expect(lazy).not.toHaveBeenCalled();

    const b = fakeCtx();
    make(true).afterDatasetsDraw(chart(b.ctx));
    expect(b.names()).toContain('strokeRect');
    expect(b.calls.find((c) => c[0] === 'fillText')?.[1]).toBe('nothing');
    expect(lazy).toHaveBeenCalledTimes(1);
  });

  it('has a stable id and swallows a drawing failure', () => {
    const plugin = createMissingValuesPlugin({ allMissing: true, getNoDataText: () => 'x' });
    expect(plugin.id).toBe('mcpuiMissingValues');
    const boom = {
      get ctx(): never {
        throw new Error('canvas lost');
      },
    };
    expect(() => plugin.afterDatasetsDraw(boom)).not.toThrow();
  });
});

describe('createMissingLegendGenerator', () => {
  it('replaces only the text of a fully-missing dataset, and forwards the chart', () => {
    const base = vi.fn(function (this: unknown, _chart: unknown) {
      return [
        { text: 'A', datasetIndex: 0, hidden: false },
        { text: 'B', datasetIndex: 1, hidden: true },
        { text: 'cat', index: 2 },
      ];
    });
    const generate = createMissingLegendGenerator(base, [false, true], strings);
    const chart = {};
    expect(generate(chart)).toEqual([
      { text: 'A', datasetIndex: 0, hidden: false },
      { text: 'B (no data)', datasetIndex: 1, hidden: true },
      { text: 'cat', index: 2 },
    ]);
    expect(base).toHaveBeenCalledWith(chart);
  });

  it('reads the template at call time', () => {
    let current = { ...DEFAULT_MCPUI_STRINGS };
    const generate = createMissingLegendGenerator(
      () => [{ text: 'S', datasetIndex: 0 }],
      [true],
      () => current
    );
    current = { ...current, chartLegendNoData: '{series} · vide' };
    expect(generate({})[0].text).toBe('S · vide');
  });
});

describe('createTooltipLabel', () => {
  it('composes like Chart.js by default', () => {
    const label = createTooltipLabel(strings, undefined, 'bar');
    expect(label({ dataset: { label: 'Rev' }, raw: 1, formattedValue: '1' })).toBe('Rev: 1');
    expect(label({ dataset: {}, raw: 1, formattedValue: '1' })).toBe('1');
    expect(label({ dataset: { label: 'Rev' }, raw: 1 })).toBe('Rev: ');
  });

  it('reads the value axis of a radar and of a horizontal bar', () => {
    const label = createTooltipLabel(strings, undefined, 'bar');
    expect(
      label({ dataset: { label: 'R' }, raw: 1, parsed: { r: null }, chart: { config: { type: 'radar' } } })
    ).toBe('R: Missing value');
    expect(
      label({ dataset: { label: 'H' }, raw: 1, parsed: { x: null, y: 2 }, chart: { options: { indexAxis: 'y' } } })
    ).toBe('H: Missing value');
    expect(
      label({ dataset: { label: 'V' }, raw: 1, formattedValue: '1', parsed: { x: null, y: 2 }, chart: { options: {} } })
    ).toBe('V: 1');
  });

  it('treats a non-finite raw value as missing', () => {
    const label = createTooltipLabel(strings, '%', 'line');
    expect(label({ dataset: { label: 'L' }, raw: NaN, formattedValue: 'NaN' })).toBe('L: Missing value');
  });

  // Chart.js calls `callbacks.label` with the tooltip as `this`. In
  // `mode: 'dataset'` every item belongs to ONE dataset, so its default
  // composition prefixes the CATEGORY (item.label) instead of the dataset label.
  describe('in tooltip mode "dataset"', () => {
    const datasetMode = { options: { mode: 'dataset' } };
    const present = { label: 'Mon', dataset: { label: 'Lyon' }, raw: 12, formattedValue: '12' };
    const missing = { label: 'Tue', dataset: { label: 'Lyon' }, raw: null, formattedValue: '' };

    it('prefixes the category, with the unit, for a present value', () => {
      const label = createTooltipLabel(strings, '°C', 'line');
      expect(label.call(datasetMode, present)).toBe('Mon: 12 °C');
    });

    it('prefixes the category for a present value without a unit', () => {
      const label = createTooltipLabel(strings, undefined, 'bar');
      expect(label.call(datasetMode, present)).toBe('Mon: 12');
    });

    it('names the missing value after the category', () => {
      const label = createTooltipLabel(strings, '°C', 'line');
      expect(label.call(datasetMode, missing)).toBe('Tue: Missing value');
    });

    it('uses the localized missing-value wording', () => {
      const label = createTooltipLabel(
        () => ({ ...DEFAULT_MCPUI_STRINGS, missingValue: 'Valeur manquante' }),
        undefined,
        'line'
      );
      expect(label.call(datasetMode, missing)).toBe('Tue: Valeur manquante');
    });

    it('leaves out the prefix when the category has no text', () => {
      const label = createTooltipLabel(strings, '°C', 'line');
      expect(label.call(datasetMode, { ...present, label: '' })).toBe('12 °C');
      expect(label.call(datasetMode, { ...present, label: undefined })).toBe('12 °C');
    });

    it('keeps the dataset label in every other tooltip mode', () => {
      const label = createTooltipLabel(strings, '°C', 'line');
      expect(label.call({ options: { mode: 'index' } }, present)).toBe('Lyon: 12 °C');
      expect(label.call({ options: { mode: 'nearest' } }, missing)).toBe('Lyon: Missing value');
      expect(label.call({ options: {} }, present)).toBe('Lyon: 12 °C');
      expect(label.call({}, present)).toBe('Lyon: 12 °C');
    });

    it('keeps the dataset label when called without a tooltip as `this`', () => {
      const label = createTooltipLabel(strings, '°C', 'line');
      // Called detached, as the existing tests do, and bound to nothing.
      expect(label(present)).toBe('Lyon: 12 °C');
      expect(label.call(undefined, present)).toBe('Lyon: 12 °C');
      expect(label.call(null, missing)).toBe('Lyon: Missing value');
    });
  });
});

describe('applyUnitAxisTitle', () => {
  it('does nothing without a unit', () => {
    const options: any = { responsive: true };
    applyUnitAxisTitle(options, 'bar', undefined);
    expect(options).toEqual({ responsive: true });
  });

  it('does not touch a chart without a value axis', () => {
    for (const type of ['radar', 'pie', 'doughnut', 'polarArea']) {
      const options: any = {};
      applyUnitAxisTitle(options, type, 'kg');
      expect(options).toEqual({});
    }
  });

  it('keeps an existing title even when it is partial', () => {
    const options: any = { scales: { y: { title: { color: 'red' } } } };
    applyUnitAxisTitle(options, 'bar', 'kg');
    expect(options.scales.y.title).toEqual({ color: 'red' });
  });
});

describe('withDatasetsNoGapSpan', () => {
  it('clones datasets, sets spanGaps false, and leaves a payload without datasets alone', () => {
    const data = Object.freeze({ labels: ['a'], datasets: Object.freeze([Object.freeze({ data: [1] })]) });
    const next = withDatasetsNoGapSpan(data as any);
    expect(next).not.toBe(data);
    expect(next.labels).toBe(data.labels);
    expect(next.datasets[0]).toEqual({ data: [1], spanGaps: false });
    const bare = { labels: ['a'] };
    expect(withDatasetsNoGapSpan(bare as any)).toBe(bare);
  });
});

describe('missingNoteKind', () => {
  it.each([
    ['bar', 'bars'],
    ['line', 'gaps'],
    ['radar', 'gaps'],
    ['scatter', 'omitted'],
    ['bubble', 'omitted'],
  ])('%s -> %s', (type, kind) => expect(missingNoteKind(type)).toBe(kind));

  it('says "bars" for a bar chart that is not stacked, whatever else its options hold', () => {
    expect(missingNoteKind('bar', {})).toBe('bars');
    expect(missingNoteKind('bar', undefined)).toBe('bars');
    expect(missingNoteKind('bar', { indexAxis: 'y', scales: { y: { beginAtZero: true } } })).toBe('bars');
    expect(missingNoteKind('bar', { scales: { x: { stacked: false }, y: { stacked: false } } })).toBe('bars');
  });

  it.each([
    ['y', { scales: { y: { stacked: true } } }],
    ['x', { scales: { x: { stacked: true } } }],
    ['x and y', { scales: { x: { stacked: true }, y: { stacked: true } } }],
  ])('says "omitted" for a bar chart stacked on %s: no outline stands in for the bar', (_axes, options) => {
    expect(missingNoteKind('bar', options)).toBe('omitted');
  });

  it('only looks at the stacking of a bar chart', () => {
    const stackedOptions = { scales: { y: { stacked: true } } };
    expect(missingNoteKind('line', stackedOptions)).toBe('gaps');
    expect(missingNoteKind('radar', stackedOptions)).toBe('gaps');
    expect(missingNoteKind('scatter', {})).toBe('omitted');
    expect(missingNoteKind(undefined, stackedOptions)).toBe('gaps');
  });
});

describe('isStackedChart', () => {
  it('is true when the x axis is stacked', () => {
    expect(isStackedChart({ scales: { x: { stacked: true } } })).toBe(true);
  });

  it('is true when the y axis is stacked', () => {
    expect(isStackedChart({ scales: { y: { stacked: true } } })).toBe(true);
  });

  it('is true when both axes are stacked', () => {
    expect(isStackedChart({ scales: { x: { stacked: true }, y: { stacked: true } } })).toBe(true);
  });

  it('is false when neither axis is stacked', () => {
    expect(isStackedChart({})).toBe(false);
    expect(isStackedChart({ scales: {} })).toBe(false);
    expect(isStackedChart({ scales: { x: {}, y: { beginAtZero: true } } })).toBe(false);
    expect(isStackedChart({ scales: { x: { stacked: false }, y: { stacked: false } } })).toBe(false);
  });

  it('is false without options, and never throws on a partial scales object', () => {
    expect(isStackedChart(undefined)).toBe(false);
    expect(isStackedChart(null)).toBe(false);
    expect(isStackedChart({ scales: null })).toBe(false);
    expect(isStackedChart({ scales: { x: null, y: undefined } })).toBe(false);
  });

  it('always answers with a boolean', () => {
    expect(isStackedChart({ scales: { y: { stacked: 1 } } })).toBe(true);
    expect(isStackedChart({ scales: { y: { stacked: 0 } } })).toBe(false);
  });
});
