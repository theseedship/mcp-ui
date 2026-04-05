/**
 * Tests for ChatPrompt component
 * Phase 2: choice, confirm, form subtypes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { ChatPrompt } from './ChatPrompt'
import type { ChatPromptConfig, ChatPromptResponse } from '../types/chat-bus'

describe('ChatPrompt', () => {
  beforeEach(() => cleanup())

  // ─── Choice ──────────────────────────────────────────

  describe('type: choice', () => {
    const choiceConfig: ChatPromptConfig = {
      type: 'choice',
      title: 'Select format',
      config: {
        options: [
          { value: 'pdf', label: 'PDF', icon: '📄' },
          { value: 'csv', label: 'CSV' },
          { value: 'json', label: 'JSON', description: 'Raw data' },
        ],
      },
    }

    it('renders title and all options', () => {
      const { getByText } = render(() => (
        <ChatPrompt config={choiceConfig} onSubmit={() => {}} />
      ))

      expect(getByText('Select format')).toBeDefined()
      expect(getByText('PDF')).toBeDefined()
      expect(getByText('CSV')).toBeDefined()
      expect(getByText('JSON')).toBeDefined()
    })

    it('renders option icons and descriptions', () => {
      const { getByText } = render(() => (
        <ChatPrompt config={choiceConfig} onSubmit={() => {}} />
      ))

      expect(getByText('📄')).toBeDefined()
      expect(getByText('Raw data')).toBeDefined()
    })

    it('calls onSubmit with value and label when option clicked', () => {
      const onSubmit = vi.fn()
      const { getByText } = render(() => (
        <ChatPrompt config={choiceConfig} onSubmit={onSubmit} />
      ))

      fireEvent.click(getByText('CSV'))

      expect(onSubmit).toHaveBeenCalledWith({
        type: 'choice',
        value: 'csv',
        label: 'CSV',
      })
    })

    it('supports vertical layout', () => {
      const verticalConfig: ChatPromptConfig = {
        ...choiceConfig,
        config: { ...choiceConfig.config as any, layout: 'vertical' },
      }
      const { container } = render(() => (
        <ChatPrompt config={verticalConfig} onSubmit={() => {}} />
      ))

      const body = container.querySelector('.flex-col')
      expect(body).not.toBeNull()
    })
  })

  // ─── Confirm ─────────────────────────────────────────

  describe('type: confirm', () => {
    const confirmConfig: ChatPromptConfig = {
      type: 'confirm',
      title: 'Delete 47 documents?',
      config: {
        message: 'This action cannot be undone.',
        confirmLabel: 'Delete',
        cancelLabel: 'Keep',
        variant: 'danger',
      },
    }

    it('renders title, message, and buttons', () => {
      const { getByText } = render(() => (
        <ChatPrompt config={confirmConfig} onSubmit={() => {}} />
      ))

      expect(getByText('Delete 47 documents?')).toBeDefined()
      expect(getByText('This action cannot be undone.')).toBeDefined()
      expect(getByText('Delete')).toBeDefined()
      expect(getByText('Keep')).toBeDefined()
    })

    it('calls onSubmit with confirmed on confirm click', () => {
      const onSubmit = vi.fn()
      const { getByText } = render(() => (
        <ChatPrompt config={confirmConfig} onSubmit={onSubmit} />
      ))

      fireEvent.click(getByText('Delete'))

      expect(onSubmit).toHaveBeenCalledWith({
        type: 'confirm',
        value: 'confirmed',
        label: 'Delete',
      })
    })

    it('calls onSubmit with dismissed on cancel click', () => {
      const onSubmit = vi.fn()
      const onDismiss = vi.fn()
      const { getByText } = render(() => (
        <ChatPrompt config={confirmConfig} onSubmit={onSubmit} onDismiss={onDismiss} />
      ))

      fireEvent.click(getByText('Keep'))

      expect(onSubmit).toHaveBeenCalledWith({
        type: 'confirm',
        value: 'cancelled',
        label: 'Keep',
        dismissed: true,
      })
      expect(onDismiss).toHaveBeenCalled()
    })

    it('uses default labels when not provided', () => {
      const simpleConfig: ChatPromptConfig = {
        type: 'confirm',
        title: 'Are you sure?',
        config: {},
      }
      const { getByText } = render(() => (
        <ChatPrompt config={simpleConfig} onSubmit={() => {}} />
      ))

      expect(getByText('Confirm')).toBeDefined()
      expect(getByText('Cancel')).toBeDefined()
    })

    it('uses danger styling for danger variant', () => {
      const { getByText } = render(() => (
        <ChatPrompt config={confirmConfig} onSubmit={() => {}} />
      ))

      const deleteBtn = getByText('Delete')
      expect(deleteBtn.className).toContain('bg-red-600')
    })
  })

  // ─── Form ────────────────────────────────────────────

  describe('type: form', () => {
    const formConfig: ChatPromptConfig = {
      type: 'form',
      title: 'Additional info',
      config: {
        fields: [
          { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Enter title' },
          { name: 'category', label: 'Category', type: 'select', options: [{ label: 'Report', value: 'report' }, { label: 'Invoice', value: 'invoice' }] },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ],
        submitLabel: 'Send',
      },
    }

    it('renders all fields', () => {
      const { getByText, getByPlaceholderText } = render(() => (
        <ChatPrompt config={formConfig} onSubmit={() => {}} />
      ))

      expect(getByText('Title')).toBeDefined()
      expect(getByText('Category')).toBeDefined()
      expect(getByText('Notes')).toBeDefined()
      expect(getByPlaceholderText('Enter title')).toBeDefined()
    })

    it('submit button is disabled when required fields empty', () => {
      const { getByText } = render(() => (
        <ChatPrompt config={formConfig} onSubmit={() => {}} />
      ))

      const submitBtn = getByText('Send')
      expect(submitBtn.hasAttribute('disabled')).toBe(true)
    })

    it('submit button enables when required fields filled', async () => {
      const { getByText, getByPlaceholderText } = render(() => (
        <ChatPrompt config={formConfig} onSubmit={() => {}} />
      ))

      const titleInput = getByPlaceholderText('Enter title')
      fireEvent.input(titleInput, { target: { value: 'My Report' } })

      const submitBtn = getByText('Send')
      expect(submitBtn.hasAttribute('disabled')).toBe(false)
    })

    it('calls onSubmit with form data on submit', async () => {
      const onSubmit = vi.fn()
      const { getByText, getByPlaceholderText } = render(() => (
        <ChatPrompt config={formConfig} onSubmit={onSubmit} />
      ))

      fireEvent.input(getByPlaceholderText('Enter title'), { target: { value: 'Q4 Report' } })
      fireEvent.click(getByText('Send'))

      expect(onSubmit).toHaveBeenCalledWith({
        type: 'form',
        value: { title: 'Q4 Report' },
        label: 'title: Q4 Report',
      })
    })

    it('shows required indicator on required fields', () => {
      const { container } = render(() => (
        <ChatPrompt config={formConfig} onSubmit={() => {}} />
      ))

      const asterisks = container.querySelectorAll('.text-red-500')
      expect(asterisks.length).toBeGreaterThan(0)
    })
  })

  // ─── Dismiss ─────────────────────────────────────────

  describe('dismiss', () => {
    it('calls onSubmit with dismissed:true and onDismiss when X clicked', () => {
      const onSubmit = vi.fn()
      const onDismiss = vi.fn()
      const config: ChatPromptConfig = {
        type: 'choice',
        title: 'Test',
        config: { options: [{ value: 'a', label: 'A' }] },
      }

      const { getByLabelText } = render(() => (
        <ChatPrompt config={config} onSubmit={onSubmit} onDismiss={onDismiss} />
      ))

      fireEvent.click(getByLabelText('Dismiss'))

      expect(onDismiss).toHaveBeenCalled()
      expect(onSubmit).toHaveBeenCalledWith({
        type: 'choice',
        value: '',
        label: '',
        dismissed: true,
      })
    })
  })

  // ─── dismissLabel ────────────────────────────────────

  describe('dismissLabel', () => {
    it('shows X icon by default (no dismissLabel)', () => {
      const config: ChatPromptConfig = {
        type: 'choice',
        title: 'Test',
        config: { options: [{ value: 'a', label: 'A' }] },
      }
      const { getByLabelText } = render(() => (
        <ChatPrompt config={config} onSubmit={() => {}} />
      ))

      expect(getByLabelText('Dismiss')).toBeDefined()
      expect(getByLabelText('Dismiss').querySelector('svg')).not.toBeNull()
    })

    it('shows text button when dismissLabel is provided', () => {
      const config: ChatPromptConfig = {
        type: 'choice',
        title: 'Test',
        config: { options: [{ value: 'a', label: 'A' }] },
      }
      const { getByText, getByLabelText } = render(() => (
        <ChatPrompt config={config} onSubmit={() => {}} dismissLabel="Send as-is" />
      ))

      expect(getByText('Send as-is')).toBeDefined()
      expect(getByLabelText('Send as-is')).toBeDefined()
    })

    it('calls onDismiss + onSubmit when dismissLabel button clicked', () => {
      const onSubmit = vi.fn()
      const onDismiss = vi.fn()
      const config: ChatPromptConfig = {
        type: 'choice',
        title: 'Test',
        config: { options: [{ value: 'a', label: 'A' }] },
      }
      const { getByText } = render(() => (
        <ChatPrompt config={config} onSubmit={onSubmit} onDismiss={onDismiss} dismissLabel="Envoyer directement" />
      ))

      fireEvent.click(getByText('Envoyer directement'))

      expect(onDismiss).toHaveBeenCalled()
      expect(onSubmit).toHaveBeenCalledWith({
        type: 'choice',
        value: '',
        label: '',
        dismissed: true,
      })
    })
  })

  // ─── Null guard (F1) ──────────────────────────────────

  describe('null guard', () => {
    it('does not crash when config is null', () => {
      expect(() => {
        render(() => (
          <ChatPrompt config={null as any} onSubmit={() => {}} />
        ))
      }).not.toThrow()
    })

    it('does not crash when config is undefined', () => {
      expect(() => {
        render(() => (
          <ChatPrompt config={undefined as any} onSubmit={() => {}} />
        ))
      }).not.toThrow()
    })
  })

  // ─── Accessibility ───────────────────────────────────

  describe('accessibility', () => {
    it('has role="dialog" with title as label', () => {
      const config: ChatPromptConfig = {
        type: 'choice',
        title: 'Pick one',
        config: { options: [{ value: 'a', label: 'A' }] },
      }

      const { getByRole } = render(() => (
        <ChatPrompt config={config} onSubmit={() => {}} />
      ))

      const dialog = getByRole('dialog')
      expect(dialog.getAttribute('aria-label')).toBe('Pick one')
    })
  })
})
