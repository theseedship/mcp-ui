/**
 * Tests for ElicitationForm — v5.3.0
 *
 * Coverage focus : the inverse mapping (ChatPromptResponse → spec content)
 * that this wrapper owns. The forward mapping (spec → ChatPromptConfig) is
 * already covered by `chat-bus.test.ts elicitationToPromptConfig`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { ElicitationForm } from './ElicitationForm'
import type { ElicitationEvent } from '../types/chat-bus'

describe('ElicitationForm — v5.3.0', () => {
  beforeEach(() => {
    cleanup()
  })

  it('boolean property → confirm UI → onAccept gets { propName: true }', () => {
    const onAccept = vi.fn()
    const event: ElicitationEvent = {
      message: 'Proceed?',
      requestedSchema: {
        type: 'object',
        properties: {
          consent: { type: 'boolean', description: 'I agree' },
        },
        required: ['consent'],
      },
    }

    const { getByText } = render(() => (
      <ElicitationForm event={event} onAccept={onAccept} onCancel={() => {}} />
    ))

    // ChatPrompt renders a Confirm button — find and click it.
    const confirmBtn = getByText('Confirm') as HTMLElement
    fireEvent.click(confirmBtn)

    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(onAccept).toHaveBeenCalledWith({ consent: true })
  })

  it('single enum property → choice UI → onAccept gets { propName: enumValue }', () => {
    const onAccept = vi.fn()
    const event: ElicitationEvent = {
      message: 'Pick a tier',
      requestedSchema: {
        type: 'object',
        properties: {
          tier: {
            type: 'string',
            enum: ['free', 'pro', 'enterprise'],
            enumNames: ['Free', 'Pro', 'Enterprise'],
          },
        },
      },
    }

    const { getByText } = render(() => (
      <ElicitationForm event={event} onAccept={onAccept} />
    ))

    fireEvent.click(getByText('Pro') as HTMLElement)

    expect(onAccept).toHaveBeenCalledWith({ tier: 'pro' })
  })

  it('numeric enum property → onAccept coerces value to number', () => {
    const onAccept = vi.fn()
    const event: ElicitationEvent = {
      message: 'Pick a level',
      requestedSchema: {
        type: 'object',
        properties: {
          level: { type: 'integer', enum: [1, 2, 3] },
        },
      },
    }

    const { getByText } = render(() => (
      <ElicitationForm event={event} onAccept={onAccept} />
    ))

    fireEvent.click(getByText('2') as HTMLElement)

    expect(onAccept).toHaveBeenCalledWith({ level: 2 })
  })

  it('multi-property schema → form UI → onAccept gets formValues unchanged', () => {
    const onAccept = vi.fn()
    const event: ElicitationEvent = {
      message: 'Tenant scope required',
      requestedSchema: {
        type: 'object',
        properties: {
          tenant_id: { type: 'string', title: 'Tenant ID' },
          space_id: { type: 'string', title: 'Space ID', default: 'default' },
        },
        required: ['tenant_id', 'space_id'],
      },
    }

    const { container, getByText } = render(() => (
      <ElicitationForm event={event} onAccept={onAccept} />
    ))

    const tenantInput = container.querySelector('input[name="tenant_id"]') as HTMLInputElement
    const spaceInput = container.querySelector('input[name="space_id"]') as HTMLInputElement
    expect(tenantInput).toBeTruthy()
    expect(spaceInput).toBeTruthy()

    fireEvent.input(tenantInput, { target: { value: 'acme-co' } })
    fireEvent.input(spaceInput, { target: { value: 'prod' } })

    const submitBtn = getByText('Submit') as HTMLElement
    fireEvent.click(submitBtn)

    expect(onAccept).toHaveBeenCalledTimes(1)
    const [content] = onAccept.mock.calls[0]
    expect(content).toMatchObject({ tenant_id: 'acme-co', space_id: 'prod' })
  })

  it('X dismiss → onCancel fires, onAccept does NOT', () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    const event: ElicitationEvent = {
      message: 'Pick a tier',
      requestedSchema: {
        type: 'object',
        properties: {
          tier: { type: 'string', enum: ['a', 'b'] },
        },
      },
    }

    const { container } = render(() => (
      <ElicitationForm event={event} onAccept={onAccept} onCancel={onCancel} />
    ))

    const dismissBtn = container.querySelector('[aria-label="Dismiss"]') as HTMLElement
    fireEvent.click(dismissBtn)

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onAccept).not.toHaveBeenCalled()
  })

  it('onDecline takes precedence over onCancel when provided', () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    const onDecline = vi.fn()
    const event: ElicitationEvent = {
      message: 'Proceed?',
      requestedSchema: {
        type: 'object',
        properties: { consent: { type: 'boolean' } },
      },
    }

    const { getByText } = render(() => (
      <ElicitationForm
        event={event}
        onAccept={onAccept}
        onCancel={onCancel}
        onDecline={onDecline}
        dismissLabel="Decline"
      />
    ))

    fireEvent.click(getByText('Decline') as HTMLElement)

    expect(onDecline).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
    expect(onAccept).not.toHaveBeenCalled()
  })

  it('confirm cancel button → onCancel fires (dismissed=true via cancel button)', () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    const event: ElicitationEvent = {
      message: 'Proceed?',
      requestedSchema: {
        type: 'object',
        properties: { consent: { type: 'boolean' } },
      },
    }

    const { getByText } = render(() => (
      <ElicitationForm event={event} onAccept={onAccept} onCancel={onCancel} />
    ))

    fireEvent.click(getByText('Cancel') as HTMLElement)

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onAccept).not.toHaveBeenCalled()
  })
})
