import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoot, createSignal, type Setter } from 'solid-js'
import { bindPortalTheme, observeTheme, readThemeTokens } from './theme'

const disposers: Array<() => void> = []
const mounts: HTMLElement[] = []

function mount(): HTMLDivElement {
  const node = document.createElement('div')
  document.body.appendChild(node)
  mounts.push(node)
  return node
}

async function flushMutations(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

/**
 * jsdom does not resolve inherited custom properties. This mock models only
 * inline-token inheritance; real computed styles remain a browser-suite concern.
 */
function mockInlineTokenInheritance() {
  return vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const chain: HTMLElement[] = []
    for (let node: Element | null = element; node; node = node.parentElement) {
      if (node instanceof HTMLElement) chain.unshift(node)
    }
    const inherited = document.createElement('div').style
    for (const ancestor of chain) {
      for (let index = 0; index < ancestor.style.length; index++) {
        const name = ancestor.style.item(index)
        if (name.startsWith('--')) inherited.setProperty(name, ancestor.style.getPropertyValue(name))
      }
    }
    return inherited
  })
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  vi.restoreAllMocks()
  for (const node of mounts.splice(0)) node.remove()
})

describe('readThemeTokens', () => {
  it('reads only requested tokens, trims values and leaves blank/missing defaults undefined', () => {
    const element = mount()
    element.style.setProperty('--mcp-ui-surface', '  plum  ')
    element.style.setProperty('--mcp-ui-fg', '   ')
    element.style.setProperty('--unrelated', 'green')
    expect(readThemeTokens(element, ['--mcp-ui-surface', '--mcp-ui-fg', '--mcp-ui-border']))
      .toEqual({ '--mcp-ui-surface': 'plum', '--mcp-ui-fg': undefined, '--mcp-ui-border': undefined })
    expect(readThemeTokens(undefined, ['--mcp-ui-surface']))
      .toEqual({ '--mcp-ui-surface': undefined })
  })

  it('uses the element owner document and does not leak sibling host tokens', () => {
    const computed = mockInlineTokenInheritance()
    const host = mount()
    const sibling = mount()
    const child = document.createElement('div')
    host.appendChild(child)
    host.style.setProperty('--mcp-ui-fg', 'indigo')
    sibling.style.setProperty('--mcp-ui-fg', 'orange')
    expect(readThemeTokens(child, ['--mcp-ui-fg'])).toEqual({ '--mcp-ui-fg': 'indigo' })
    expect(computed).toHaveBeenCalledWith(child)
    expect(readThemeTokens(sibling, ['--mcp-ui-fg'])).toEqual({ '--mcp-ui-fg': 'orange' })
  })
})

describe('observeTheme', () => {
  it('responds to ancestor class, style and data attributes but ignores siblings and descendants', async () => {
    const host = mount()
    const sibling = mount()
    const anchor = document.createElement('div')
    const child = document.createElement('span')
    anchor.appendChild(child)
    host.appendChild(anchor)
    const callback = vi.fn()
    disposers.push(observeTheme(anchor, callback))
    host.classList.add('dark')
    await flushMutations()
    expect(callback).toHaveBeenCalledTimes(1)
    host.style.setProperty('--mcp-ui-surface', 'pink')
    await flushMutations()
    expect(callback).toHaveBeenCalledTimes(2)
    host.dataset.theme = 'custom'
    await flushMutations()
    expect(callback).toHaveBeenCalledTimes(3)
    sibling.dataset.theme = 'unrelated'
    child.className = 'unrelated'
    sibling.appendChild(document.createElement('span'))
    await flushMutations()
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('observes reparenting the anchor into another host', async () => {
    const host = mount()
    const otherHost = mount()
    const anchor = document.createElement('div')
    host.appendChild(anchor)
    const callback = vi.fn()
    disposers.push(observeTheme(anchor, callback))
    otherHost.appendChild(anchor)
    await flushMutations()
    expect(callback).toHaveBeenCalledTimes(1)
    otherHost.dataset.theme = 'new-host'
    await flushMutations()
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('disconnects and suppresses a callback already queued before disposal', async () => {
    const host = mount()
    const anchor = document.createElement('div')
    host.appendChild(anchor)
    const callback = vi.fn()
    const queued: VoidFunction[] = []
    vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((run) => { queued.push(run) })
    const disconnect = vi.spyOn(window.MutationObserver.prototype, 'disconnect')
    const stop = observeTheme(anchor, callback)
    disposers.push(stop)
    host.dataset.theme = 'changed'
    await Promise.resolve()
    expect(queued).toHaveLength(1)
    stop()
    expect(disconnect).toHaveBeenCalledTimes(1)
    for (const run of queued.splice(0)) run()
    host.dataset.theme = 'after-disposal'
    await Promise.resolve()
    expect(queued).toHaveLength(0)
    expect(callback).not.toHaveBeenCalled()
  })
})

describe('bindPortalTheme', () => {
  it('bridges inherited tokens and dark state, updates/removes them, and preserves geometry', async () => {
    mockInlineTokenInheritance()
    const host = mount()
    const anchor = document.createElement('button')
    host.appendChild(anchor)
    host.className = 'dark'
    host.style.setProperty('--mcp-ui-surface', 'plum')
    host.style.setProperty('--mcp-ui-fg', 'indigo')
    host.style.setProperty('--unrelated', 'red')
    const portal = mount()
    portal.className = 'menu'
    Object.assign(portal.style, { position: 'fixed', top: '123px', left: '42px', width: '144px' })
    createRoot((dispose) => {
      disposers.push(dispose)
      bindPortalTheme(portal, () => anchor)
    })
    expect(portal.style.getPropertyValue('--mcp-ui-surface')).toBe('plum')
    expect(portal.style.getPropertyValue('--mcp-ui-fg')).toBe('indigo')
    expect(portal.style.getPropertyValue('--unrelated')).toBe('')
    expect(portal.classList.contains('dark')).toBe(true)
    host.style.setProperty('--mcp-ui-surface', 'tomato')
    host.style.removeProperty('--mcp-ui-fg')
    host.classList.remove('dark')
    await flushMutations()
    expect(portal.style.getPropertyValue('--mcp-ui-surface')).toBe('tomato')
    expect(portal.style.getPropertyValue('--mcp-ui-fg')).toBe('')
    expect(portal.classList.contains('dark')).toBe(false)
    expect(portal.classList.contains('menu')).toBe(true)
    expect([portal.style.position, portal.style.top, portal.style.left, portal.style.width])
      .toEqual(['fixed', '123px', '42px', '144px'])
  })

  it('blocks a portal-parent token reset to an invalid value locally, then clears the blocker', async () => {
    const host = mount()
    const anchor = document.createElement('button')
    host.appendChild(anchor)
    const portal = mount()
    Object.assign(portal.style, { position: 'fixed', top: '123px', left: '42px', width: '144px' })
    // Model browser computed output: the local scope resets this token with
    // `initial`, whose computed value is empty, while body still supplies red.
    // jsdom cannot resolve that custom-property inheritance/reset itself.
    const anchorComputed = document.createElement('div').style
    const parentComputed = document.createElement('div').style
    parentComputed.setProperty('--mcp-ui-surface', 'red')
    const actual = window.getComputedStyle.bind(window)
    const computed = vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      if (element === anchor) return anchorComputed
      if (element === portal.parentElement) return parentComputed
      return actual(element)
    })
    createRoot((dispose) => {
      disposers.push(dispose)
      bindPortalTheme(portal, () => anchor)
    })
    expect(computed).toHaveBeenCalledWith(anchor)
    expect(computed).toHaveBeenCalledWith(portal.parentElement)
    expect(portal.style.getPropertyValue('--mcp-ui-surface')).toBe('initial')
    expect([portal.style.position, portal.style.top, portal.style.left, portal.style.width])
      .toEqual(['fixed', '123px', '42px', '144px'])
    parentComputed.removeProperty('--mcp-ui-surface')
    host.dataset.theme = 'parent-token-removed'
    await flushMutations()
    expect(portal.style.getPropertyValue('--mcp-ui-surface')).toBe('')
    expect([portal.style.position, portal.style.top, portal.style.left, portal.style.width])
      .toEqual(['fixed', '123px', '42px', '144px'])
  })

  it('clears old tokens and dark class on reactive anchor A to B to undefined', () => {
    mockInlineTokenInheritance()
    const hostA = mount()
    const hostB = mount()
    const anchorA = document.createElement('button')
    const anchorB = document.createElement('button')
    hostA.appendChild(anchorA)
    hostB.appendChild(anchorB)
    hostA.className = 'dark'
    hostA.style.setProperty('--mcp-ui-surface', 'plum')
    hostB.style.setProperty('--mcp-ui-fg', 'navy')
    const portal = mount()
    let setAnchor!: Setter<HTMLElement | undefined>
    createRoot((dispose) => {
      disposers.push(dispose)
      const [anchor, update] = createSignal<HTMLElement | undefined>(anchorA)
      setAnchor = update
      bindPortalTheme(portal, anchor)
    })
    expect(portal.style.getPropertyValue('--mcp-ui-surface')).toBe('plum')
    expect(portal.classList.contains('dark')).toBe(true)
    setAnchor(anchorB)
    expect(portal.style.getPropertyValue('--mcp-ui-surface')).toBe('')
    expect(portal.style.getPropertyValue('--mcp-ui-fg')).toBe('navy')
    expect(portal.classList.contains('dark')).toBe(false)
    setAnchor(undefined)
    expect(portal.style.getPropertyValue('--mcp-ui-surface')).toBe('')
    expect(portal.style.getPropertyValue('--mcp-ui-fg')).toBe('')
    expect(portal.classList.contains('dark')).toBe(false)
  })

  it('cleans copied tokens, dark state and observer when its Solid owner is disposed', async () => {
    const computed = mockInlineTokenInheritance()
    const disconnect = vi.spyOn(window.MutationObserver.prototype, 'disconnect')
    const host = mount()
    host.className = 'dark'
    host.style.setProperty('--mcp-ui-surface', 'plum')
    const portal = mount()
    let disposeOwner!: () => void
    createRoot((dispose) => {
      disposeOwner = dispose
      disposers.push(dispose)
      bindPortalTheme(portal, () => host)
    })
    expect(portal.style.getPropertyValue('--mcp-ui-surface')).toBe('plum')
    disposeOwner()
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(portal.style.getPropertyValue('--mcp-ui-surface')).toBe('')
    expect(portal.classList.contains('dark')).toBe(false)
    computed.mockClear()
    host.style.setProperty('--mcp-ui-surface', 'orange')
    await flushMutations()
    expect(computed).not.toHaveBeenCalled()
    expect(portal.style.getPropertyValue('--mcp-ui-surface')).toBe('')
  })
})
