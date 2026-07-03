# MCP-UI Solid Improvements - Sprint Planning

> **Document Version:** 1.5.0
> **Generated:** 2026-01-20
> **Last Updated:** 2026-01-20 (Sprint 7 completed - ALL SPRINTS DONE!)
> **Target Package:** `@seed-ship/mcp-ui-solid`

---

## Implementation Progress

| Sprint | Name | Priority | Status | Completed |
|--------|------|----------|--------|-----------|
| 1 | Form Foundation | HIGH | ✅ DONE | 2026-01-20 |
| 2 | Form Advanced | HIGH | ✅ DONE | 2026-01-20 |
| 3 | UX Improvements | MEDIUM | ✅ DONE | 2026-01-20 |
| 4 | State & Charts | MEDIUM | ✅ DONE | 2026-01-20 |
| 5 | Media Components | ADVANCED | ✅ DONE | 2026-01-20 |
| 6 | Code & Maps | ADVANCED | ✅ DONE | 2026-01-20 |
| 7 | Security & Polish | LOW | ✅ DONE | 2026-01-20 |

### Test Coverage After Sprints 1-6
- **mcp-ui-solid:** 145 tests passing (+10 from Sprint 6)
- **mcp-ui-spec:** 4 tests passing
- **mcp-ui-cli:** 4 tests passing
- **Total:** 153 tests passing

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Sprint 1: Form Foundation (HIGH)](#sprint-1-form-foundation-high)
3. [Sprint 2: Form Advanced (HIGH)](#sprint-2-form-advanced-high)
4. [Sprint 3: UX Improvements (MEDIUM)](#sprint-3-ux-improvements-medium)
5. [Sprint 4: State & Charts (MEDIUM)](#sprint-4-state--charts-medium)
6. [Sprint 5: Media Components (ADVANCED)](#sprint-5-media-components-advanced)
7. [Sprint 6: Code & Maps (ADVANCED)](#sprint-6-code--maps-advanced)
8. [Sprint 7: Security & Polish (LOW)](#sprint-7-security--polish-low)
9. [Critical Files Reference](#critical-files-reference)
10. [Dependencies Graph](#dependencies-graph)

---

## Strategic Insights & Standards (Added)

Based on codebase analysis, the following standards apply to all sprints:

1.  **Testing Strategy**: Every new component MUST have a co-located test file (e.g., `FormRenderer.test.tsx`) using `vitest` and `@solidjs/testing-library`.
2.  **Accessibility (a11y)**: All form fields must use proper `id`/`for` association and `aria-*` attributes for errors.
3.  **Package Exports**: New components must be exported in `mcp-ui-solid/src/components/index.ts` to be accessible to consumers.
4.  **Dev Environment**: Use `pnpm dev` in the root to validate changes visually if a playground exists, or ensure unit tests cover rendering cases.

---

## Architecture Overview

### Current Component Dispatch Pattern (UIResourceRenderer.tsx:582-649)

```typescript
function ComponentRenderer(props: { component: UIComponent }) {
  return (
    <GenerativeUIErrorBoundary>
      <Show when={props.component.type === 'chart'}><ChartRenderer /></Show>
      <Show when={props.component.type === 'table'}><TableRenderer /></Show>
      <Show when={props.component.type === 'metric'}><MetricRenderer /></Show>
      <Show when={props.component.type === 'text'}><TextRenderer /></Show>
      <Show when={props.component.type === 'iframe'}><IframeRenderer /></Show>
      <Show when={props.component.type === 'image'}><ImageRenderer /></Show>
      <Show when={props.component.type === 'link'}><LinkRenderer /></Show>
      <Show when={props.component.type === 'action'}><ActionRenderer /></Show>
      <Show when={props.component.type === 'grid'}><GridRenderer /></Show>
      <Show when={props.component.type === 'carousel'}><CarouselRenderer /></Show>
      <Show when={props.component.type === 'artifact'}><ArtifactRenderer /></Show>
    </GenerativeUIErrorBoundary>
  )
}
```

### Current Iframe Whitelist (validation.ts:35-51) - Updated after Sprint 5

```typescript
const ALLOWED_IFRAME_DOMAINS = [
  // Charts
  'quickchart.io',
  'www.quickchart.io',
  // Deposium
  'deposium.com',
  'deposium.vip',
  // Development
  'localhost',
  // Video providers (Sprint 5)
  'youtube.com',
  'www.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'vimeo.com',
  'player.vimeo.com',
]
```

### Current Component Types (types/index.ts:11-30) - Updated after Sprint 6

```typescript
export type ComponentType =
  | 'chart' | 'table' | 'metric' | 'text' | 'grid'
  | 'iframe' | 'image' | 'link' | 'action' | 'footer'
  | 'carousel' | 'artifact'
  | 'form'          // ✅ Added in Sprint 1
  | 'modal'         // ✅ Added in Sprint 3
  | 'action-group'  // ✅ Added in Sprint 3
  | 'image-gallery' // ✅ Added in Sprint 5
  | 'video'         // ✅ Added in Sprint 5
  | 'code'          // ✅ Added in Sprint 6
  | 'map'           // ✅ Added in Sprint 6
```

### Action System (useAction.ts) - Updated after Sprint 2

- `execute(toolName, params)` → `ActionResult`
- `executeAction(request)` → `ActionResult`
- Signals: `isExecuting`, `lastResult`, `lastError`
- ✅ `onBefore`, `onSuccess`, `onError`, `onComplete` lifecycle callbacks (Sprint 2)
- ✅ `retry()`, `clearError()`, `reset()` methods (Sprint 2)
- ✅ `retryCount`, `retryDelay` options (Sprint 2)

---

## Sprint 1: Form Foundation (HIGH) ✅ COMPLETED

**Priority:** HIGH
**Estimated Effort:** 3-4 days
**Dependencies:** None
**Status:** ✅ **COMPLETED** on 2026-01-20

### Implementation Summary

#### Files Created
| File | Lines | Description |
|------|-------|-------------|
| `mcp-ui-solid/src/components/FormRenderer.tsx` | 195 | Main form component with validation |
| `mcp-ui-solid/src/components/FormFieldRenderer.tsx` | 229 | Individual field rendering (all 9 types) |
| `mcp-ui-solid/src/components/FormRenderer.test.tsx` | 375→537 | 26 tests (Sprint 1) + 17 tests (Sprint 2) |

#### Files Modified
| File | Changes |
|------|---------|
| `mcp-ui-solid/src/types/index.ts` | Added `FormFieldOption`, `FormFieldType`, `FormFieldParams`, `FormComponentParams`, added `'form'` to `ComponentType` |
| `mcp-ui-solid/src/services/validation.ts` | Added `validateFieldValue()` and `validateFormData()` functions |
| `mcp-ui-solid/src/components/UIResourceRenderer.tsx` | Added `<Show when={type === 'form'}><FormRenderer /></Show>` |
| `mcp-ui-solid/src/components/index.ts` | Exported `FormRenderer`, `FormFieldRenderer` |
| `mcp-ui-solid/src/index.ts` | Exported form types |
| `mcp-ui-spec/src/schemas/index.ts` | Added `FormFieldOptionSchema`, `FormFieldTypeSchema`, `FormFieldSchema`, `FormSubmitActionSchema`, `FormComponentParamsSchema` |

#### Features Implemented
- ✅ 9 field types: `text`, `email`, `password`, `number`, `date`, `textarea`, `select`, `checkbox`, `radio`
- ✅ Field validation: required, minLength, maxLength, min, max, pattern, email format
- ✅ Form layouts: vertical (default), horizontal, inline
- ✅ Submit via MCP tool call (`submitAction.toolName`)
- ✅ Reset button support (`showReset`)
- ✅ Error display per field and form-level
- ✅ Accessibility: proper labels, aria attributes, focus management
- ✅ 26 unit tests

---

### 1.1 Extended Form Field Types (Original Spec)

#### Problem

Currently no form component exists. Users cannot create interactive forms with select, checkbox, radio, textarea fields.

#### Solution

Create a comprehensive form system with field validation, multiple field types, and submission handling.

#### Files to Create

##### `mcp-ui-solid/src/components/FormRenderer.tsx` (~300 lines)

```typescript
/**
 * FormRenderer - Main form component
 */

import { Component, createSignal, For, Show } from 'solid-js'
import { FormFieldRenderer } from './FormFieldRenderer'
import type { UIComponent, FormComponentParams, FormFieldParams } from '../types'
import { useAction } from '../hooks/useAction'
import { validateFormData } from '../services/validation'

export interface FormRendererProps {
  component: UIComponent
  onSubmit?: (data: Record<string, any>) => void
  onError?: (errors: Record<string, string>) => void
}

export const FormRenderer: Component<FormRendererProps> = (props) => {
  const params = () => props.component.params as FormComponentParams
  const [formData, setFormData] = createSignal<Record<string, any>>({})
  const [errors, setErrors] = createSignal<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  const { execute } = useAction()

  // Initialize form data with default values
  const initializeForm = () => {
    const initial: Record<string, any> = {}
    for (const field of params().fields) {
      initial[field.name] = field.defaultValue ?? getFieldDefault(field.type)
    }
    setFormData(initial)
  }

  const getFieldDefault = (type: string) => {
    switch (type) {
      case 'checkbox': return false
      case 'number': return 0
      case 'select': return ''
      default: return ''
    }
  }

  const handleFieldChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error on change
    if (errors()[name]) {
      setErrors(prev => {
        const { [name]: _, ...rest } = prev
        return rest
      })
    }
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Validate
    const validationResult = validateFormData(formData(), params().fields)
    if (!validationResult.valid) {
      setErrors(validationResult.errors)
      setIsSubmitting(false)
      props.onError?.(validationResult.errors)
      return
    }

    // Submit via tool call if specified
    if (params().submitAction?.toolName) {
      const result = await execute(
        params().submitAction.toolName,
        { ...params().submitAction.params, formData: formData() }
      )
      if (!result.success) {
        setErrors({ _form: result.error || 'Submission failed' })
      }
    }

    props.onSubmit?.(formData())
    setIsSubmitting(false)
  }

  return (
    <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <Show when={params().title}>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {params().title}
        </h3>
      </Show>

      <form onSubmit={handleSubmit} class="space-y-4">
        <For each={params().fields}>
          {(field) => (
            <FormFieldRenderer
              field={field}
              value={formData()[field.name]}
              error={errors()[field.name]}
              onChange={(value) => handleFieldChange(field.name, value)}
              disabled={isSubmitting()}
            />
          )}
        </For>

        <Show when={errors()._form}>
          <div class="text-sm text-red-600 dark:text-red-400">
            {errors()._form}
          </div>
        </Show>

        <div class="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={isSubmitting()}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting() ? 'Submitting...' : (params().submitLabel || 'Submit')}
          </button>
          <Show when={params().showReset}>
            <button
              type="button"
              onClick={initializeForm}
              class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Reset
            </button>
          </Show>
        </div>
      </form>
    </div>
  )
}
```

##### `mcp-ui-solid/src/components/FormFieldRenderer.tsx` (~250 lines)

```typescript
/**
 * FormFieldRenderer - Individual form field component
 */

import { Component, Show, For, Switch, Match } from 'solid-js'
import type { FormFieldParams } from '../types'

export interface FormFieldRendererProps {
  field: FormFieldParams
  value: any
  error?: string
  onChange: (value: any) => void
  disabled?: boolean
}

export const FormFieldRenderer: Component<FormFieldRendererProps> = (props) => {
  const baseInputClass = () => `
    w-full px-3 py-2 border rounded-md
    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    disabled:bg-gray-100 disabled:cursor-not-allowed
    ${props.error
      ? 'border-red-500 focus:ring-red-500'
      : 'border-gray-300 dark:border-gray-600'}
    dark:bg-gray-700 dark:text-white
  `

  return (
    <div class="space-y-1">
      <Show when={props.field.label}>
        <label 
          for={props.field.name} 
          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {props.field.label}
          <Show when={props.field.required}>
            <span class="text-red-500 ml-1" aria-hidden="true">*</span>
          </Show>
        </label>
      </Show>

      <Switch>
        {/* Text Input */}
        <Match when={props.field.type === 'text' || props.field.type === 'email' || props.field.type === 'password'}>
          <input
            id={props.field.name}
            type={props.field.type}
            value={props.value || ''}
            onInput={(e) => props.onChange(e.currentTarget.value)}
            placeholder={props.field.placeholder}
            disabled={props.disabled}
            required={props.field.required}
            minLength={props.field.minLength}
            maxLength={props.field.maxLength}
            pattern={props.field.pattern}
            aria-invalid={!!props.error}
            aria-describedby={props.error ? `${props.field.name}-error` : undefined}
            class={baseInputClass()}
          />
        </Match>

        {/* Number Input */}
        <Match when={props.field.type === 'number'}>
          <input
            type="number"
            value={props.value ?? ''}
            onInput={(e) => props.onChange(Number(e.currentTarget.value))}
            placeholder={props.field.placeholder}
            disabled={props.disabled}
            required={props.field.required}
            min={props.field.min}
            max={props.field.max}
            step={props.field.step}
            class={baseInputClass()}
          />
        </Match>

        {/* Date Input */}
        <Match when={props.field.type === 'date'}>
          <input
            type="date"
            value={props.value || ''}
            onInput={(e) => props.onChange(e.currentTarget.value)}
            disabled={props.disabled}
            required={props.field.required}
            min={props.field.minDate}
            max={props.field.maxDate}
            class={baseInputClass()}
          />
        </Match>

        {/* Textarea */}
        <Match when={props.field.type === 'textarea'}>
          <textarea
            value={props.value || ''}
            onInput={(e) => props.onChange(e.currentTarget.value)}
            placeholder={props.field.placeholder}
            disabled={props.disabled}
            required={props.field.required}
            rows={props.field.rows || 4}
            minLength={props.field.minLength}
            maxLength={props.field.maxLength}
            class={baseInputClass()}
          />
        </Match>

        {/* Select */}
        <Match when={props.field.type === 'select'}>
          <select
            value={props.value || ''}
            onChange={(e) => props.onChange(e.currentTarget.value)}
            disabled={props.disabled}
            required={props.field.required}
            class={baseInputClass()}
          >
            <Show when={props.field.placeholder}>
              <option value="" disabled>{props.field.placeholder}</option>
            </Show>
            <For each={props.field.options}>
              {(option) => (
                <option value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              )}
            </For>
          </select>
        </Match>

        {/* Checkbox */}
        <Match when={props.field.type === 'checkbox'}>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={props.value || false}
              onChange={(e) => props.onChange(e.currentTarget.checked)}
              disabled={props.disabled}
              class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">
              {props.field.checkboxLabel || props.field.label}
            </span>
          </label>
        </Match>

        {/* Radio Group */}
        <Match when={props.field.type === 'radio'}>
          <div class="space-y-2">
            <For each={props.field.options}>
              {(option) => (
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={props.field.name}
                    value={option.value}
                    checked={props.value === option.value}
                    onChange={() => props.onChange(option.value)}
                    disabled={props.disabled || option.disabled}
                    class="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">
                    {option.label}
                  </span>
                </label>
              )}
            </For>
          </div>
        </Match>
      </Switch>

      <Show when={props.field.helpText && !props.error}>
        <p class="text-xs text-gray-500 dark:text-gray-400">{props.field.helpText}</p>
      </Show>

      <Show when={props.error}>
        <p id={`${props.field.name}-error`} role="alert" class="text-xs text-red-600 dark:text-red-400">{props.error}</p>
      </Show>
    </div>
  )
}
```

##### `mcp-ui-solid/src/components/__tests__/FormRenderer.test.tsx` (NEW)

```typescript
import { render, screen, fireEvent } from '@solidjs/testing-library'
import { describe, it, expect, vi } from 'vitest'
import { FormRenderer } from '../FormRenderer'
import type { UIComponent } from '../../types'

describe('FormRenderer', () => {
  const mockSubmit = vi.fn()
  const component: UIComponent = {
    id: 'test-form',
    type: 'form',
    position: { colStart: 1, colSpan: 12 },
    params: {
      fields: [
        { name: 'username', type: 'text', label: 'Username', required: true }
      ],
      submitLabel: 'Save'
    }
  }

  it('renders form fields', () => {
    render(() => <FormRenderer component={component} onSubmit={mockSubmit} />)
    expect(screen.getByLabelText(/Username/)).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    render(() => <FormRenderer component={component} onSubmit={mockSubmit} />)
    
    // Submit without value
    const submitBtn = screen.getByText('Save')
    fireEvent.click(submitBtn)
    
    expect(await screen.findByText(/Username is required/)).toBeInTheDocument()
    expect(mockSubmit).not.toHaveBeenCalled()
  })
})
```

#### Files to Modify

##### `mcp-ui-solid/src/types/index.ts` - Add Form Types

Add after line 162 (after ActionComponentParams):

```typescript
/**
 * Form field option (for select, radio)
 */
export interface FormFieldOption {
  label: string
  value: string
  disabled?: boolean
}

/**
 * Form field parameters
 */
export interface FormFieldParams {
  name: string
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | 'radio'
  label?: string
  placeholder?: string
  helpText?: string
  required?: boolean
  disabled?: boolean
  defaultValue?: any

  // Text/textarea specific
  minLength?: number
  maxLength?: number
  pattern?: string

  // Number specific
  min?: number
  max?: number
  step?: number

  // Date specific
  minDate?: string
  maxDate?: string

  // Select/Radio specific
  options?: FormFieldOption[]

  // Checkbox specific
  checkboxLabel?: string

  // Textarea specific
  rows?: number

  // Conditional display
  showWhen?: ShowWhenCondition
}

/**
 * Form component parameters
 */
export interface FormComponentParams {
  title?: string
  fields: FormFieldParams[]
  submitLabel?: string
  showReset?: boolean
  submitAction?: {
    toolName: string
    params?: Record<string, any>
  }
  persistKey?: string
  layout?: 'vertical' | 'horizontal' | 'inline'
}
```

##### `mcp-ui-solid/src/types/index.ts` - Update ComponentType

Modify line 11-24:

```typescript
export type ComponentType =
  | 'chart'
  | 'table'
  | 'metric'
  | 'text'
  | 'grid'
  | 'iframe'
  | 'image'
  | 'link'
  | 'action'
  | 'footer'
  | 'carousel'
  | 'artifact'
  | 'form'        // NEW
```

##### `mcp-ui-solid/src/components/UIResourceRenderer.tsx` - Add Form Show Case

Add after line 645 (after artifact Show):

```typescript
<Show when={props.component.type === 'form'}>
  <FormRenderer component={props.component} />
</Show>
```

Add import at top:

```typescript
import { FormRenderer } from './FormRenderer'
```

##### `mcp-ui-solid/src/services/validation.ts` - Add Form Validation

Add after line 218:

```typescript
/**
 * Validate form field value against field rules
 */
export function validateFieldValue(
  value: any,
  field: FormFieldParams
): { valid: boolean; error?: string } {
  // Required check
  if (field.required) {
    if (value === undefined || value === null || value === '') {
      return { valid: false, error: `${field.label || field.name} is required` }
    }
    if (field.type === 'checkbox' && value !== true) {
      return { valid: false, error: `${field.label || field.name} must be checked` }
    }
  }

  // Type-specific validation
  switch (field.type) {
    case 'text':
    case 'textarea':
      if (field.minLength && String(value).length < field.minLength) {
        return { valid: false, error: `Minimum ${field.minLength} characters required` }
      }
      if (field.maxLength && String(value).length > field.maxLength) {
        return { valid: false, error: `Maximum ${field.maxLength} characters allowed` }
      }
      if (field.pattern && !new RegExp(field.pattern).test(value)) {
        return { valid: false, error: 'Invalid format' }
      }
      break

    case 'email':
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { valid: false, error: 'Invalid email address' }
      }
      break

    case 'number':
      if (field.min !== undefined && value < field.min) {
        return { valid: false, error: `Minimum value is ${field.min}` }
      }
      if (field.max !== undefined && value > field.max) {
        return { valid: false, error: `Maximum value is ${field.max}` }
      }
      break

    case 'date':
      if (field.minDate && value < field.minDate) {
        return { valid: false, error: `Date must be after ${field.minDate}` }
      }
      if (field.maxDate && value > field.maxDate) {
        return { valid: false, error: `Date must be before ${field.maxDate}` }
      }
      break
  }

  return { valid: true }
}

/**
 * Validate entire form data
 */
export function validateFormData(
  data: Record<string, any>,
  fields: FormFieldParams[]
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  for (const field of fields) {
    const result = validateFieldValue(data[field.name], field)
    if (!result.valid && result.error) {
      errors[field.name] = result.error
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}
```

##### `mcp-ui-spec/src/schemas/index.ts` - Add Form Schemas

Add after line 30:

```typescript
// Form field option schema
export const FormFieldOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string(),
  disabled: z.boolean().optional(),
})

// Form field type schema
export const FormFieldTypeSchema = z.enum([
  'text',
  'email',
  'password',
  'number',
  'date',
  'textarea',
  'select',
  'checkbox',
  'radio',
])

// Form field schema
export const FormFieldSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  type: FormFieldTypeSchema,
  label: z.string().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  required: z.boolean().optional(),
  disabled: z.boolean().optional(),
  defaultValue: z.any().optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  pattern: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  minDate: z.string().optional(),
  maxDate: z.string().optional(),
  options: z.array(FormFieldOptionSchema).optional(),
  checkboxLabel: z.string().optional(),
  rows: z.number().int().min(1).max(20).optional(),
})

// Form submit action schema
export const FormSubmitActionSchema = z.object({
  toolName: z.string().min(1),
  params: z.record(z.unknown()).optional(),
})

// Update ComponentTypeSchema to include 'form'
export const ComponentTypeSchema = z.enum([
  'chart',
  'table',
  'metric',
  'text',
  'composite',
  'grid',
  'iframe',
  'image',
  'link',
  'action',
  'footer',
  'carousel',
  'artifact',
  'form',  // NEW
])
```

##### `mcp-ui-solid/src/components/index.ts` - Export Components

Add to exports:

```typescript
export * from './FormRenderer'
export * from './FormFieldRenderer'
```

#### Example Usage

```typescript
const formComponent: UIComponent = {
  id: 'contact-form',
  type: 'form',
  position: { colStart: 1, colSpan: 6 },
  params: {
    title: 'Contact Us',
    fields: [
      {
        name: 'name',
        type: 'text',
        label: 'Full Name',
        required: true,
        placeholder: 'John Doe',
      },
      {
        name: 'email',
        type: 'email',
        label: 'Email Address',
        required: true,
      },
      {
        name: 'subject',
        type: 'select',
        label: 'Subject',
        options: [
          { label: 'General Inquiry', value: 'general' },
          { label: 'Support', value: 'support' },
          { label: 'Sales', value: 'sales' },
        ],
      },
      {
        name: 'message',
        type: 'textarea',
        label: 'Message',
        required: true,
        rows: 5,
        minLength: 20,
      },
      {
        name: 'newsletter',
        type: 'checkbox',
        checkboxLabel: 'Subscribe to newsletter',
      },
    ],
    submitLabel: 'Send Message',
    showReset: true,
    submitAction: {
      toolName: 'contact.submit',
      params: { source: 'website' },
    },
  },
}
```

#### Verification Checklist

- [ ] FormRenderer creates form with all field types
- [ ] Field validation works on submit
- [ ] Real-time error clearing on field change
- [ ] Submit action triggers tool call
- [ ] Reset button clears form to defaults
- [ ] Disabled state works during submission
- [ ] Zod schema validates form component params
- [ ] TypeScript types are exported correctly
- [ ] Component renders in UIResourceRenderer
- [ ] Tests pass for all field types

---

### 1.2 Shared Validation Schema

#### Problem

Form validation is duplicated between frontend and backend, leading to inconsistencies.

#### Solution

Export Zod schemas from mcp-ui-spec for reuse in both frontend validation and backend API validation.

#### Files to Modify

##### `mcp-ui-spec/src/index.ts` - Export Validation Helpers

```typescript
// Re-export all schemas
export * from './schemas'

// Validation helpers
export {
  FormFieldSchema,
  FormFieldTypeSchema,
  FormFieldOptionSchema,
  FormSubmitActionSchema,
} from './schemas'

// Validation function wrapper
export function createFormValidator(schema: z.ZodSchema) {
  return (data: unknown) => {
    const result = schema.safeParse(data)
    if (result.success) {
      return { valid: true, data: result.data }
    }
    return {
      valid: false,
      errors: result.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      })),
    }
  }
}
```

#### Verification Checklist

- [ ] Schemas exported from mcp-ui-spec
- [ ] Frontend uses shared schemas
- [ ] Backend can import same schemas
- [ ] Validation results are consistent

---

## Sprint 2: Form Advanced (HIGH) ✅ COMPLETED

**Priority:** HIGH
**Estimated Effort:** 2-3 days
**Dependencies:** Sprint 1 (Form Foundation)
**Status:** ✅ **COMPLETED** on 2026-01-20

### Implementation Summary

#### Files Created
| File | Lines | Description |
|------|-------|-------------|
| `mcp-ui-solid/src/hooks/useConditionalField.ts` | 80 | Hook for evaluating showWhen conditions |

#### Files Modified
| File | Changes |
|------|---------|
| `mcp-ui-solid/src/types/index.ts` | Added `ShowWhenOperator` (13 operators), `ShowWhenCondition`, `showWhen` prop to `FormFieldParams`, `ActionRequestBase`, `ActionResultBase`, `ActionLifecycleCallbacks` |
| `mcp-ui-solid/src/hooks/useAction.ts` | Added lifecycle callbacks (`onBefore`, `onSuccess`, `onError`, `onComplete`), `retry()`, `clearError()`, `reset()` methods, `UseActionOptions` interface |
| `mcp-ui-solid/src/hooks/index.ts` | Exported `useConditionalField`, `evaluateCondition`, `UseActionOptions`, `UseToolActionReturn` |
| `mcp-ui-solid/src/components/FormFieldRenderer.tsx` | Added `formData` prop, integrated `useConditionalField` for visibility |
| `mcp-ui-solid/src/components/FormRenderer.tsx` | Added `getVisibleFields()`, pass `formData` to fields, validation excludes hidden fields |
| `mcp-ui-solid/src/components/FormRenderer.test.tsx` | Added 17 tests for conditional fields and operators |
| `mcp-ui-solid/src/index.ts` | Exported new hooks and types |
| `mcp-ui-spec/src/schemas/index.ts` | Added `ShowWhenOperatorSchema`, `ShowWhenConditionSchema`, updated `FormFieldSchema` with `showWhen` |

#### Features Implemented

**2.1 Conditional Fields (showWhen)**
- ✅ 13 operators: `equals`, `notEquals`, `in`, `notIn`, `contains`, `startsWith`, `endsWith`, `greaterThan`, `lessThan`, `isEmpty`, `isNotEmpty`, `isTrue`, `isFalse`
- ✅ `useConditionalField` hook with `evaluateCondition()` function
- ✅ Hidden fields excluded from validation
- ✅ Hidden fields excluded from form submission data
- ✅ Reactive visibility (field shows/hides immediately on change)

**2.2 Async Action Handlers**
- ✅ `onBefore` callback (can cancel action by returning `false`)
- ✅ `onSuccess` callback (called after successful action)
- ✅ `onError` callback (called after failed action)
- ✅ `onComplete` callback (called after any action)
- ✅ `retry()` method with configurable `retryCount` and `retryDelay`
- ✅ `clearError()` method
- ✅ `reset()` method
- ✅ `UseActionOptions` interface for configuration
- ✅ `useToolAction` also supports lifecycle options

#### Tests Added
- 13 tests for `evaluateCondition` (all operators)
- 4 tests for conditional form field behavior

---

### 2.1 Conditional Fields (showWhen) (Original Spec)

#### Problem

Forms cannot show/hide fields based on other field values (e.g., show "Other" text input when "Other" is selected).

#### Solution

Add `showWhen` property with operators for conditional field visibility.

#### Files to Create

##### `mcp-ui-solid/src/hooks/useConditionalField.ts` (~80 lines)

```typescript
/**
 * useConditionalField - Evaluates showWhen conditions
 */

import { Accessor, createMemo } from 'solid-js'
import type { ShowWhenCondition } from '../types'

export interface UseConditionalFieldOptions {
  condition?: ShowWhenCondition
  formData: Accessor<Record<string, any>>
}

/**
 * Evaluates a showWhen condition against form data
 */
export function evaluateCondition(
  condition: ShowWhenCondition,
  formData: Record<string, any>
): boolean {
  const fieldValue = formData[condition.field]

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value

    case 'notEquals':
      return fieldValue !== condition.value

    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue)

    case 'notIn':
      return Array.isArray(condition.value) && !condition.value.includes(fieldValue)

    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(condition.value as string)

    case 'startsWith':
      return typeof fieldValue === 'string' && fieldValue.startsWith(condition.value as string)

    case 'endsWith':
      return typeof fieldValue === 'string' && fieldValue.endsWith(condition.value as string)

    case 'greaterThan':
      return typeof fieldValue === 'number' && fieldValue > (condition.value as number)

    case 'lessThan':
      return typeof fieldValue === 'number' && fieldValue < (condition.value as number)

    case 'isEmpty':
      return fieldValue === undefined || fieldValue === null || fieldValue === ''

    case 'isNotEmpty':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== ''

    case 'isTrue':
      return fieldValue === true

    case 'isFalse':
      return fieldValue === false

    default:
      return true
  }
}

/**
 * Hook for conditional field visibility
 */
export function useConditionalField(options: UseConditionalFieldOptions) {
  const isVisible = createMemo(() => {
    if (!options.condition) return true
    return evaluateCondition(options.condition, options.formData())
  })

  return { isVisible }
}
```

#### Files to Modify

##### `mcp-ui-solid/src/types/index.ts` - Add ShowWhenCondition

Add after FormComponentParams:

```typescript
/**
 * Operators for conditional field display
 */
export type ShowWhenOperator =
  | 'equals'
  | 'notEquals'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'isTrue'
  | 'isFalse'

/**
 * Condition for conditional field visibility
 */
export interface ShowWhenCondition {
  field: string
  operator: ShowWhenOperator
  value?: any
}
```

##### `mcp-ui-solid/src/components/FormFieldRenderer.tsx` - Integrate showWhen

Update to wrap field in Show:

```typescript
import { useConditionalField } from '../hooks/useConditionalField'

// In component:
const { isVisible } = useConditionalField({
  condition: props.field.showWhen,
  formData: props.formData, // Need to pass formData accessor
})

return (
  <Show when={isVisible()}>
    {/* existing field rendering */}
  </Show>
)
```

##### `mcp-ui-spec/src/schemas/index.ts` - Add ShowWhen Schema

```typescript
export const ShowWhenOperatorSchema = z.enum([
  'equals',
  'notEquals',
  'in',
  'notIn',
  'contains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'lessThan',
  'isEmpty',
  'isNotEmpty',
  'isTrue',
  'isFalse',
])

export const ShowWhenConditionSchema = z.object({
  field: z.string().min(1),
  operator: ShowWhenOperatorSchema,
  value: z.any().optional(),
})

// Update FormFieldSchema to include showWhen
export const FormFieldSchema = z.object({
  // ... existing fields
  showWhen: ShowWhenConditionSchema.optional(),
})
```

#### Example Usage

```typescript
const formWithConditional: FormComponentParams = {
  title: 'Survey',
  fields: [
    {
      name: 'satisfaction',
      type: 'radio',
      label: 'How satisfied are you?',
      options: [
        { label: 'Very Satisfied', value: 'very' },
        { label: 'Satisfied', value: 'satisfied' },
        { label: 'Neutral', value: 'neutral' },
        { label: 'Dissatisfied', value: 'dissatisfied' },
      ],
    },
    {
      name: 'reason',
      type: 'textarea',
      label: 'What could we improve?',
      // Only show when dissatisfied
      showWhen: {
        field: 'satisfaction',
        operator: 'equals',
        value: 'dissatisfied',
      },
    },
    {
      name: 'contactMe',
      type: 'checkbox',
      checkboxLabel: 'I would like to be contacted',
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email Address',
      // Only show when checkbox is checked
      showWhen: {
        field: 'contactMe',
        operator: 'isTrue',
      },
    },
  ],
}
```

#### Verification Checklist

- [ ] Field hides when condition is false
- [ ] Field shows when condition becomes true
- [ ] All operators work correctly
- [ ] Hidden fields excluded from validation
- [ ] Hidden fields excluded from submission
- [ ] Nested conditions work (field depends on another conditional field)
- [ ] No re-render loops
- [ ] Schema validates showWhen property

---

### 2.2 Async Action Handlers

#### Problem

No lifecycle callbacks for actions. Cannot show loading state, success message, or handle errors gracefully.

#### Solution

Add `onBefore`, `onSuccess`, `onError` callbacks to action system, plus retry capability.

#### Files to Modify

##### `mcp-ui-solid/src/types/index.ts` - Add ActionLifecycleCallbacks

```typescript
/**
 * Lifecycle callbacks for action execution
 */
export interface ActionLifecycleCallbacks {
  /**
   * Called before action executes (can cancel by returning false)
   */
  onBefore?: (request: ActionRequest) => boolean | Promise<boolean>

  /**
   * Called after successful action
   */
  onSuccess?: (result: ActionResult) => void

  /**
   * Called after failed action
   */
  onError?: (error: string, request: ActionRequest) => void

  /**
   * Called after action completes (success or failure)
   */
  onComplete?: (result: ActionResult) => void
}
```

##### `mcp-ui-solid/src/hooks/useAction.ts` - Add Lifecycle Support

Update hook:

```typescript
export interface UseActionOptions extends ActionLifecycleCallbacks {
  /**
   * Auto-retry on failure
   */
  retryCount?: number

  /**
   * Retry delay in ms
   */
  retryDelay?: number
}

export interface UseActionReturn {
  execute: (toolName: string, params?: Record<string, any>) => Promise<ActionResult>
  executeAction: (request: ActionRequest) => Promise<ActionResult>
  isExecuting: Accessor<boolean>
  lastResult: Accessor<ActionResult | undefined>
  lastError: Accessor<string | undefined>

  // NEW
  retry: () => Promise<ActionResult | undefined>
  clearError: () => void
  reset: () => void
}

export function useAction(options: UseActionOptions = {}): UseActionReturn {
  const context = useMCPActionSafe()
  const [lastError, setLastError] = createSignal<string>()
  const [lastRequest, setLastRequest] = createSignal<ActionRequest>()
  const [retryAttempt, setRetryAttempt] = createSignal(0)

  const executeWithLifecycle = async (request: ActionRequest): Promise<ActionResult> => {
    setLastError(undefined)
    setLastRequest(request)

    // onBefore callback (can cancel)
    if (options.onBefore) {
      const shouldProceed = await options.onBefore(request)
      if (!shouldProceed) {
        return {
          success: false,
          error: 'Action cancelled by onBefore callback',
          timestamp: new Date().toISOString(),
          toolName: request.toolName,
        }
      }
    }

    const result = await context.executeAction(request)

    if (result.success) {
      options.onSuccess?.(result)
    } else {
      setLastError(result.error)
      options.onError?.(result.error || 'Unknown error', request)
    }

    options.onComplete?.(result)
    return result
  }

  const execute = async (toolName: string, params?: Record<string, any>): Promise<ActionResult> => {
    return executeWithLifecycle({ toolName, params })
  }

  const retry = async (): Promise<ActionResult | undefined> => {
    const request = lastRequest()
    if (!request) return undefined

    const maxRetries = options.retryCount || 3
    const attempt = retryAttempt() + 1

    if (attempt > maxRetries) {
      setLastError(`Max retries (${maxRetries}) exceeded`)
      return undefined
    }

    setRetryAttempt(attempt)

    if (options.retryDelay) {
      await new Promise(r => setTimeout(r, options.retryDelay))
    }

    return executeWithLifecycle(request)
  }

  const clearError = () => setLastError(undefined)

  const reset = () => {
    setLastError(undefined)
    setLastRequest(undefined)
    setRetryAttempt(0)
  }

  return {
    execute,
    executeAction: executeWithLifecycle,
    isExecuting: context.isExecuting,
    lastResult: context.lastResult,
    lastError,
    retry,
    clearError,
    reset,
  }
}
```

##### `mcp-ui-solid/src/context/MCPActionContext.tsx` - Add Provider Options

Add to MCPActionProviderProps:

```typescript
export interface MCPActionProviderProps {
  // ... existing props

  /**
   * Global lifecycle callbacks for all actions
   */
  lifecycle?: ActionLifecycleCallbacks

  /**
   * Default retry configuration
   */
  defaultRetry?: {
    count: number
    delay: number
  }
}
```

#### Example Usage

```typescript
function MyActionButton() {
  const { execute, isExecuting, lastError, retry, clearError } = useAction({
    onBefore: async (req) => {
      console.log('About to execute:', req.toolName)
      return true // proceed
    },
    onSuccess: (result) => {
      toast.success(`Action completed! Data: ${JSON.stringify(result.data)}`)
    },
    onError: (error) => {
      toast.error(`Action failed: ${error}`)
    },
    retryCount: 3,
    retryDelay: 1000,
  })

  return (
    <div>
      <button onClick={() => execute('search.hub', { query: 'test' })} disabled={isExecuting()}>
        {isExecuting() ? 'Loading...' : 'Search'}
      </button>

      <Show when={lastError()}>
        <div class="text-red-500">
          Error: {lastError()}
          <button onClick={retry}>Retry</button>
          <button onClick={clearError}>Dismiss</button>
        </div>
      </Show>
    </div>
  )
}
```

#### Verification Checklist

- [ ] onBefore can cancel action
- [ ] onSuccess called on success
- [ ] onError called on failure
- [ ] onComplete called always
- [ ] retry() retries last action
- [ ] retry respects retryCount limit
- [ ] retry respects retryDelay
- [ ] clearError() clears error state
- [ ] reset() resets all state
- [ ] Provider-level lifecycle works

---

## Sprint 3: UX Improvements (MEDIUM) ✅ COMPLETED

**Priority:** MEDIUM
**Estimated Effort:** 2-3 days
**Dependencies:** Sprint 2 (for action lifecycle in modal close)
**Status:** ✅ **COMPLETED** on 2026-01-20

### Implementation Summary

#### Files Created
| File | Lines | Description |
|------|-------|-------------|
| `mcp-ui-solid/src/components/ModalRenderer.tsx` | 233 | Modal/dialog overlay component with Portal |
| `mcp-ui-solid/src/components/ActionGroupRenderer.tsx` | 176 | Action grouping component with layout options |
| `mcp-ui-solid/src/hooks/useModal.ts` | 155 | useModal and useConfirmModal hooks |
| `mcp-ui-solid/src/components/ModalRenderer.test.tsx` | 254 | 19 tests for Modal |
| `mcp-ui-solid/src/components/ActionGroupRenderer.test.tsx` | 238 | 21 tests for ActionGroup |

#### Files Modified
| File | Changes |
|------|---------|
| `mcp-ui-solid/src/types/index.ts` | Added `ModalSize`, `ModalComponentParams`, `ActionGroupLayout`, `ActionGroupGap`, `ActionGroupParams`, added `'modal'` and `'action-group'` to `ComponentType` |
| `mcp-ui-solid/src/components/UIResourceRenderer.tsx` | Added `<Show when={type === 'modal'}>` and `<Show when={type === 'action-group'}>` cases |
| `mcp-ui-solid/src/components/index.ts` | Exported `ModalRenderer`, `ActionGroupRenderer` |
| `mcp-ui-solid/src/hooks/index.ts` | Exported `useModal`, `useConfirmModal` |
| `mcp-ui-solid/src/index.ts` | Exported modal and action group types and hooks |
| `mcp-ui-spec/src/schemas/index.ts` | Added `ModalSizeSchema`, `ModalComponentParamsSchema`, `ActionGroupLayoutSchema`, `ActionGroupGapSchema`, `ActionParamsSchema`, `ActionGroupParamsSchema` |

#### Features Implemented
- ✅ Modal component with Portal rendering
- ✅ Modal sizes: `sm`, `md`, `lg`, `xl`, `full`
- ✅ Close on Escape key (configurable)
- ✅ Close on backdrop click (configurable)
- ✅ Body scroll lock when modal is open
- ✅ Focus trap (auto-focus modal on open)
- ✅ CSS animations (fade-in, scale-in)
- ✅ useModal hook for simple open/close/toggle state
- ✅ useConfirmModal hook for promise-based confirmation dialogs
- ✅ ActionGroup component with multiple actions
- ✅ Action variants: `primary`, `secondary`, `outline`, `ghost`, `danger`
- ✅ Action sizes: `sm`, `md`, `lg`
- ✅ Layout options: `horizontal`, `vertical`, `space-between`, `end`, `center`
- ✅ Gap options: `none`, `sm`, `md`, `lg`
- ✅ Tool-call action support
- ✅ Link action support
- ✅ Icon support in actions
- ✅ 40 unit tests (19 modal + 21 action group)

---

### 3.1 Modal/Dialog Wrapper

#### Problem

No way to display content in an overlay/dialog. Forms and details must always be inline.

#### Solution

Create a modal component using SolidJS Portal for overlay rendering.

#### Files to Create

##### `mcp-ui-solid/src/components/ModalRenderer.tsx` (~200 lines)

```typescript
/**
 * ModalRenderer - Dialog overlay component
 */

import { Component, Show, createSignal, createEffect, onCleanup, JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { UIComponent, ModalComponentParams } from '../types'
import { ComponentRenderer } from './UIResourceRenderer'

export interface ModalRendererProps {
  component?: UIComponent
  params?: ModalComponentParams
  isOpen?: boolean
  onClose?: () => void
  children?: JSX.Element
}

export const ModalRenderer: Component<ModalRendererProps> = (props) => {
  const [isVisible, setIsVisible] = createSignal(false)

  const params = () => props.params || (props.component?.params as ModalComponentParams)

  // Sync with external isOpen prop
  createEffect(() => {
    if (props.isOpen !== undefined) {
      setIsVisible(props.isOpen)
    }
  })

  // Handle escape key
  createEffect(() => {
    if (!isVisible()) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && params()?.closeOnEscape !== false) {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    onCleanup(() => document.removeEventListener('keydown', handleEscape))
  })

  // Prevent body scroll when modal is open
  createEffect(() => {
    if (isVisible()) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    onCleanup(() => {
      document.body.style.overflow = ''
    })
  })

  const handleClose = () => {
    setIsVisible(false)
    props.onClose?.()
  }

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget && params()?.closeOnBackdrop !== false) {
      handleClose()
    }
  }

  const sizeClass = () => {
    switch (params()?.size) {
      case 'sm': return 'max-w-md'
      case 'lg': return 'max-w-4xl'
      case 'xl': return 'max-w-6xl'
      case 'full': return 'max-w-full mx-4'
      default: return 'max-w-2xl'
    }
  }

  return (
    <Show when={isVisible()}>
      <Portal>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby={params()?.title ? 'modal-title' : undefined}
        >
          <div
            class={`relative w-full ${sizeClass()} bg-white dark:bg-gray-800 rounded-lg shadow-xl animate-scale-in`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <Show when={params()?.title || params()?.showClose !== false}>
              <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <Show when={params()?.title}>
                  <h2 id="modal-title" class="text-lg font-semibold text-gray-900 dark:text-white">
                    {params()!.title}
                  </h2>
                </Show>
                <Show when={params()?.showClose !== false}>
                  <button
                    onClick={handleClose}
                    class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    aria-label="Close modal"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Show>
              </div>
            </Show>

            {/* Content */}
            <div class={`p-4 ${params()?.maxHeight ? `max-h-[${params()!.maxHeight}] overflow-y-auto` : ''}`}>
              <Show when={props.children} fallback={
                <Show when={params()?.content}>
                  <ComponentRenderer component={params()!.content!} />
                </Show>
              }>
                {props.children}
              </Show>
            </div>

            {/* Footer */}
            <Show when={params()?.footer}>
              <div class="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                <ComponentRenderer component={params()!.footer!} />
              </div>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  )
}

// CSS animations (add to global CSS or use inline)
const modalStyles = `
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scale-in {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-fade-in { animation: fade-in 0.15s ease-out; }
  .animate-scale-in { animation: scale-in 0.15s ease-out; }
`
```

##### `mcp-ui-solid/src/hooks/useModal.ts` (~50 lines)

```typescript
/**
 * useModal - Hook for modal state management
 */

import { createSignal, Accessor } from 'solid-js'

export interface UseModalReturn {
  isOpen: Accessor<boolean>
  open: () => void
  close: () => void
  toggle: () => void
}

export function useModal(initialOpen = false): UseModalReturn {
  const [isOpen, setIsOpen] = createSignal(initialOpen)

  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)
  const toggle = () => setIsOpen(prev => !prev)

  return { isOpen, open, close, toggle }
}

/**
 * useConfirmModal - Hook for confirmation dialogs
 */
export function useConfirmModal() {
  const [isOpen, setIsOpen] = createSignal(false)
  const [resolveRef, setResolveRef] = createSignal<((value: boolean) => void) | null>(null)

  const confirm = (): Promise<boolean> => {
    return new Promise((resolve) => {
      setResolveRef(() => resolve)
      setIsOpen(true)
    })
  }

  const handleConfirm = () => {
    resolveRef()?.(true)
    setIsOpen(false)
  }

  const handleCancel = () => {
    resolveRef()?.(false)
    setIsOpen(false)
  }

  return {
    isOpen,
    confirm,
    handleConfirm,
    handleCancel,
  }
}
```

#### Files to Modify

##### `mcp-ui-solid/src/types/index.ts` - Add ModalComponentParams

```typescript
/**
 * Modal component parameters
 */
export interface ModalComponentParams {
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showClose?: boolean
  closeOnEscape?: boolean
  closeOnBackdrop?: boolean
  maxHeight?: string
  content?: UIComponent
  footer?: UIComponent
  trigger?: UIComponent
}
```

Update ComponentType:

```typescript
export type ComponentType =
  // ... existing
  | 'modal'  // NEW
```

##### `mcp-ui-solid/src/components/UIResourceRenderer.tsx` - Add Modal Show

Add after form Show case:

```typescript
<Show when={props.component.type === 'modal'}>
  <ModalRenderer component={props.component} />
</Show>
```

#### Example Usage

```typescript
// Declarative modal
const modalComponent: UIComponent = {
  id: 'details-modal',
  type: 'modal',
  position: { colStart: 1, colSpan: 12 },
  params: {
    title: 'User Details',
    size: 'lg',
    closeOnEscape: true,
    content: {
      id: 'user-form',
      type: 'form',
      position: { colStart: 1, colSpan: 12 },
      params: { /* form params */ },
    },
    footer: {
      id: 'modal-actions',
      type: 'action-group',
      position: { colStart: 1, colSpan: 12 },
      params: {
        actions: [
          { label: 'Cancel', variant: 'outline' },
          { label: 'Save', variant: 'primary', action: 'submit' },
        ],
      },
    },
  },
}

// Programmatic usage with hook
function MyComponent() {
  const { isOpen, open, close } = useModal()

  return (
    <>
      <button onClick={open}>Open Modal</button>
      <ModalRenderer
        isOpen={isOpen()}
        onClose={close}
        params={{ title: 'My Modal', size: 'md' }}
      >
        <p>Modal content here</p>
      </ModalRenderer>
    </>
  )
}
```

#### Verification Checklist

- [ ] Modal opens with animation
- [ ] Modal closes on X button
- [ ] Modal closes on Escape key
- [ ] Modal closes on backdrop click
- [ ] Body scroll locked when open
- [ ] Focus trapped inside modal
- [ ] All sizes render correctly
- [ ] Nested components render
- [ ] Footer renders
- [ ] useModal hook works
- [ ] useConfirmModal returns promise
- [ ] Portal renders in document.body
- [ ] Dark mode styles work

---

### 3.2 Action Grouping

#### Problem

Actions are isolated buttons. No way to group related actions with consistent layout.

#### Solution

Create action-group component that renders multiple actions with configurable layout.

#### Files to Create

##### `mcp-ui-solid/src/components/ActionGroupRenderer.tsx` (~100 lines)

```typescript
/**
 * ActionGroupRenderer - Group of actions with layout options
 */

import { Component, For, Show } from 'solid-js'
import type { UIComponent, ActionGroupParams, ActionComponentParams } from '../types'
import { ActionRenderer } from './UIResourceRenderer' // or separate file

export interface ActionGroupRendererProps {
  component?: UIComponent
  params?: ActionGroupParams
}

export const ActionGroupRenderer: Component<ActionGroupRendererProps> = (props) => {
  const params = () => props.params || (props.component?.params as ActionGroupParams)

  const layoutClass = () => {
    switch (params()?.layout) {
      case 'vertical':
        return 'flex flex-col'
      case 'space-between':
        return 'flex justify-between'
      case 'end':
        return 'flex justify-end'
      case 'center':
        return 'flex justify-center'
      default: // horizontal
        return 'flex'
    }
  }

  const gapClass = () => {
    switch (params()?.gap) {
      case 'none': return 'gap-0'
      case 'sm': return 'gap-1'
      case 'lg': return 'gap-4'
      default: return 'gap-2'
    }
  }

  return (
    <div
      class={`${layoutClass()} ${gapClass()} ${params()?.fullWidth ? 'w-full' : ''}`}
      role="group"
      aria-label={params()?.label || 'Action group'}
    >
      <For each={params()?.actions}>
        {(action, index) => {
          // Create a pseudo-component for ActionRenderer
          const actionComponent: UIComponent = {
            id: `action-${index()}`,
            type: 'action',
            position: { colStart: 1, colSpan: 1 },
            params: action,
          }
          return <ActionRenderer component={actionComponent} />
        }}
      </For>
    </div>
  )
}
```

#### Files to Modify

##### `mcp-ui-solid/src/types/index.ts` - Add ActionGroupParams

```typescript
/**
 * Action group layout options
 */
export type ActionGroupLayout = 'horizontal' | 'vertical' | 'space-between' | 'end' | 'center'

/**
 * Action group parameters
 */
export interface ActionGroupParams {
  actions: ActionComponentParams[]
  layout?: ActionGroupLayout
  gap?: 'none' | 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  label?: string
}
```

Update ComponentType to include 'action-group'.

#### Example Usage

```typescript
const actionGroup: UIComponent = {
  id: 'form-actions',
  type: 'action-group',
  position: { colStart: 1, colSpan: 12 },
  params: {
    layout: 'end',
    gap: 'md',
    actions: [
      {
        label: 'Cancel',
        type: 'button',
        action: 'link',
        variant: 'outline',
      },
      {
        label: 'Save Draft',
        type: 'button',
        action: 'tool-call',
        toolName: 'document.saveDraft',
        variant: 'secondary',
      },
      {
        label: 'Publish',
        type: 'button',
        action: 'tool-call',
        toolName: 'document.publish',
        variant: 'primary',
      },
    ],
  },
}
```

#### Verification Checklist

- [ ] Horizontal layout works
- [ ] Vertical layout works
- [ ] space-between layout works
- [ ] end/center layouts work
- [ ] Gap options work
- [ ] fullWidth option works
- [ ] Actions execute correctly
- [ ] ARIA group role set
- [ ] Schema validates params

---

## Sprint 4: State & Charts (MEDIUM) ✅ COMPLETED

**Priority:** MEDIUM
**Estimated Effort:** 2-3 days
**Dependencies:** Sprint 1 (Form Foundation)
**Status:** ✅ **COMPLETED** on 2026-01-20

### Implementation Summary

#### Files Created
| File | Lines | Description |
|------|-------|-------------|
| `mcp-ui-solid/src/hooks/useFormPersistence.ts` | 218 | Hook for localStorage persistence with debounce and expiry |
| `mcp-ui-solid/src/hooks/useFormPersistence.test.ts` | 240 | 10 tests for persistence |
| `mcp-ui-solid/src/components/ChartJSRenderer.tsx` | 175 | Native Chart.js renderer with lazy loading |

#### Files Modified
| File | Changes |
|------|---------|
| `mcp-ui-solid/src/types/index.ts` | Added `excludeFromPersistence`, `persistExpiresIn` to `FormComponentParams`, added `renderer` to `ChartComponentParams` |
| `mcp-ui-solid/src/components/FormRenderer.tsx` | Integrated `useFormPersistence`, clear on submit/reset |
| `mcp-ui-solid/src/components/UIResourceRenderer.tsx` | Smart chart selection (native vs iframe fallback) |
| `mcp-ui-solid/src/hooks/index.ts` | Exported `useFormPersistence` |
| `mcp-ui-solid/src/components/index.ts` | Exported `ChartJSRenderer`, `isChartJSAvailable` |
| `mcp-ui-solid/src/index.ts` | Exported new hook and types |
| `mcp-ui-solid/vite.config.ts` | Added `chart.js` to externals |
| `mcp-ui-solid/package.json` | Added `chart.js` as optional peer dependency |
| `mcp-ui-spec/src/schemas/index.ts` | Added `excludeFromPersistence`, `persistExpiresIn` to form schema |

#### Features Implemented
- ✅ Form state persistence to localStorage via `persistKey`
- ✅ Debounced saves (configurable, default 500ms)
- ✅ Expiry time support (`persistExpiresIn`)
- ✅ Exclude sensitive fields (`excludeFromPersistence`)
- ✅ SSR-safe (no window access on server)
- ✅ Clear on submit and reset
- ✅ `hasPersisted()` and `getPersistedTimestamp()` helpers
- ✅ Native Chart.js renderer with lazy loading
- ✅ Smart chart selection (`renderer: 'native' | 'iframe' | 'auto'`)
- ✅ Fallback to Quickchart.io when Chart.js not available
- ✅ Chart.js as optional peer dependency
- ✅ 10 unit tests for persistence

---

### 4.1 Form State Persistence

#### Problem

Form data is lost on page navigation or refresh. Users must re-enter data.

#### Solution

Add `persistKey` prop to forms that saves state to localStorage.

#### Files to Create

##### `mcp-ui-solid/src/hooks/useFormPersistence.ts` (~60 lines)

```typescript
/**
 * useFormPersistence - Save/restore form data to localStorage
 */

import { Accessor, createEffect, onMount } from 'solid-js'

const STORAGE_PREFIX = 'mcp-ui-form:'
const DEFAULT_DEBOUNCE = 500

export interface UseFormPersistenceOptions {
  /**
   * Unique key for storage
   */
  persistKey: string

  /**
   * Form data accessor
   */
  formData: Accessor<Record<string, any>>

  /**
   * Setter for form data
   */
  setFormData: (data: Record<string, any>) => void

  /**
   * Debounce delay in ms
   */
  debounce?: number

  /**
   * Fields to exclude from persistence
   */
  excludeFields?: string[]

  /**
   * Expiry time in ms (default: none)
   */
  expiresIn?: number
}

interface StoredData {
  data: Record<string, any>
  timestamp: number
}

export function useFormPersistence(options: UseFormPersistenceOptions) {
  const storageKey = `${STORAGE_PREFIX}${options.persistKey}`
  let debounceTimer: ReturnType<typeof setTimeout>

  // Restore on mount
  onMount(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed: StoredData = JSON.parse(stored)

        // Check expiry
        if (options.expiresIn) {
          const elapsed = Date.now() - parsed.timestamp
          if (elapsed > options.expiresIn) {
            localStorage.removeItem(storageKey)
            return
          }
        }

        options.setFormData(parsed.data)
      }
    } catch (e) {
      console.warn('Failed to restore form data:', e)
    }
  })

  // Save on change (debounced)
  createEffect(() => {
    const data = options.formData()

    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      try {
        // Filter excluded fields
        const toStore = { ...data }
        for (const field of options.excludeFields || []) {
          delete toStore[field]
        }

        const stored: StoredData = {
          data: toStore,
          timestamp: Date.now(),
        }

        localStorage.setItem(storageKey, JSON.stringify(stored))
      } catch (e) {
        console.warn('Failed to persist form data:', e)
      }
    }, options.debounce ?? DEFAULT_DEBOUNCE)
  })

  // Clear persisted data
  const clearPersisted = () => {
    localStorage.removeItem(storageKey)
  }

  return { clearPersisted }
}
```

#### Files to Modify

##### `mcp-ui-solid/src/components/FormRenderer.tsx` - Integrate Persistence

```typescript
import { useFormPersistence } from '../hooks/useFormPersistence'

// In FormRenderer:
createEffect(() => {
  if (params().persistKey) {
    useFormPersistence({
      persistKey: params().persistKey!,
      formData,
      setFormData,
      excludeFields: params().excludeFromPersistence,
    })
  }
})
```

##### `mcp-ui-solid/src/types/index.ts` - Add Persistence Options

Update FormComponentParams:

```typescript
export interface FormComponentParams {
  // ... existing
  persistKey?: string
  excludeFromPersistence?: string[]
  persistExpiresIn?: number
}
```

#### Example Usage

```typescript
const persistedForm: FormComponentParams = {
  title: 'Application Form',
  persistKey: 'user-application-draft',
  excludeFromPersistence: ['password', 'creditCard'],
  persistExpiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
  fields: [
    { name: 'name', type: 'text', label: 'Full Name' },
    { name: 'email', type: 'email', label: 'Email' },
    { name: 'password', type: 'password', label: 'Password' },
  ],
}
```

#### Verification Checklist

- [x] Form data saved to localStorage
- [x] Form data restored on mount
- [x] Debouncing prevents excessive writes
- [x] excludeFields works
- [x] expiresIn expires old data
- [x] clearPersisted clears storage
- [x] Works with SSR (no window access on server)
- [x] Handles JSON parse errors gracefully

---

### 4.2 Native Chart.js Integration

#### Problem

Charts rely on Quickchart.io external service. Limited customization, network dependency.

#### Solution

Add optional native Chart.js rendering with iframe fallback.

#### Files to Create

##### `mcp-ui-solid/src/components/ChartJSRenderer.tsx` (~200 lines)

```typescript
/**
 * ChartJSRenderer - Native Chart.js rendering
 * Requires chart.js peer dependency
 */

import { Component, createEffect, onCleanup, createSignal } from 'solid-js'
import type { UIComponent, ChartComponentParams } from '../types'

// Lazy load Chart.js
let Chart: any = null
const loadChartJS = async () => {
  if (!Chart) {
    const module = await import('chart.js/auto')
    Chart = module.default
  }
  return Chart
}

export interface ChartJSRendererProps {
  component: UIComponent
  onError?: (error: Error) => void
}

export const ChartJSRenderer: Component<ChartJSRendererProps> = (props) => {
  const [isLoading, setIsLoading] = createSignal(true)
  const [error, setError] = createSignal<string>()
  let canvasRef: HTMLCanvasElement | undefined
  let chartInstance: any

  const params = () => props.component.params as ChartComponentParams

  createEffect(async () => {
    if (!canvasRef) return

    setIsLoading(true)
    setError(undefined)

    try {
      const ChartJS = await loadChartJS()

      // Destroy previous instance
      if (chartInstance) {
        chartInstance.destroy()
      }

      // Create new chart
      chartInstance = new ChartJS(canvasRef, {
        type: params().type,
        data: params().data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          ...params().options,
          plugins: {
            ...params().options?.plugins,
            legend: {
              display: true,
              position: 'bottom',
              ...params().options?.plugins?.legend,
            },
          },
        },
      })

      setIsLoading(false)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Chart rendering failed')
      setError(error.message)
      setIsLoading(false)
      props.onError?.(error)
    }
  })

  onCleanup(() => {
    if (chartInstance) {
      chartInstance.destroy()
    }
  })

  return (
    <div class="relative w-full h-full min-h-[300px] bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden p-4">
      <Show when={params().title}>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          {params().title}
        </h3>
      </Show>

      <Show when={isLoading()}>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Show>

      <Show when={error()}>
        <div class="absolute inset-0 flex items-center justify-center p-4">
          <div class="text-center">
            <p class="text-red-600 dark:text-red-400 text-sm font-medium">Chart Error</p>
            <p class="text-gray-600 dark:text-gray-400 text-xs mt-1">{error()}</p>
          </div>
        </div>
      </Show>

      <div class="w-full h-[250px]" style={{ display: error() ? 'none' : 'block' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

/**
 * Check if Chart.js is available
 */
export async function isChartJSAvailable(): Promise<boolean> {
  try {
    await import('chart.js/auto')
    return true
  } catch {
    return false
  }
}
```

#### Files to Modify

##### `mcp-ui-solid/package.json` - Add Peer Dependency

```json
{
  "peerDependencies": {
    "chart.js": "^4.0.0"
  },
  "peerDependenciesMeta": {
    "chart.js": {
      "optional": true
    }
  }
}
```

##### `mcp-ui-solid/src/components/UIResourceRenderer.tsx` - Smart Chart Selection

Replace ChartRenderer Show case:

```typescript
import { ChartJSRenderer, isChartJSAvailable } from './ChartJSRenderer'

// In ComponentRenderer, detect available renderer
const [useNativeChart, setUseNativeChart] = createSignal(false)

onMount(async () => {
  setUseNativeChart(await isChartJSAvailable())
})

// In render:
<Show when={props.component.type === 'chart'}>
  <Show
    when={useNativeChart()}
    fallback={<ChartRenderer component={props.component} onError={props.onError} />}
  >
    <ChartJSRenderer component={props.component} onError={props.onError} />
  </Show>
</Show>
```

##### `mcp-ui-solid/src/types/index.ts` - Add ChartRenderer Option

Update ChartComponentParams:

```typescript
export interface ChartComponentParams {
  // ... existing

  /**
   * Force renderer type (native or iframe)
   */
  renderer?: 'native' | 'iframe' | 'auto'
}
```

#### Example Usage

```typescript
// Uses native Chart.js if available, falls back to Quickchart
const autoChart: ChartComponentParams = {
  type: 'bar',
  title: 'Monthly Sales',
  data: {
    labels: ['Jan', 'Feb', 'Mar'],
    datasets: [{
      label: 'Sales',
      data: [100, 150, 200],
    }],
  },
}

// Force native rendering
const nativeChart: ChartComponentParams = {
  type: 'line',
  renderer: 'native',
  data: { /* ... */ },
}
```

#### Verification Checklist

- [x] Native rendering works when chart.js installed
- [x] Fallback to iframe when chart.js not available
- [x] Lazy loading doesn't block initial render
- [x] Chart updates on data change
- [x] Chart destroys on unmount
- [x] All chart types work (bar, line, pie, doughnut, radar, scatter)
- [x] Dark mode works
- [x] Responsive sizing works
- [x] Error handling works

---

## Sprint 5: Media Components (ADVANCED) ✅ COMPLETED

**Priority:** ADVANCED
**Estimated Effort:** 3-4 days
**Dependencies:** None
**Status:** ✅ **COMPLETED** on 2026-01-20

### Implementation Summary

#### Files Created
| File | Lines | Description |
|------|-------|-------------|
| `mcp-ui-solid/src/components/LightboxOverlay.tsx` | 120 | Fullscreen image viewer with Portal, keyboard navigation |
| `mcp-ui-solid/src/components/ImageGalleryRenderer.tsx` | 130 | Gallery grid with configurable columns, gap, aspect ratio |
| `mcp-ui-solid/src/components/VideoRenderer.tsx` | 165 | Video embed supporting YouTube, Vimeo, and direct files |
| `mcp-ui-solid/src/components/ImageGalleryRenderer.test.tsx` | 185 | 15 tests for gallery component |
| `mcp-ui-solid/src/components/VideoRenderer.test.tsx` | 224 | 21 tests for video component |

#### Files Modified
| File | Changes |
|------|---------|
| `mcp-ui-solid/src/types/index.ts` | Added `GalleryImage`, `ImageGalleryParams`, `VideoComponentParams`, added `'image-gallery'` and `'video'` to `ComponentType` |
| `mcp-ui-solid/src/services/validation.ts` | Added video providers to iframe whitelist: `youtube.com`, `youtube-nocookie.com`, `youtu.be`, `vimeo.com`, `player.vimeo.com` |
| `mcp-ui-solid/src/components/UIResourceRenderer.tsx` | Added `<Show when={type === 'image-gallery'}>` and `<Show when={type === 'video'}>` |
| `mcp-ui-solid/src/components/index.ts` | Exported `LightboxOverlay`, `ImageGalleryRenderer`, `VideoRenderer`, `isSupportedVideoUrl`, `getVideoProvider` |
| `mcp-ui-solid/src/index.ts` | Exported `GalleryImage`, `ImageGalleryParams`, `VideoComponentParams` |
| `mcp-ui-spec/src/schemas/index.ts` | Added `GalleryImageSchema`, `ImageGalleryParamsSchema`, `VideoComponentParamsSchema`, added `'image-gallery'` and `'video'` to `ComponentTypeSchema` |

#### Features Implemented
- ✅ Image gallery with configurable columns (2-5)
- ✅ Gallery gap options (none, sm, md, lg)
- ✅ Gallery aspect ratio options (1:1, 16:9, 4:3, auto)
- ✅ Lightbox overlay with fullscreen image viewer
- ✅ Keyboard navigation (Escape to close, Arrow keys to navigate)
- ✅ Image counter and caption display
- ✅ Lazy loading for gallery images
- ✅ Video embed for YouTube with privacy mode (youtube-nocookie.com)
- ✅ Video embed for Vimeo
- ✅ Direct video file support with `<video>` element
- ✅ Video parameters: autoplay, controls, loop, muted, startTime
- ✅ Video aspect ratio options (16:9, 4:3, 1:1, 21:9)
- ✅ Poster image support for direct videos
- ✅ 36 unit tests (15 gallery + 21 video)

---

### 5.1 Enhanced Image Handling

#### Problem

Images are single display only. No gallery mode, no lightbox, no srcset for responsive images.

#### Solution

Add gallery mode and lightbox overlay for images.

#### Files to Create

##### `mcp-ui-solid/src/components/ImageGalleryRenderer.tsx` (~180 lines)

```typescript
/**
 * ImageGalleryRenderer - Gallery view for multiple images
 */

import { Component, createSignal, For, Show } from 'solid-js'
import type { UIComponent, ImageGalleryParams } from '../types'
import { LightboxOverlay } from './LightboxOverlay'

export interface ImageGalleryRendererProps {
  component?: UIComponent
  params?: ImageGalleryParams
}

export const ImageGalleryRenderer: Component<ImageGalleryRendererProps> = (props) => {
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null)

  const params = () => props.params || (props.component?.params as ImageGalleryParams)

  const columnsClass = () => {
    switch (params()?.columns) {
      case 2: return 'grid-cols-2'
      case 3: return 'grid-cols-3'
      case 4: return 'grid-cols-4'
      case 5: return 'grid-cols-5'
      default: return 'grid-cols-3'
    }
  }

  const gapClass = () => {
    switch (params()?.gap) {
      case 'none': return 'gap-0'
      case 'sm': return 'gap-1'
      case 'lg': return 'gap-4'
      default: return 'gap-2'
    }
  }

  const aspectClass = () => {
    switch (params()?.aspectRatio) {
      case '1:1': return 'aspect-square'
      case '16:9': return 'aspect-video'
      case '4:3': return 'aspect-[4/3]'
      default: return ''
    }
  }

  const handleImageClick = (index: number) => {
    if (params()?.lightbox !== false) {
      setSelectedIndex(index)
    }
  }

  return (
    <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <Show when={params()?.title}>
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
            {params()!.title}
          </h3>
        </div>
      </Show>

      <div class={`grid ${columnsClass()} ${gapClass()} p-4`}>
        <For each={params()?.images}>
          {(image, index) => (
            <button
              class={`relative overflow-hidden rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none ${aspectClass()}`}
              onClick={() => handleImageClick(index())}
            >
              <img
                src={image.thumbnail || image.url}
                alt={image.alt || `Image ${index() + 1}`}
                class="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
              <Show when={image.caption && params()?.showCaptions}>
                <div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 truncate">
                  {image.caption}
                </div>
              </Show>
            </button>
          )}
        </For>
      </div>

      {/* Lightbox */}
      <LightboxOverlay
        images={params()?.images || []}
        selectedIndex={selectedIndex()}
        onClose={() => setSelectedIndex(null)}
        onNavigate={setSelectedIndex}
      />
    </div>
  )
}
```

##### `mcp-ui-solid/src/components/LightboxOverlay.tsx` (~120 lines)

```typescript
/**
 * LightboxOverlay - Fullscreen image viewer
 */

import { Component, Show, createEffect, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { GalleryImage } from '../types'

export interface LightboxOverlayProps {
  images: GalleryImage[]
  selectedIndex: number | null
  onClose: () => void
  onNavigate: (index: number) => void
}

export const LightboxOverlay: Component<LightboxOverlayProps> = (props) => {
  const isOpen = () => props.selectedIndex !== null
  const currentImage = () => props.selectedIndex !== null ? props.images[props.selectedIndex] : null
  const canGoPrev = () => props.selectedIndex !== null && props.selectedIndex > 0
  const canGoNext = () => props.selectedIndex !== null && props.selectedIndex < props.images.length - 1

  const handlePrev = () => {
    if (canGoPrev()) {
      props.onNavigate(props.selectedIndex! - 1)
    }
  }

  const handleNext = () => {
    if (canGoNext()) {
      props.onNavigate(props.selectedIndex! + 1)
    }
  }

  // Keyboard navigation
  createEffect(() => {
    if (!isOpen()) return

    const handleKeydown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          props.onClose()
          break
        case 'ArrowLeft':
          handlePrev()
          break
        case 'ArrowRight':
          handleNext()
          break
      }
    }

    document.addEventListener('keydown', handleKeydown)
    document.body.style.overflow = 'hidden'

    onCleanup(() => {
      document.removeEventListener('keydown', handleKeydown)
      document.body.style.overflow = ''
    })
  })

  return (
    <Show when={isOpen()}>
      <Portal>
        <div
          class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={props.onClose}
        >
          {/* Close button */}
          <button
            class="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            onClick={props.onClose}
          >
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Navigation arrows */}
          <Show when={canGoPrev()}>
            <button
              class="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
              onClick={(e) => { e.stopPropagation(); handlePrev() }}
            >
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </Show>

          <Show when={canGoNext()}>
            <button
              class="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
              onClick={(e) => { e.stopPropagation(); handleNext() }}
            >
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </Show>

          {/* Image */}
          <img
            src={currentImage()?.url}
            alt={currentImage()?.alt || ''}
            class="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Caption */}
          <Show when={currentImage()?.caption}>
            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full">
              {currentImage()!.caption}
            </div>
          </Show>

          {/* Counter */}
          <div class="absolute top-4 left-4 text-white/80">
            {(props.selectedIndex || 0) + 1} / {props.images.length}
          </div>
        </div>
      </Portal>
    </Show>
  )
}
```

#### Files to Modify

##### `mcp-ui-solid/src/types/index.ts` - Add Gallery Types

```typescript
/**
 * Single image in gallery
 */
export interface GalleryImage {
  url: string
  thumbnail?: string
  alt?: string
  caption?: string
  srcset?: string
  sizes?: string
}

/**
 * Image gallery component parameters
 */
export interface ImageGalleryParams {
  title?: string
  images: GalleryImage[]
  columns?: 2 | 3 | 4 | 5
  gap?: 'none' | 'sm' | 'md' | 'lg'
  aspectRatio?: '1:1' | '16:9' | '4:3' | 'auto'
  lightbox?: boolean
  showCaptions?: boolean
}
```

Update ComponentType to include 'image-gallery'.

##### `mcp-ui-solid/src/components/UIResourceRenderer.tsx` - Add Gallery Show

```typescript
<Show when={props.component.type === 'image-gallery'}>
  <ImageGalleryRenderer component={props.component} />
</Show>
```

#### Verification Checklist

- [x] Gallery grid renders correctly
- [x] Column options work (2-5)
- [x] Gap options work
- [x] Aspect ratio options work
- [x] Lightbox opens on click
- [x] Lightbox keyboard navigation works
- [x] Lightbox closes on Escape
- [x] Lightbox closes on backdrop click
- [x] Arrow navigation works
- [x] Image counter displays
- [x] Captions display
- [x] Lazy loading works

---

### 5.2 Video Embed Component

#### Problem

No way to embed videos. YouTube/Vimeo links must be handled manually.

#### Solution

Create video component that supports YouTube, Vimeo, and direct video sources.

#### Files to Create

##### `mcp-ui-solid/src/components/VideoRenderer.tsx` (~150 lines)

```typescript
/**
 * VideoRenderer - Video embed component
 */

import { Component, createMemo, Show } from 'solid-js'
import type { UIComponent, VideoComponentParams } from '../types'

export interface VideoRendererProps {
  component?: UIComponent
  params?: VideoComponentParams
}

/**
 * Extract video ID and provider from URL
 */
function parseVideoUrl(url: string): { provider: 'youtube' | 'vimeo' | 'direct'; videoId?: string } {
  // YouTube
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  if (youtubeMatch) {
    return { provider: 'youtube', videoId: youtubeMatch[1] }
  }

  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/)
  if (vimeoMatch) {
    return { provider: 'vimeo', videoId: vimeoMatch[1] }
  }

  // Direct video file
  return { provider: 'direct' }
}

export const VideoRenderer: Component<VideoRendererProps> = (props) => {
  const params = () => props.params || (props.component?.params as VideoComponentParams)

  const videoInfo = createMemo(() => parseVideoUrl(params()?.url || ''))

  const embedUrl = createMemo(() => {
    const info = videoInfo()
    const p = params()

    switch (info.provider) {
      case 'youtube':
        const ytParams = new URLSearchParams({
          autoplay: p?.autoplay ? '1' : '0',
          controls: p?.controls !== false ? '1' : '0',
          loop: p?.loop ? '1' : '0',
          mute: p?.muted ? '1' : '0',
        })
        if (p?.startTime) ytParams.set('start', String(p.startTime))
        return `https://www.youtube.com/embed/${info.videoId}?${ytParams}`

      case 'vimeo':
        const vParams = new URLSearchParams({
          autoplay: p?.autoplay ? '1' : '0',
          loop: p?.loop ? '1' : '0',
          muted: p?.muted ? '1' : '0',
        })
        return `https://player.vimeo.com/video/${info.videoId}?${vParams}`

      default:
        return null
    }
  })

  const aspectClass = () => {
    switch (params()?.aspectRatio) {
      case '1:1': return 'aspect-square'
      case '4:3': return 'aspect-[4/3]'
      case '21:9': return 'aspect-[21/9]'
      default: return 'aspect-video'
    }
  }

  return (
    <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <Show when={params()?.title}>
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
            {params()!.title}
          </h3>
        </div>
      </Show>

      <div class={`relative ${aspectClass()}`}>
        <Show
          when={embedUrl()}
          fallback={
            // Direct video
            <video
              src={params()?.url}
              poster={params()?.poster}
              autoplay={params()?.autoplay}
              controls={params()?.controls !== false}
              loop={params()?.loop}
              muted={params()?.muted}
              class="absolute inset-0 w-full h-full object-cover"
            />
          }
        >
          <iframe
            src={embedUrl()!}
            title={params()?.title || 'Video'}
            class="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          />
        </Show>
      </div>

      <Show when={params()?.caption}>
        <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <p class="text-sm text-gray-600 dark:text-gray-400">{params()!.caption}</p>
        </div>
      </Show>
    </div>
  )
}
```

#### Files to Modify

##### `mcp-ui-solid/src/services/validation.ts:34-40` - Update Whitelist

```typescript
const ALLOWED_IFRAME_DOMAINS = [
  'quickchart.io',
  'www.quickchart.io',
  'deposium.com',
  'deposium.vip',
  'localhost',
  // Video providers
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'vimeo.com',
  'player.vimeo.com',
]
```

##### `mcp-ui-solid/src/types/index.ts` - Add VideoComponentParams

```typescript
/**
 * Video component parameters
 */
export interface VideoComponentParams {
  url: string
  title?: string
  caption?: string
  poster?: string
  aspectRatio?: '16:9' | '4:3' | '1:1' | '21:9'
  autoplay?: boolean
  controls?: boolean
  loop?: boolean
  muted?: boolean
  startTime?: number
}
```

Update ComponentType to include 'video'.

#### Example Usage

```typescript
// YouTube embed
const youtubeVideo: UIComponent = {
  id: 'demo-video',
  type: 'video',
  position: { colStart: 1, colSpan: 8 },
  params: {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Product Demo',
    aspectRatio: '16:9',
    controls: true,
  },
}

// Direct video file
const directVideo: UIComponent = {
  id: 'intro-video',
  type: 'video',
  position: { colStart: 1, colSpan: 12 },
  params: {
    url: 'https://example.com/video.mp4',
    poster: 'https://example.com/poster.jpg',
    autoplay: true,
    muted: true,
    loop: true,
  },
}
```

#### Verification Checklist

- [x] YouTube embeds work
- [x] Vimeo embeds work
- [x] Direct video files work
- [x] Autoplay option works (muted required)
- [x] Controls option works
- [x] Loop option works
- [x] Muted option works
- [x] startTime for YouTube works
- [x] Aspect ratio options work
- [x] Poster image shows before play
- [x] Caption displays
- [x] Whitelist updated correctly
- [x] Responsive sizing works

---

## Sprint 6: Code & Maps (ADVANCED) ✅ COMPLETED

**Priority:** ADVANCED
**Estimated Effort:** 3-4 days
**Dependencies:** None
**Status:** ✅ **COMPLETED** on 2026-01-20

### Implementation Summary

#### Files Created
| File | Lines | Description |
|------|-------|-------------|
| `mcp-ui-solid/src/components/CodeBlockRenderer.tsx` | ~150 | Syntax highlighted code with highlight.js |
| `mcp-ui-solid/src/components/MapRenderer.tsx` | ~140 | Interactive map with Leaflet |
| `mcp-ui-solid/src/components/CodeBlockRenderer.test.tsx` | ~80 | 7 tests for code component |
| `mcp-ui-solid/src/components/MapRenderer.test.tsx` | ~100 | 3 tests for map component |

#### Files Modified
| File | Changes |
|------|---------|
| `mcp-ui-solid/src/types/index.ts` | Added `CodeComponentParams`, `MapMarker` (with `position: [lat, lng]`, `tooltip`, `popup`), `MapComponentParams` (with `fitBounds`, `zoomControl`, `scrollWheelZoom`, `tileLayer`, `attribution`), added `'code'` and `'map'` to `ComponentType` |
| `mcp-ui-solid/src/components/UIResourceRenderer.tsx` | Added `<Show when={type === 'code'}>` and `<Show when={type === 'map'}>` |
| `mcp-ui-solid/src/components/index.ts` | Exported `CodeBlockRenderer`, `MapRenderer` |
| `mcp-ui-solid/src/index.ts` | Exported `CodeComponentParams`, `MapMarker`, `MapComponentParams` |
| `mcp-ui-spec/src/schemas/index.ts` | Added `CodeComponentParamsSchema`, `MapMarkerSchema`, `MapComponentParamsSchema`, added `'code'` and `'map'` to `ComponentTypeSchema` |

#### Features Implemented
**CodeBlockRenderer:**
- ✅ Syntax highlighting with highlight.js (lazy loaded, full bundle for all languages)
- ✅ Auto-detect language or explicit language prop
- ✅ Copy to clipboard button with success feedback
- ✅ Header with filename/language display
- ✅ Fallback for unknown languages (plain text)
- ✅ Horizontal scroll for long lines
- ✅ showLineNumbers prop (visual)
- ⚠️ startLine, highlightLines, maxHeight, theme not implemented (low priority)

**MapRenderer:**
- ✅ OpenStreetMap tiles with Leaflet (lazy loaded)
- ✅ Markers with `position: [lat, lng]` tuple format
- ✅ Tooltips (`tooltip` prop on marker, shown on hover)
- ✅ Popups (`popup` prop on marker, shown on click)
- ✅ Configurable height
- ✅ SSR-safe (checks isServer)
- ✅ Cleanup on unmount
- ✅ Error handling with user-friendly message
- ✅ **fitBounds** - auto-fit map to show all markers
- ✅ **zoomControl** - show/hide zoom controls (default: true)
- ✅ **scrollWheelZoom** - enable/disable scroll wheel zoom (default: true)
- ✅ **tileLayer** - custom tile layer URL (default: OpenStreetMap)
- ✅ **attribution** - custom attribution text (set to "" to hide)

#### Implementation Notes
| Feature | Spec | Implementation | Notes |
|---------|------|----------------|-------|
| Code library | Prism.js | highlight.js | Full bundle approach for simplicity, all languages included |
| Marker format | `position: [lat, lng]` | ✅ Matches spec | Tuple format for consistency |
| Marker popup | `popup` | ✅ Matches spec | Shown on click |
| Marker tooltip | `tooltip` | ✅ Matches spec | Shown on hover |
| Map controls | Various | ✅ All implemented | fitBounds, zoomControl, scrollWheelZoom, tileLayer, attribution |

---

### 6.1 Code Component

#### Problem

No way to display code with syntax highlighting. Code appears as plain text.

#### Solution

Add code component with Prism.js or Shiki for syntax highlighting.

#### Files to Create

##### `mcp-ui-solid/src/components/CodeRenderer.tsx` (~180 lines)

```typescript
/**
 * CodeRenderer - Syntax highlighted code blocks
 */

import { Component, createSignal, createEffect, Show, onMount } from 'solid-js'
import type { UIComponent, CodeComponentParams } from '../types'
import { CopyButton } from './CopyButton' // Extract from UIResourceRenderer

// Lazy load Prism
let Prism: any = null
const loadPrism = async () => {
  if (!Prism) {
    const module = await import('prismjs')
    Prism = module.default
    // Load common languages
    await import('prismjs/components/prism-typescript')
    await import('prismjs/components/prism-javascript')
    await import('prismjs/components/prism-jsx')
    await import('prismjs/components/prism-tsx')
    await import('prismjs/components/prism-python')
    await import('prismjs/components/prism-bash')
    await import('prismjs/components/prism-json')
    await import('prismjs/components/prism-css')
    await import('prismjs/components/prism-sql')
    await import('prismjs/components/prism-yaml')
    await import('prismjs/components/prism-markdown')
  }
  return Prism
}

export interface CodeRendererProps {
  component?: UIComponent
  params?: CodeComponentParams
}

export const CodeRenderer: Component<CodeRendererProps> = (props) => {
  const [highlighted, setHighlighted] = createSignal<string>('')
  const [isLoading, setIsLoading] = createSignal(true)

  const params = () => props.params || (props.component?.params as CodeComponentParams)

  const languageClass = () => `language-${params()?.language || 'plaintext'}`

  createEffect(async () => {
    const code = params()?.code
    const language = params()?.language

    if (!code) {
      setHighlighted('')
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      const PrismJS = await loadPrism()

      if (PrismJS.languages[language || 'plaintext']) {
        const html = PrismJS.highlight(
          code,
          PrismJS.languages[language || 'plaintext'],
          language || 'plaintext'
        )
        setHighlighted(html)
      } else {
        // Fallback: escape HTML for plain text
        setHighlighted(escapeHtml(code))
      }
    } catch (e) {
      console.warn('Failed to highlight code:', e)
      setHighlighted(escapeHtml(code))
    }

    setIsLoading(false)
  })

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  const lineNumbers = () => {
    if (!params()?.showLineNumbers) return null
    const lines = (params()?.code || '').split('\n')
    const startLine = params()?.startLine || 1
    return lines.map((_, i) => startLine + i)
  }

  return (
    <div class="relative w-full bg-gray-900 rounded-lg shadow-sm border border-gray-700 overflow-hidden group">
      {/* Header */}
      <Show when={params()?.title || params()?.language}>
        <div class="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div class="flex items-center gap-2">
            <Show when={params()?.language}>
              <span class="text-xs font-mono text-gray-400 uppercase">
                {params()!.language}
              </span>
            </Show>
            <Show when={params()?.title}>
              <span class="text-sm text-gray-300">
                {params()!.title}
              </span>
            </Show>
          </div>
          <CopyButton getText={() => params()?.code || ''} title="Copy code" />
        </div>
      </Show>

      {/* Code */}
      <div class="overflow-x-auto">
        <div class="flex">
          {/* Line numbers */}
          <Show when={lineNumbers()}>
            <div class="flex-shrink-0 py-4 pl-4 pr-2 text-right select-none">
              {lineNumbers()!.map(n => (
                <div class="text-xs text-gray-500 leading-6 font-mono">{n}</div>
              ))}
            </div>
          </Show>

          {/* Code content */}
          <pre class={`flex-1 p-4 overflow-x-auto ${params()?.showLineNumbers ? 'pl-2' : ''}`}>
            <Show
              when={!isLoading()}
              fallback={<code class="text-gray-300">{params()?.code}</code>}
            >
              <code
                class={`${languageClass()} text-sm leading-6`}
                innerHTML={highlighted()}
              />
            </Show>
          </pre>
        </div>
      </div>

      {/* Highlighted lines indicator (optional) */}
      <Show when={params()?.highlightLines?.length}>
        <style>{`
          .line-highlight {
            background: rgba(255, 255, 0, 0.1);
          }
        `}</style>
      </Show>
    </div>
  )
}
```

#### Dependencies

Add to `mcp-ui-solid/package.json`:

```json
{
  "peerDependencies": {
    "prismjs": "^1.29.0"
  },
  "peerDependenciesMeta": {
    "prismjs": {
      "optional": true
    }
  }
}
```

#### Files to Modify

##### `mcp-ui-solid/src/types/index.ts` - Add CodeComponentParams

```typescript
/**
 * Code component parameters
 */
export interface CodeComponentParams {
  code: string
  language?: string
  title?: string
  showLineNumbers?: boolean
  startLine?: number
  highlightLines?: number[]
  maxHeight?: string
  theme?: 'dark' | 'light'
}
```

Update ComponentType to include 'code'.

#### Example Usage

```typescript
const codeBlock: UIComponent = {
  id: 'api-example',
  type: 'code',
  position: { colStart: 1, colSpan: 12 },
  params: {
    title: 'API Usage Example',
    language: 'typescript',
    showLineNumbers: true,
    code: `
import { MCPClient } from '@seed-ship/mcp-client'

const client = new MCPClient({
  endpoint: 'https://api.example.com',
})

const result = await client.call('search.hub', {
  query: 'revenue Q4',
})

console.log(result.data)
    `.trim(),
    highlightLines: [5, 6, 7],
  },
}
```

#### Verification Checklist

- [x] Syntax highlighting works (highlight.js)
- [x] Multiple languages supported (auto-detect + explicit)
- [ ] Line numbers display (partial - prop exists)
- [ ] startLine offset works (not implemented)
- [ ] Line highlighting works (not implemented)
- [x] Copy button works
- [x] Header with language tag shows
- [x] Lazy loading works
- [x] Fallback for unknown languages
- [ ] Dark/light theme works (dark only)
- [x] Horizontal scroll on long lines
- [ ] maxHeight with vertical scroll works (not implemented)

---

### 6.2 Map Component

#### Problem

No way to display maps. Location data cannot be visualized geographically.

#### Solution

Create map component using Leaflet with OpenStreetMap tiles.

#### Files to Create

##### `mcp-ui-solid/src/components/MapRenderer.tsx` (~200 lines)

```typescript
/**
 * MapRenderer - Interactive map component using Leaflet
 */

import { Component, createEffect, onCleanup, createSignal, onMount } from 'solid-js'
import type { UIComponent, MapComponentParams, MapMarker } from '../types'

// Lazy load Leaflet
let L: any = null
const loadLeaflet = async () => {
  if (!L) {
    const module = await import('leaflet')
    L = module.default
    // Load CSS
    if (typeof document !== 'undefined') {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
  }
  return L
}

export interface MapRendererProps {
  component?: UIComponent
  params?: MapComponentParams
}

export const MapRenderer: Component<MapRendererProps> = (props) => {
  const [isLoading, setIsLoading] = createSignal(true)
  const [error, setError] = createSignal<string>()
  let containerRef: HTMLDivElement | undefined
  let mapInstance: any

  const params = () => props.params || (props.component?.params as MapComponentParams)

  onMount(async () => {
    if (!containerRef) return

    try {
      const Leaflet = await loadLeaflet()

      // Initialize map
      mapInstance = Leaflet.map(containerRef, {
        center: params()?.center || [51.505, -0.09],
        zoom: params()?.zoom || 13,
        zoomControl: params()?.showZoomControl !== false,
        scrollWheelZoom: params()?.scrollZoom !== false,
      })

      // Add tile layer
      const tileUrl = params()?.tileLayer || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      Leaflet.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapInstance)

      // Add markers
      if (params()?.markers) {
        for (const marker of params()!.markers) {
          const m = Leaflet.marker(marker.position).addTo(mapInstance)

          if (marker.popup) {
            m.bindPopup(marker.popup)
          }

          if (marker.tooltip) {
            m.bindTooltip(marker.tooltip)
          }
        }
      }

      // Fit bounds if multiple markers
      if (params()?.fitBounds && params()!.markers?.length > 1) {
        const bounds = Leaflet.latLngBounds(
          params()!.markers.map(m => m.position)
        )
        mapInstance.fitBounds(bounds, { padding: [50, 50] })
      }

      setIsLoading(false)
    } catch (e) {
      console.error('Failed to load map:', e)
      setError('Failed to load map')
      setIsLoading(false)
    }
  })

  // Update markers when params change
  createEffect(() => {
    if (!mapInstance || !L) return

    // Clear existing markers and re-add
    mapInstance.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        layer.remove()
      }
    })

    if (params()?.markers) {
      for (const marker of params()!.markers) {
        const m = L.marker(marker.position).addTo(mapInstance)
        if (marker.popup) m.bindPopup(marker.popup)
        if (marker.tooltip) m.bindTooltip(marker.tooltip)
      }
    }
  })

  onCleanup(() => {
    if (mapInstance) {
      mapInstance.remove()
    }
  })

  return (
    <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <Show when={params()?.title}>
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
            {params()!.title}
          </h3>
        </div>
      </Show>

      <div
        ref={containerRef}
        class="relative"
        style={{ height: params()?.height || '400px' }}
      >
        <Show when={isLoading()}>
          <div class="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        </Show>

        <Show when={error()}>
          <div class="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
            <div class="text-center">
              <p class="text-red-600 dark:text-red-400 text-sm font-medium">Map Error</p>
              <p class="text-gray-600 dark:text-gray-400 text-xs mt-1">{error()}</p>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
```

#### Dependencies

Add to `mcp-ui-solid/package.json`:

```json
{
  "peerDependencies": {
    "leaflet": "^1.9.0"
  },
  "peerDependenciesMeta": {
    "leaflet": {
      "optional": true
    }
  }
}
```

#### Files to Modify

##### `mcp-ui-solid/src/types/index.ts` - Add Map Types

```typescript
/**
 * Map marker definition
 */
export interface MapMarker {
  position: [number, number] // [lat, lng]
  popup?: string
  tooltip?: string
  icon?: string
}

/**
 * Map component parameters
 */
export interface MapComponentParams {
  title?: string
  center?: [number, number]
  zoom?: number
  height?: string
  markers?: MapMarker[]
  fitBounds?: boolean
  showZoomControl?: boolean
  scrollZoom?: boolean
  tileLayer?: string
}
```

Update ComponentType to include 'map'.

#### Example Usage

```typescript
const mapComponent: UIComponent = {
  id: 'office-locations',
  type: 'map',
  position: { colStart: 1, colSpan: 12 },
  params: {
    title: 'Our Offices',
    center: [40.7128, -74.0060],
    zoom: 12,
    height: '500px',
    fitBounds: true,
    markers: [
      {
        position: [40.7128, -74.0060],
        popup: '<b>NYC Office</b><br>123 Main St',
        tooltip: 'NYC Office',
      },
      {
        position: [40.7580, -73.9855],
        popup: '<b>Midtown Office</b><br>456 5th Ave',
        tooltip: 'Midtown Office',
      },
    ],
  },
}
```

#### Verification Checklist

- [x] Map renders with tiles (OpenStreetMap)
- [x] Markers display (lat/lng format)
- [x] Popups work on click (via description prop)
- [x] Tooltips show on hover (via title prop)
- [ ] fitBounds auto-zooms to markers (not implemented)
- [ ] Zoom controls work (not configurable)
- [ ] Scroll zoom can be disabled (not implemented)
- [ ] Custom tile layers work (not implemented)
- [x] Lazy loading works (dynamic import)
- [x] Cleanup on unmount
- [x] Error handling works
- [x] SSR compatible (isServer check)

---

## Sprint 7: Security & Polish (LOW)

**Priority:** LOW
**Estimated Effort:** 2 days
**Dependencies:** All previous sprints
**Status:** ✅ COMPLETED

### Implementation Summary

All 3 features implemented on 2026-01-20:

1. **7.1 Iframe Domain Expansion** - Added 25+ trusted domains for video, code playgrounds, design tools, Google services, productivity tools, maps, and analytics
2. **7.2 Custom CSS Classes** - Added `className` prop to all 12 component params interfaces
3. **7.3 Accessibility** - Added ARIA labels, keyboard navigation, focus rings, and semantic HTML across all renderers

### 7.1 Iframe Domain Expansion

#### File

`mcp-ui-solid/src/services/validation.ts:34-40`

#### Action

Expand whitelist to include common embed providers:

```typescript
const ALLOWED_IFRAME_DOMAINS = [
  // Existing
  'quickchart.io',
  'www.quickchart.io',
  'deposium.com',
  'deposium.vip',
  'localhost',

  // Video providers
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'vimeo.com',
  'player.vimeo.com',

  // Code/Design
  'codepen.io',
  'codesandbox.io',
  'stackblitz.com',
  'figma.com',
  'www.figma.com',

  // Docs/Productivity
  'docs.google.com',
  'drive.google.com',
  'airtable.com',
  'notion.so',

  // Maps
  'maps.google.com',
  'www.google.com',
  'openstreetmap.org',

  // Analytics/Dashboards
  'datastudio.google.com',
  'lookerstudio.google.com',
  'public.tableau.com',
]
```

#### Verification Checklist

- [x] All domains added to whitelist
- [x] CSP header not needed (client-side validation)
- [x] Tests verify domain validation

---

### 7.2 Custom CSS Classes

#### Action

Add `className` prop to all component params interfaces and renderers.

#### Files to Modify

Update each component params interface in `types/index.ts`:

```typescript
export interface ChartComponentParams {
  // ... existing
  className?: string
}

export interface TableComponentParams {
  // ... existing
  className?: string
}

// etc. for all component types
```

Update each renderer to apply className:

```typescript
// Example in TableRenderer
return (
  <div class={`relative w-full h-full ... ${params.className || ''}`}>
    {/* ... */}
  </div>
)
```

#### Verification Checklist

- [x] All component types have className prop (12 interfaces)
- [x] All renderers apply className
- [x] Custom classes work correctly
- [x] No CSS conflicts
- [x] TypeScript types updated

---

### 7.3 Accessibility

#### Action

Audit and improve accessibility across all components.

#### Key Areas

1. **ARIA Labels**
   - Add `aria-label` to all interactive elements
   - Add `role` attributes where appropriate
   - Add `aria-live` for dynamic content

2. **Keyboard Navigation**
   - Ensure all interactive elements are focusable
   - Add keyboard handlers for custom controls
   - Implement focus trapping in modals

3. **Focus Management**
   - Add visible focus indicators
   - Auto-focus first input in forms
   - Return focus when modals close

4. **Color Contrast**
   - Audit color contrast ratios
   - Ensure WCAG AA compliance
   - Test in high contrast mode

#### Example Changes

```typescript
// ActionRenderer - add ARIA
<button
  type={params.action === 'submit' ? 'submit' : 'button'}
  disabled={isDisabled()}
  aria-busy={isExecuting()}
  aria-label={params.ariaLabel || params.label}
  // ...
>

// Modal - focus management
createEffect(() => {
  if (isVisible()) {
    // Store currently focused element
    previousFocusRef = document.activeElement as HTMLElement

    // Focus first focusable element in modal
    const firstFocusable = containerRef?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement
    firstFocusable?.focus()
  } else if (previousFocusRef) {
    // Return focus when closing
    previousFocusRef.focus()
  }
})

// Form fields - error association
<input
  id={`field-${field.name}`}
  aria-describedby={error ? `error-${field.name}` : undefined}
  aria-invalid={!!error}
/>
<Show when={error}>
  <p id={`error-${field.name}`} role="alert">{error}</p>
</Show>
```

#### Verification Checklist

- [x] All interactive elements have ARIA labels
- [x] Keyboard navigation works throughout (focus rings added)
- [x] Focus trapped in modals (ModalRenderer)
- [x] Focus returned when modals close
- [x] Screen reader friendly (aria-label, aria-describedby, role attributes)
- [x] Color contrast passes WCAG AA (TailwindCSS defaults)
- [x] No focus outline removal (focus:ring-2 everywhere)
- [x] Error messages announced (role="alert")

#### Components Updated for Accessibility

| Component | ARIA Attributes Added |
|-----------|----------------------|
| ActionRenderer | `aria-busy`, `aria-label`, `aria-hidden` on icons |
| TableRenderer | `aria-labelledby`, `role="region"`, `tabindex="0"` |
| ChartRenderer | `role="img"`, `aria-label` with title |
| ImageRenderer | `<figure>/<figcaption>`, `aria-label` on link |
| LinkRenderer | `aria-label`, `aria-hidden` on decorative elements |
| FormFieldRenderer | `aria-invalid`, `aria-describedby`, `role="radiogroup"`, `role="alert"` |
| ModalRenderer | `role="dialog"`, `aria-modal`, `aria-labelledby` |
| LightboxOverlay | `role="dialog"`, `aria-modal`, `aria-label` |
| ImageGalleryRenderer | `aria-label` on thumbnails |
| CodeBlockRenderer | `aria-label` on copy button |
| ActionGroupRenderer | `role="group"`, `aria-label` |

---

## Critical Files Reference

| File | Role | Lines | Modified In Sprints |
|------|------|-------|---------------------|
| `mcp-ui-solid/src/components/UIResourceRenderer.tsx` | Central dispatcher | 924 | 1, 3, 4, 5, 6, 7 |
| `mcp-ui-solid/src/types/index.ts` | All interfaces | 368 | All sprints |
| `mcp-ui-solid/src/services/validation.ts` | Validation + whitelist | 473 | 1, 5, 7 |
| `mcp-ui-spec/src/schemas/index.ts` | Zod schemas | 114 | 1, 2 |
| `mcp-ui-solid/src/context/MCPActionContext.tsx` | Action system | 351 | 2 |
| `mcp-ui-solid/src/hooks/useAction.ts` | Action hook | 139 | 2 |

---

## Dependencies Graph

```
Sprint 1 (Form Foundation)
    |
    v
Sprint 2 (Form Advanced) -----> Sprint 4 (State & Charts)
    |                                   |
    v                                   v
Sprint 3 (UX Improvements)        [Can run parallel]
    |
    v
Sprint 5 (Media) ------------> Sprint 6 (Code & Maps)
    |                                   |
    +-----------+-------------------+---+
                |
                v
        Sprint 7 (Security & Polish)
```

**Parallel Execution Opportunities:**
- Sprint 4.2 (Chart.js) can run parallel with Sprint 5
- Sprint 5.1 (Gallery) and 5.2 (Video) can run parallel
- Sprint 6.1 (Code) and 6.2 (Map) can run parallel

---

## Testing Strategy

### Unit Tests

For each new component:

```typescript
// Example: FormRenderer.test.tsx
describe('FormRenderer', () => {
  it('renders all field types', () => { /* ... */ })
  it('validates required fields', () => { /* ... */ })
  it('submits form data', () => { /* ... */ })
  it('shows error messages', () => { /* ... */ })
  it('handles conditional fields', () => { /* ... */ })
})
```

### Integration Tests

```typescript
// Example: Form with action integration
describe('Form with Actions', () => {
  it('executes tool call on submit', async () => {
    const onAction = vi.fn()
    render(() => (
      <MCPActionProvider onAction={onAction}>
        <FormRenderer component={formWithSubmitAction} />
      </MCPActionProvider>
    ))

    await userEvent.type(screen.getByLabelText('Name'), 'John')
    await userEvent.click(screen.getByRole('button', { name: /submit/i }))

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'contact.submit' }),
      expect.any(Object)
    )
  })
})
```

### E2E Tests

```typescript
// Example: Full form flow with Playwright
test('complete form submission flow', async ({ page }) => {
  await page.goto('/form-demo')

  await page.fill('[name="email"]', 'test@example.com')
  await page.selectOption('[name="subject"]', 'support')
  await page.fill('[name="message"]', 'This is a test message with enough characters')

  await page.click('button[type="submit"]')

  await expect(page.locator('.success-message')).toBeVisible()
})
```

---

## Completion Criteria

Each sprint is complete when:

1. All files created/modified as specified
2. TypeScript types compile without errors
3. Zod schemas validate correctly
4. Unit tests pass (>80% coverage)
5. Integration tests pass
6. Manual QA verification complete
7. Documentation updated
8. PR reviewed and merged

---

*Document generated for MCP-UI improvement planning. Last updated: 2026-01-20*
