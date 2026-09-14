import { createSignal, onCleanup, onMount } from 'solid-js'

/** Stack read-only layouts in narrow containers, including desktop chat panels. */
export function createResponsiveGrid(breakpoint = 640) {
  const [stacked, setStacked] = createSignal(false)
  let container: HTMLElement | undefined

  onMount(() => {
    if (!container) return
    const element = container
    const updateWidth = (width: number) => {
      // Hidden/unmeasured containers retain their last layout until measurable.
      if (Number.isFinite(width) && width > 0) setStacked(width < breakpoint)
    }
    const measure = () => updateWidth(element.getBoundingClientRect().width)
    measure()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === element) updateWidth(entry.contentRect.width)
        }
      })
      observer.observe(element)
      onCleanup(() => observer.disconnect())
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure)
      onCleanup(() => window.removeEventListener('resize', measure))
    }
  })

  return { stacked, ref: (element: HTMLElement) => { container = element } }
}
