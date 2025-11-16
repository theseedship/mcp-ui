/**
 * Test Examples command - validates all component examples
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import Ajv from 'ajv'
import chalk from 'chalk'
import ora from 'ora'
import type { ComponentRegistry } from '@mcp-ui/spec'

interface TestExamplesOptions {
  component?: string
  verbose?: boolean
}

interface TestResult {
  componentId: string
  exampleName: string
  passed: boolean
  errors?: string[]
}

export async function testExamplesCommand(file: string, options: TestExamplesOptions) {
  const spinner = ora('Loading registry...').start()

  try {
    // Read registry file
    const registryPath = resolve(process.cwd(), file)
    const registryContent = readFileSync(registryPath, 'utf-8')
    const registry: ComponentRegistry = JSON.parse(registryContent)

    // Filter components if specific component requested
    const componentsToTest = options.component
      ? registry.components.filter((c) => c.id === options.component)
      : registry.components

    if (componentsToTest.length === 0) {
      spinner.fail(`Component not found: ${options.component}`)
      process.exit(1)
    }

    spinner.text = 'Running example tests...'

    const results: TestResult[] = []
    let totalExamples = 0
    let passedExamples = 0

    // Test each component's examples
    for (const component of componentsToTest) {
      spinner.text = `Testing examples for ${component.id}...`

      // Create Ajv validator for this component's schema
      const ajv = new Ajv({ allErrors: true, verbose: options.verbose })
      const validate = ajv.compile(component.schema as any)

      // Test each example
      for (const example of component.examples) {
        totalExamples++

        const valid = validate(example.params)
        const result: TestResult = {
          componentId: component.id,
          exampleName: example.name,
          passed: valid,
        }

        if (!valid && validate.errors) {
          result.errors = validate.errors.map((err) => {
            const path = err.instancePath || 'root'
            return `${path}: ${err.message}`
          })
        }

        if (valid) {
          passedExamples++
        }

        results.push(result)
      }
    }

    spinner.stop()

    // Display results
    console.log(chalk.bold('\nTest Results:\n'))

    let hasFailures = false

    for (const result of results) {
      const status = result.passed ? chalk.green('✓') : chalk.red('✗')
      const componentLabel = chalk.cyan(result.componentId)
      const exampleLabel = chalk.gray(result.exampleName)

      console.log(`${status} ${componentLabel} › ${exampleLabel}`)

      if (!result.passed && result.errors) {
        hasFailures = true
        result.errors.forEach((error) => {
          console.log(chalk.red(`    ${error}`))
        })
      }
    }

    // Summary
    console.log('')
    console.log(chalk.bold('Summary:'))
    console.log(`  ${chalk.green(`${passedExamples} passed`)} / ${totalExamples} total`)

    if (hasFailures) {
      console.log(chalk.red(`  ${totalExamples - passedExamples} failed`))
      process.exit(1)
    }

    console.log(chalk.green('\n✓ All examples are valid!'))
    process.exit(0)
  } catch (error) {
    spinner.fail('Example testing failed')

    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        console.error(chalk.red(`\nFile not found: ${file}`))
      } else if (error instanceof SyntaxError) {
        console.error(chalk.red('\nInvalid JSON syntax'))
        console.error(chalk.gray(error.message))
      } else {
        console.error(chalk.red('\nUnexpected error:'))
        console.error(chalk.gray(error.message))
      }
    }

    process.exit(1)
  }
}
