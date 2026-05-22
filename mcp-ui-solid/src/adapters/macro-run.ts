/**
 * MacroRun adapters — `MacroRunV1` / `MacroInterrogationV1` → MCP-UI render
 * primitives.
 *
 * @since v6.7.0 (MacroRun Phase 2 — contract consolidated in deposium_MCPs
 *   `docs/2026/briefs/2026-05-22-macro-run-runtime-contract-consolidation.md`)
 *
 * ## Opt-in, pure
 *
 * Published under the dedicated subpath `@seed-ship/mcp-ui-solid/adapters` —
 * never imported by the core renderer path. Every function here is a **pure
 * function**: same input → same output, no `fetch`, no SSE listener, no
 * persistence, no global state, no clock, no randomness.
 *
 * ## Scope boundary
 *
 * These adapters only translate the agnostic `MacroRunV1` contract (defined
 * in `@seed-ship/mcp-ui-spec`) into existing MCP-UI primitives — a
 * `ScratchpadState` and a `ChatPromptConfig`. They do NOT:
 *
 * - emit or consume any SSE event (a `macro_run_snapshot` producer is a
 *   separate, later goal on the producing runtime repo);
 * - perform any fetch, persistence or resume;
 * - know anything about a specific runtime, host, corpus or domain;
 * - touch the `action:'submit'` executors, nor mix MacroRun with the
 *   existing tool-call action path.
 *
 * The host owns all of the above — it feeds a `MacroRunV1` snapshot in and
 * decides where to render the result.
 */

import type { MacroRunV1, MacroStepV1, MacroInterrogationV1 } from '@seed-ship/mcp-ui-spec';
import type {
  ScratchpadState,
  ScratchpadSection,
  ChatPromptConfig,
  ChoiceOption,
  ConfirmPromptConfig,
  AgentCardContent,
  SplitStepperContent,
  ElicitationRequestedSchema,
  FormPromptConfig,
} from '../types/chat-bus';
import { elicitationToPromptConfig } from '../services/chat-bus';

// ─── Status mappings ─────────────────────────────────────────

/**
 * Run status → top-level `ScratchpadState` status. `aborted` and `failed`
 * both surface as `error` (an aborted run is additionally non-retryable —
 * see `buildError`).
 */
const RUN_STATUS_TO_SCRATCHPAD: Record<MacroRunV1['status'], ScratchpadState['status']> = {
  pending: 'loading',
  running: 'processing',
  awaiting_input: 'waiting_human',
  completed: 'complete',
  failed: 'error',
  aborted: 'error',
};

/** Run status → `AgentCardContent` status, used when the run carries no agent. */
function runStatusToAgentStatus(status: MacroRunV1['status']): AgentCardContent['status'] {
  switch (status) {
    case 'pending':
      return 'idle';
    case 'running':
      return 'running';
    case 'awaiting_input':
      return 'waiting';
    case 'completed':
      return 'done';
    case 'failed':
    case 'aborted':
      return 'error';
  }
}

/**
 * Step status → stepper status. The MCP-UI stepper primitive renders
 * `failed` as `error`; every other value passes through unchanged.
 */
function stepToStepperStatus(
  status: MacroStepV1['status']
): 'pending' | 'active' | 'done' | 'skipped' | 'error' {
  return status === 'failed' ? 'error' : status;
}

// ─── Section builders ────────────────────────────────────────

interface StepperSectionContent {
  steps: Array<{
    id: string;
    label: string;
    status: 'pending' | 'active' | 'done' | 'skipped' | 'error';
    summary?: string;
    duration_ms?: number;
  }>;
  orientation: 'horizontal' | 'vertical';
}

function buildAgentCard(run: MacroRunV1): AgentCardContent {
  const agent = run.agent;
  const card: AgentCardContent = {
    agentId: agent?.id ?? run.macroId,
    name: agent?.name ?? run.macroName ?? run.macroId,
    status: agent?.status ?? runStatusToAgentStatus(run.status),
  };
  if (agent?.avatar) card.avatar = agent.avatar;
  if (agent?.capabilities) card.capabilities = agent.capabilities;
  if (agent?.currentStep) card.currentStep = agent.currentStep;
  return card;
}

function buildStepperContent(steps: MacroStepV1[]): StepperSectionContent {
  return {
    orientation: 'horizontal',
    steps: steps.map((step) => {
      const out: StepperSectionContent['steps'][number] = {
        id: step.id,
        label: step.label,
        status: stepToStepperStatus(step.status),
      };
      if (step.summary) out.summary = step.summary;
      if (typeof step.durationMs === 'number') out.duration_ms = step.durationMs;
      return out;
    }),
  };
}

/** Collapse a set of sub-step statuses into a single parallel-lane status. */
function laneStatus(subSteps: MacroStepV1[]): 'done' | 'active' | 'pending' | 'error' {
  if (subSteps.some((s) => s.status === 'failed')) return 'error';
  if (subSteps.some((s) => s.status === 'active')) return 'active';
  if (subSteps.length > 0 && subSteps.every((s) => s.status === 'done' || s.status === 'skipped'))
    return 'done';
  return 'pending';
}

/**
 * Build a `split_stepper` content from steps that carry `parallel` branches.
 * Each top-level step becomes a lane: a step with `parallel` sub-steps shows
 * those sub-steps; a step without falls back to a single-step lane.
 */
function buildSplitStepperContent(steps: MacroStepV1[]): SplitStepperContent {
  return {
    agents: steps.map((step) => {
      const subSteps = step.parallel && step.parallel.length > 0 ? step.parallel : [step];
      return {
        id: step.id,
        name: step.label,
        status: laneStatus(subSteps),
        steps: subSteps.map((sub) => ({
          id: sub.id,
          label: sub.label,
          status: stepToStepperStatus(sub.status),
        })),
      };
    }),
  };
}

/** Component `type` → the closest `ScratchpadSection` type for a result. */
function resultSectionType(componentType: unknown): ScratchpadSection['type'] {
  switch (componentType) {
    case 'chart':
      return 'chart';
    case 'map':
      return 'map';
    case 'table':
      return 'data_preview';
    default:
      return 'data';
  }
}

function buildError(run: MacroRunV1): ScratchpadState['error'] | undefined {
  if (run.status !== 'failed' && run.status !== 'aborted') return undefined;
  const aborted = run.status === 'aborted';
  if (run.error) {
    const err: NonNullable<ScratchpadState['error']> = {
      message: run.error.message,
      // An aborted run is never retryable, regardless of the producer flag.
      retryable: aborted ? false : (run.error.retryable ?? false),
    };
    if (run.error.code) err.code = run.error.code;
    return err;
  }
  return {
    message: aborted ? 'Macro run aborted.' : 'Macro run failed.',
    retryable: false,
  };
}

// ─── macroRunToScratchpadState ───────────────────────────────

/**
 * Convert a `MacroRunV1` snapshot into a `ScratchpadState`.
 *
 * Sections produced, in order:
 * 1. `agent_card` — always (derived from `run.agent`, or from the macro
 *    identity when the run carries no agent, e.g. a non-interactive macro).
 * 2. `stepper` — when the run has steps and none carry `parallel` branches.
 *    `split_stepper` instead when any step carries `parallel` (future model).
 * 3. `prompt` — when `run.pendingInterrogation` is set; its content is the
 *    `ChatPromptConfig` produced by {@link macroInterrogationToChatPromptConfig}.
 * 4. one section per `run.results` entry (`chart` / `map` / `data_preview` /
 *    `data`, by component type). Optional — the adapter works without results.
 *
 * Pure: no fetch, no SSE, no persistence. The host owns all wiring.
 */
export function macroRunToScratchpadState(run: MacroRunV1): ScratchpadState {
  const sections: ScratchpadSection[] = [];

  // 1. Agent card — always present.
  sections.push({
    id: 'macro-agent',
    title: 'Agent',
    type: 'agent_card',
    content: buildAgentCard(run),
    editable: false,
    source: 'agent',
  });

  // 2. Stepper / split_stepper — when there are steps.
  if (run.steps.length > 0) {
    const hasParallel = run.steps.some((s) => Array.isArray(s.parallel) && s.parallel.length > 0);
    sections.push(
      hasParallel
        ? {
            id: 'macro-split-stepper',
            title: 'Progress',
            type: 'split_stepper',
            content: buildSplitStepperContent(run.steps),
            editable: false,
            source: 'agent',
          }
        : {
            id: 'macro-stepper',
            title: 'Progress',
            type: 'stepper',
            content: buildStepperContent(run.steps),
            editable: false,
            source: 'agent',
          }
    );
  }

  // 3. Pending interrogation → a `prompt` section.
  if (run.pendingInterrogation) {
    sections.push({
      id: 'macro-prompt',
      title: run.pendingInterrogation.title,
      type: 'prompt',
      content: macroInterrogationToChatPromptConfig(run.pendingInterrogation),
      editable: false,
      source: 'agent',
    });
  }

  // 4. Result components → one section each (results are optional). A result
  // is a `UIComponent`-shaped object — passthrough, read loosely (the spec
  // validates the run envelope, the renderer validates each component).
  const results = run.results ?? [];
  results.forEach((component, index) => {
    sections.push({
      id: `macro-result-${String(component?.id ?? index)}`,
      title: 'Result',
      type: resultSectionType(component?.type),
      content: component,
      editable: false,
      source: 'agent',
    });
  });

  const state: ScratchpadState = {
    id: run.runId,
    title: run.title ?? run.macroName ?? run.macroId,
    sections,
    filters: {},
    agentMessages: [],
    status: RUN_STATUS_TO_SCRATCHPAD[run.status],
  };

  const error = buildError(run);
  if (error) state.error = error;

  return state;
}

// ─── macroInterrogationToChatPromptConfig ────────────────────

function isElicitationSchema(value: unknown): value is ElicitationRequestedSchema {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { type?: unknown; properties?: unknown };
  return v.type === 'object' && typeof v.properties === 'object' && v.properties !== null;
}

/**
 * Convert a `MacroInterrogationV1` into a `ChatPromptConfig`.
 *
 * - `choice` → `{ type: 'choice' }` (vertical layout).
 * - `confirm` → `{ type: 'confirm' }`.
 * - `form` → `{ type: 'form' }` (the opaque `fields` are passed through).
 * - `elicitation` → routed through the existing `elicitationToPromptConfig()`
 *   helper. If the interrogation carries no usable elicitation JSON Schema,
 *   it degrades to a `confirm` prompt rather than throwing.
 *
 * Always returns a `ChatPromptConfig` — never an `ElicitationEvent` — so the
 * host has a single entry point. Usable standalone or via
 * {@link macroRunToScratchpadState} (which calls it for an embedded
 * `pendingInterrogation`).
 */
export function macroInterrogationToChatPromptConfig(q: MacroInterrogationV1): ChatPromptConfig {
  switch (q.kind) {
    case 'choice': {
      const options: ChoiceOption[] = (q.options ?? []).map((o) => {
        const opt: ChoiceOption = { value: o.value, label: o.label };
        if (o.icon) opt.icon = o.icon;
        if (o.description) opt.description = o.description;
        if (o.metadata) opt.metadata = o.metadata;
        return opt;
      });
      return {
        type: 'choice',
        title: q.title,
        config: { options, layout: 'vertical' },
      };
    }

    case 'confirm': {
      const config: ConfirmPromptConfig = {};
      if (q.message) config.message = q.message;
      if (q.confirm?.confirmLabel) config.confirmLabel = q.confirm.confirmLabel;
      if (q.confirm?.cancelLabel) config.cancelLabel = q.confirm.cancelLabel;
      if (q.confirm?.variant) config.variant = q.confirm.variant;
      return { type: 'confirm', title: q.title, config };
    }

    case 'form':
      return {
        type: 'form',
        title: q.title,
        config: { fields: (q.fields ?? []) as FormPromptConfig['fields'] },
      };

    case 'elicitation': {
      if (isElicitationSchema(q.elicitationSchema)) {
        return elicitationToPromptConfig({
          message: q.message ?? q.title,
          requestedSchema: q.elicitationSchema,
        });
      }
      // No usable schema — degrade gracefully instead of crashing.
      return {
        type: 'confirm',
        title: q.title,
        config: { message: q.message ?? 'Please confirm to continue.' },
      };
    }
  }
}
