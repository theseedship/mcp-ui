import { flush } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { AutocompleteDropdown } from './AutocompleteDropdown'
import { GhostText, GhostTextInput } from './GhostText'
import { readFileSync } from 'node:fs'

const autocompleteCss = readFileSync('src/styles/autocomplete.css', 'utf8')
const dropdownSource = readFileSync('src/components/AutocompleteDropdown.tsx', 'utf8')

afterEach(cleanup)

describe('autocomplete theme token consumption', () => {
  it('marks the existing dropdown root and keeps host tokens inherited', () => {
    const { container } = render(() => (
      <div style={{ '--mcp-ui-surface': 'rebeccapurple' }}>
        <AutocompleteDropdown options={[]} selectedIndex={-1} isOpen onSelect={() => {}} />
      </div>
    ))
    const dropdown = container.querySelector<HTMLElement>('[role="listbox"]')!
    expect(dropdown.classList.contains('mcp-ui-root')).toBe(true)
    expect(dropdown.style.backgroundColor).toBe('var(--mcp-ui-surface, #ffffff)')
    expect(dropdown.style.getPropertyValue('--mcp-ui-surface')).toBe('')
    expect(dropdown.style.position).toBe('absolute')
    expect(dropdown.style.top).toBe('100%')
  })

  it('retains top placement, selected and disabled behavior with token colors', () => {
    const onSelect = vi.fn()
    const { getByRole, getAllByRole } = render(() => (
      <AutocompleteDropdown
        options={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta', disabled: true },
        ]}
        selectedIndex={0} isOpen position="top" maxHeight="180px" onSelect={onSelect}
      />
    ))
    const dropdown = getByRole('listbox')
    const options = getAllByRole('option')
    expect(dropdown.style.bottom).toBe('100%')
    expect(dropdown.style.maxHeight).toBe('180px')
    expect(options[0].style.backgroundColor).toBe('var(--mcp-ui-accent-soft, #eff6ff)')
    expect(options[0].style.color).toBe('var(--mcp-ui-fg, #374151)')
    expect(options[1].style.color).toBe('var(--mcp-ui-fg-subtle, #9ca3af)')
    fireEvent.click(options[1])
    flush()
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(options[0])
    flush()
    expect(onSelect).toHaveBeenCalledWith({ value: 'a', label: 'Alpha' })
    for (const key of dropdown.querySelectorAll('kbd')) {
      expect(key.style.backgroundColor).toBe('var(--mcp-ui-surface-hover, #e5e7eb)')
    }
  })

  it('keeps loading and empty state fallbacks independently tokenized', () => {
    const loading = render(() => (
      <AutocompleteDropdown options={[]} selectedIndex={-1} isOpen isLoading onSelect={() => {}} />
    ))
    const indicator = loading.container.querySelector<HTMLElement>('.mcp-autocomplete-loading')!
    expect(indicator.style.color).toBe('var(--mcp-ui-fg-muted, #6b7280)')
    // jsdom drops variable-valued border-top-color; the browser suite checks computed colors.
    expect(dropdownSource).toContain("'border-top-color': 'var(--mcp-ui-accent, #3b82f6)'")
    loading.unmount()
    const empty = render(() => (
      <AutocompleteDropdown options={[]} selectedIndex={-1} isOpen onSelect={() => {}} />
    ))
    expect(empty.container.querySelector<HTMLElement>('.mcp-autocomplete-empty')!.style.color)
      .toBe('var(--mcp-ui-fg-subtle, #9ca3af)')
  })

  it('marks ghost roots without introducing wrappers or changing overlay geometry', () => {
    const { container } = render(() => (
      <GhostText inputValue="Al" ghostText="pha" hintText="Accept" isLoading />
    ))
    expect(container.firstElementChild!.classList.contains('mcp-ui-root')).toBe(true)
    const ghost = container.querySelector<HTMLElement>('.mcp-ghost-text')!
    const hint = container.querySelector<HTMLElement>('.mcp-ghost-text-hint')!
    expect(ghost.style.color).toBe('var(--mcp-ui-fg-subtle, #9ca3af)')
    expect(hint.style.backgroundColor).toBe('var(--mcp-ui-surface, rgba(255, 255, 255, 0.9))')
    expect(hint.style.transform).toBe('translateY(-50%)')
    expect(container.querySelector<HTMLElement>('.mcp-ghost-text-overlay')!.style.pointerEvents).toBe('none')
  })

  it('keeps GhostTextInput input behavior and transparency', () => {
    const onInput = vi.fn()
    const { container, getByRole } = render(() => (
      <GhostTextInput value="Al" ghostText="pha" onInput={onInput} />
    ))
    expect(container.firstElementChild!.classList.contains('mcp-ui-root')).toBe(true)
    const input = getByRole('textbox') as HTMLInputElement
    expect(input.style.backgroundColor).toBe('transparent')
    fireEvent.input(input, { target: { value: 'Alpha' } })
    flush()
    expect(onInput).toHaveBeenCalledWith('Alpha')
  })

  it('uses fallback expressions in stylesheet colors without declaring public defaults', () => {
    const colorDeclarations = [...autocompleteCss.matchAll(/^\s*(?:color|background-color|border(?:-(?:color|top))?|outline|box-shadow):\s*(.*);/gm)]
    expect(colorDeclarations.length).toBeGreaterThan(40)
    for (const [, value] of colorDeclarations) {
      expect(value.includes('var(--mcp-ui-') || value === 'transparent').toBe(true)
    }
    expect(autocompleteCss).not.toMatch(/--mcp-ui-[\w-]+\s*:/)
    expect(autocompleteCss).toContain('var(--mcp-ui-accent-soft, #1e3a5f) !important')
    expect(autocompleteCss).toContain('@media (prefers-color-scheme: dark)')
    expect(autocompleteCss).toContain('.dark .mcp-autocomplete-dropdown')
    expect(autocompleteCss).toContain('animation: none !important;')
    expect(autocompleteCss).toContain('transition: none !important;')
  })
})
