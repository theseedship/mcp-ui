/** Offline Solid 2 toolchain-cohort guard. Reads manifests and pnpm-lock only. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const solidRoot = resolve(repoRoot, 'mcp-ui-solid')
const cohort = ['solid-js', '@solidjs/web', '@solidjs/signals', '@solidjs/compiler', '@solidjs/babel-plugin']
const rc19 = '2.0.0-rc.19'
const plugin = '@solidjs/vite-plugin'
const pluginVersion = '3.0.0-next.51'
const virtualCore = '@tanstack/virtual-core'
const virtualCoreVersion = '3.13.18'

function packageName(line) {
  const match = line.match(/^\s{6}(?:'([^']+)'|"([^"]+)"|([^:]+)):\s*$/)
  return match?.[1] ?? match?.[2] ?? match?.[3]?.trim()
}

/** Read the small, stable importer subset emitted by pnpm v6 lockfiles. */
function importerEntries(lockText, importer = 'mcp-ui-solid') {
  const lines = lockText.split(/\r?\n/)
  const start = lines.findIndex(line => line === `  ${importer}:`)
  assert.notEqual(start, -1, `pnpm lock importer missing: ${importer}`)
  let end = start + 1
  while (end < lines.length && !/^  [^\s#][^:]*:\s*$/.test(lines[end])) end++
  const result = new Map()
  let group
  for (let index = start + 1; index < end; index++) {
    const line = lines[index]
    const groupMatch = line.match(/^    (dependencies|devDependencies|optionalDependencies|peerDependencies):\s*$/)
    if (groupMatch) { group = groupMatch[1]; continue }
    if (/^    [^\s#][^:]*:\s*$/.test(line)) { group = undefined; continue }
    if (!group) continue
    const name = packageName(line)
    if (!name) continue
    const fields = {}
    for (let fieldIndex = index + 1; fieldIndex < end && /^        /.test(lines[fieldIndex]); fieldIndex++) {
      const field = lines[fieldIndex].match(/^        (specifier|version):\s*(.*?)\s*$/)
      if (field) fields[field[1]] = field[2].replace(/^['"]|['"]$/g, '')
    }
    if (!result.has(group)) result.set(group, new Map())
    result.get(group).set(name, fields)
  }
  return result
}

function allImporterResolutions(importers, name) {
  return [...importers.values()].map(entries => entries.get(name)).filter(Boolean)
}

function resolutionVersion(value) {
  return typeof value === 'string' ? value.split('(')[0] : undefined
}

/** Read package records without interpreting YAML beyond indentation/keys. */
function lockPackageRecords(lockText, name) {
  const lines = lockText.split(/\r?\n/)
  const prefix = `  /${name}@`
  const records = []
  for (let index = 0; index < lines.length; index++) {
    const header = lines[index]
    if (!header.startsWith(prefix) || !header.endsWith(':')) continue
    const version = header.slice(prefix.length, -1).split('(')[0]
    let end = index + 1
    while (end < lines.length && !/^  \/[^\s]+:\s*$/.test(lines[end]) && !/^snapshots:\s*$/.test(lines[end])) end++
    const sections = new Map()
    let section
    for (let cursor = index + 1; cursor < end; cursor++) {
      const line = lines[cursor]
      const sectionMatch = line.match(/^    (dependencies|peerDependencies):\s*$/)
      if (sectionMatch) { section = sectionMatch[1]; sections.set(section, new Map()); continue }
      if (/^    [^\s#][^:]*:\s*$/.test(line)) { section = undefined; continue }
      if (!section) continue
      const nameMatch = line.match(/^      (?:'([^']+)'|"([^"]+)"|([^:]+)):\s*(.*?)\s*$/)
      if (nameMatch) sections.get(section).set(nameMatch[1] ?? nameMatch[2] ?? nameMatch[3].trim(), nameMatch[4].replace(/^['"]|['"]$/g, ''))
    }
    records.push({ version, sections })
  }
  return records
}

function versionsFor(lockText, name) {
  return new Set(lockPackageRecords(lockText, name).map(record => record.version))
}

function hasForcedOverride(object, sought) {
  if (!object || typeof object !== 'object') return false
  for (const [key, value] of Object.entries(object)) {
    if (['overrides', 'resolutions'].includes(key) && value && typeof value === 'object' && Object.hasOwn(value, sought)) return true
    if (key === 'pnpm' && value && typeof value === 'object' && hasForcedOverride({ overrides: value.overrides }, sought)) return true
  }
  return false
}

function lockOverrides(lockText) {
  const lines = lockText.split(/\r?\n/)
  const start = lines.findIndex(line => line === 'overrides:')
  if (start < 0) return new Set()
  const names = new Set()
  for (let index = start + 1; index < lines.length && !/^\S/.test(lines[index]); index++) {
    const match = lines[index].match(/^  (?:'([^']+)'|"([^"]+)"|([^:]+)):\s*/)
    if (match) names.add(match[1] ?? match[2] ?? match[3].trim())
  }
  return names
}

function assertSolid2Cohort({ producer, workspace, lockText }) {
  const peers = producer.peerDependencies ?? {}
  const peerMeta = producer.peerDependenciesMeta ?? {}
  const dev = producer.devDependencies ?? {}
  assert.equal(peers['solid-js'], rc19, 'solid-js must remain a required RC.19 peer')
  assert.equal(peers['@solidjs/web'], rc19, '@solidjs/web must remain a required RC.19 peer')
  for (const name of ['solid-js', '@solidjs/web']) {
    assert.notEqual(peerMeta[name]?.optional, true, `${name} cannot be optional`)
    assert.equal(dev[name], rc19, `${name} dev dependency must match its peer pin`)
  }
  for (const name of ['@solidjs/signals', '@solidjs/compiler', '@solidjs/babel-plugin']) {
    assert.equal(dev[name], rc19, `${name} must use the same RC.19 cohort`)
  }
  assert.equal(dev[plugin], pluginVersion, `${plugin} must stay on the reviewed compatible plugin pin`)

  const deps = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
  for (const group of deps) {
    assert(!Object.hasOwn(producer[group] ?? {}, '@tanstack/solid-virtual'), `Solid 1 adapter is forbidden in ${group}`)
  }
  assert.equal(peers[virtualCore], virtualCoreVersion, 'The Solid 2 virtual-core peer pin must be preserved')
  assert(!hasForcedOverride(producer, '@tanstack/solid-virtual'), 'Solid 1 adapter cannot be forced by producer override')
  assert(!hasForcedOverride(workspace, '@tanstack/solid-virtual'), 'Solid 1 adapter cannot be forced by workspace override')
  assert(!hasForcedOverride(producer, 'seroval') && !hasForcedOverride(producer, 'seroval-plugins'), 'Seroval is renderer-owned; producer overrides are forbidden')
  assert(!hasForcedOverride(workspace, 'seroval') && !hasForcedOverride(workspace, 'seroval-plugins'), 'Workspace cannot force renderer Seroval versions')

  const importers = importerEntries(lockText)
  for (const name of cohort) {
    const locations = allImporterResolutions(importers, name)
    assert(locations.length > 0, `${name} missing from mcp-ui-solid lock importer`)
    assert(locations.every(entry => resolutionVersion(entry.version) === rc19), `${name} importer resolution is outside RC.19`)
    assert.deepEqual(versionsFor(lockText, name), new Set([rc19]), `${name} lock package versions must be one RC.19 cohort`)
  }
  const pluginResolutions = allImporterResolutions(importers, plugin)
  assert(pluginResolutions.length > 0, `${plugin} missing from mcp-ui-solid lock importer`)
  assert(pluginResolutions.every(entry => resolutionVersion(entry.version) === pluginVersion &&
    entry.version.includes(`@solidjs/web@${rc19}`) && entry.version.includes(`solid-js@${rc19}`)), `${plugin} lock resolution must bind to RC.19 runtime peers`)
  assert.deepEqual(versionsFor(lockText, plugin), new Set([pluginVersion]), `${plugin} lock version drifted`)
  const pluginRecords = lockPackageRecords(lockText, plugin)
  assert(pluginRecords.length > 0, `${plugin} package record missing from lock`)
  for (const record of pluginRecords) {
    const resolved = record.sections.get('dependencies')
    for (const name of ['@solidjs/babel-plugin', '@solidjs/compiler', '@solidjs/web', 'solid-js']) {
      assert.equal(resolutionVersion(resolved?.get(name)), rc19, `${plugin} must resolve ${name} from the RC.19 cohort`)
    }
  }
  const virtualResolutions = allImporterResolutions(importers, virtualCore)
  assert(virtualResolutions.length > 0 && virtualResolutions.every(entry => resolutionVersion(entry.version) === virtualCoreVersion), `${virtualCore} lock resolution changed`)
  assert.deepEqual(versionsFor(lockText, virtualCore), new Set([virtualCoreVersion]), `${virtualCore} lock package versions must stay pinned`)
  assert.equal(allImporterResolutions(importers, '@tanstack/solid-virtual').length, 0, 'Solid 1 adapter leaked into pnpm importer')
  assert(!lockOverrides(lockText).has('@tanstack/solid-virtual'), 'Lockfile cannot force the Solid 1 adapter')
  assert(!lockOverrides(lockText).has('seroval') && !lockOverrides(lockText).has('seroval-plugins'), 'Lockfile cannot force Seroval')

  const webRecords = lockPackageRecords(lockText, '@solidjs/web').filter(record => record.version === rc19)
  assert(webRecords.length > 0, '@solidjs/web package record missing from lock')
  for (const web of webRecords) {
    const runtimeDeps = web.sections.get('dependencies')
    assert(runtimeDeps, '@solidjs/web must own its serialization dependencies')
    const serovalResolution = runtimeDeps.get('seroval')
    const pluginsResolution = runtimeDeps.get('seroval-plugins')
    const serovalVersion = resolutionVersion(serovalResolution)
    const pluginsVersion = resolutionVersion(pluginsResolution)
    assert(serovalVersion && pluginsVersion, '@solidjs/web lock record must declare both Seroval packages')
    assert.equal(pluginsVersion, serovalVersion, 'seroval-plugins must resolve against the same seroval version')
    assert(pluginsResolution.includes(`seroval@${serovalVersion}`), 'seroval-plugins lock peer context must match web-owned seroval')
    assert(versionsFor(lockText, 'seroval').has(serovalVersion), 'web-owned seroval package is absent from lock')
    assert(versionsFor(lockText, 'seroval-plugins').has(pluginsVersion), 'web-owned seroval-plugins package is absent from lock')
  }
  return true
}

function syntheticCase() {
  const producer = {
    peerDependencies: { 'solid-js': rc19, '@solidjs/web': rc19, [virtualCore]: virtualCoreVersion },
    devDependencies: { 'solid-js': rc19, '@solidjs/web': rc19, '@solidjs/signals': rc19,
      '@solidjs/compiler': rc19, '@solidjs/babel-plugin': rc19, [plugin]: pluginVersion },
  }
  const workspace = {}
  const entries = [...cohort.map(name => `      '${name}':\n        specifier: ${rc19}\n        version: ${name === '@solidjs/web' ? `${rc19}(solid-js@${rc19})` : rc19}`),
    `      '${plugin}':\n        specifier: ${pluginVersion}\n        version: ${pluginVersion}(@solidjs/web@${rc19})(solid-js@${rc19})(vite@8.3.5)`,
    `      '${virtualCore}':\n        specifier: ${virtualCoreVersion}\n        version: ${virtualCoreVersion}`].join('\n')
  const packages = [...cohort.filter(name => name !== '@solidjs/web').map(name => `  /${name}@${rc19}:\n    resolution: {integrity: fixture}\n`),
    `  /${plugin}@${pluginVersion}(@solidjs/web@${rc19})(solid-js@${rc19})(vite@8.3.5):\n    resolution: {integrity: fixture}\n    dependencies:\n      '@solidjs/babel-plugin': ${rc19}(@babel/core@7.29.7)\n      '@solidjs/compiler': ${rc19}\n      '@solidjs/web': ${rc19}(solid-js@${rc19})\n      solid-js: ${rc19}\n`,
    `  /${virtualCore}@${virtualCoreVersion}:\n    resolution: {integrity: fixture}\n`,
    `  /@solidjs/web@${rc19}(solid-js@${rc19}):\n    resolution: {integrity: fixture}\n    dependencies:\n      seroval: 99.1.0\n      seroval-plugins: 99.1.0(seroval@99.1.0)\n`,
    `  /seroval@99.1.0:\n    resolution: {integrity: fixture}\n`,
    `  /seroval-plugins@99.1.0(seroval@99.1.0):\n    resolution: {integrity: fixture}\n`].join('\n')
  const lockText = `lockfileVersion: '6.0'\n\nimporters:\n  mcp-ui-solid:\n    dependencies:\n${entries}\n\npackages:\n${packages}\nsnapshots:\n`
  return { producer, workspace, lockText }
}

test('current producer and lockfile use one Solid 2 RC.19 cohort and renderer-owned Seroval pair', async () => {
  const [producer, workspace, lockText] = await Promise.all([
    readFile(resolve(solidRoot, 'package.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'package.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'pnpm-lock.yaml'), 'utf8'),
  ])
  assertSolid2Cohort({ producer, workspace, lockText })
})

test('validator accepts a coherent synthetic RC.19 lock and matching renderer-owned pair', () => {
  assert.equal(assertSolid2Cohort(syntheticCase()), true)
})

test('validator rejects an RC.18/RC.19 producer mixture', () => {
  const input = syntheticCase()
  input.producer.devDependencies['@solidjs/compiler'] = '2.0.0-rc.18'
  assert.throws(() => assertSolid2Cohort(input), /same RC\.19 cohort/)
})

test('validator rejects a Solid 1 virtual adapter even when the RC cohort is otherwise coherent', () => {
  const input = syntheticCase()
  input.producer.dependencies = { '@tanstack/solid-virtual': '^3.0.0' }
  assert.throws(() => assertSolid2Cohort(input), /Solid 1 adapter is forbidden/)
})

test('validator rejects an incoherent renderer-owned Seroval pair and forced override', () => {
  const input = syntheticCase()
  input.lockText = input.lockText.replace('seroval-plugins: 99.1.0(seroval@99.1.0)', 'seroval-plugins: 99.2.0(seroval@99.1.0)')
  assert.throws(() => assertSolid2Cohort(input), /same seroval version/)
  const override = syntheticCase()
  override.workspace = { pnpm: { overrides: { seroval: '1.0.0' } } }
  assert.throws(() => assertSolid2Cohort(override), /Workspace cannot force renderer Seroval/)
})
