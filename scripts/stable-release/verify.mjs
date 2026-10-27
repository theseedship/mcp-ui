#!/usr/bin/env node
/** Offline stable-release policy checks; this module never publishes or calls a registry. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOLID_PACKAGE = '@seed-ship/mcp-ui-solid'
const SPEC_PACKAGE = '@seed-ship/mcp-ui-spec'
const CLI_PACKAGE = '@seed-ship/mcp-ui-cli'
const STABLE_MAJOR = 7

const canonicalStableVersion = value => {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return null
  const parts = value.split('.').map(Number)
  return parts.every(Number.isSafeInteger) ? parts : null
}

function assertStableVersion(manifest, expectedName, label, expectedMajor) {
  assert(manifest && typeof manifest === 'object' && !Array.isArray(manifest), `${label} manifest must be an object`)
  assert.equal(manifest.name, expectedName, `${label} package name mismatch`)
  const parsed = canonicalStableVersion(manifest.version)
  assert(parsed, `${label} version must be canonical stable semver without prerelease or build metadata`)
  if (expectedMajor !== undefined) assert.equal(parsed[0], expectedMajor, `${label} must remain on stable major ${expectedMajor}`)
  return manifest.version
}

const solid2PackageName = name => {
  if (typeof name !== 'string') return false
  return /^solid-js\/(?:web|signals|store|universal|h)$/.test(name) ||
    name === '@solidjs/web' || name === '@solidjs/signals' || name === '@solidjs/compiler' ||
    /^@solidjs\/(?:babel(?:-.+)?|vite-plugin(?:-.+)?)$/.test(name)
}

const solidOneRange = range => typeof range === 'string' &&
  /^(?:\^)?1\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(range)

function assertNoSolid2Dependencies(manifest) {
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const dependencies = manifest[section]
    if (dependencies === undefined) continue
    assert(dependencies && typeof dependencies === 'object' && !Array.isArray(dependencies), `${section} must be an object`)
    for (const [name, range] of Object.entries(dependencies)) {
      const alias = typeof range === 'string' ? /^npm:(@[^/]+\/[^@]+|[^@]+)@(.+)$/.exec(range) : null
      const aliasTarget = alias?.[1] ?? ''
      const validSolidPeer = section === 'peerDependencies' && name === 'solid-js' &&
        /^\^1\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(range)
      const solidCore = name === 'solid-js' || aliasTarget === 'solid-js'
      if (solidCore) {
        const coreRange = name === 'solid-js' ? range : alias?.[2]
        assert(validSolidPeer || solidOneRange(coreRange),
          `Solid 2 runtime/toolchain package is forbidden in ${section}: ${name}`)
      }
      assert(!solid2PackageName(name) && !solid2PackageName(aliasTarget),
        `Solid 2 runtime/toolchain package is forbidden in ${section}: ${name}`)
    }
  }
}

function assertNoSolidOverrides(workspace) {
  if (workspace.pnpm === undefined) return
  assert(workspace.pnpm && typeof workspace.pnpm === 'object' && !Array.isArray(workspace.pnpm),
    'Root pnpm configuration must be an object')
  const overrides = workspace.pnpm.overrides
  if (overrides === undefined) return
  assert(overrides && typeof overrides === 'object' && !Array.isArray(overrides),
    'Root pnpm overrides must be an object')
  for (const [selector, replacement] of Object.entries(overrides)) {
    assert.equal(typeof replacement, 'string', `Root override must be a string: ${selector}`)
    for (const part of selector.split('>')) {
      const name = /^(@[^/\s>]+\/[^@\s>]+|[^@\s>]+)(?:@.*)?$/.exec(part.trim())?.[1]
      assert(name !== 'solid-js' && !solid2PackageName(name),
        `Solid runtime/toolchain override is forbidden: ${selector}`)
    }
  }
  // The dependency scanner also catches npm:solid-js@2 and npm:@solidjs/web aliases under unrelated keys.
  assertNoSolid2Dependencies({ dependencies: overrides })
}

function assertSolidOnePeer(manifest) {
  const peer = manifest.peerDependencies?.['solid-js']
  assert.equal(typeof peer, 'string', 'Solid producer must declare solid-js as a peer dependency')
  const match = /^\^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(peer)
  assert(match && Number(match[1]) === 1 && match.slice(1).every(part => Number.isSafeInteger(Number(part))),
    'solid-js peer must be one canonical caret range within major 1, such as ^1.9.0')
}

/** Validate the three package manifests without requiring them to share release numbers. */
export function validateStableRelease({ solid, spec, cli, workspace }) {
  assertStableVersion(solid, SOLID_PACKAGE, 'Solid', STABLE_MAJOR)
  assertSolidOnePeer(solid)
  assertNoSolid2Dependencies(solid)
  assertStableVersion(spec, SPEC_PACKAGE, 'Spec')
  assertStableVersion(cli, CLI_PACKAGE, 'CLI')
  if (workspace !== undefined) {
    assert(workspace && typeof workspace === 'object' && !Array.isArray(workspace), 'Root workspace manifest must be an object')
    assertNoSolid2Dependencies(workspace)
    assertNoSolidOverrides(workspace)
  }
  return { solid: solid.version, spec: spec.version, cli: cli.version }
}

/** Bind a hosted release run to a reviewed stable package version or main dispatch. */
export function validateReleaseContext({ eventName, ref }, versions) {
  assert(versions && typeof versions === 'object', 'Validated release versions are required')
  if (eventName === 'workflow_dispatch') {
    assert.equal(ref, 'refs/heads/main', 'Manual stable release must dispatch on main')
    return { eventName, ref }
  }
  assert.equal(eventName, 'push', 'Only tag pushes or manual stable dispatch are allowed')
  assert(typeof ref === 'string' && ref.startsWith('refs/tags/v'), 'Stable release push must use a v tag')
  const version = ref.slice('refs/tags/v'.length)
  assert(canonicalStableVersion(version), 'Release tag must be a canonical stable version')
  assert([versions.solid, versions.spec, versions.cli].includes(version),
    'Release tag must match a workspace package version')
  return { eventName, ref, version }
}

async function readManifest(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

export async function verifyWorkspace(root) {
  const base = resolve(root)
  const [solid, spec, cli, workspace] = await Promise.all([
    readManifest(resolve(base, 'mcp-ui-solid/package.json')),
    readManifest(resolve(base, 'mcp-ui-spec/package.json')),
    readManifest(resolve(base, 'mcp-ui-cli/package.json')),
    readManifest(resolve(base, 'package.json')),
  ])
  return validateStableRelease({ solid, spec, cli, workspace })
}

async function main(args) {
  assert(args.length <= 1, 'Usage: node scripts/stable-release/verify.mjs [workspace-root]')
  const root = args[0] ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const versions = await verifyWorkspace(root)
  if (process.env.GITHUB_ACTIONS === 'true') {
    validateReleaseContext({ eventName: process.env.GITHUB_EVENT_NAME, ref: process.env.GITHUB_REF }, versions)
  }
  return versions
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
