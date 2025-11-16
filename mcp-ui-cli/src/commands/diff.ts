/**
 * Diff command - compares two registry versions for breaking changes
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import type { ComponentRegistry } from '@mcp-ui/spec'

interface DiffOptions {
  json?: boolean
  failOnBreaking?: boolean
}

interface ChangeType {
  type: 'added' | 'removed' | 'modified' | 'deprecated'
  breaking: boolean
  componentId: string
  field?: string
  oldValue?: unknown
  newValue?: unknown
  message: string
}

export async function diffCommand(oldFile: string, newFile: string, options: DiffOptions) {
  const spinner = ora('Loading registries...').start()

  try {
    // Read both registry files
    const oldPath = resolve(process.cwd(), oldFile)
    const newPath = resolve(process.cwd(), newFile)

    const oldRegistry: ComponentRegistry = JSON.parse(readFileSync(oldPath, 'utf-8'))
    const newRegistry: ComponentRegistry = JSON.parse(readFileSync(newPath, 'utf-8'))

    spinner.text = 'Comparing registries...'

    const changes: ChangeType[] = []

    // Create maps for easier lookup
    const oldComponents = new Map(oldRegistry.components.map((c) => [c.id, c]))
    const newComponents = new Map(newRegistry.components.map((c) => [c.id, c]))

    // Check for removed components (breaking)
    for (const [id] of oldComponents) {
      if (!newComponents.has(id)) {
        changes.push({
          type: 'removed',
          breaking: true,
          componentId: id,
          message: `Component '${id}' was removed`,
        })
      }
    }

    // Check for added components (non-breaking)
    for (const [id] of newComponents) {
      if (!oldComponents.has(id)) {
        changes.push({
          type: 'added',
          breaking: false,
          componentId: id,
          message: `Component '${id}' was added`,
        })
      }
    }

    // Check for modified components
    for (const [id, newComponent] of newComponents) {
      const oldComponent = oldComponents.get(id)
      if (!oldComponent) continue

      // Check deprecation
      if (!oldComponent.deprecated && newComponent.deprecated) {
        changes.push({
          type: 'deprecated',
          breaking: false,
          componentId: id,
          message: `Component '${id}' was deprecated${
            newComponent.deprecationMessage ? `: ${newComponent.deprecationMessage}` : ''
          }`,
        })
      }

      // Check type change (breaking)
      if (oldComponent.type !== newComponent.type) {
        changes.push({
          type: 'modified',
          breaking: true,
          componentId: id,
          field: 'type',
          oldValue: oldComponent.type,
          newValue: newComponent.type,
          message: `Component '${id}' type changed from '${oldComponent.type}' to '${newComponent.type}'`,
        })
      }

      // Check required fields change (breaking)
      const oldRequired = new Set(oldComponent.schema.required || [])
      const newRequired = new Set(newComponent.schema.required || [])

      for (const field of newRequired) {
        if (!oldRequired.has(field)) {
          changes.push({
            type: 'modified',
            breaking: true,
            componentId: id,
            field: `schema.required`,
            message: `Component '${id}' now requires field '${field}'`,
          })
        }
      }

      for (const field of oldRequired) {
        if (!newRequired.has(field)) {
          changes.push({
            type: 'modified',
            breaking: false,
            componentId: id,
            field: `schema.required`,
            message: `Component '${id}' no longer requires field '${field}'`,
          })
        }
      }

      // Check version change
      if (oldComponent.version !== newComponent.version) {
        const oldVersion = oldComponent.version || '0.0.0'
        const newVersion = newComponent.version || '0.0.0'

        const breaking = isMajorVersionChange(oldVersion, newVersion)

        changes.push({
          type: 'modified',
          breaking,
          componentId: id,
          field: 'version',
          oldValue: oldVersion,
          newValue: newVersion,
          message: `Component '${id}' version changed from ${oldVersion} to ${newVersion}`,
        })
      }
    }

    spinner.stop()

    // Output results
    if (options.json) {
      console.log(JSON.stringify({ changes }, null, 2))
    } else {
      displayHumanReadableDiff(changes)
    }

    // Check if we should fail on breaking changes
    const hasBreakingChanges = changes.some((c) => c.breaking)
    if (options.failOnBreaking && hasBreakingChanges) {
      console.error(chalk.red('\n✗ Breaking changes detected!'))
      process.exit(1)
    }

    process.exit(0)
  } catch (error) {
    spinner.fail('Diff failed')

    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        console.error(chalk.red(`\nFile not found`))
      } else {
        console.error(chalk.red('\nUnexpected error:'))
        console.error(chalk.gray(error.message))
      }
    }

    process.exit(1)
  }
}

function displayHumanReadableDiff(changes: ChangeType[]) {
  console.log(chalk.bold('\nRegistry Changes:\n'))

  if (changes.length === 0) {
    console.log(chalk.gray('No changes detected'))
    return
  }

  const breakingChanges = changes.filter((c) => c.breaking)
  const nonBreakingChanges = changes.filter((c) => !c.breaking)

  if (breakingChanges.length > 0) {
    console.log(chalk.red.bold('Breaking Changes:'))
    for (const change of breakingChanges) {
      const icon = getChangeIcon(change.type)
      console.log(chalk.red(`  ${icon} ${change.message}`))
    }
    console.log('')
  }

  if (nonBreakingChanges.length > 0) {
    console.log(chalk.yellow.bold('Non-Breaking Changes:'))
    for (const change of nonBreakingChanges) {
      const icon = getChangeIcon(change.type)
      console.log(chalk.yellow(`  ${icon} ${change.message}`))
    }
    console.log('')
  }

  // Summary
  console.log(chalk.bold('Summary:'))
  console.log(`  Total changes: ${changes.length}`)
  console.log(
    `  Breaking: ${breakingChanges.length > 0 ? chalk.red(breakingChanges.length) : chalk.green('0')}`
  )
  console.log(`  Non-breaking: ${nonBreakingChanges.length}`)
}

function getChangeIcon(type: ChangeType['type']): string {
  switch (type) {
    case 'added':
      return '+'
    case 'removed':
      return '-'
    case 'modified':
      return '~'
    case 'deprecated':
      return '⚠'
    default:
      return '•'
  }
}

function isMajorVersionChange(oldVersion: string, newVersion: string): boolean {
  const oldMajor = parseInt(oldVersion.split('.')[0], 10)
  const newMajor = parseInt(newVersion.split('.')[0], 10)
  return newMajor > oldMajor
}
