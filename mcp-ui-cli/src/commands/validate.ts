/**
 * Validate command - validates component registry against JSON Schema
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import Ajv from 'ajv'
import chalk from 'chalk'
import ora from 'ora'
import { ComponentRegistrySchema, type ComponentRegistry } from '@mcp-ui/spec'

// Load JSON Schema from @mcp-ui/spec package
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface ValidateOptions {
  strict?: boolean
  verbose?: boolean
}

export async function validateCommand(file: string, options: ValidateOptions) {
  const spinner = ora('Loading registry...').start()

  try {
    // Read registry file
    const registryPath = resolve(process.cwd(), file)
    const registryContent = readFileSync(registryPath, 'utf-8')
    const registry = JSON.parse(registryContent)

    spinner.text = 'Validating with Zod schema...'

    // First validate with Zod (runtime validation)
    const zodResult = ComponentRegistrySchema.safeParse(registry)

    if (!zodResult.success) {
      spinner.fail('Zod validation failed')
      console.error(chalk.red('\nValidation Errors:'))
      zodResult.error.errors.forEach((err) => {
        console.error(chalk.red(`  • ${err.path.join('.')}: ${err.message}`))
      })
      process.exit(1)
    }

    spinner.text = 'Validating with JSON Schema...'

    // Load JSON Schema for secondary validation
    const schemaPath = join(
      __dirname,
      '../../node_modules/@mcp-ui/spec/schemas/component-registry-v1.json'
    )
    let jsonSchemaContent: string

    try {
      jsonSchemaContent = readFileSync(schemaPath, 'utf-8')
    } catch {
      // Fallback to local schema if node_modules path fails
      const localSchemaPath = join(
        __dirname,
        '../../../mcp-ui-spec/schemas/component-registry-v1.json'
      )
      jsonSchemaContent = readFileSync(localSchemaPath, 'utf-8')
    }

    const jsonSchema = JSON.parse(jsonSchemaContent)

    // Validate with JSON Schema using Ajv
    const ajv = new Ajv({
      allErrors: options.strict,
      verbose: options.verbose,
      strict: options.strict,
    })

    const validate = ajv.compile(jsonSchema)
    const jsonValid = validate(registry)

    if (!jsonValid && validate.errors) {
      spinner.fail('JSON Schema validation failed')
      console.error(chalk.red('\nValidation Errors:'))
      validate.errors.forEach((err) => {
        const path = err.instancePath || 'root'
        console.error(chalk.red(`  • ${path}: ${err.message}`))
        if (options.verbose && err.params) {
          console.error(chalk.gray(`    Params: ${JSON.stringify(err.params)}`))
        }
      })
      process.exit(1)
    }

    spinner.succeed(chalk.green('Registry is valid!'))

    // Summary
    if (options.verbose) {
      console.log(chalk.gray('\nRegistry Summary:'))
      console.log(chalk.gray(`  Version: ${registry.version}`))
      console.log(chalk.gray(`  Components: ${registry.components.length}`))

      if (registry.metadata?.name) {
        console.log(chalk.gray(`  Name: ${registry.metadata.name}`))
      }

      console.log(chalk.gray('\nComponents:'))
      const validRegistry = registry as ComponentRegistry
      validRegistry.components.forEach((comp) => {
        console.log(chalk.gray(`  • ${comp.id} (${comp.type}): ${comp.examples.length} example(s)`))
      })
    }

    process.exit(0)
  } catch (error) {
    spinner.fail('Validation failed')

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
