/**
 * v6.6.1 — `action: 'submit'` reaches the host executor outside a <form>.
 *
 * Before v6.6.1, `submit` actions were inert : `ActionGroupRenderer` only
 * branched on `tool-call` / `link`, and the standalone `action` renderer
 * emitted a native `type="submit"` button that did nothing outside a real
 * `<form>`. This file pins the fix — a full integration test through the
 * real `useAction` → `MCPActionContext` → host `executor` path (no mocks).
 *
 * Covers both render surfaces :
 *   - `<ActionGroupRenderer>` (action-group)
 *   - `<UIResourceRenderer content={{ type: 'action', ... }}>` (standalone)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@solidjs/testing-library'
import { ActionGroupRenderer } from './ActionGroupRenderer'
import { UIResourceRenderer } from './UIResourceRenderer'
import { MCPActionProvider } from '../context/MCPActionContext'
import type { ActionRequest, ActionResult } from '../context/MCPActionContext'
import type { UIComponent } from '../types'

// The connector "feedback format" payload from the bug report.
const SUBMIT_PARAMS = {
  submit_url: '/api/connector-render-feedback',
  feedback_kind: 'presentation',
  connector_id: 'clinicaltrials',
  tool_name: 'clinicaltrials_search',
  render_kind: 'clinical_trial_search',
  preferred_layout_options: ['table', 'cards', 'bar'],
}

function makeExecutor() {
  const calls: ActionRequest[] = []
  const executor = vi.fn(async (req: ActionRequest): Promise<ActionResult> => {
    calls.push(req)
    return { success: true, timestamp: new Date().toISOString(), toolName: req.toolName }
  })
  return { executor, calls }
}

describe('action: submit reaches the host executor (v6.6.1)', () => {
  beforeEach(() => cleanup())

  it('ActionGroupRenderer routes a submit action to the executor', async () => {
    const { executor, calls } = makeExecutor()
    const component: UIComponent = {
      id: 'ag',
      type: 'action-group',
      position: { colStart: 1, colSpan: 12 },
      params: {
        actions: [
          { label: 'Feedback format', action: 'submit', params: SUBMIT_PARAMS },
        ],
      },
    } as UIComponent

    render(() => (
      <MCPActionProvider executor={executor}>
        <ActionGroupRenderer component={component} />
      </MCPActionProvider>
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Feedback format' }))

    await waitFor(() => expect(executor).toHaveBeenCalledTimes(1))
    const req = calls[0]
    // The action KIND is preserved — host can tell it apart from a tool call.
    expect(req.action).toBe('submit')
    // The full params payload survives intact.
    expect(req.params).toEqual(SUBMIT_PARAMS)
  })

  it('a submit action is NOT executed as a tool call', async () => {
    const { executor, calls } = makeExecutor()
    const component: UIComponent = {
      id: 'ag',
      type: 'action-group',
      position: { colStart: 1, colSpan: 12 },
      params: {
        actions: [{ label: 'Send', action: 'submit', params: SUBMIT_PARAMS }],
      },
    } as UIComponent

    render(() => (
      <MCPActionProvider executor={executor}>
        <ActionGroupRenderer component={component} />
      </MCPActionProvider>
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(executor).toHaveBeenCalledTimes(1))
    // action is 'submit', never silently coerced to 'tool-call'
    expect(calls[0].action).not.toBe('tool-call')
    expect(calls[0].action).toBe('submit')
  })

  it('standalone action component (UIResourceRenderer) routes submit to the executor', async () => {
    const { executor, calls } = makeExecutor()
    const component: UIComponent = {
      id: 'act',
      type: 'action',
      position: { colStart: 1, colSpan: 12 },
      params: { label: 'Feedback format', action: 'submit', params: SUBMIT_PARAMS },
    } as UIComponent

    render(() => (
      <MCPActionProvider executor={executor}>
        <UIResourceRenderer content={component} />
      </MCPActionProvider>
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Feedback format' }))

    await waitFor(() => expect(executor).toHaveBeenCalledTimes(1))
    expect(calls[0].action).toBe('submit')
    expect(calls[0].params).toEqual(SUBMIT_PARAMS)
  })

  it('standalone submit button is type="button" — not a native form submit', () => {
    const component: UIComponent = {
      id: 'act',
      type: 'action',
      position: { colStart: 1, colSpan: 12 },
      params: { label: 'Send', action: 'submit', params: {} },
    } as UIComponent

    const { container } = render(() => (
      <MCPActionProvider executor={makeExecutor().executor}>
        <UIResourceRenderer content={component} />
      </MCPActionProvider>
    ))
    const btn = container.querySelector('button')
    // Must NOT rely on a surrounding <form> — JS-handled, type=button.
    expect(btn?.getAttribute('type')).toBe('button')
  })

  it('tool-call actions still work unchanged', async () => {
    const { executor, calls } = makeExecutor()
    const component: UIComponent = {
      id: 'ag',
      type: 'action-group',
      position: { colStart: 1, colSpan: 12 },
      params: {
        actions: [
          { label: 'Run', action: 'tool-call', toolName: 'do_thing', params: { a: 1 } },
        ],
      },
    } as UIComponent

    render(() => (
      <MCPActionProvider executor={executor}>
        <ActionGroupRenderer component={component} />
      </MCPActionProvider>
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(executor).toHaveBeenCalledTimes(1))
    expect(calls[0].toolName).toBe('do_thing')
    expect(calls[0].params).toEqual({ a: 1 })
  })

  it('a disabled submit action does not call the executor', async () => {
    const { executor } = makeExecutor()
    const component: UIComponent = {
      id: 'ag',
      type: 'action-group',
      position: { colStart: 1, colSpan: 12 },
      params: {
        actions: [
          { label: 'Send', action: 'submit', params: SUBMIT_PARAMS, disabled: true },
        ],
      },
    } as UIComponent

    render(() => (
      <MCPActionProvider executor={executor}>
        <ActionGroupRenderer component={component} />
      </MCPActionProvider>
    ))
    const btn = screen.getByRole('button', { name: 'Send' })
    expect(btn.hasAttribute('disabled')).toBe(true)
    fireEvent.click(btn)
    // Give any async handler a tick — nothing should fire.
    await new Promise((r) => setTimeout(r, 10))
    expect(executor).not.toHaveBeenCalled()
  })
})
