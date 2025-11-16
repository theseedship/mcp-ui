# @mcp-ui/spec

Component registry specification and JSON Schemas for MCP UI.

## Installation

```bash
pnpm add @mcp-ui/spec
```

## Usage

### Import JSON Schema

```typescript
import { registrySchema } from '@mcp-ui/spec/schemas'
import Ajv from 'ajv'

const ajv = new Ajv()
const validate = ajv.compile(registrySchema)

const valid = validate(myRegistry)
if (!valid) {
  console.error(validate.errors)
}
```

### Import Zod Schema

```typescript
import { ComponentRegistrySchema } from '@mcp-ui/spec'

const result = ComponentRegistrySchema.safeParse(myRegistry)
if (!result.success) {
  console.error(result.error)
}
```

## Registry Format

```json
{
  "version": "1.0.0",
  "components": [
    {
      "id": "quickchart-bar",
      "type": "chart",
      "name": "Bar Chart",
      "description": "Renders a bar chart",
      "schema": { /* JSON Schema */ },
      "examples": [ /* Working examples */ ],
      "security": {
        "requiresAuth": true,
        "allowedDomains": ["quickchart.io"]
      },
      "tags": ["chart", "visualization"]
    }
  ]
}
```

## Documentation

See the [full documentation](../../docs/features/generative-ui/) for more details.

## License

MIT
