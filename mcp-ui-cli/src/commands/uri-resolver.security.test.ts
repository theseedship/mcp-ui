import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Ajv from 'ajv'
import uriResolver from 'fast-uri'
import { validateCommand } from './validate'
import { testExamplesCommand } from './test-examples'

// Decorate the real parser rather than replacing it. Ajv's CommonJS default
// retains its own resolver, so these identities prove the CLI supplied ours.
vi.mock('fast-uri', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fast-uri')>()
  const parse = vi.fn(actual.parse)
  const serialize = vi.fn(actual.serialize)
  const resolve = vi.fn(actual.resolve)
  const decorated = { ...actual.default, parse, serialize, resolve }
  return { ...actual, parse, serialize, resolve, default: decorated }
})

const EXIT = Symbol('intercepted process.exit')

function expectDirectResolver(compile: ReturnType<typeof vi.spyOn<Ajv, 'compile'>>) {
  expect(compile).toHaveBeenCalledOnce()
  const ajv = compile.mock.contexts[0] as Ajv
  const resolver = ajv.opts.uriResolver

  expect(resolver.parse).toBe(uriResolver.parse)
  expect(resolver.serialize).toBe(uriResolver.serialize)
  expect(resolver.resolve).toBe(uriResolver.resolve)
  // Without an explicit option, Ajv would use its internal default instead.
  expect(resolver.parse).not.toBe(new Ajv().opts.uriResolver.parse)
}

describe('CLI URI resolver security integration', () => {
  let directory: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'mcp-ui-cli-uri-'))
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw EXIT
    })
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

  it('uses the direct resolver when validating a real registry schema', async () => {
    const compile = vi.spyOn(Ajv.prototype, 'compile')
    const file = writeRegistry({
      version: '1.0.0',
      components: [{
        id: 'metric-card',
        type: 'metric',
        name: 'Metric Card',
        schema: { type: 'object', properties: {} },
        examples: [{ name: 'Valid', params: {} }],
      }],
    })

    await expect(validateCommand(file, { strict: true })).rejects.toBe(EXIT)

    expect(process.exit).toHaveBeenCalledWith(0)
    expectDirectResolver(compile)
  })

  it('uses the direct resolver for local $refs and reports invalid example params', async () => {
    const compile = vi.spyOn(Ajv.prototype, 'compile')
    const file = writeRegistry({
      version: '1.0.0',
      components: [{
        id: 'metric-card',
        type: 'metric',
        name: 'Metric Card',
        schema: {
          type: 'object',
          $defs: { value: { type: 'number', minimum: 0 } },
          properties: { value: { $ref: '#/$defs/value' } },
          required: ['value'],
        },
        examples: [
          { name: 'Positive', params: { value: 3 } },
          { name: 'Negative', params: { value: -1 } },
        ],
      }],
    })

    await expect(testExamplesCommand(file, {})).rejects.toBe(EXIT)

    expect(process.exit).toHaveBeenCalledWith(1)
    expectDirectResolver(compile)
    const output = vi.mocked(console.log).mock.calls.flat().join('\n')
    expect(output).toContain('Positive')
    expect(output).toContain('Negative')
    expect(output).toContain('/value: must be >= 0')
    expect(output).toContain('1 passed')
    expect(uriResolver.resolve).toHaveBeenCalled()
  })

  it('keeps a percent-encoded scheme inert (GHSA-w74x-v6f9-j3xg)', () => {
    const input = '%6Aavascript:alert(1)'
    expect(uriResolver.normalize(input)).toBe(input)
    expect(uriResolver.parse(input).error).toBe('URI scheme is malformed.')
    expect(() => uriResolver.resolve('https://safe.example/', input)).toThrow('URI scheme is malformed.')
  })

  it('flags a multiply-delimited authority (GHSA-wjr9-j795-jxcr)', () => {
    expect(uriResolver.parse('http://a@b@evil.example/').error).toBe('URI host is malformed.')
  })

  it('preserves leading parent segments in relative references (GHSA-xhq7-xmqj-769h)', () => {
    const base = 'https://safe.example/dir/doc'
    const relative = '../x'
    expect(uriResolver.normalize(relative)).toBe(relative)
    expect(uriResolver.resolve(base, uriResolver.normalize(relative))).toBe(
      uriResolver.resolve(base, relative)
    )
  })

  it('escapes a first-segment colon in suffix references (GHSA-333x-w4r6-6crp)', () => {
    const output = uriResolver.normalize('javascript:alert(1)', {
      reference: 'suffix',
      scheme: 'x',
    })
    expect(output).toBe('javascript%3Aalert(1)')
    expect(uriResolver.parse(output).scheme).toBeUndefined()
  })
})
