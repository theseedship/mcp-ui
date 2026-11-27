import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import {
  POLICY,
  assertLatestUnchanged,
  validateRequest,
  validateSource,
  verifyQualification,
  verifyTarball,
} from './verify.mjs';

const SOURCE_SHA = '271e92434696f14ba0fdaaa3e91b242819820a16';
const TARBALL_SHA = 'a'.repeat(64);
const OTHER_SHA = 'b'.repeat(64);
const PACKAGE = '@seed-ship/mcp-ui-solid';
const VERSION = '8.0.0-solid2.5';
const SPEC_SHA = 'c'.repeat(64);
const CI_PACK_DIR = '/fixture/mcpui-solid2-artifacts';
const CI_TARBALL = `${CI_PACK_DIR}/seed-ship-mcp-ui-solid-${VERSION}.tgz`;
const CI_SPEC_TARBALL = `${CI_PACK_DIR}/seed-ship-mcp-ui-spec-6.0.0.tgz`;
// Split stable cohort: runtime 2.0.4; compiler/Babel plugin 2.0.3 (no 2.0.4 on npm).
const RUNTIME_PINS = { 'solid-js': '2.0.4', '@solidjs/web': '2.0.4', '@solidjs/signals': '2.0.4' };
const TOOLCHAIN_PINS = { '@solidjs/compiler': '2.0.3', '@solidjs/babel-plugin': '2.0.3', '@solidjs/vite-plugin': '3.0.1' };
const COHORT_PINS = { ...RUNTIME_PINS, ...TOOLCHAIN_PINS };
const MATH_PINS = { ...COHORT_PINS, '@babel/core': '7.29.6', '@types/node': '22.19.11',
  vite: '8.3.5', typescript: '5.9.3' };
const MATH_VERSIONS = ['0.18.4', '0.18.5', 'absent'];
const MATH_ADAPTER_CHECKS = ['inline fraction', 'subscript', 'display fraction', 'matrix',
  'invalid TeX returns null', 'macro scope does not leak', 'recursive macro is bounded',
  'untrusted commands emit no active resource or markup', 'oversized dimensions are clamped'];
const mathProbeChecks = version => version === 'absent'
  ? ['public ESM root', 'public CJS root', 'absent peer: only plugin ESM fails for missing katex',
    'absent peer: only plugin CJS fails for missing katex']
  : ['public ESM root', 'public CJS root', 'public ESM/CJS plugin exports',
    ...['ESM', 'CJS'].flatMap(format => MATH_ADAPTER_CHECKS.map(check => `${format}: ${check}`))];
const mathBrowserChecks = version => ['SSR sentinel preserved across hydration',
  ...(version === 'absent' ? ['root renderer works without KaTeX and leaves source literal'] : [
    'client upgrades text and table to sanitized MathML',
    'malformed TeX, currency, and hostile source remain inert',
    'browser preserves expansion and dimension limits', 'reactive source update and unmount'])];
const PUBLIC_ENTRIES = {
  '.': 'index', './components': 'components', './hooks': 'hooks', './types': 'types',
  './validation': 'validation', './types-only': 'types-export', './adapters': 'adapters',
  './adapters/presentation': 'adapters/presentation', './plugins/duckdb': 'plugins/duckdb', './plugins/katex': 'plugins/katex',
};
const OPTIONAL_PEERS = ['@antv/g6', '@duckdb/duckdb-wasm', '@tanstack/virtual-core', 'chart.js', 'chartjs-plugin-zoom', 'highlight.js', 'katex', 'leaflet', 'leaflet.markercluster', 'protomaps-leaflet'];

function request(overrides = {}) {
  return {
    sourceSha: SOURCE_SHA,
    ciRunId: '123456',
    artifactId: '654321',
    tarballSha256: TARBALL_SHA,
    repository: 'theseedship/mcp-ui',
    ref: 'refs/heads/main',
    eventName: 'workflow_dispatch',
    stage: false,
    approval: '',
    ...overrides,
  };
}

function source() {
  const head = { ref: 'feat/solid2-preview', sha: SOURCE_SHA };
  const repo = { full_name: 'theseedship/mcp-ui' };
  return {
    run: {
      id: 123456,
      head_sha: SOURCE_SHA,
      head_branch: head.ref,
      event: 'pull_request',
      status: 'completed',
      conclusion: 'success',
      run_attempt: 1,
      run_started_at: '2026-10-23T20:00:00Z',
      path: '.github/workflows/ci.yml',
      repository: { ...repo },
      head_repository: { ...repo },
      pull_requests: [{ number: 34, head: { ...head }, base: { ref: 'main' } }],
    },
    pull: {
      number: 34,
      state: 'open',
      draft: false,
      head: { ...head, repo: { ...repo } },
      base: { ref: 'main', repo: { ...repo } },
    },
    artifact: {
      id: 654321,
      name: 'solid2-preview-qualification',
      expired: false,
      created_at: '2026-10-23T20:05:00Z',
      workflow_run: { id: 123456, head_sha: SOURCE_SHA, head_branch: head.ref },
    },
  };
}

function manifest(overrides = {}) {
  return {
    name: PACKAGE,
    version: VERSION,
    type: 'module',
    main: './dist/index.cjs',
    module: './dist/index.js',
    types: './dist/index.d.ts',
    exports: { '.': { solid: './src/index.ts', import: './dist/index.js', require: './dist/index.cjs' } },
    peerDependencies: { 'solid-js': RUNTIME_PINS['solid-js'], '@solidjs/web': RUNTIME_PINS['@solidjs/web'],
      katex: '0.18.4 || 0.18.5' },
    peerDependenciesMeta: { katex: { optional: true } },
    dependencies: { '@seed-ship/mcp-ui-spec': '^6.0.0' },
    ...overrides,
  };
}

// Construct real ustar bytes, including hostile names which tar CLIs may sanitize.
// Nothing from these fixtures is ever extracted or executed.
function tarEntry({ name, body = '', type = '0', link = '' }) {
  const data = Buffer.from(body);
  const header = Buffer.alloc(512);
  header.write(name, 0, 100);
  header.write('0000644\0', 100, 8);
  header.write('0000000\0', 108, 8);
  header.write('0000000\0', 116, 8);
  header.write(`${data.length.toString(8).padStart(11, '0')}\0`, 124, 12);
  header.write('00000000000\0', 136, 12);
  header.fill(32, 148, 156);
  header.write(type, 156, 1);
  header.write(link, 157, 100);
  header.write('ustar\0', 257, 6);
  header.write('00', 263, 2);
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8);
  return Buffer.concat([header, data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
}

async function temp(t) {
  const dir = await mkdtemp(join(tmpdir(), 'mcpui-preview-verify-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function archive(t, { packageJson = manifest(), extra = [] } = {}) {
  const dir = await temp(t);
  const entries = [
    { name: 'package/package.json', body: JSON.stringify(packageJson) },
    { name: 'package/dist/index.js', body: 'export const fixture = true;' },
    { name: 'package/dist/index.cjs', body: 'exports.fixture = true;' },
    { name: 'package/dist/index.d.ts', body: 'export declare const fixture: boolean;' },
    { name: 'package/src/index.ts', body: 'export const fixture = true;' },
    ...extra,
  ];
  const bytes = gzipSync(Buffer.concat([...entries.map(tarEntry), Buffer.alloc(1024)]));
  const file = join(dir, 'preview.tgz');
  await writeFile(file, bytes);
  return { file, sha: createHash('sha256').update(bytes).digest('hex') };
}

function boundaryProof() {
  const userAgent = 'fixture-browser';
  return {
    ssr: { callbackCount: 1, fallbackCount: 1, escaped: true },
    client: { callbacks: [{ type: 'render', componentId: 'packed-client-boundary',
      message: '<mcpui-fixture-client-error>', retryCount: 0, userAgent }], fallbackCount: 1, escaped: true },
    expectedConsoleErrors: [{ componentId: 'packed-client-boundary', componentType: 'text',
      errorMessage: '<mcpui-fixture-client-error>', errorStack: 'Error: <mcpui-fixture-client-error>',
      renderDuration: 1, retryCount: 0, timestamp: '2026-11-18T00:00:00Z', userAgent,
      viewport: { width: 1440, height: 1100 } }],
  };
}

function engineProof(mode) {
  const series = (instanceId, label, values) => ({
    instanceId, labels: [...'ABCDEFGH'].map(letter => 'Synthetic ' + letter),
    datasets: [{ label, values }], barHeights: values.map(value => value * 10),
  });
  const diagram = iframeWidth => ({ labels: ['Synthetic start', 'Synthetic end'], edges: 1, iframeWidth });
  return {
    mode, status: 'passed',
    chartSeriesUpdate: { before: series(1, 'Fixture', [2, 5, 3, 7, 4, 8, 6, 9]),
      after: series(2, 'Updated Fixture', [9, 3, 8, 4, 7, 5, 6, 2]), paintChanged: true },
    mermaid: { version: '12.3.0', inline: diagram(640), expanded: diagram(1100), restored: diagram(640),
      iframeElementStable: true, focusRestored: true, requests: { document: 3, script: 3 } },
  };
}

function mode(profile, name, compiled = false) {
  return {
    mode: name,
    profile,
    status: 'passed',
    errors: [],
    pageErrors: [],
    diagnostics: [],
    console: [],
    externalRequests: [],
    ...(profile === 'full' && !compiled ? { boundary: boundaryProof(), engines: engineProof(name) } : {}),
    ...(compiled ? { compiledModules: ['/fixture/node_modules/@seed-ship/mcp-ui-solid/dist/index.js'] } : {}),
  };
}

function runtimePaths(consumer) {
  return {
    'solid-js': `/fixture/${consumer}/node_modules/.pnpm/solid-js@2.0.4/node_modules/solid-js/dist/solid.cjs`,
    '@solidjs/web': `/fixture/${consumer}/node_modules/.pnpm/@solidjs+web@2.0.4_solid-js@2.0.4/node_modules/@solidjs/web/dist/server.cjs`,
    '@solidjs/signals': `/fixture/${consumer}/node_modules/.pnpm/@solidjs+signals@2.0.4/node_modules/@solidjs/signals/dist/index.cjs`,
  };
}

function serverDiagnostics(profile) {
  const documentRequests = profile === 'full' ? 3 : 2;
  return {
    dev: { documentRequests, expectedContainedErrors: profile === 'full' ? [true, false, false].map(explanationFooter => ({
      code: 'SSR_RENDER_ERROR_CONTAINED',
      message: 'Render error caught by <Errored>: Error: <mcpui-fixture-ssr-error>',
      stack: '<Document> › <App> › <BoundaryProbe> › <GenerativeUIErrorBoundary> › <Errored> › <ThrowingChild>',
      source: 'src/BoundaryProbe.tsx:12:30', explanationFooter,
    })) : [] },
    production: { documentRequests, expectedContainedErrors: [] },
  };
}

function report(profile) {
  return {
    status: 'passed',
    version: VERSION,
    input: { profile, tarball: { path: CI_TARBALL, sha256: TARBALL_SHA },
      spec: { path: CI_SPEC_TARBALL, sha256: SPEC_SHA }, pins: { ...COHORT_PINS } },
    actualPins: { ...COHORT_PINS },
    runtimePaths: runtimePaths(`mcpui-solid2-${profile}`),
    serverDiagnostics: serverDiagnostics(profile),
    modes: { dev: mode(profile, 'dev'), production: mode(profile, 'production') },
  };
}

async function json(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

function probe(profile) {
  return {
    status: 'passed', version: VERSION, profile, failures: 0,
    entries: Object.keys(PUBLIC_ENTRIES).flatMap((entry) => ['esm', 'cjs'].map((format) => ({
      entry, format,
      ...(profile === 'optional-absent' && entry === './plugins/katex'
        ? { status: 'expected-missing-optional-peer', code: 'MODULE_NOT_FOUND', error: 'Cannot find module katex' }
        : { status: 'passed' }),
    }))),
    files: Object.entries(PUBLIC_ENTRIES).flatMap(([entry, stem]) => {
      const source = ['components', 'hooks', 'types', 'adapters'].includes(stem) ? `${stem}/index` : stem;
      return [`./src/${source}.ts`, ...['.d.ts', '.d.cts', '.js', '.cjs'].map((ext) => `./dist/${stem}${ext}`),
        `./dist/server/${stem}.js`, `./dist/server/${stem}.cjs`].map((target) => ({ entry, target, exists: true }));
    }).concat(['src/index.ts', 'src/components/SafeHtml.tsx'].map((target) => ({ target, exists: true }))),
    absentPeers: profile === 'full' ? [] : OPTIONAL_PEERS.map((peer) => ({ peer, absent: true, code: 'MODULE_NOT_FOUND' })),
  };
}

function mathReport(version) {
  const input = { version, tarball: { path: CI_TARBALL, sha256: TARBALL_SHA },
    spec: { path: CI_SPEC_TARBALL, sha256: SPEC_SHA }, pins: { ...MATH_PINS } };
  const mode = name => ({ mode: name, version, browser: 'fixture-chromium', status: 'passed',
    checks: mathBrowserChecks(version), console: [], pageErrors: [], externalRequests: [],
    counts: version === 'absent' ? {} : { total: 6, text: 3, table: 3, block: 1, fraction: 2,
      subscript: 2, matrix: 2, positiveGeometry: 6, annotations: 0, htmlLayout: 0, forbidden: 0 } });
  return { status: 'passed', input, installedVersion: VERSION, peer: '0.18.4 || 0.18.5',
    optional: true, actualPins: { ...MATH_PINS }, pluginKatexVersion: version === 'absent' ? null : version,
    runtimePaths: runtimePaths(`mcpui-katex-${version}`),
    modes: { dev: mode('dev'), production: mode('production') } };
}

function mathProbe(version) {
  return { version, status: 'passed', checks: mathProbeChecks(version) };
}

async function qualification(t, change = () => {}) {
  const dir = await temp(t);
  const evidence = {
    full: report('full'),
    absent: report('optional-absent'),
    compiled: {
      status: 'passed',
      tarball: { sha256: TARBALL_SHA },
      publicDefaults: Object.fromEntries(Object.entries(PUBLIC_ENTRIES).map(([entry, stem]) => [entry, `./dist/${stem}.js`])),
      modes: { dev: mode('full', 'dev', true), production: mode('full', 'production', true) },
    },
    math: Object.fromEntries(MATH_VERSIONS.map(version => [version, mathReport(version)])),
  };
  change(evidence);
  for (const [key, profile] of [['full', 'full'], ['absent', 'optional-absent']]) {
    if (!evidence[key]) continue;
    const consumer = join(dir, `mcpui-solid2-${profile}`);
    const results = join(consumer, 'qualification-results', 'fixture');
    await json(join(results, 'report.json'), evidence[key]);
    for (const mode of ['dev', 'production']) {
      await writeFile(join(results, `${mode}-server.log`), 'Fixture SSR server started\n');
    }
    await json(join(consumer, 'qualification-input.json'), evidence[key].input);
    await json(join(consumer, 'import-probe-result.json'), probe(profile));
    await writeFile(join(consumer, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  }
  if (evidence.compiled) {
    await json(join(dir, 'mcpui-solid2-full', 'dist-client-probe', 'fixture', 'report.json'), evidence.compiled);
  }
  for (const [version, report] of Object.entries(evidence.math)) {
    const consumer = join(dir, `mcpui-katex-${version}`);
    await json(join(consumer, 'qualification-results', 'fixture', 'report.json'), report);
    await json(join(consumer, 'qualification-input.json'), report.input);
    await json(join(consumer, 'import-probe-result.json'), mathProbe(version));
    await writeFile(join(consumer, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  }
  return dir;
}

async function promotionArtifact(t, { includeSpec = true, specVersion = '6.0.0', reportSpecSha,
  includeCli = true, cliVersion = '5.0.2', cliFastUri = '^3.1.9', includeReport = true,
  reportCliSha, extraArchive = false } = {}) {
  const solid = await archive(t);
  const spec = await archive(t, { packageJson: { name: '@seed-ship/mcp-ui-spec', version: specVersion } });
  const cli = await archive(t, { packageJson: { name: '@seed-ship/mcp-ui-cli', version: cliVersion,
    dependencies: { '@seed-ship/mcp-ui-spec': '^6.0.0', 'fast-uri': cliFastUri } } });
  const dir = await qualification(t, (evidence) => {
    for (const profile of ['full', 'absent']) {
      evidence[profile].input.tarball.sha256 = solid.sha;
      evidence[profile].input.spec.sha256 = reportSpecSha ?? spec.sha;
    }
    evidence.compiled.tarball.sha256 = solid.sha;
    for (const report of Object.values(evidence.math)) {
      report.input.tarball.sha256 = solid.sha;
      report.input.spec.sha256 = reportSpecSha ?? spec.sha;
    }
  });
  await writeFile(join(dir, `seed-ship-mcp-ui-solid-${VERSION}.tgz`), await readFile(solid.file));
  if (includeSpec) await writeFile(join(dir, 'seed-ship-mcp-ui-spec-6.0.0.tgz'), await readFile(spec.file));
  if (includeCli) await writeFile(join(dir, 'seed-ship-mcp-ui-cli-5.0.2.tgz'), await readFile(cli.file));
  if (extraArchive) await writeFile(join(dir, 'unreviewed-cli-5.0.2.tgz'), await readFile(cli.file));
  if (includeReport) await json(join(dir, 'mcpui-fast-uri-report.json'), { status: 'passed', failures: [], archives: {
    spec: { sha256: spec.sha, name: '@seed-ship/mcp-ui-spec', version: '6.0.0' },
    cli: { sha256: reportCliSha ?? cli.sha, name: '@seed-ship/mcp-ui-cli', version: '5.0.2' },
  } });
  return { dir, solidSha: solid.sha };
}

test('policy fixes one package, prerelease, source PR and non-latest channel', () => {
  assert.equal(POLICY.repository, 'theseedship/mcp-ui');
  assert.equal(POLICY.sourcePr, 34);
  assert.equal(POLICY.sourceBranch, 'feat/solid2-preview');
  assert.equal(POLICY.packageName, PACKAGE);
  assert.equal(POLICY.version, VERSION);
  assert.equal(POLICY.tag, 'solid2');
  assert.notEqual(POLICY.tag, 'latest');
});

test('accepts a fully pinned main manual request; CLI rejects unsafe input before metadata/API access', () => {
  const result = validateRequest(request());
  for (const [key, expected] of Object.entries(request())) assert.equal(result[key], expected);
  const env = {
    SOURCE_SHA, CI_RUN_ID: '123456', ARTIFACT_ID: '654321', TARBALL_SHA256: TARBALL_SHA,
    GITHUB_REPOSITORY: 'theseedship/mcp-ui', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch',
    STAGE: 'false',
  };
  const cli = (overrides) => spawnSync(process.execPath, [new URL('./verify.mjs', import.meta.url).pathname, 'request'], {
    env: { ...env, ...overrides }, encoding: 'utf8', timeout: 5000,
  });
  const valid = cli({});
  assert.equal(valid.error, undefined);
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).sourceSha, SOURCE_SHA);
  for (const invalid of [{ GITHUB_REF: 'refs/heads/unsafe' }, { STAGE: 'true' }, { STAGE: 'yes' }]) {
    const failed = cli(invalid);
    assert.equal(failed.error, undefined);
    assert.notEqual(failed.status, 0);
  }
});

test('staging requires explicit approval bound to the package, source, bytes and non-latest channel', () => {
  const approval = `STAGE ${PACKAGE}@${VERSION} FROM ${SOURCE_SHA} SHA256 ${TARBALL_SHA} AS solid2`;
  assert.doesNotThrow(() => validateRequest(request({ stage: true, approval })));
  for (const invalid of ['', approval.replace(SOURCE_SHA, 'c'.repeat(40)),
    approval.replace(VERSION, '8.0.0-solid2.0'), approval.replace(VERSION, '8.0.0-solid2.3'), approval.replace(VERSION, '8.0.0-solid2.4'),
    approval.replace('AS solid2', 'AS latest')]) {
    assert.throws(() => validateRequest(request({ stage: true, approval: invalid })));
  }
});

for (const [name, overrides] of [
  ['wrong repository or untrusted fork', { repository: 'attacker/mcp-ui' }],
  ['non-main workflow ref', { ref: 'refs/heads/feat/solid2-preview' }],
  ['automatic or pull-request event', { eventName: 'pull_request' }],
  ['noncanonical source SHA', { sourceSha: '271e924' }],
  ['nonpositive artifact ID', { artifactId: '0' }],
]) {
  test(`request rejects ${name}`, () => assert.throws(() => validateRequest(request(overrides))));
}

test('request rejects malformed artifact digests and CI IDs independently', () => {
  for (const overrides of [{ tarballSha256: 'xyz' }, { ciRunId: '12; echo unsafe' }]) {
    assert.throws(() => validateRequest(request(overrides)));
  }
});

test('binds successful CI, current PR head, first attempt and artifact chronology', () => {
  assert.doesNotThrow(() => validateSource(source(), request()));
  for (const mutate of [
    (s) => { s.run.run_attempt = 2; },
    (s) => { s.artifact.created_at = '2026-10-23T19:00:00Z'; },
    (s) => { s.artifact.workflow_run.head_sha = 'c'.repeat(40); },
  ]) {
    const value = source();
    mutate(value);
    assert.throws(() => validateSource(value, request()));
  }
});

for (const [name, mutate] of [
  ['failed CI', (s) => { s.run.conclusion = 'failure'; }],
  ['another workflow', (s) => { s.run.path = '.github/workflows/release.yml'; }],
  ['forked CI head', (s) => { s.run.head_repository.full_name = 'attacker/mcp-ui'; }],
  ['PR advanced since qualification', (s) => { s.pull.head.sha = 'c'.repeat(40); }],
  ['another PR', (s) => { s.pull.number = 35; }],
  ['expired artifact', (s) => { s.artifact.expired = true; }],
  ['artifact from another run', (s) => { s.artifact.workflow_run.id = 987654; }],
]) {
  test(`source rejects ${name}`, () => {
    const value = source();
    mutate(value);
    assert.throws(() => validateSource(value, request()));
  });
}

test('draft PR is reviewable without staging but cannot be staged', () => {
  const value = source();
  value.pull.draft = true;
  assert.doesNotThrow(() => validateSource(value, request()));
  const staged = request({
    stage: true,
    approval: `STAGE ${PACKAGE}@${VERSION} FROM ${SOURCE_SHA} SHA256 ${TARBALL_SHA} AS solid2`,
  });
  assert.doesNotThrow(() => validateSource(source(), staged));
  assert.throws(() => validateSource(value, staged));
  delete value.pull.draft;
  assert.throws(() => validateSource(value, staged));
});

test('verifies the exact gzip tar bytes and returns the fixed package identity', async (t) => {
  const { file, sha } = await archive(t);
  const result = await verifyTarball(file, sha);
  assert.equal(result.name, PACKAGE);
  assert.equal(result.version, VERSION);
  assert.equal(result.sha256, sha);
});

test('rejects a correctly formed archive with the wrong expected digest', async (t) => {
  const { file } = await archive(t);
  await assert.rejects(() => verifyTarball(file, OTHER_SHA));
});

test('rejects the prior RC.21 preview and non-exact stable runtime peers with correct digests', async (t) => {
  const previous = await archive(t, { packageJson: manifest({
    version: '8.0.0-solid2.3',
    peerDependencies: { ...manifest().peerDependencies, 'solid-js': '2.0.0-rc.21', '@solidjs/web': '2.0.0-rc.21' },
  }) });
  await assert.rejects(() => verifyTarball(previous.file, previous.sha), /Tarball version mismatch/);
  for (const peer of ['solid-js', '@solidjs/web']) {
    for (const version of ['2.0.0-rc.21', '^2.0.0']) {
      const { file, sha } = await archive(t, { packageJson: manifest({
        peerDependencies: { ...manifest().peerDependencies, [peer]: version },
      }) });
      await assert.rejects(() => verifyTarball(file, sha), error => error.message.includes('Unexpected ' + peer + ' peer'));
    }
  }
});

test('rejects the published .4 (exact 2.0.0 cohort) and any non-2.0.4 runtime peer with correct digests', async (t) => {
  const published = await archive(t, { packageJson: manifest({
    version: '8.0.0-solid2.4',
    peerDependencies: { ...manifest().peerDependencies, 'solid-js': '2.0.0', '@solidjs/web': '2.0.0' },
  }) });
  await assert.rejects(() => verifyTarball(published.file, published.sha), /Tarball version mismatch/);
  // The current version with the previous 2.0.0 peers (or a split/ranged runtime) is also a wrong cohort.
  for (const peer of ['solid-js', '@solidjs/web']) {
    for (const version of ['2.0.0', '2.0.3', '^2.0.4', '>=2.0.4', '2.0.5']) {
      const { file, sha } = await archive(t, { packageJson: manifest({
        peerDependencies: { ...manifest().peerDependencies, [peer]: version },
      }) });
      await assert.rejects(() => verifyTarball(file, sha), error => error.message.includes('Unexpected ' + peer + ' peer'));
    }
  }
});

for (const [name, entry] of [
  ['parent traversal', { name: 'package/../../escape', body: 'unsafe' }],
  ['absolute path', { name: '/tmp/escape', body: 'unsafe' }],
  ['duplicate package manifest', { name: 'package/package.json', body: JSON.stringify(manifest({ name: 'attacker' })) }],
]) {
  test(`archive rejects ${name} even when its digest is correct`, async (t) => {
    const { file, sha } = await archive(t, { extra: [entry] });
    await assert.rejects(() => verifyTarball(file, sha));
  });
}

test('archive rejects both symbolic and hard links with correct digests', async (t) => {
  for (const type of ['1', '2']) {
    const { file, sha } = await archive(t, { extra: [{ name: 'package/link', type, link: 'package/package.json' }] });
    await assert.rejects(() => verifyTarball(file, sha));
  }
});

for (const [name, packageJson] of [
  ['wrong package', manifest({ name: '@seed-ship/mcp-ui-spec' })],
  ['stable or different version', manifest({ version: '6.25.1' })],
  ['old Solid2 preview version', manifest({ version: '7.0.0-solid2.0' })],
  ['published Solid2 preview version', manifest({ version: '8.0.0-solid2.0' })],
  ['Solid1 peer', manifest({ peerDependencies: { 'solid-js': '^1.9.0', '@solidjs/web': RUNTIME_PINS['@solidjs/web'] } })],
  ['RC18 peer', manifest({ peerDependencies: { 'solid-js': '2.0.0-rc.18', '@solidjs/web': '2.0.0-rc.18' } })],
  ['old RC19 peers', manifest({ peerDependencies: { 'solid-js': '2.0.0-rc.19', '@solidjs/web': '2.0.0-rc.19' } })],
  ['published .4 2.0.0 peers on the current version', manifest({ peerDependencies: { 'solid-js': '2.0.0', '@solidjs/web': '2.0.0' } })],
  ['mixed 2.0.4 Solid and 2.0.0 Web peers', manifest({ peerDependencies: { 'solid-js': RUNTIME_PINS['solid-js'], '@solidjs/web': '2.0.0' } })],
  ['mixed 2.0.0 Solid and 2.0.4 Web peers', manifest({ peerDependencies: { 'solid-js': '2.0.0', '@solidjs/web': RUNTIME_PINS['@solidjs/web'] } })],
  ['compiler version leaked into runtime peers', manifest({ peerDependencies: { 'solid-js': TOOLCHAIN_PINS['@solidjs/compiler'], '@solidjs/web': TOOLCHAIN_PINS['@solidjs/compiler'] } })],
  ['mixed RC20 and stable peers', manifest({ peerDependencies: { 'solid-js': '2.0.0-rc.20', '@solidjs/web': RUNTIME_PINS['@solidjs/web'] } })],
  ['old KaTeX-only peer', manifest({ peerDependencies: { ...manifest().peerDependencies, katex: '0.18.4' } })],
  ['nonoptional KaTeX peer', manifest({ peerDependenciesMeta: { katex: { optional: false } } })],
  ['old Spec floor', manifest({ dependencies: { '@seed-ship/mcp-ui-spec': '^5.7.0' } })],
  ['workspace runtime dependency', manifest({ dependencies: { '@seed-ship/mcp-ui-spec': 'workspace:^6.0.0' } })],
  ['publishConfig latest override', manifest({ publishConfig: { tag: 'latest' } })],
  ['foreign registry override', manifest({ publishConfig: { registry: 'https://registry.attacker.invalid' } })],
]) {
  test(`manifest rejects ${name}`, async (t) => {
    const { file, sha } = await archive(t, { packageJson });
    await assert.rejects(() => verifyTarball(file, sha));
  });
}

test('requires successful source and compiled-browser qualification of the same archive', async (t) => {
  await verifyQualification(await qualification(t), TARBALL_SHA, SPEC_SHA);
});

for (const profile of ['full', 'optional-absent']) {
  for (const mode of ['dev', 'production']) {
    test(`qualification requires the raw ${profile} ${mode} SSR log beside its report`, async (t) => {
      const dir = await qualification(t);
      const log = join(dir, `mcpui-solid2-${profile}`, 'qualification-results', 'fixture', `${mode}-server.log`);
      await rm(log);
      await assert.rejects(() => verifyQualification(dir, TARBALL_SHA, SPEC_SHA),
        { message: `Missing raw SSR server log for ${profile} ${mode}` });
    });
  }
}

test('qualification rejects an empty raw SSR server log', async (t) => {
  const dir = await qualification(t);
  await writeFile(join(dir, 'mcpui-solid2-full', 'qualification-results', 'fixture', 'dev-server.log'), ' \n');
  await assert.rejects(() => verifyQualification(dir, TARBALL_SHA, SPEC_SHA),
    { message: 'Empty raw SSR server log for full dev' });
});

test('accepts a fourth full dev SSR request only with its exact contained diagnostic', async (t) => {
  const dir = await qualification(t, (e) => {
    const diagnostics = e.full.serverDiagnostics.dev;
    diagnostics.documentRequests = 4;
    diagnostics.expectedContainedErrors.push({ ...diagnostics.expectedContainedErrors.at(-1) });
  });
  await verifyQualification(dir, TARBALL_SHA, SPEC_SHA);
});

for (const [name, options, passes] of [
  ['matching Solid 2.0.4/2.0.3 split cohort, KaTeX matrix, Spec 6 and CLI 5.0.2 fixtures', {}, true],
  ['missing Spec 6 fixture', { includeSpec: false }, false],
  ['Spec fixture with old manifest', { specVersion: '5.7.0' }, false],
  ['Spec fixture hash forged in profile evidence', { reportSpecSha: OTHER_SHA }, false],
  ['missing CLI fixture', { includeCli: false }, false],
  ['CLI fixture with wrong version', { cliVersion: '5.0.1' }, false],
  ['CLI fixture with wrong fast-uri floor', { cliFastUri: '^3.1.8' }, false],
  ['CLI fixture with forged report hash', { reportCliSha: OTHER_SHA }, false],
  ['missing packed CLI security report', { includeReport: false }, false],
  ['unexpected extra archive', { extraArchive: true }, false],
]) {
  test(`archive ${passes ? 'accepts' : 'rejects'} ${name} without executing package code`, async (t) => {
    const { dir, solidSha } = await promotionArtifact(t, options);
    const output = join(await temp(t), 'delivery');
    const result = spawnSync(process.execPath, [new URL('./verify.mjs', import.meta.url).pathname, 'archive', dir, output], {
      env: { ...process.env, SOURCE_SHA, CI_RUN_ID: '123456', ARTIFACT_ID: '654321', TARBALL_SHA256: solidSha,
        GITHUB_REPOSITORY: 'theseedship/mcp-ui', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch', STAGE: 'false' },
      encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status === 0, passes, result.stderr);
    if (passes) {
      const delivery = JSON.parse(await readFile(join(output, 'delivery.json'), 'utf8'));
      assert.equal(delivery.version, VERSION);
      assert.equal(delivery.sha256, solidSha);
      assert.deepEqual((await readdir(output)).sort(), ['delivery.json', `seed-ship-mcp-ui-solid-${VERSION}.tgz`].sort());
    }
  });
}

for (const [name, mutate] of [
  ['missing optional-absent profile', (e) => { delete e.absent; }],
  ['failed production source mode', (e) => { e.full.modes.production.status = 'failed'; }],
  ['source report bound to different archive', (e) => { e.absent.input.tarball.sha256 = OTHER_SHA; }],
  ['published preview version in profile report', (e) => { e.full.version = '8.0.0-solid2.0'; }],
  ['superseded RC21 preview version in profile report', (e) => { e.full.version = '8.0.0-solid2.3'; }],
  ['published .4 version in profile report', (e) => { e.full.version = '8.0.0-solid2.4'; }],
  ['prepared previous 2.0.0 runtime cohort', (e) => { for (const name of Object.keys(RUNTIME_PINS)) e.full.input.pins[name] = '2.0.0'; }],
  ['installed previous 2.0.0 cohort', (e) => { for (const name of Object.keys(COHORT_PINS).filter(n => n !== '@solidjs/vite-plugin')) e.full.actualPins[name] = '2.0.0'; }],
  ['prepared nonexistent compiler 2.0.4', (e) => { e.full.input.pins['@solidjs/compiler'] = '2.0.4'; }],
  ['installed nonexistent compiler 2.0.4', (e) => { e.absent.actualPins['@solidjs/compiler'] = '2.0.4'; }],
  ['prepared nonexistent Babel plugin 2.0.4', (e) => { e.absent.input.pins['@solidjs/babel-plugin'] = '2.0.4'; }],
  ['installed nonexistent Babel plugin 2.0.4', (e) => { e.full.actualPins['@solidjs/babel-plugin'] = '2.0.4'; }],
  ['installed compiler left on 2.0.0', (e) => { e.full.actualPins['@solidjs/compiler'] = '2.0.0'; }],
  ['installed Babel plugin forced to the runtime 2.0.4', (e) => { e.full.actualPins['@solidjs/babel-plugin'] = RUNTIME_PINS['solid-js']; }],
  ['prepared runtime downgraded to the toolchain 2.0.3', (e) => { e.full.input.pins['@solidjs/web'] = '2.0.3'; }],
  ['installed signals left on 2.0.0', (e) => { e.absent.actualPins['@solidjs/signals'] = '2.0.0'; }],
  ['previous 2.0.0 physical Solid slot', (e) => {
    e.full.runtimePaths['solid-js'] = e.full.runtimePaths['solid-js'].replace('solid-js@2.0.4/', 'solid-js@2.0.0/');
  }],
  ['previous 2.0.0 physical signals slot', (e) => {
    e.absent.runtimePaths['@solidjs/signals'] = e.absent.runtimePaths['@solidjs/signals'].replace('signals@2.0.4/', 'signals@2.0.0/');
  }],
  ['previous 2.0.0 physical Web slot', (e) => {
    e.full.runtimePaths['@solidjs/web'] = e.full.runtimePaths['@solidjs/web'].replace('web@2.0.4_solid-js@2.0.4/', 'web@2.0.0_solid-js@2.0.0/');
  }],
  ['physical Web slot on the 2.0.3 toolchain version', (e) => {
    e.full.runtimePaths['@solidjs/web'] = e.full.runtimePaths['@solidjs/web'].replace('web@2.0.4_solid-js@2.0.4/', 'web@2.0.3_solid-js@2.0.3/');
  }],
  ['prepared old RC19 runtime', (e) => { e.full.input.pins['solid-js'] = '2.0.0-rc.19'; }],
  ['installed mixed RC21/stable cohort', (e) => { e.full.actualPins['@solidjs/compiler'] = '2.0.0-rc.21'; }],
  ['superseded RC21 Vite plugin', (e) => { e.full.actualPins['@solidjs/vite-plugin'] = '3.0.0-next.57'; }],
  ['wrong installed plugin', (e) => { e.absent.actualPins['@solidjs/vite-plugin'] = '3.0.0-next.50'; }],
  ['missing installed cohort proof', (e) => { delete e.full.actualPins; }],
  ['missing physical runtime proof', (e) => { delete e.full.runtimePaths; }],
  ['missing optional-absent physical signals path', (e) => { delete e.absent.runtimePaths['@solidjs/signals']; }],
  ['relative physical runtime path', (e) => { e.full.runtimePaths['solid-js'] = 'node_modules/solid-js/dist/solid.cjs'; }],
  ['physical runtime escaped its profile', (e) => { e.full.runtimePaths['@solidjs/web'] = e.absent.runtimePaths['@solidjs/web']; }],
  ['different physical roots with the same profile name', (e) => {
    e.full.runtimePaths['@solidjs/web'] = e.full.runtimePaths['@solidjs/web'].replace('/fixture/', '/other-fixture/');
  }],
  ['all physical paths relocated from the tarball runner root', (e) => {
    for (const [name, path] of Object.entries(e.full.runtimePaths)) {
      e.full.runtimePaths[name] = path.replace('/fixture/', '/other-fixture/');
    }
  }],
  ['one consumer reports a different runner tarball path with the same hash', (e) => {
    e.absent.input.tarball.path = e.absent.input.tarball.path.replace('/fixture/', '/other-fixture/');
    for (const [name, path] of Object.entries(e.absent.runtimePaths)) {
      e.absent.runtimePaths[name] = path.replace('/fixture/', '/other-fixture/');
    }
  }],
  ['tarball path is outside the fixed CI pack directory', (e) => {
    e.full.input.tarball.path = e.full.input.tarball.path.replace('mcpui-solid2-artifacts', 'other-artifacts');
  }],
  ['RC21 physical Solid slot despite a stable manifest claim', (e) => {
    e.full.runtimePaths['solid-js'] = e.full.runtimePaths['solid-js'].replace('solid-js@2.0.4/', 'solid-js@2.0.0-rc.21/');
  }],
  ['RC21 physical signals slot despite a stable manifest claim', (e) => {
    e.absent.runtimePaths['@solidjs/signals'] = e.absent.runtimePaths['@solidjs/signals'].replace('signals@2.0.4/', 'signals@2.0.0-rc.21/');
  }],
  ['stable physical Solid Web with an RC21 Solid peer slot', (e) => {
    e.math['0.18.5'].runtimePaths['@solidjs/web'] =
      e.math['0.18.5'].runtimePaths['@solidjs/web'].replace('_solid-js@2.0.4/', '_solid-js@2.0.0-rc.21/');
  }],
  ['duplicated physical path for different runtime packages', (e) => { e.full.runtimePaths['@solidjs/web'] = e.full.runtimePaths['solid-js']; }],
  ['wrong Spec fixture hash', (e) => { e.full.input.spec.sha256 = OTHER_SHA; }],
  ['missing Spec fixture', (e) => { delete e.absent.input.spec; }],
  ['wrong Spec fixture path', (e) => { e.absent.input.spec.path = '/fixture/seed-ship-mcp-ui-spec-5.7.0.tgz'; }],
  ['missing prepared cohort pin', (e) => { delete e.absent.input.pins['@solidjs/babel-plugin']; }],
  ['missing real engine qualification', (e) => { delete e.full.modes.dev.engines; }],
  ['dev source browser evidence relabeled as production', (e) => { e.full.modes.production.mode = 'dev'; }],
  ['full source browser evidence relabeled as optional-absent', (e) => { e.full.modes.dev.profile = 'optional-absent'; }],
  ['missing production SSR diagnostic evidence', (e) => { delete e.full.serverDiagnostics.production; }],
  ['missing full SSR document request count', (e) => { delete e.full.serverDiagnostics.dev.documentRequests; }],
  ['more SSR document requests than intentional diagnostics', (e) => { e.full.serverDiagnostics.dev.documentRequests = 4; }],
  ['too few production SSR document requests', (e) => { e.full.serverDiagnostics.production.documentRequests = 2; }],
  ['too few optional-absent SSR document requests', (e) => { e.absent.serverDiagnostics.dev.documentRequests = 1; }],
  ['missing intentional SSR containment diagnostic', (e) => { e.full.serverDiagnostics.dev.expectedContainedErrors.pop(); }],
  ['unrelated SSR containment diagnostic', (e) => {
    e.full.serverDiagnostics.dev.expectedContainedErrors[1].message = 'Render error caught by <Errored>: Error: unrelated';
  }],
  ['incorrect SSR diagnostic footer occurrence', (e) => { e.full.serverDiagnostics.dev.expectedContainedErrors[1].explanationFooter = true; }],
  ['unexpected SSR diagnostic source', (e) => { e.full.serverDiagnostics.dev.expectedContainedErrors[0].source = 'src/App.tsx:1:1'; }],
  ['unexpected containment diagnostic in production', (e) => {
    e.full.serverDiagnostics.production.expectedContainedErrors = e.full.serverDiagnostics.dev.expectedContainedErrors;
  }],
  ['unexpected containment diagnostic in optional-absent', (e) => {
    e.absent.serverDiagnostics.dev.expectedContainedErrors = e.full.serverDiagnostics.dev.expectedContainedErrors;
  }],
  ['missing packed SSR boundary callback', (e) => { delete e.full.modes.production.boundary.ssr; }],
  ['duplicated packed SSR boundary callback', (e) => { e.full.modes.dev.boundary.ssr.callbackCount = 2; }],
  ['unescaped packed client boundary fallback', (e) => { e.full.modes.production.boundary.client.escaped = false; }],
  ['missing packed client boundary callback', (e) => { e.full.modes.dev.boundary.client.callbacks = []; }],
  ['unreviewed packed boundary console context', (e) => {
    e.full.modes.production.boundary.expectedConsoleErrors[0].errorMessage = 'unexpected error';
  }],
  ['stale native Chart.js series', (e) => {
    e.full.modes.dev.engines.chartSeriesUpdate.after.datasets = e.full.modes.dev.engines.chartSeriesUpdate.before.datasets;
  }],
  ['unchanged native Chart.js bar geometry', (e) => {
    e.full.modes.production.engines.chartSeriesUpdate.after.barHeights = e.full.modes.production.engines.chartSeriesUpdate.before.barHeights;
  }],
  ['missing updated Chart.js paint', (e) => { e.full.modes.production.engines.chartSeriesUpdate.paintChanged = false; }],
  ['missing restored Mermaid diagram', (e) => { delete e.full.modes.production.engines.mermaid.restored; }],
  ['replaced fullscreen Mermaid iframe', (e) => { e.full.modes.dev.engines.mermaid.iframeElementStable = false; }],
  ['missing local Mermaid script execution', (e) => { e.full.modes.production.engines.mermaid.requests.script = 0; }],
  ['missing compiled-browser report', (e) => { delete e.compiled; }],
  ['compiled-browser diagnostic', (e) => { e.compiled.modes.production.diagnostics = ['STRICT_READ_UNTRACKED']; }],
  ['compiled-browser source substitution', (e) => { e.compiled.modes.dev.compiledModules = ['/fixture/src/index.ts']; }],
  ['missing KaTeX 0.18.5 profile', (e) => { delete e.math['0.18.5']; }],
  ['failed KaTeX production browser', (e) => { e.math['0.18.4'].modes.production.status = 'failed'; }],
  ['KaTeX report bound to another Solid tarball', (e) => { e.math['0.18.5'].input.tarball.sha256 = OTHER_SHA; }],
  ['KaTeX report bound to another Spec fixture', (e) => { e.math.absent.input.spec.sha256 = OTHER_SHA; }],
  ['KaTeX superseded RC21 preview', (e) => { e.math['0.18.4'].installedVersion = '8.0.0-solid2.3'; }],
  ['KaTeX wrong peer range', (e) => { e.math['0.18.5'].peer = '0.18.4'; }],
  ['KaTeX peer not optional', (e) => { e.math.absent.optional = false; }],
  ['KaTeX plugin resolved another version', (e) => { e.math['0.18.4'].pluginKatexVersion = '0.18.5'; }],
  ['KaTeX published .4 version', (e) => { e.math['0.18.5'].installedVersion = '8.0.0-solid2.4'; }],
  ['KaTeX prepared previous 2.0.0 cohort', (e) => { e.math['0.18.4'].input.pins['solid-js'] = '2.0.0'; }],
  ['KaTeX installed previous 2.0.0 cohort', (e) => { e.math.absent.actualPins['@solidjs/web'] = '2.0.0'; }],
  ['KaTeX prepared nonexistent compiler 2.0.4', (e) => { e.math['0.18.4'].input.pins['@solidjs/compiler'] = '2.0.4'; }],
  ['KaTeX installed nonexistent Babel plugin 2.0.4', (e) => { e.math['0.18.5'].actualPins['@solidjs/babel-plugin'] = '2.0.4'; }],
  ['KaTeX previous 2.0.0 physical runtime slot', (e) => {
    e.math['0.18.5'].runtimePaths['@solidjs/signals'] = e.math['0.18.5'].runtimePaths['@solidjs/signals'].replace('signals@2.0.4/', 'signals@2.0.0/');
  }],
  ['KaTeX prepared RC21 cohort', (e) => { e.math['0.18.4'].input.pins['solid-js'] = '2.0.0-rc.21'; }],
  ['KaTeX installed RC21 cohort', (e) => { e.math['0.18.5'].actualPins['@solidjs/compiler'] = '2.0.0-rc.21'; }],
  ['KaTeX missing physical runtime proof', (e) => { delete e.math['0.18.5'].runtimePaths; }],
  ['KaTeX reused another profile runtime', (e) => { e.math.absent.runtimePaths = e.math['0.18.4'].runtimePaths; }],
  ['KaTeX browser warning', (e) => { e.math['0.18.5'].modes.dev.console = [{ type: 'warning', text: 'hydration' }]; }],
  ['KaTeX browser external request', (e) => { e.math.absent.modes.dev.externalRequests = ['https://example.test']; }],
  ['KaTeX missing math geometry', (e) => { e.math['0.18.4'].modes.dev.counts.positiveGeometry = 0; }],
]) {
  test(`qualification rejects ${name}`, async (t) => {
    const dir = await qualification(t, mutate);
    await assert.rejects(() => verifyQualification(dir, TARBALL_SHA, SPEC_SHA));
  });
}

test('qualification rejects duplicate KaTeX profile reports', async (t) => {
  const dir = await qualification(t);
  await json(join(dir, 'mcpui-katex-0.18.4', 'qualification-results', 'duplicate', 'report.json'), mathReport('0.18.4'));
  await assert.rejects(() => verifyQualification(dir, TARBALL_SHA, SPEC_SHA));
});

test('qualification rejects KaTeX evidence outside its fixed consumer root', async (t) => {
  const dir = await qualification(t);
  await json(join(dir, 'mcpui-katex-unreviewed', 'qualification-results', 'fixture', 'report.json'), mathReport('0.18.4'));
  await assert.rejects(() => verifyQualification(dir, TARBALL_SHA, SPEC_SHA));
});

test('qualification rejects unknown report directories instead of ignoring them', async (t) => {
  const dir = await qualification(t);
  await json(join(dir, 'unreviewed', 'report.json'), { status: 'passed' });
  await assert.rejects(() => verifyQualification(dir, TARBALL_SHA, SPEC_SHA));
});

for (const missing of ['qualification-input.json', 'import-probe-result.json', 'pnpm-lock.yaml']) {
  test(`qualification rejects a missing KaTeX ${missing}`, async (t) => {
    const dir = await qualification(t);
    await rm(join(dir, 'mcpui-katex-0.18.5', missing));
    await assert.rejects(() => verifyQualification(dir, TARBALL_SHA, SPEC_SHA));
  });
}

test('qualification rejects a failed KaTeX ESM/CJS import probe', async (t) => {
  const dir = await qualification(t);
  await json(join(dir, 'mcpui-katex-0.18.4', 'import-probe-result.json'), { version: '0.18.4', status: 'failed', checks: [] });
  await assert.rejects(() => verifyQualification(dir, TARBALL_SHA, SPEC_SHA));
});

test('qualification does not follow evidence symlinks outside its directory', async (t) => {
  const dir = await qualification(t);
  await symlink('/etc/passwd', join(dir, 'escaped-report.json'));
  await assert.rejects(() => verifyQualification(dir, TARBALL_SHA, SPEC_SHA));
});

for (const missing of ['qualification-input.json', 'import-probe-result.json', 'pnpm-lock.yaml']) {
  test(`qualification rejects a missing ${missing} even with passed browser reports`, async (t) => {
    const dir = await qualification(t);
    await rm(join(dir, 'mcpui-solid2-full', missing));
    await assert.rejects(() => verifyQualification(dir, TARBALL_SHA, SPEC_SHA));
  });
}

test('compiled proof rejects forged ten-key exports rather than trusting their count', async (t) => {
  const dir = await qualification(t, (e) => {
    delete e.compiled.publicDefaults['./types-only'];
    e.compiled.publicDefaults['./forged-entry'] = './dist/types-export.js';
  });
  await assert.rejects(() => verifyQualification(dir, TARBALL_SHA, SPEC_SHA));
});

for (const newline of ['\n', '\r\n']) {
  test(`preview workflow is manual/main-only and never checks out untrusted source (${newline === '\n' ? 'LF' : 'CRLF'})`, async () => {
    const workflow = (await readFile(new URL('../../.github/workflows/publish-solid2-preview.yml', import.meta.url), 'utf8')).replace(/\r?\n/g, newline);
    const triggerBlock = workflow.match(/^on:\r?\n([\s\S]*?)^permissions:/m)?.[1];
    assert.ok(triggerBlock, 'Explicit workflow triggers are required');
    assert.deepEqual([...triggerBlock.matchAll(/^  ([a-z_]+):/gm)].map((match) => match[1]), ['workflow_dispatch']);
    assert.match(triggerBlock, /stage:\r?\n[\s\S]*?type: boolean\r?\n\s+default: false/);
    const checkouts = workflow.split(/(?=^      - )/m).filter((block) => /uses: actions\/checkout@/.test(block));
    assert.equal(checkouts.length, 2);
    for (const block of checkouts) {
      assert.match(block, /ref: \$\{\{ github\.sha \}\}/);
      assert.match(block, /persist-credentials: false/);
      assert.doesNotMatch(block, /inputs\.source_sha|SOURCE_SHA/);
    }
    assert.equal((workflow.match(/if: .*github\.repository == 'theseedship\/mcp-ui' && github\.ref == 'refs\/heads\/main'/g) || []).length, 2);
    assert.ok(workflow.indexOf('verify.mjs request') < workflow.indexOf('gh api '), 'Validate inputs before constructing API paths');
    assert.doesNotMatch(workflow, /\bnpm publish\b|\bnpm dist-tag\b|\bnpm stage approve\b/);
  });
}

test('only the protected stage step receives the npm token, with fixed bytes/tag and script/config guards', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/publish-solid2-preview.yml', import.meta.url), 'utf8');
  const blocks = workflow.split(/(?=^      - )/m);
  const tokenBlocks = blocks.filter((block) => /NODE_AUTH_TOKEN|secrets\.NPM_TOKEN/.test(block));
  assert.equal(tokenBlocks.length, 1);
  const stage = tokenBlocks[0];
  assert.equal((workflow.match(/^\s+NODE_AUTH_TOKEN:/gm) || []).length, 1);
  assert.equal((workflow.match(/npm stage publish /g) || []).length, 1);
  assert.match(workflow, /environment: npm-solid2-preview/);
  assert.match(workflow, /if: inputs\.stage && github\.repository/);
  assert.match(stage, /working-directory: \$\{\{ runner\.temp \}\}\/solid2-stage-empty/);
  assert.match(stage, /NPM_CONFIG_IGNORE_SCRIPTS: 'true'/);
  assert.match(stage, /NPM_CONFIG_GLOBALCONFIG: \/dev\/null/);
  assert.match(stage, /npm stage publish "\$RUNNER_TEMP\/solid2-reviewed\/seed-ship-mcp-ui-solid-8\.0\.0-solid2\.5\.tgz" --access public --tag solid2 --ignore-scripts --registry=https:\/\/registry\.npmjs\.org --json/);
  assert.match(workflow, /index\("8\.0\.0-solid2\.5"\) == null/);
  assert.doesNotMatch(workflow, /8\.0\.0-solid2\.[0-4]\b/);
  assert.doesNotMatch(stage, /--tag\s+["']?\$|\bnpm (?:install|ci|run|exec)\b|\bpnpm\b/);
  const latestGuard = blocks.find((block) => block.includes('Verify latest even when the staging command failed'));
  assert.ok(latestGuard);
  assert.match(latestGuard, /if: always\(\) && steps\.npm_stage\.outcome != 'skipped'/);
  assert.match(latestGuard, /verify\.mjs latest "\$RUNNER_TEMP\/solid2-stage-before\.json" "\$RUNNER_TEMP\/solid2-stage-after\.json"/);
});

test('CI executes preview guards in a dedicated credential-free job', async () => {
  const ci = await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const guardJob = ci.match(/^  preview-channel-guards:\r?\n([\s\S]*?)(?=^  [a-z][\w-]*:)/m)?.[1];
  assert.ok(guardJob);
  assert.match(guardJob, /run: node --test scripts\/solid2-preview\/verify\.test\.mjs/);
  assert.doesNotMatch(guardJob, /NPM_TOKEN|NODE_AUTH_TOKEN/);
});

test('allows preview tag movement only while latest remains the exact stable version', () => {
  assert.doesNotThrow(() => assertLatestUnchanged({ latest: '6.25.1' }, { latest: '6.25.1', solid2: VERSION }));
  assert.throws(() => assertLatestUnchanged({ latest: '6.25.1' }, { latest: VERSION }));
  assert.throws(() => assertLatestUnchanged({ latest: '6.25.1' }, { latest: '6.25.2' }));
  assert.throws(() => assertLatestUnchanged({}, { solid2: VERSION }));
});
