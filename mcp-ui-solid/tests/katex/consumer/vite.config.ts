import { defineConfig } from 'vite'
import solid from '@solidjs/vite-plugin'

export default defineConfig({
  plugins: [solid({ start: { nodeServer: true, middleware: './src/middleware.ts' }, ssr: true })],
  ssr: { noExternal: ['@seed-ship/mcp-ui-solid', '@seed-ship/mcp-ui-spec'] },
  server: { host: '127.0.0.1' },
})
