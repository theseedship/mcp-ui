import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Ajv from 'ajv'
import { ComponentRegistrySchema } from '@seed-ship/mcp-ui-spec'
import { validateCommand } from './validate'

// A non-Error sentinel avoids the command's catch block reporting our
// intercepted process.exit as an application failure.
const EXIT = Symbol('intercepted process.exit')

const validRegistry = {
  version: '1.0.0',
  components: [
    {
      id: 'metric-card',
      type: 'metric',
      name: 'Metric Card',
      schema: { type: 'object', properties: {} },
      examples: [{ name: 'Example', params: { title: 'Score', value: 1 } }],
    },
  ],
}

describe('validateCommand with real Zod and Ajv', () => {
  let directory: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'mcp-ui-cli-zod4-'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(directory, { recursive: true, force: true })
  })

  function writeRegistry(registry: unknown): string {
    const file = join(directory, 'registry.json')
    writeFileSync(file, JSON.stringify(registry))
    return file
  }

  it('prints Zod issue paths instead of treating invalid input as an unexpected error', async () => {
    const file = writeRegistry({ ...validRegistry, components: [] })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw EXIT
    })

    await expect(validateCommand(file, {})).rejects.toBe(EXIT)

    const output = errors.mock.calls.flat().join('\n')
    expect(output).toContain('components')
    expect(output).not.toContain('Unexpected error')
    expect(exit.mock.calls[0]?.[0]).toBe(1)
  })

  it('runs the separate JSON Schema/Ajv validation after Zod accepts a registry', async () => {
    const file = writeRegistry(validRegistry)
    const compile = vi.spyOn(Ajv.prototype, 'compile')
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw EXIT
    })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(validateCommand(file, { strict: true })).rejects.toBe(EXIT)

    expect(compile).toHaveBeenCalledOnce()
    expect(exit.mock.calls[0]?.[0]).toBe(0)
    expect(errors.mock.calls.flat().join('\n')).not.toContain('Unexpected error')
  })

  it('reports an Ajv-only hostname violation with its JSON Schema instance path', async () => {
    const registry = {
      ...validRegistry,
      components: [
        { ...validRegistry.components[0], security: { allowedDomains: ['not a hostname!'] } },
      ],
    }
    expect(ComponentRegistrySchema.safeParse(registry).success).toBe(true)

    const file = writeRegistry(registry)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw EXIT
    })

    await expect(validateCommand(file, { strict: true })).rejects.toBe(EXIT)

    expect(exit.mock.calls[0]?.[0]).toBe(1)
    expect(errors.mock.calls.flat().join('\n')).toContain(
      '/components/0/security/allowedDomains/0: must match format "hostname"'
    )
  })
})
