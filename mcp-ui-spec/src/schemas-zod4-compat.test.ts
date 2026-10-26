import { describe, expect, it } from 'vitest';
import {
  ActionParamsSchema,
  ComponentSchema,
  ConnectorDynamicResultV1Schema,
  FormFieldSchema,
  GeoJSONFeatureSchema,
  GraphNodeSchema,
  GridPositionSchema,
  ImageGalleryColumnsSchema,
  MacroRunOutcomeSchema,
  MacroStepV1Schema,
  PerformanceConstraintsSchema,
  SecurityConstraintsSchema,
  TableComponentParamsSchema,
} from './schemas';

describe('Zod 3 wire-shape compatibility', () => {
  it('keeps every formerly defaulted optional key absent from parsed JSON', () => {
    const grid = GridPositionSchema.parse({ colStart: 1, colSpan: 2 });
    expect(grid).toStrictEqual({
      colStart: 1,
      colSpan: 2,
    });
    expect(Object.hasOwn(grid, 'rowSpan')).toBe(false);
    const security = SecurityConstraintsSchema.parse({});
    expect(security).toStrictEqual({});
    expect(Object.hasOwn(security, 'requiresAuth')).toBe(false);
    expect(Object.hasOwn(security, 'maxIframeDepth')).toBe(false);
    const performance = PerformanceConstraintsSchema.parse({});
    expect(performance).toStrictEqual({});
    expect(Object.hasOwn(performance, 'maxRenderTime')).toBe(false);
    expect(Object.hasOwn(performance, 'maxDataSize')).toBe(false);

    const component = {
      id: 'example',
      type: 'chart',
      name: 'Example',
      schema: { type: 'object', properties: {} },
      examples: [{ name: 'Default', params: {} }],
    };
    const parsedComponent = ComponentSchema.parse(component);
    expect(parsedComponent).toStrictEqual(component);
    expect(Object.hasOwn(parsedComponent, 'deprecated')).toBe(false);

    const gridWithUndefined = GridPositionSchema.parse({ colStart: 1, colSpan: 2, rowSpan: undefined });
    expect(gridWithUndefined).toStrictEqual({
      colStart: 1,
      colSpan: 2,
      rowSpan: undefined,
    });
    expect(Object.hasOwn(gridWithUndefined, 'rowSpan')).toBe(true);
    const securityWithUndefined = SecurityConstraintsSchema.parse({ requiresAuth: undefined, maxIframeDepth: undefined });
    expect(securityWithUndefined).toStrictEqual({ requiresAuth: undefined, maxIframeDepth: undefined });
    expect(Object.hasOwn(securityWithUndefined, 'requiresAuth')).toBe(true);
    expect(Object.hasOwn(securityWithUndefined, 'maxIframeDepth')).toBe(true);
    const performanceWithUndefined = PerformanceConstraintsSchema.parse({ maxRenderTime: undefined, maxDataSize: undefined });
    expect(performanceWithUndefined).toStrictEqual({ maxRenderTime: undefined, maxDataSize: undefined });
    expect(Object.hasOwn(performanceWithUndefined, 'maxRenderTime')).toBe(true);
    expect(Object.hasOwn(performanceWithUndefined, 'maxDataSize')).toBe(true);
    const componentWithUndefined = ComponentSchema.parse({ ...component, deprecated: undefined });
    expect(componentWithUndefined).toStrictEqual({ ...component, deprecated: undefined });
    expect(Object.hasOwn(componentWithUndefined, 'deprecated')).toBe(true);
  });

  it('retains string-keyed records and their value validation', () => {
    const field = FormFieldSchema.parse({
      name: 'query',
      type: 'autocomplete',
      extraParams: { locale: 'fr', source: 'registry' },
      dependsOn: {
        field: 'country',
        apiUrl: '/options',
        labelField: 'label',
        valueField: 'value',
        extraParams: { country: 'FR' },
      },
    });
    expect(field.extraParams).toEqual({ locale: 'fr', source: 'registry' });
    expect(field.dependsOn?.extraParams).toEqual({ country: 'FR' });
    expect(FormFieldSchema.safeParse({ name: 'query', type: 'autocomplete', extraParams: { bad: 1 } }).success).toBe(false);

    expect(ActionParamsSchema.parse({ label: 'Open', params: { ids: [1, 2] } }).params).toEqual({ ids: [1, 2] });
    expect(GeoJSONFeatureSchema.parse({ type: 'Feature', geometry: null, properties: { score: 0.8 } }).properties).toEqual({ score: 0.8 });
    expect(GraphNodeSchema.parse({ id: 'n1', style: { fill: '#fff' }, data: { score: 0.8 } }).data).toEqual({ score: 0.8 });
  });

  it('keeps table citation entries typed separately from free-form rows', () => {
    const table = TableComponentParamsSchema.parse({
      columns: [{ key: 'name', label: 'Name' }],
      rows: [{ name: 'Ada', score: 42 }],
      citationMap: { '1': { page: 3, file: 'paper.pdf' } },
    });
    expect(table.rows).toEqual([{ name: 'Ada', score: 42 }]);
    expect(table.citationMap).toEqual({ '1': { page: 3, file: 'paper.pdf' } });
    expect(TableComponentParamsSchema.safeParse({
      columns: [{ key: 'name', label: 'Name' }],
      rows: [],
      citationMap: { '1': { page: true } },
    }).success).toBe(false);
  });

  it('keeps connector payloads opaque and macro content absent or undefined', () => {
    const connector = ConnectorDynamicResultV1Schema.parse({
      schemaVersion: 'connector-dynamic-result/v1',
      connectorId: 'example',
      toolName: 'search',
      query: 'hello',
      primary: { type: 'table', params: { rows: [] } },
      supplemental: [{ type: 'metric', value: 2 }],
    });
    expect(connector.primary).toEqual({ type: 'table', params: { rows: [] } });
    expect(connector.supplemental).toEqual([{ type: 'metric', value: 2 }]);
    const withoutContent = MacroRunOutcomeSchema.parse({ kind: 'raw' });
    expect(withoutContent).toStrictEqual({ kind: 'raw' });
    expect(Object.hasOwn(withoutContent, 'content')).toBe(false);
    const withUndefinedContent = MacroRunOutcomeSchema.parse({ kind: 'raw', content: undefined });
    expect(withUndefinedContent).toStrictEqual({ kind: 'raw', content: undefined });
    expect(Object.hasOwn(withUndefinedContent, 'content')).toBe(true);
  });

  it('keeps recursive macro steps and transformed gallery columns', () => {
    const step = { id: 'parent', label: 'Parent', status: 'done', parallel: [{ id: 'child', label: 'Child', status: 'pending' }] };
    expect(MacroStepV1Schema.parse(step)).toEqual(step);
    expect(ImageGalleryColumnsSchema.parse('2')).toBe(2);
    expect(ImageGalleryColumnsSchema.parse('5')).toBe(5);
    expect(ImageGalleryColumnsSchema.safeParse(2).success).toBe(false);
  });
});
