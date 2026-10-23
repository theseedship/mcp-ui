#!/usr/bin/env node
/** Offline, fail-closed policy checks. This module never publishes or calls GitHub. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstat, readdir, readFile, mkdir, copyFile, writeFile, realpath } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

export const POLICY = Object.freeze({
  repository: 'theseedship/mcp-ui', sourceBranch: 'feat/solid2-preview', sourcePr: 34,
  packageName: '@seed-ship/mcp-ui-solid', version: '7.0.0-solid2.0', tag: 'solid2',
  artifactName: 'solid2-preview-qualification', workflowPath: '.github/workflows/ci.yml',
})
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const id = value => typeof value === 'string' && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value))
const exactId = (actual, expected) => Number.isSafeInteger(actual) && String(actual) === expected
const solidFilename = `seed-ship-mcp-ui-solid-${POLICY.version}.tgz`
const specFilename = 'seed-ship-mcp-ui-spec-5.7.0.tgz'
const publicEntries = { '.': 'index', './components': 'components', './hooks': 'hooks', './types': 'types',
  './validation': 'validation', './types-only': 'types-export', './adapters': 'adapters',
  './adapters/presentation': 'adapters/presentation', './plugins/duckdb': 'plugins/duckdb', './plugins/katex': 'plugins/katex' }
const optionalPeers = ['@antv/g6', '@duckdb/duckdb-wasm', '@tanstack/virtual-core', 'chart.js', 'chartjs-plugin-zoom', 'highlight.js', 'katex', 'leaflet', 'leaflet.markercluster', 'protomaps-leaflet']
const expectedFiles = new Set(Object.entries(publicEntries).flatMap(([entry, stem]) => {
  const source = ['components', 'hooks', 'types', 'adapters'].includes(stem) ? `${stem}/index` : stem
  return [`./src/${source}.ts`, ...['.d.ts', '.d.cts', '.js', '.cjs'].map(ext => `./dist/${stem}${ext}`),
    `./dist/server/${stem}.js`, `./dist/server/${stem}.cjs`].map(target => `${entry}|${target}`)
}).concat(['|src/index.ts', '|src/components/SafeHtml.tsx']))

export function validateRequest(input) {
  assert(input && typeof input === 'object', 'Request is required')
  assert(sha(input.sourceSha), 'SOURCE_SHA must be a canonical 40-character lowercase SHA')
  assert(digest(input.tarballSha256), 'TARBALL_SHA256 must be a canonical lowercase SHA-256')
  assert(id(input.ciRunId) && id(input.artifactId), 'CI_RUN_ID and ARTIFACT_ID must be positive canonical IDs')
  assert.equal(input.repository, POLICY.repository, 'Only the canonical repository is allowed')
  assert.equal(input.ref, 'refs/heads/main', 'Dispatch must run the reviewed workflow on main')
  assert.equal(input.eventName, 'workflow_dispatch', 'Only manual dispatch is allowed')
  const stage = input.stage ?? false, approval = input.approval ?? ''
  assert.equal(typeof stage, 'boolean', 'Stage must be a boolean')
  assert.equal(typeof approval, 'string', 'Approval must be a string')
  const stageApproval = `STAGE ${POLICY.packageName}@${POLICY.version} FROM ${input.sourceSha} SHA256 ${input.tarballSha256} AS ${POLICY.tag}`
  if (stage) assert.equal(approval, stageApproval, 'Exact staging approval is required')
  return { sourceSha: input.sourceSha, ciRunId: input.ciRunId, artifactId: input.artifactId,
    tarballSha256: input.tarballSha256, repository: input.repository, ref: input.ref, eventName: input.eventName,
    stage, approval, stageApproval }
}

export function validateSource({ run, pull, artifact }, input) {
  const request = validateRequest(input)
  assert(exactId(run?.id, request.ciRunId), 'Unexpected CI run ID')
  assert.equal(run.repository?.full_name, POLICY.repository, 'CI repository mismatch')
  assert.equal(run.head_repository?.full_name, POLICY.repository, 'Fork CI is not allowed')
  assert.equal(run.head_sha, request.sourceSha, 'CI must qualify the exact requested SHA')
  assert.equal(run.head_branch, POLICY.sourceBranch, 'CI source branch mismatch')
  assert.equal(run.event, 'pull_request', 'CI must originate from the preview PR')
  assert.equal(run.path, POLICY.workflowPath, 'Unexpected CI workflow')
  assert.equal(run.status, 'completed', 'CI is not complete')
  assert.equal(run.conclusion, 'success', 'CI did not succeed')
  assert.equal(run.run_attempt, 1, 'Rerun artifacts require a separately reviewed attempt-binding policy')
  assert(Array.isArray(run.pull_requests) && run.pull_requests.some(pr =>
    pr.number === POLICY.sourcePr && pr.head?.sha === request.sourceSha &&
    pr.head?.ref === POLICY.sourceBranch && pr.base?.ref === 'main'), 'CI PR/ref binding mismatch')
  assert.equal(pull?.number, POLICY.sourcePr, 'Unexpected source PR')
  assert.equal(pull.state, 'open', 'Source PR must remain open')
  if (request.stage) assert.equal(pull.draft, false, 'Only an explicitly non-draft source PR can be staged')
  assert.equal(pull.head?.repo?.full_name, POLICY.repository, 'Fork PR is not allowed')
  assert.equal(pull.base?.repo?.full_name, POLICY.repository, 'PR base repository mismatch')
  assert.equal(pull.head?.ref, POLICY.sourceBranch, 'PR branch mismatch')
  assert.equal(pull.head?.sha, request.sourceSha, 'PR advanced beyond the approved source SHA')
  assert.equal(pull.base?.ref, 'main', 'PR must target stable main')
  assert(exactId(artifact?.id, request.artifactId), 'Artifact ID mismatch')
  assert.equal(artifact.name, POLICY.artifactName, 'Unexpected artifact name')
  assert.equal(artifact.expired, false, 'Artifact is expired or expiry is unknown')
  assert(exactId(artifact.workflow_run?.id, request.ciRunId), 'Artifact belongs to another CI run')
  assert.equal(artifact.workflow_run.head_sha, request.sourceSha, 'Artifact source SHA mismatch')
  assert.equal(artifact.workflow_run.head_branch, POLICY.sourceBranch, 'Artifact source branch mismatch')
  const started = Date.parse(run.run_started_at), created = Date.parse(artifact.created_at)
  assert(Number.isFinite(started) && Number.isFinite(created) && created >= started, 'Artifact predates this CI run')
  return request
}

// Parse tar headers without extracting any paths or executing package scripts.
// Reject extension/link records rather than interpreting alternate path metadata.
function tarFiles(bytes) {
  const data = gunzipSync(bytes, { maxOutputLength: 128 * 1024 * 1024 })
  const files = new Map(), names = new Set()
  let offset = 0, terminated = false
  while (offset + 512 <= data.length) {
    const h = data.subarray(offset, offset + 512)
    if (h.every(value => value === 0)) {
      assert(offset + 1024 <= data.length && data.subarray(offset).every(value => value === 0), 'Invalid tar terminator')
      terminated = true; break
    }
    const field = (start, end) => h.subarray(start, end).toString('utf8').replace(/\0.*$/s, '')
    const octal = (start, end) => {
      const value = field(start, end).trim()
      assert(/^[0-7]+$/.test(value), 'Invalid tar numeric field')
      const number = parseInt(value, 8)
      assert(Number.isSafeInteger(number), 'Oversized tar numeric field')
      return number
    }
    const checksum = [...h].reduce((sum, value, index) => sum + (index >= 148 && index < 156 ? 32 : value), 0)
    assert.equal(octal(148, 156), checksum, 'Invalid tar header checksum')
    const prefix = field(345, 500), raw = (prefix ? prefix + '/' : '') + field(0, 100)
    const name = raw.endsWith('/') ? raw.slice(0, -1) : raw
    assert(!isAbsolute(name) && !name.includes('\\') && !name.includes(':') &&
      name.split('/').every(part => part && part !== '.' && part !== '..') &&
      (name === 'package' || name.startsWith('package/')), 'Unsafe tar path')
    assert(!names.has(name), `Duplicate tar path: ${name}`); names.add(name)
    const type = h[156], size = octal(124, 136)
    assert(type === 0 || type === 48 || type === 53, 'Tar links and extension records are not allowed')
    assert.equal(field(157, 257), '', 'Tar link target is not allowed')
    assert(offset + 512 + size <= data.length, 'Truncated tar member')
    if (type === 53) assert.equal(size, 0, 'Directory contains data')
    else files.set(name, data.subarray(offset + 512, offset + 512 + size))
    offset += 512 + Math.ceil(size / 512) * 512
  }
  assert(terminated, 'Tar archive is missing its terminator')
  return files
}

function validateManifest(manifest, files) {
  assert.equal(manifest.name, POLICY.packageName, 'Tarball package name mismatch')
  assert.equal(manifest.version, POLICY.version, 'Tarball version mismatch')
  for (const peer of ['solid-js', '@solidjs/web']) {
    assert.equal(manifest.peerDependencies?.[peer], '2.0.0-rc.18', `Unexpected ${peer} peer`)
    assert.notEqual(manifest.peerDependenciesMeta?.[peer]?.optional, true, 'Solid runtime cannot be optional')
  }
  for (const group of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const value of Object.values(manifest[group] || {})) {
      assert(typeof value === 'string' && !/[:\\/\n\r]/.test(value), 'Dependency protocols and workspace references are forbidden')
    }
  }
  for (const lifecycle of ['preinstall', 'install', 'postinstall', 'prepublish', 'prepublishOnly', 'prepare', 'prepack', 'postpack', 'publish', 'postpublish']) {
    assert(!Object.hasOwn(manifest.scripts || {}, lifecycle), `Untrusted lifecycle script: ${lifecycle}`)
  }
  const config = manifest.publishConfig || {}
  assert(config && typeof config === 'object' && !Array.isArray(config), 'Invalid publishConfig')
  assert(Object.keys(config).every(key => ['registry', 'tag', 'access'].includes(key)), 'Unexpected publishConfig option')
  if (config.registry !== undefined) assert(/^https:\/\/registry\.npmjs\.org\/?$/.test(config.registry), 'Unexpected publishing registry')
  if (config.tag !== undefined) assert.equal(config.tag, POLICY.tag, 'Unexpected publishing tag')
  if (config.access !== undefined) assert.equal(config.access, 'public', 'Unexpected package visibility')
  assert(!files.has('package/.npmrc'), 'Embedded npm configuration is not allowed')
  for (const name of files.keys()) assert(!/(^|\/)(node_modules|tests?|test-support|fixtures?|qualification-results)(\/|$)|\.test\.|\.(log|tgz)$/.test(name), `Unexpected packaged evidence: ${name}`)
}

export async function verifyTarball(file, expectedSha256) {
  assert(digest(expectedSha256), 'Invalid expected tarball SHA-256')
  const stat = await lstat(file)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 64 * 1024 * 1024, 'Tarball must be a bounded regular file')
  const bytes = await readFile(file), sha256 = createHash('sha256').update(bytes).digest('hex')
  assert.equal(sha256, expectedSha256, 'Tarball SHA-256 mismatch')
  const files = tarFiles(bytes)
  assert(files.has('package/package.json'), 'Package manifest is missing')
  const manifest = JSON.parse(files.get('package/package.json').toString('utf8'))
  validateManifest(manifest, files)
  return { name: manifest.name, version: manifest.version, sha256, path: await realpath(file) }
}

async function walk(directory) {
  const stat = await lstat(directory)
  assert(stat.isDirectory() && !stat.isSymbolicLink(), 'Evidence root must be a real directory')
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    assert(!entry.isSymbolicLink(), `Evidence symlink is forbidden: ${path}`)
    if (entry.isDirectory()) files.push(...await walk(path))
    else { assert(entry.isFile(), 'Evidence must contain only regular files'); files.push(path) }
  }
  return files
}
const json = async file => JSON.parse(await readFile(file, 'utf8'))
const empty = (value, message) => assert(Array.isArray(value) && value.length === 0, message)

export async function verifyQualification(directory, sha256) {
  assert(digest(sha256), 'Invalid qualification SHA-256')
  directory = resolve(directory)
  const reports = (await walk(resolve(directory))).filter(file => basename(file) === 'report.json')
  const core = new Map(), compiled = []
  for (const file of reports) {
    if (!file.includes(`${sep}qualification-results${sep}`) && !file.includes(`${sep}dist-client-probe${sep}`)) continue
    const report = await json(file)
    assert.equal(report.status, 'passed', 'Qualification report is not passed')
    const isCore = file.includes(`${sep}qualification-results${sep}`)
    if (isCore) {
      const profile = report.input?.profile
      assert(['full', 'optional-absent'].includes(profile) && !core.has(profile), 'Missing, duplicate or unexpected profile report')
      const consumer = join(directory, `mcpui-solid2-${profile}`)
      assert(file.startsWith(join(consumer, 'qualification-results') + sep), 'Profile evidence is outside its fixed consumer root')
      const input = await json(join(consumer, 'qualification-input.json')), probe = await json(join(consumer, 'import-probe-result.json'))
      assert.deepEqual(report.input, input, 'Profile report does not match preparation input')
      assert((await readFile(join(consumer, 'pnpm-lock.yaml'), 'utf8')).trim().length > 0, 'Consumer lockfile is missing or empty')
      assert.equal(probe.profile, profile, 'Import probe profile mismatch')
      assert.equal(probe.version, POLICY.version, 'Import probe version mismatch')
      assert.equal(probe.status, 'passed', 'Import probe did not pass'); assert.equal(probe.failures, 0, 'Import probe failures')
      const pairs = new Set()
      assert(Array.isArray(probe.entries) && probe.entries.length === 20, 'Twenty import entry/format pairs are required')
      for (const entry of probe.entries) {
        assert(Object.hasOwn(publicEntries, entry.entry) && ['esm', 'cjs'].includes(entry.format), 'Unexpected public import pair')
        pairs.add(`${entry.entry}|${entry.format}`)
        if (profile === 'optional-absent' && entry.entry === './plugins/katex') {
          assert.equal(entry.status, 'expected-missing-optional-peer', 'Missing KaTeX must be explicit')
          assert(['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(entry.code) && /katex/.test(entry.error), 'Unexpected missing-peer error')
        } else assert.equal(entry.status, 'passed', 'Public import failed')
      }
      assert.equal(pairs.size, 20, 'Duplicate public import pair')
      assert(Array.isArray(probe.files) && probe.files.length === 72 && probe.files.every(item => item.exists === true), 'Seventy-two existing export targets are required')
      assert.deepEqual(new Set(probe.files.map(item => `${item.entry ?? ''}|${item.target}`)), expectedFiles, 'Export target evidence mismatch')
      assert(Array.isArray(probe.absentPeers), 'Peer absence evidence is missing')
      assert.deepEqual(probe.absentPeers.map(item => item.peer).sort(), profile === 'full' ? [] : [...optionalPeers].sort(), 'Optional-peer evidence mismatch')
      assert(probe.absentPeers.every(item => item.absent === true && ['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(item.code)), 'Optional peer was not proven absent')
      assert.equal(report.input.tarball?.sha256, sha256, 'Profile qualified another tarball')
      assert.equal(report.version, POLICY.version, 'Profile package version mismatch')
      core.set(profile, file)
    } else {
      assert.equal(report.tarball?.sha256, sha256, 'Compiled probe qualified another tarball')
      assert(file.startsWith(join(directory, 'mcpui-solid2-full', 'dist-client-probe') + sep), 'Compiled evidence must belong to the full consumer')
      assert.deepEqual(report.publicDefaults, Object.fromEntries(Object.entries(publicEntries).map(([entry, stem]) => [entry, `./dist/${stem}.js`])), 'Compiled probe public entries mismatch')
      compiled.push(file)
    }
    for (const mode of ['dev', 'production']) {
      const result = report.modes?.[mode]
      assert.equal(result?.status, 'passed', `Missing or failed ${mode} qualification`)
      empty(result[isCore ? 'errors' : 'pageErrors'], 'Browser errors were recorded')
      empty(result.externalRequests, 'Unexpected browser requests were recorded')
      if (isCore && report.input.profile === 'full') assert.equal(result.engines?.status, 'passed', 'Full engine qualification did not pass')
      if (!isCore) {
        empty(result.diagnostics, 'Compiled browser diagnostics were recorded')
        assert(Array.isArray(result.compiledModules) && result.compiledModules.some(path => path.endsWith('/dist/index.js')) &&
          result.compiledModules.every(path => typeof path === 'string' && !path.includes('/src/') && !path.includes('/dist/server/')), 'Compiled probe did not prove browser distribution files')
      }
    }
  }
  assert(core.has('full') && core.has('optional-absent') && compiled.length === 1, 'Both profiles and exactly one compiled probe are required')
  return { sha256, profiles: Object.fromEntries(core), compiled: compiled[0] }
}

export function assertLatestUnchanged(before, after) {
  assert(before && typeof before.latest === 'string' && /^\d+\.\d+\.\d+$/.test(before.latest), 'A stable latest tag is required')
  assert.equal(after?.latest, before.latest, 'The stable latest tag changed')
  return before.latest
}

function environmentRequest() {
  const e = process.env
  assert(e.STAGE === undefined || ['true', 'false'].includes(e.STAGE), 'STAGE must be true or false')
  return validateRequest({ sourceSha: e.SOURCE_SHA, ciRunId: e.CI_RUN_ID, artifactId: e.ARTIFACT_ID,
    tarballSha256: e.TARBALL_SHA256, repository: e.GITHUB_REPOSITORY, ref: e.GITHUB_REF, eventName: e.GITHUB_EVENT_NAME,
    stage: e.STAGE === 'true', approval: e.STAGE_APPROVAL })
}

async function main([command, first, second, ...extra]) {
  assert(extra.length === 0, 'Unexpected CLI arguments')
  if (command === 'request') {
    assert(!first && !second, 'Usage: verify.mjs request')
    return environmentRequest()
  }
  if (command === 'tarball') {
    assert(first && !second, 'Usage: verify.mjs tarball <file>')
    return verifyTarball(first, environmentRequest().tarballSha256)
  }
  if (command === 'source') {
    assert(first && !second, 'Usage: verify.mjs source <metadata-dir>')
    const files = await walk(resolve(first))
    for (const name of ['run.json', 'pull.json', 'artifact.json']) assert(files.includes(resolve(first, name)), `Missing metadata ${name}`)
    return validateSource({ run: await json(join(first, 'run.json')), pull: await json(join(first, 'pull.json')), artifact: await json(join(first, 'artifact.json')) }, environmentRequest())
  }
  if (command === 'archive') {
    assert(first && second, 'Usage: verify.mjs archive <artifact-dir> <output-dir>')
    const request = environmentRequest(), source = await realpath(first), output = resolve(second)
    assert.equal(source, resolve(first), 'Artifact root cannot resolve through symlinks')
    assert(isAbsolute(second) && output !== source && !source.startsWith(output + sep) && !output.startsWith(source + sep), 'Output must be an independent absolute directory')
    const parent = await realpath(dirname(output))
    assert.equal(parent, dirname(output), 'Output parent cannot resolve through symlinks')
    const files = await walk(source), archives = files.filter(file => file.endsWith('.tgz'))
    assert(archives.every(file => [solidFilename, specFilename].includes(basename(file))), 'Unexpected archive in CI artifact')
    const solid = archives.filter(file => basename(file) === solidFilename)
    assert(solid.length === 1 && archives.filter(file => basename(file) === specFilename).length <= 1, 'Expected one Solid tarball and at most one Spec fixture')
    const verified = await verifyTarball(solid[0], request.tarballSha256)
    const qualification = await verifyQualification(source, verified.sha256)
    await mkdir(output) // No recursive creation and no reuse of an existing delivery directory.
    await copyFile(verified.path, join(output, solidFilename), constants.COPYFILE_EXCL)
    const delivery = { ...request, ...verified, path: join(output, solidFilename), qualification }
    await writeFile(join(output, 'delivery.json'), JSON.stringify(delivery, null, 2) + '\n', { flag: 'wx' })
    return delivery
  }
  if (command === 'latest') {
    assert(first && second, 'Usage: verify.mjs latest <before-json> <after-json>')
    return { latest: assertLatestUnchanged(await json(first), await json(second)) }
  }
  throw Error('Usage: verify.mjs source <metadata-dir> | archive <artifact-dir> <output-dir> | latest <before-json> <after-json>')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message); process.exitCode = 1
  })
}
