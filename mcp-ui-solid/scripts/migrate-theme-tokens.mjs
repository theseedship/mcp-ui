/** One-time static class migration; generated utilities remain visible to Tailwind. */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const files = [
  'components/ChatPrompt.tsx', 'components/ScratchpadPanel.tsx',
  'components/UIResourceRenderer.tsx', 'components/FormFieldRenderer.tsx',
  'components/AutocompleteFormField.tsx', 'components/ComponentToolbar.tsx',
  'components/ExpandableWrapper.tsx', 'components/PortalDropdownMenu.tsx',
  'components/MissingValue.tsx', 'components/DegradedFallback.tsx',
  'components/FormRenderer.tsx', 'components/ActionGroupRenderer.tsx',
  'components/ModalRenderer.tsx', 'components/GenerativeUIErrorBoundary.tsx',
  'utils/math-markdown.ts',
]
const requested = process.argv.slice(2)
const targets = requested.length ? requested : files
const permitted = new Set([...files, 'components/ChartJSRenderer.tsx', 'components/GraphRenderer.tsx'])
if (targets.some((file) => !permitted.has(file))) throw new Error('Unsupported migration target')

const gray = { 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712' }
const roles = { blue: 'accent', indigo: 'accent', cyan: 'info', sky: 'info', teal: 'info', green: 'success', emerald: 'success', red: 'danger', rose: 'danger', amber: 'warning', yellow: 'warning', orange: 'warning', purple: 'secondary', violet: 'secondary', pink: 'secondary' }

for (const file of targets) {
  const path = resolve(root, 'src', file)
  const original = readFileSync(path, 'utf8')
  const controls = /FormFieldRenderer|AutocompleteFormField/.test(file)
  const migrated = original.replace(
    /(?<![\w-])((?:[\w-]+:)*)((?:bg|text|border|divide|ring|ring-offset|outline|accent|fill|stroke|placeholder)-(?:white|black|(?:gray|slate|zinc|neutral|stone|blue|indigo|cyan|sky|teal|green|emerald|red|rose|amber|yellow|orange|purple|violet|pink)-\d{2,3})(?:\/\d{1,3})?)(?![\w/-])/g,
    (_match, variants, utility) => {
      const match = /^(ring-offset|bg|text|border|divide|ring|outline|accent|fill|stroke|placeholder)-(white|black|[a-z]+-\d+)(?:\/(\d+))?$/.exec(utility)
      if (!match) return _match
      const [, kind, color, opacity] = match
      const [palette, shadeString] = color.split('-')
      const shade = Number(shadeString)
      const neutral = ['gray', 'slate', 'zinc', 'neutral', 'stone', 'white', 'black'].includes(palette)
      const focus = /(?:^|:)focus(?:-visible|-within)?:/.test(variants)
      const hover = /(?:^|:)(?:group-)?hover:/.test(variants)
      let role
      if (focus && ['ring', 'border', 'outline'].includes(kind)) role = 'focus'
      else if (kind === 'ring-offset') role = 'surface'
      else if (neutral) {
        if (kind === 'bg') {
          role = palette === 'black' && opacity ? 'overlay'
            : hover ? 'surface-hover'
              : color === 'white' || shade >= 800 ? 'surface' : 'surface-muted'
        } else if (['border', 'divide', 'ring', 'outline'].includes(kind)) role = controls ? 'border-control' : 'border'
        else if (color === 'white') role = variants.includes('dark:') ? 'fg' : 'accent-fg'
        else if (variants.includes('placeholder:') || kind === 'placeholder') role = 'fg-subtle'
        else role = shade >= 700 || color === 'black' || variants.includes('dark:') && shade <= 300 ? 'fg'
          : shade === 400 ? 'fg-subtle' : 'fg-muted'
      } else {
        role = roles[palette]
        if (!role) return _match
        if (['border', 'divide'].includes(kind)) role += '-border'
        else if (kind === 'bg') {
          if (shade <= 300 || shade >= 800) role += '-soft'
          else if (hover) role += '-hover'
        }
      }
      let fallback = `var(--color-${color}${palette === 'gray' && gray[shade] ? `,${gray[shade]}` : color === 'white' ? ',#fff' : color === 'black' ? ',#000' : ''})`
      if (opacity) fallback = `color-mix(in_oklab,${fallback}_${opacity}%,transparent)`
      // The fallback is the exact old palette/alpha; a host token replaces the
      // whole paint, not a second opacity multiplier applied to its color.
      return `${variants}${kind}-[color:var(--mcp-ui-${role},${fallback})]`
    },
  ).replace(/(?<![\w-])shadow-(sm|md|lg|xl|2xl)(?![\w-])/g,
    (_match, size) => `shadow-[var(--mcp-ui-shadow,var(--shadow-${size}))]`)
  if (migrated !== original) writeFileSync(path, migrated)
}
