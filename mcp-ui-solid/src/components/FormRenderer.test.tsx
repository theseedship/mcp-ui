/**
 * FormRenderer Tests
 * Sprint 1: Form Foundation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library'
import { FormRenderer } from './FormRenderer'
import { FormFieldRenderer } from './FormFieldRenderer'
import { validateFormData, validateFieldValue } from '../services/validation'
import type { UIComponent, FormComponentParams, FormFieldParams } from '../types'

// Mock useAction hook
vi.mock('../hooks/useAction', () => ({
  useAction: () => ({
    execute: vi.fn().mockResolvedValue({ success: true }),
    isExecuting: () => false,
    lastResult: () => undefined,
    lastError: () => undefined,
  }),
}))

describe('FormRenderer', () => {
  const createFormComponent = (params: Partial<FormComponentParams> = {}): UIComponent => ({
    id: 'test-form',
    type: 'form',
    position: { colStart: 1, colSpan: 12 },
    params: {
      fields: [
        { name: 'username', type: 'text', label: 'Username', required: true },
      ],
      submitLabel: 'Save',
      ...params,
    } as FormComponentParams,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form with title', () => {
    const component = createFormComponent({ title: 'Test Form' })
    render(() => <FormRenderer component={component} />)

    expect(screen.getByText('Test Form')).toBeTruthy()
  })

  it('renders form fields', () => {
    const component = createFormComponent({
      fields: [
        { name: 'email', type: 'email', label: 'Email' },
        { name: 'message', type: 'textarea', label: 'Message' },
      ],
    })
    render(() => <FormRenderer component={component} />)

    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Message')).toBeTruthy()
  })

  it('renders submit button with custom label', () => {
    const component = createFormComponent({ submitLabel: 'Send Message' })
    render(() => <FormRenderer component={component} />)

    expect(screen.getByRole('button', { name: 'Send Message' })).toBeTruthy()
  })

  it('renders reset button when showReset is true', () => {
    const component = createFormComponent({ showReset: true })
    render(() => <FormRenderer component={component} />)

    expect(screen.getByRole('button', { name: 'Reset' })).toBeTruthy()
  })

  it('does not render reset button when showReset is false', () => {
    const component = createFormComponent({ showReset: false })
    render(() => <FormRenderer component={component} />)

    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull()
  })

  it('calls onSubmit with form data when validation passes', async () => {
    const onSubmit = vi.fn()
    const component = createFormComponent({
      fields: [{ name: 'name', type: 'text', label: 'Name' }],
    })

    render(() => <FormRenderer component={component} onSubmit={onSubmit} />)

    const input = screen.getByLabelText('Name')
    fireEvent.input(input, { target: { value: 'John Doe' } })

    const submitBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: 'John Doe' })
    })
  })

  it('shows validation error for required fields', async () => {
    const onError = vi.fn()
    const component = createFormComponent({
      fields: [{ name: 'username', type: 'text', label: 'Username', required: true }],
    })

    render(() => <FormRenderer component={component} onError={onError} />)

    const submitBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeTruthy()
      expect(onError).toHaveBeenCalled()
    })
  })

  it('clears error when field value changes', async () => {
    const component = createFormComponent({
      fields: [{ name: 'email', type: 'email', label: 'Email', required: true }],
    })

    render(() => <FormRenderer component={component} />)

    // Submit to trigger error
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeTruthy()
    })

    // Type in field to clear error - use getByRole instead because the label includes required indicator
    const input = screen.getByRole('textbox')
    fireEvent.input(input, { target: { value: 'test@example.com' } })

    await waitFor(() => {
      expect(screen.queryByText('Email is required')).toBeNull()
    })
  })
})

describe('FormFieldRenderer', () => {
  const createField = (overrides: Partial<FormFieldParams> = {}): FormFieldParams => ({
    name: 'testField',
    type: 'text',
    label: 'Test Field',
    ...overrides,
  })

  it('renders text input', () => {
    render(() => (
      <FormFieldRenderer
        field={createField({ type: 'text' })}
        value=""
        onChange={() => {}}
      />
    ))

    const input = screen.getByLabelText('Test Field') as HTMLInputElement
    expect(input.type).toBe('text')
  })

  it('renders email input', () => {
    render(() => (
      <FormFieldRenderer
        field={createField({ type: 'email', label: 'Email' })}
        value=""
        onChange={() => {}}
      />
    ))

    const input = screen.getByLabelText('Email') as HTMLInputElement
    expect(input.type).toBe('email')
  })

  it('renders textarea', () => {
    render(() => (
      <FormFieldRenderer
        field={createField({ type: 'textarea', label: 'Message', rows: 5 })}
        value=""
        onChange={() => {}}
      />
    ))

    const textarea = screen.getByLabelText('Message') as HTMLTextAreaElement
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea.rows).toBe(5)
  })

  it('renders select with options', () => {
    render(() => (
      <FormFieldRenderer
        field={createField({
          type: 'select',
          label: 'Country',
          options: [
            { label: 'USA', value: 'us' },
            { label: 'Canada', value: 'ca' },
          ],
        })}
        value=""
        onChange={() => {}}
      />
    ))

    const select = screen.getByLabelText('Country') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    expect(screen.getByText('USA')).toBeTruthy()
    expect(screen.getByText('Canada')).toBeTruthy()
  })

  it('renders checkbox', () => {
    render(() => (
      <FormFieldRenderer
        field={createField({ type: 'checkbox', checkboxLabel: 'I agree' })}
        value={false}
        onChange={() => {}}
      />
    ))

    expect(screen.getByRole('checkbox')).toBeTruthy()
    expect(screen.getByText('I agree')).toBeTruthy()
  })

  it('renders radio group', () => {
    render(() => (
      <FormFieldRenderer
        field={createField({
          type: 'radio',
          label: 'Size',
          options: [
            { label: 'Small', value: 's' },
            { label: 'Medium', value: 'm' },
            { label: 'Large', value: 'l' },
          ],
        })}
        value=""
        onChange={() => {}}
      />
    ))

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
  })

  it('shows required indicator', () => {
    render(() => (
      <FormFieldRenderer
        field={createField({ required: true })}
        value=""
        onChange={() => {}}
      />
    ))

    expect(screen.getByText('*')).toBeTruthy()
  })

  it('shows help text', () => {
    render(() => (
      <FormFieldRenderer
        field={createField({ helpText: 'Enter your full name' })}
        value=""
        onChange={() => {}}
      />
    ))

    expect(screen.getByText('Enter your full name')).toBeTruthy()
  })

  it('shows error message', () => {
    render(() => (
      <FormFieldRenderer
        field={createField()}
        value=""
        error="This field is required"
        onChange={() => {}}
      />
    ))

    expect(screen.getByText('This field is required')).toBeTruthy()
  })

  it('disables input when disabled prop is true', () => {
    render(() => (
      <FormFieldRenderer
        field={createField()}
        value=""
        onChange={() => {}}
        disabled={true}
      />
    ))

    const input = screen.getByLabelText('Test Field') as HTMLInputElement
    expect(input.disabled).toBe(true)
  })

  it('calls onChange when value changes', async () => {
    const onChange = vi.fn()
    render(() => (
      <FormFieldRenderer
        field={createField()}
        value=""
        onChange={onChange}
      />
    ))

    const input = screen.getByLabelText('Test Field')
    fireEvent.input(input, { target: { value: 'new value' } })

    expect(onChange).toHaveBeenCalledWith('new value')
  })
})

describe('validateFieldValue', () => {
  it('validates required text field', () => {
    const field: FormFieldParams = { name: 'name', type: 'text', required: true }

    expect(validateFieldValue('', field).valid).toBe(false)
    expect(validateFieldValue('John', field).valid).toBe(true)
  })

  it('validates email format', () => {
    const field: FormFieldParams = { name: 'email', type: 'email', required: true }

    expect(validateFieldValue('invalid', field).valid).toBe(false)
    expect(validateFieldValue('test@example.com', field).valid).toBe(true)
  })

  it('validates minLength', () => {
    const field: FormFieldParams = { name: 'password', type: 'password', minLength: 8 }

    expect(validateFieldValue('short', field).valid).toBe(false)
    expect(validateFieldValue('longenough', field).valid).toBe(true)
  })

  it('validates maxLength', () => {
    const field: FormFieldParams = { name: 'code', type: 'text', maxLength: 5 }

    expect(validateFieldValue('toolong', field).valid).toBe(false)
    expect(validateFieldValue('ok', field).valid).toBe(true)
  })

  it('validates number min/max', () => {
    const field: FormFieldParams = { name: 'age', type: 'number', min: 18, max: 100 }

    expect(validateFieldValue(10, field).valid).toBe(false)
    expect(validateFieldValue(150, field).valid).toBe(false)
    expect(validateFieldValue(25, field).valid).toBe(true)
  })

  it('validates checkbox required', () => {
    const field: FormFieldParams = { name: 'terms', type: 'checkbox', required: true }

    expect(validateFieldValue(false, field).valid).toBe(false)
    expect(validateFieldValue(true, field).valid).toBe(true)
  })
})

describe('validateFormData', () => {
  it('validates all fields', () => {
    const fields: FormFieldParams[] = [
      { name: 'name', type: 'text', label: 'Name', required: true },
      { name: 'email', type: 'email', label: 'Email', required: true },
    ]

    const invalidResult = validateFormData({ name: '', email: 'invalid' }, fields)
    expect(invalidResult.valid).toBe(false)
    expect(invalidResult.errors.name).toBeDefined()
    expect(invalidResult.errors.email).toBeDefined()

    const validResult = validateFormData({ name: 'John', email: 'john@example.com' }, fields)
    expect(validResult.valid).toBe(true)
    expect(Object.keys(validResult.errors)).toHaveLength(0)
  })
})

// Sprint 2: Conditional Fields Tests
import { evaluateCondition } from '../hooks/useConditionalField'
import type { ShowWhenCondition } from '../types'

describe('evaluateCondition', () => {
  it('evaluates equals operator', () => {
    const condition: ShowWhenCondition = { field: 'status', operator: 'equals', value: 'active' }
    expect(evaluateCondition(condition, { status: 'active' })).toBe(true)
    expect(evaluateCondition(condition, { status: 'inactive' })).toBe(false)
  })

  it('evaluates notEquals operator', () => {
    const condition: ShowWhenCondition = { field: 'status', operator: 'notEquals', value: 'deleted' }
    expect(evaluateCondition(condition, { status: 'active' })).toBe(true)
    expect(evaluateCondition(condition, { status: 'deleted' })).toBe(false)
  })

  it('evaluates in operator', () => {
    const condition: ShowWhenCondition = { field: 'role', operator: 'in', value: ['admin', 'moderator'] }
    expect(evaluateCondition(condition, { role: 'admin' })).toBe(true)
    expect(evaluateCondition(condition, { role: 'user' })).toBe(false)
  })

  it('evaluates notIn operator', () => {
    const condition: ShowWhenCondition = { field: 'role', operator: 'notIn', value: ['banned', 'suspended'] }
    expect(evaluateCondition(condition, { role: 'user' })).toBe(true)
    expect(evaluateCondition(condition, { role: 'banned' })).toBe(false)
  })

  it('evaluates contains operator', () => {
    const condition: ShowWhenCondition = { field: 'email', operator: 'contains', value: '@example' }
    expect(evaluateCondition(condition, { email: 'test@example.com' })).toBe(true)
    expect(evaluateCondition(condition, { email: 'test@other.com' })).toBe(false)
  })

  it('evaluates startsWith operator', () => {
    const condition: ShowWhenCondition = { field: 'name', operator: 'startsWith', value: 'Dr.' }
    expect(evaluateCondition(condition, { name: 'Dr. Smith' })).toBe(true)
    expect(evaluateCondition(condition, { name: 'John Smith' })).toBe(false)
  })

  it('evaluates endsWith operator', () => {
    const condition: ShowWhenCondition = { field: 'file', operator: 'endsWith', value: '.pdf' }
    expect(evaluateCondition(condition, { file: 'document.pdf' })).toBe(true)
    expect(evaluateCondition(condition, { file: 'document.doc' })).toBe(false)
  })

  it('evaluates greaterThan operator', () => {
    const condition: ShowWhenCondition = { field: 'age', operator: 'greaterThan', value: 18 }
    expect(evaluateCondition(condition, { age: 25 })).toBe(true)
    expect(evaluateCondition(condition, { age: 15 })).toBe(false)
  })

  it('evaluates lessThan operator', () => {
    const condition: ShowWhenCondition = { field: 'price', operator: 'lessThan', value: 100 }
    expect(evaluateCondition(condition, { price: 50 })).toBe(true)
    expect(evaluateCondition(condition, { price: 150 })).toBe(false)
  })

  it('evaluates isEmpty operator', () => {
    const condition: ShowWhenCondition = { field: 'notes', operator: 'isEmpty' }
    expect(evaluateCondition(condition, { notes: '' })).toBe(true)
    expect(evaluateCondition(condition, { notes: undefined })).toBe(true)
    expect(evaluateCondition(condition, { notes: null })).toBe(true)
    expect(evaluateCondition(condition, { notes: 'some notes' })).toBe(false)
  })

  it('evaluates isNotEmpty operator', () => {
    const condition: ShowWhenCondition = { field: 'notes', operator: 'isNotEmpty' }
    expect(evaluateCondition(condition, { notes: 'some notes' })).toBe(true)
    expect(evaluateCondition(condition, { notes: '' })).toBe(false)
  })

  it('evaluates isTrue operator', () => {
    const condition: ShowWhenCondition = { field: 'subscribe', operator: 'isTrue' }
    expect(evaluateCondition(condition, { subscribe: true })).toBe(true)
    expect(evaluateCondition(condition, { subscribe: false })).toBe(false)
  })

  it('evaluates isFalse operator', () => {
    const condition: ShowWhenCondition = { field: 'disabled', operator: 'isFalse' }
    expect(evaluateCondition(condition, { disabled: false })).toBe(true)
    expect(evaluateCondition(condition, { disabled: true })).toBe(false)
  })
})

describe('FormRenderer with conditional fields', () => {
  const createFormWithConditionalField = () => ({
    id: 'test-form',
    type: 'form' as const,
    position: { colStart: 1, colSpan: 12 },
    params: {
      fields: [
        { name: 'hasEmail', type: 'checkbox' as const, checkboxLabel: 'I have an email' },
        {
          name: 'email',
          type: 'email' as const,
          label: 'Email',
          required: true,
          showWhen: { field: 'hasEmail', operator: 'isTrue' as const },
        },
      ],
      submitLabel: 'Submit',
    },
  })

  it('hides conditional field when condition is false', () => {
    const component = createFormWithConditionalField()
    render(() => <FormRenderer component={component} />)

    // Email field should be hidden (checkbox is unchecked by default)
    expect(screen.queryByLabelText('Email')).toBeNull()
  })

  it('shows conditional field when condition becomes true', async () => {
    const component = createFormWithConditionalField()
    render(() => <FormRenderer component={component} />)

    // Check the checkbox
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    // Email field should now be visible
    await waitFor(() => {
      expect(screen.getByLabelText(/Email/)).toBeTruthy()
    })
  })

  it('excludes hidden fields from validation', async () => {
    const onSubmit = vi.fn()
    const component = createFormWithConditionalField()
    render(() => <FormRenderer component={component} onSubmit={onSubmit} />)

    // Submit without checking checkbox - email field is hidden, so no validation error
    const submitBtn = screen.getByRole('button', { name: 'Submit' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ hasEmail: false })
    })
  })

  it('includes visible conditional fields in validation', async () => {
    const onError = vi.fn()
    const component = createFormWithConditionalField()
    render(() => <FormRenderer component={component} onError={onError} />)

    // Check the checkbox to show email field
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    // Submit without filling email - should trigger validation error
    const submitBtn = screen.getByRole('button', { name: 'Submit' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
  })
})
