// Guards the README "solid-compat" matrix and install line against package.json.
// Pure node:test, no dependencies. Run: node --test mcp-ui-solid/tests/solid2/readme-compat.node-test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const START = '<!-- solid-compat:start -->'
const END = '<!-- solid-compat:end -->'
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const count = (text, needle) => text.split(needle).length - 1
const cell = (value) => value.trim().replace(/^`|`$/g, '')

/**
 * Validate a README against a package manifest. Returns a list of problems
 * (empty when consistent). Pure: takes strings/objects, touches no files.
 */
export function checkReadmeCompat(readme, pkg) {
  const errors = []
  const { version } = pkg
  const peers = pkg.peerDependencies ?? {}
  const solid = peers['solid-js']
  const web = peers['@solidjs/web']

  if (count(readme, START) !== 1) errors.push(`expected exactly one ${START}`)
  if (count(readme, END) !== 1) errors.push(`expected exactly one ${END}`)
  if (errors.length) return errors
  const startAt = readme.indexOf(START)
  const endAt = readme.indexOf(END)
  if (startAt > endAt) return [`${END} appears before ${START}`]

  const rows = readme
    .slice(startAt + START.length, endAt)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .map((line) => line.replace(/^\||\|$/g, '').split('|').map(cell))
    .filter((cells) => cells.length === 4 && !/^-+$/.test(cells[0]) && cells[0] !== '@seed-ship/mcp-ui-solid')
    .map(([pkgVersion, tag, solidJs, solidWeb]) => ({ pkgVersion, tag, solidJs, solidWeb }))

  const current = rows.filter((row) => row.pkgVersion === version)
  if (current.length !== 1) {
    errors.push(`expected exactly one matrix row for ${version}, found ${current.length}`)
  } else {
    if (current[0].solidJs !== solid) errors.push(`solid-js cell "${current[0].solidJs}" != peer "${solid}"`)
    if (current[0].solidWeb !== web) errors.push(`@solidjs/web cell "${current[0].solidWeb}" != peer "${web}"`)
  }

  const tagged = rows.filter((row) => row.tag === 'solid2')
  if (tagged.length !== 1) {
    errors.push(`expected exactly one row with dist-tag solid2, found ${tagged.length}`)
  } else if (tagged[0].pkgVersion !== version) {
    errors.push(`solid2 dist-tag row is ${tagged[0].pkgVersion}, expected ${version}`)
  }

  const installs = readme.split('\n').filter((line) => line.startsWith('pnpm add @seed-ship/mcp-ui-solid@'))
  const expected = `pnpm add @seed-ship/mcp-ui-solid@${version} solid-js@${solid} @solidjs/web@${web}`
  if (installs.length === 0) errors.push('no `pnpm add @seed-ship/mcp-ui-solid@...` install line')
  for (const line of installs) {
    if (line.trim() !== expected) errors.push(`install line "${line.trim()}" != "${expected}"`)
  }
  return errors
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const readme = readFileSync(join(root, 'README.md'), 'utf8')

test('README compatibility matrix and install line match package.json', () => {
  assert.deepEqual(checkReadmeCompat(readme, pkg), [])
})

test('negative: stale or mutated README text is rejected', () => {
  const stale = (from, to) => {
    assert.ok(readme.includes(from), `fixture needs "${from}"`)
    return readme.replace(from, to)
  }
  const web = pkg.peerDependencies['@solidjs/web']
  const matches = (errors, re) => assert.ok(errors.some((e) => re.test(e)), `no error matching ${re}: ${errors}`)

  matches(checkReadmeCompat(readme.replace(START, ''), pkg), /exactly one <!-- solid-compat:start/)
  matches(checkReadmeCompat(readme + `\n${END}\n`, pkg), /exactly one <!-- solid-compat:end/)
  matches(
    checkReadmeCompat(stale(`| \`8.0.0-solid2.5\` | \`solid2\` | \`${web}\``, `| \`8.0.0-solid2.5\` | \`solid2\` | \`2.0.0\``), pkg),
    /solid-js cell/,
  )
  matches(checkReadmeCompat(stale(`\`${web}\` |\n<!-- solid-compat:end`, '`2.0.0` |\n<!-- solid-compat:end'), pkg), /@solidjs\/web cell/)
  matches(checkReadmeCompat(stale('| `8.0.0-solid2.5` | `solid2`', '| `8.0.0-solid2.5` | —'), pkg), /dist-tag solid2/)
  matches(checkReadmeCompat(stale('| `8.0.0-solid2.4` | —', '| `8.0.0-solid2.4` | `solid2`'), pkg), /dist-tag solid2/)
  matches(checkReadmeCompat(readme, { ...pkg, version: '8.0.0-solid2.9' }), /exactly one matrix row for 8.0.0-solid2.9/)
  matches(checkReadmeCompat(readme.replace(/^pnpm add @seed-ship\/mcp-ui-solid@\S+/m, 'pnpm add @seed-ship/mcp-ui-solid@8.0.0-solid2.4'), pkg), /install line/)
  matches(checkReadmeCompat(readme.replace(`solid-js@${pkg.peerDependencies['solid-js']} `, 'solid-js@2.0.0 '), pkg), /install line/)
})
