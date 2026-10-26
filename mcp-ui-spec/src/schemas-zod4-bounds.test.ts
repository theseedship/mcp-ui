import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Deliberately tiny inputs: the invariant is zero element visits when a
// leading upper bound rejects a container, not a timing or memory threshold.
describe('bounded collection validation', () => {
  it('rejects an oversized array before synchronous element parsing', () => {
    let visits = 0;
    const schema = z.array(z.string().transform((value) => {
      visits++;
      return value.toUpperCase();
    })).max(2);

    expect(schema.parse(['a', 'b'])).toEqual(['A', 'B']);
    expect(visits).toBe(2);
    visits = 0;

    const result = schema.safeParse(['a', 'b', 'c']);
    expect(result.success).toBe(false);
    expect(visits).toBe(0);
    if (!result.success) expect(result.error.issues.map((issue) => issue.code)).toEqual(['too_big']);
  });

  it('rejects an oversized set before synchronous element parsing', () => {
    let visits = 0;
    const schema = z.set(z.string().transform((value) => {
      visits++;
      return value.toUpperCase();
    })).max(2);

    expect(schema.parse(new Set(['a', 'b']))).toEqual(new Set(['A', 'B']));
    expect(visits).toBe(2);
    visits = 0;

    const result = schema.safeParse(new Set(['a', 'b', 'c']));
    expect(result.success).toBe(false);
    expect(visits).toBe(0);
    if (!result.success) expect(result.error.issues.map((issue) => issue.code)).toEqual(['too_big']);
  });

  it('rejects an oversized array before asynchronous element parsing', async () => {
    let visits = 0;
    const schema = z.array(z.string().transform(async (value) => {
      visits++;
      return value.toUpperCase();
    })).max(2);

    expect(await schema.parseAsync(['a', 'b'])).toEqual(['A', 'B']);
    expect(visits).toBe(2);
    visits = 0;

    const result = await schema.safeParseAsync(['a', 'b', 'c']);
    expect(result.success).toBe(false);
    expect(visits).toBe(0);
    if (!result.success) expect(result.error.issues.map((issue) => issue.code)).toEqual(['too_big']);
  });

  it('rejects an oversized set before asynchronous element parsing', async () => {
    let visits = 0;
    const schema = z.set(z.string().transform(async (value) => {
      visits++;
      return value.toUpperCase();
    })).max(2);

    expect(await schema.parseAsync(new Set(['a', 'b']))).toEqual(new Set(['A', 'B']));
    expect(visits).toBe(2);
    visits = 0;

    const result = await schema.safeParseAsync(new Set(['a', 'b', 'c']));
    expect(result.success).toBe(false);
    expect(visits).toBe(0);
    if (!result.success) expect(result.error.issues.map((issue) => issue.code)).toEqual(['too_big']);
  });

  it('treats a leading exact array length as an upper bound', () => {
    let visits = 0;
    const schema = z.array(z.string().transform((value) => {
      visits++;
      return value;
    })).length(2);
    expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
    expect(visits).toBe(2);
    visits = 0;
    const result = schema.safeParse(['a', 'b', 'c']);
    expect(result.success).toBe(false);
    expect(visits).toBe(0);
    if (!result.success) expect(result.error.issues.map((issue) => issue.code)).toEqual(['too_big']);
  });

  it('still visits every element in an unbounded collection', () => {
    let visits = 0;
    const schema = z.array(z.string().transform((value) => {
      visits++;
      return value;
    }));
    expect(schema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(visits).toBe(3);
  });
});

describe('Zod 4 bounded collection paths', () => {
  it('rejects an oversized map before value parsing', () => {
    let visits = 0;
    const map = z.map(z.string(), z.string().transform((value) => {
      visits++;
      return value.toUpperCase();
    }));
    const schema = map.size(2);

    expect(schema.parse(new Map([['a', 'one'], ['b', 'two']]))).toEqual(new Map([['a', 'ONE'], ['b', 'TWO']]));
    expect(visits).toBe(2);
    visits = 0;

    const result = schema.safeParse(new Map([['a', 'one'], ['b', 'two'], ['c', 'three']]));
    expect(result.success).toBe(false);
    expect(visits).toBe(0);
    if (!result.success) expect(result.error.issues.map((issue) => issue.code)).toEqual(['too_big']);
  });

  it('rejects an oversized map before asynchronous value parsing', async () => {
    let visits = 0;
    const map = z.map(z.string(), z.string().transform(async (value) => {
      visits++;
      return value.toUpperCase();
    }));
    const schema = map.size(2);

    expect(await schema.parseAsync(new Map([['a', 'one'], ['b', 'two']]))).toEqual(new Map([['a', 'ONE'], ['b', 'TWO']]));
    expect(visits).toBe(2);
    visits = 0;

    const result = await schema.safeParseAsync(new Map([['a', 'one'], ['b', 'two'], ['c', 'three']]));
    expect(result.success).toBe(false);
    expect(visits).toBe(0);
    if (!result.success) expect(result.error.issues.map((issue) => issue.code)).toEqual(['too_big']);
  });

  it('preserves early rejection on the compiled path', () => {
    let visits = 0;
    const schema = z.array(z.string().transform((value) => {
      visits++;
      return value.toUpperCase();
    })).max(2);
    const compiled = z.compile(schema);

    expect(compiled.parse(['a', 'b'])).toEqual(['A', 'B']);
    expect(visits).toBe(2);
    visits = 0;

    const result = compiled.safeParse(['a', 'b', 'c']);
    expect(result.success).toBe(false);
    expect(visits).toBe(0);
    if (!result.success) expect(result.error.issues.map((issue) => issue.code)).toEqual(['too_big']);
  });

  it('preserves early rejection for compiled sets and maps', () => {
    let setVisits = 0;
    const setSchema = z.compile(z.set(z.string().transform((value) => {
      setVisits++;
      return value.toUpperCase();
    })).max(2));
    expect(setSchema.parse(new Set(['a', 'b']))).toEqual(new Set(['A', 'B']));
    expect(setVisits).toBe(2);
    setVisits = 0;
    const setResult = setSchema.safeParse(new Set(['a', 'b', 'c']));
    expect(setResult.success).toBe(false);
    expect(setVisits).toBe(0);
    if (!setResult.success) expect(setResult.error.issues.map((issue) => issue.code)).toEqual(['too_big']);

    let mapVisits = 0;
    const map = z.map(z.string(), z.string().transform((value) => {
      mapVisits++;
      return value.toUpperCase();
    }));
    const mapSchema = z.compile(map.size(2));
    expect(mapSchema.parse(new Map([['a', 'one'], ['b', 'two']]))).toEqual(new Map([['a', 'ONE'], ['b', 'TWO']]));
    expect(mapVisits).toBe(2);
    mapVisits = 0;
    const mapResult = mapSchema.safeParse(new Map([['a', 'one'], ['b', 'two'], ['c', 'three']]));
    expect(mapResult.success).toBe(false);
    expect(mapVisits).toBe(0);
    if (!mapResult.success) expect(mapResult.error.issues.map((issue) => issue.code)).toEqual(['too_big']);
  });

  it('does not hoist a size bound across an earlier overwrite', () => {
    let visits = 0;
    const item = z.string().transform((value) => {
      visits++;
      return value;
    });
    const shrinkFirst = z.array(item).overwrite((values) => values.slice(0, 2)).max(2);
    expect(shrinkFirst.parse(['a', 'b', 'c'])).toEqual(['a', 'b']);
    expect(visits).toBe(3);

    visits = 0;
    const capFirst = z.array(item).max(2).overwrite((values) => values.slice(0, 2));
    const result = capFirst.safeParse(['a', 'b', 'c']);
    expect(result.success).toBe(false);
    expect(visits).toBe(0);
    if (!result.success) expect(result.error.issues.map((issue) => issue.code)).toEqual(['too_big']);
  });
});
