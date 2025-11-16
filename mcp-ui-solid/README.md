# @mcp-ui/solid

SolidJS components for rendering MCP-generated UI resources.

## Installation

```bash
pnpm add @mcp-ui/solid
```

## Usage

```tsx
import { UIResourceRenderer, StreamingUIRenderer } from '@mcp-ui/solid'
import { useStreamingUI } from '@mcp-ui/solid/hooks'

// Static rendering
function Dashboard() {
  const layout = {
    id: 'dashboard-1',
    type: 'composite',
    components: [/* ... */]
  }

  return <UIResourceRenderer content={layout} />
}

// Streaming rendering
function StreamingDashboard() {
  return (
    <StreamingUIRenderer
      query="Show me revenue trends"
      spaceIds={['space-1']}
      onComplete={(metadata) => console.log('Done!', metadata)}
    />
  )
}
```

## Features

- 📊 **12-Column Grid Layout**: Responsive Bootstrap-like grid system
- ⚡ **Progressive Streaming**: Components appear as they're generated
- 🎨 **Smooth Animations**: Fade-in effects and skeleton loading states
- 🔒 **Type Safety**: Full TypeScript support
- ✅ **Validation**: Built-in component and layout validation
- 🛡️ **Error Boundaries**: Graceful error handling

## Documentation

See the [full documentation](../../docs/features/generative-ui/) for more details.

## License

MIT
