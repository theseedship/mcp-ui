/**
 * v5.3.0 — MacroRun Phase 2 contract.
 *
 * Validates the agnostic `MacroRunV1` / `MacroStepV1` / `MacroInterrogationV1`
 * schemas and that every shipped fixture in `examples/macro/` parses.
 *
 * The producer runtime (snapshot emission, SSE) is out of scope — this suite
 * only locks the wire shape.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  MacroRunV1Schema,
  MacroInterrogationV1Schema,
  MacroStepV1Schema,
  MacroRunStatusSchema,
  MacroStepStatusSchema,
  MACRO_RUN_V1,
  MACRO_INTERROGATION_V1,
} from './schemas/index';

const FIXTURE_DIR = join(__dirname, '..', 'examples', 'macro');

const MINIMAL_RUN = {
  schemaVersion: MACRO_RUN_V1,
  runId: 'run_1',
  macroId: 'demo-macro',
  status: 'running' as const,
  steps: [{ id: 's1', label: 'Step 1', status: 'active' as const }],
};

const MINIMAL_INTERROGATION = {
  schemaVersion: MACRO_INTERROGATION_V1,
  interrogationId: 'int_1',
  runId: 'run_1',
  kind: 'choice' as const,
  title: 'Pick one',
  options: [{ value: 'a', label: 'A' }],
};

describe('MacroRunV1Schema (v5.3.0)', () => {
  it('accepts a minimal valid run', () => {
    expect(MacroRunV1Schema.safeParse(MINIMAL_RUN).success).toBe(true);
  });

  it('requires the exact namespaced schemaVersion literal', () => {
    for (const bad of [undefined, 1, 'v1', 'macro-run/v2']) {
      expect(MacroRunV1Schema.safeParse({ ...MINIMAL_RUN, schemaVersion: bad }).success).toBe(
        false
      );
    }
  });

  it('requires non-empty runId and macroId', () => {
    expect(MacroRunV1Schema.safeParse({ ...MINIMAL_RUN, runId: '' }).success).toBe(false);
    expect(MacroRunV1Schema.safeParse({ ...MINIMAL_RUN, macroId: '' }).success).toBe(false);
  });

  it('uses `completed` at run level, not `done`', () => {
    expect(MacroRunStatusSchema.safeParse('completed').success).toBe(true);
    expect(MacroRunStatusSchema.safeParse('done').success).toBe(false);
  });

  it('accepts every run status (pending → aborted)', () => {
    for (const s of ['pending', 'running', 'awaiting_input', 'completed', 'failed', 'aborted']) {
      expect(MacroRunV1Schema.safeParse({ ...MINIMAL_RUN, status: s }).success).toBe(true);
    }
  });

  it('accepts an embedded pendingInterrogation', () => {
    expect(
      MacroRunV1Schema.safeParse({
        ...MINIMAL_RUN,
        status: 'awaiting_input',
        pendingInterrogation: MINIMAL_INTERROGATION,
      }).success
    ).toBe(true);
  });

  it('accepts optional results (UIComponent-shaped passthrough) and works without them', () => {
    expect(MacroRunV1Schema.safeParse(MINIMAL_RUN).success).toBe(true); // no results
    expect(
      MacroRunV1Schema.safeParse({
        ...MINIMAL_RUN,
        status: 'completed',
        results: [{ id: 'r1', type: 'chart', params: {} }],
      }).success
    ).toBe(true);
  });

  it('accepts an optional agent, error and outcome', () => {
    expect(
      MacroRunV1Schema.safeParse({
        ...MINIMAL_RUN,
        agent: { id: 'a1', name: 'Agent', status: 'running' },
        error: { message: 'x', retryable: false },
        outcome: { kind: 'agent_result', content: { ok: true } },
      }).success
    ).toBe(true);
  });
});

describe('MacroStepV1Schema (v5.3.0)', () => {
  it('uses `done` at step level (distinct from run level)', () => {
    expect(MacroStepStatusSchema.safeParse('done').success).toBe(true);
    expect(MacroStepStatusSchema.safeParse('completed').success).toBe(false);
  });

  it('accepts every step status (pending → failed)', () => {
    for (const s of ['pending', 'active', 'done', 'skipped', 'failed']) {
      expect(MacroStepV1Schema.safeParse({ id: 's', label: 'L', status: s }).success).toBe(true);
    }
  });

  it('accepts nested parallel sub-steps (recursive)', () => {
    expect(
      MacroStepV1Schema.safeParse({
        id: 's1',
        label: 'Parallel batch',
        status: 'active',
        parallel: [
          { id: 's1a', label: 'Branch A', status: 'done' },
          { id: 's1b', label: 'Branch B', status: 'active' },
        ],
      }).success
    ).toBe(true);
  });
});

describe('MacroInterrogationV1Schema (v5.3.0)', () => {
  it('accepts a minimal standalone interrogation', () => {
    expect(MacroInterrogationV1Schema.safeParse(MINIMAL_INTERROGATION).success).toBe(true);
  });

  it('requires the exact namespaced schemaVersion literal', () => {
    expect(
      MacroInterrogationV1Schema.safeParse({
        ...MINIMAL_INTERROGATION,
        schemaVersion: 'macro-interrogation/v2',
      }).success
    ).toBe(false);
  });

  it('accepts every interrogation kind', () => {
    for (const kind of ['choice', 'confirm', 'form', 'elicitation']) {
      expect(MacroInterrogationV1Schema.safeParse({ ...MINIMAL_INTERROGATION, kind }).success).toBe(
        true
      );
    }
  });

  it('rejects an unknown interrogation kind', () => {
    expect(
      MacroInterrogationV1Schema.safeParse({ ...MINIMAL_INTERROGATION, kind: 'teleport' }).success
    ).toBe(false);
  });
});

describe('MacroRun fixtures', () => {
  const fixtures = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));

  it('ships fixtures for the documented scenarios', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(4);
  });

  for (const file of fixtures) {
    it(`fixture ${file} parses against its v1 schema`, () => {
      const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf8'));
      const schema =
        raw.schemaVersion === MACRO_INTERROGATION_V1
          ? MacroInterrogationV1Schema
          : MacroRunV1Schema;
      const result = schema.safeParse(raw);
      if (!result.success) {
        throw new Error(
          `${file} failed validation:\n${JSON.stringify(result.error.issues, null, 2)}`
        );
      }
      expect(result.success).toBe(true);
    });
  }
});
