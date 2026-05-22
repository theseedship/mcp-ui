/**
 * MacroRun adapter tests (v6.7.0 — MacroRun Phase 2).
 *
 * Covers `macroRunToScratchpadState` and `macroInterrogationToChatPromptConfig`
 * as pure functions: status mappings, section production, the stepper /
 * split_stepper branch, embedded vs standalone interrogations, and the
 * results-absent path.
 */

import { describe, it, expect } from 'vitest';
import type { MacroRunV1, MacroInterrogationV1, MacroStepV1 } from '@seed-ship/mcp-ui-spec';
import { macroRunToScratchpadState, macroInterrogationToChatPromptConfig } from './macro-run';
import type { ScratchpadSection } from '../types/chat-bus';

// ─── Fixture builders ────────────────────────────────────────

function run(overrides: Partial<MacroRunV1> = {}): MacroRunV1 {
  return {
    schemaVersion: 'macro-run/v1',
    runId: 'run_1',
    macroId: 'demo-macro',
    macroName: 'Demo macro',
    status: 'running',
    steps: [],
    ...overrides,
  };
}

const STEPS: MacroStepV1[] = [
  { id: 's1', label: 'Collect', status: 'done', durationMs: 1200 },
  { id: 's2', label: 'Summarize', status: 'active' },
  { id: 's3', label: 'Draft', status: 'pending' },
];

function interrogation(overrides: Partial<MacroInterrogationV1> = {}): MacroInterrogationV1 {
  return {
    schemaVersion: 'macro-interrogation/v1',
    interrogationId: 'int_1',
    runId: 'run_1',
    kind: 'choice',
    title: 'Pick a direction',
    options: [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
    ],
    ...overrides,
  };
}

const sectionTypes = (sections: ScratchpadSection[]) => sections.map((s) => s.type);

// ─── macroRunToScratchpadState — status mapping ──────────────

describe('macroRunToScratchpadState — run status → scratchpad status', () => {
  const cases: Array<[MacroRunV1['status'], string]> = [
    ['pending', 'loading'],
    ['running', 'processing'],
    ['awaiting_input', 'waiting_human'],
    ['completed', 'complete'],
    ['failed', 'error'],
    ['aborted', 'error'],
  ];
  for (const [runStatus, scratchpadStatus] of cases) {
    it(`maps run '${runStatus}' → scratchpad '${scratchpadStatus}'`, () => {
      expect(macroRunToScratchpadState(run({ status: runStatus })).status).toBe(scratchpadStatus);
    });
  }
});

// ─── macroRunToScratchpadState — sections ────────────────────

describe('macroRunToScratchpadState — sections', () => {
  it('running run with steps → agent_card + stepper', () => {
    const state = macroRunToScratchpadState(run({ status: 'running', steps: STEPS }));
    expect(state.status).toBe('processing');
    expect(sectionTypes(state.sections)).toContain('agent_card');
    expect(sectionTypes(state.sections)).toContain('stepper');
    expect(sectionTypes(state.sections)).not.toContain('split_stepper');
  });

  it('maps step `failed` → stepper `error`', () => {
    const state = macroRunToScratchpadState(
      run({ status: 'failed', steps: [{ id: 's1', label: 'X', status: 'failed' }] })
    );
    const stepper = state.sections.find((s) => s.type === 'stepper');
    const content = stepper?.content as { steps: Array<{ status: string }> };
    expect(content.steps[0].status).toBe('error');
  });

  it('carries the agent card from run.agent when present', () => {
    const state = macroRunToScratchpadState(
      run({
        status: 'running',
        steps: STEPS,
        agent: { id: 'researcher', name: 'Researcher', status: 'running' },
      })
    );
    const card = state.sections.find((s) => s.type === 'agent_card');
    expect((card?.content as { agentId: string }).agentId).toBe('researcher');
  });

  it('derives an agent card from the macro identity when run.agent is absent', () => {
    const state = macroRunToScratchpadState(run({ status: 'running', steps: STEPS }));
    const card = state.sections.find((s) => s.type === 'agent_card');
    expect((card?.content as { agentId: string; name: string }).agentId).toBe('demo-macro');
    expect((card?.content as { name: string }).name).toBe('Demo macro');
  });

  it('awaiting_input + pendingInterrogation → waiting_human + prompt section (choice)', () => {
    const state = macroRunToScratchpadState(
      run({
        status: 'awaiting_input',
        steps: STEPS,
        pendingInterrogation: interrogation(),
      })
    );
    expect(state.status).toBe('waiting_human');
    const prompt = state.sections.find((s) => s.type === 'prompt');
    expect(prompt).toBeDefined();
    expect((prompt?.content as { type: string }).type).toBe('choice');
  });

  it('completed + results UI → complete with one section per result, mapped by type', () => {
    const state = macroRunToScratchpadState(
      run({
        status: 'completed',
        steps: STEPS,
        results: [
          { id: 'r1', type: 'chart', params: {} },
          { id: 'r2', type: 'map', params: {} },
          { id: 'r3', type: 'table', params: {} },
        ],
      })
    );
    expect(state.status).toBe('complete');
    const types = sectionTypes(state.sections);
    expect(types).toContain('chart');
    expect(types).toContain('map');
    expect(types).toContain('data_preview');
  });

  it('does not crash and emits no result section when results are absent', () => {
    const state = macroRunToScratchpadState(run({ status: 'completed', steps: STEPS }));
    expect(state.status).toBe('complete');
    expect(state.sections.every((s) => !s.id.startsWith('macro-result-'))).toBe(true);
  });

  it('parallel steps present → split_stepper instead of stepper', () => {
    const state = macroRunToScratchpadState(
      run({
        status: 'running',
        steps: [
          {
            id: 'batch',
            label: 'Parallel batch',
            status: 'active',
            parallel: [
              { id: 'b1', label: 'Branch 1', status: 'done' },
              { id: 'b2', label: 'Branch 2', status: 'active' },
            ],
          },
        ],
      })
    );
    const types = sectionTypes(state.sections);
    expect(types).toContain('split_stepper');
    expect(types).not.toContain('stepper');
    const split = state.sections.find((s) => s.type === 'split_stepper');
    expect((split?.content as { agents: unknown[] }).agents).toHaveLength(1);
  });

  it('failed run → status error with retryable error detail', () => {
    const state = macroRunToScratchpadState(
      run({
        status: 'failed',
        steps: STEPS,
        error: { message: 'Tool timed out', code: 'TIMEOUT', retryable: true },
      })
    );
    expect(state.status).toBe('error');
    expect(state.error).toEqual({ message: 'Tool timed out', code: 'TIMEOUT', retryable: true });
  });

  it('aborted run → status error, never retryable', () => {
    const state = macroRunToScratchpadState(
      run({
        status: 'aborted',
        steps: STEPS,
        error: { message: 'User aborted', retryable: true },
      })
    );
    expect(state.status).toBe('error');
    expect(state.error?.retryable).toBe(false);
  });

  it('produces a well-formed ScratchpadState (id, title, required fields)', () => {
    const state = macroRunToScratchpadState(run({ status: 'running', steps: STEPS }));
    expect(state.id).toBe('run_1');
    expect(state.title).toBe('Demo macro');
    expect(state.filters).toEqual({});
    expect(state.agentMessages).toEqual([]);
  });
});

// ─── macroInterrogationToChatPromptConfig ────────────────────

describe('macroInterrogationToChatPromptConfig', () => {
  it('choice → ChatPromptConfig { type: "choice" } with options', () => {
    const config = macroInterrogationToChatPromptConfig(interrogation({ kind: 'choice' }));
    expect(config.type).toBe('choice');
    expect((config.config as { options: unknown[] }).options).toHaveLength(2);
  });

  it('confirm → ChatPromptConfig { type: "confirm" } with labels', () => {
    const config = macroInterrogationToChatPromptConfig(
      interrogation({
        kind: 'confirm',
        message: 'Proceed?',
        confirm: { confirmLabel: 'Yes', cancelLabel: 'No', variant: 'danger' },
      })
    );
    expect(config.type).toBe('confirm');
    expect(config.config).toMatchObject({
      message: 'Proceed?',
      confirmLabel: 'Yes',
      variant: 'danger',
    });
  });

  it('form → ChatPromptConfig { type: "form" } passing fields through', () => {
    const fields = [{ name: 'tone', label: 'Tone', type: 'text' }];
    const config = macroInterrogationToChatPromptConfig(interrogation({ kind: 'form', fields }));
    expect(config.type).toBe('form');
    expect((config.config as { fields: unknown[] }).fields).toEqual(fields);
  });

  it('elicitation → routed through elicitationToPromptConfig (single boolean → confirm)', () => {
    const config = macroInterrogationToChatPromptConfig(
      interrogation({
        kind: 'elicitation',
        message: 'Confirm export?',
        elicitationSchema: {
          type: 'object',
          properties: { confirmed: { type: 'boolean', description: 'Export now' } },
        },
      })
    );
    // Single-boolean schema → elicitationToPromptConfig produces a confirm.
    expect(config.type).toBe('confirm');
  });

  it('elicitation → form for a multi-property schema', () => {
    const config = macroInterrogationToChatPromptConfig(
      interrogation({
        kind: 'elicitation',
        message: 'Report options',
        elicitationSchema: {
          type: 'object',
          properties: {
            tone: { type: 'string' },
            maxPages: { type: 'integer' },
          },
          required: ['tone'],
        },
      })
    );
    expect(config.type).toBe('form');
  });

  it('elicitation with no usable schema → degrades to confirm, never throws', () => {
    const config = macroInterrogationToChatPromptConfig(
      interrogation({ kind: 'elicitation', elicitationSchema: undefined })
    );
    expect(config.type).toBe('confirm');
  });

  it('choice with no options → empty options array, does not crash', () => {
    const config = macroInterrogationToChatPromptConfig(
      interrogation({ kind: 'choice', options: undefined })
    );
    expect(config.type).toBe('choice');
    expect((config.config as { options: unknown[] }).options).toEqual([]);
  });

  it('is usable standalone and produces the same prompt as the embedded path', () => {
    const q = interrogation();
    const standalone = macroInterrogationToChatPromptConfig(q);
    const embedded = macroRunToScratchpadState(
      run({ status: 'awaiting_input', pendingInterrogation: q })
    ).sections.find((s) => s.type === 'prompt')?.content;
    expect(embedded).toEqual(standalone);
  });
});
