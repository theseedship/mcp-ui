#!/usr/bin/env node

/**
 * @mcp-ui/cli
 *
 * Command-line interface for MCP UI component registry operations
 */

import { Command } from 'commander'
import { validateCommand } from './commands/validate.js'
import { generateTypesCommand } from './commands/generate-types.js'
import { testExamplesCommand } from './commands/test-examples.js'
import { diffCommand } from './commands/diff.js'

const program = new Command()

program.name('mcp-ui').description('CLI tools for MCP UI component registries').version('1.0.0')

// Validate command
program
  .command('validate')
  .description('Validate a component registry against the schema')
  .argument('<file>', 'Path to registry JSON file')
  .option('--strict', 'Enable strict validation mode', false)
  .option('--verbose', 'Show detailed validation output', false)
  .action(validateCommand)

// Generate types command
program
  .command('generate-types')
  .description('Generate TypeScript types from a registry')
  .argument('<input>', 'Path to registry JSON file')
  .argument('[output]', 'Output file path (default: stdout)')
  .option('--namespace <name>', 'Wrap types in a namespace')
  .option('--export-all', 'Export all generated types', false)
  .action(generateTypesCommand)

// Test examples command
program
  .command('test-examples')
  .description('Test all examples in a component registry')
  .argument('<file>', 'Path to registry JSON file')
  .option('--component <id>', 'Test only specific component')
  .option('--verbose', 'Show detailed test output', false)
  .action(testExamplesCommand)

// Diff command
program
  .command('diff')
  .description('Compare two registry versions for breaking changes')
  .argument('<old>', 'Path to old registry JSON file')
  .argument('<new>', 'Path to new registry JSON file')
  .option('--json', 'Output diff as JSON', false)
  .option('--fail-on-breaking', 'Exit with error if breaking changes found', false)
  .action(diffCommand)

program.parse()
