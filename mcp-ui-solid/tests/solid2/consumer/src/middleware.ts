/** Local synthetic endpoint: never forwards accounts, prompts, or network data. */
const stats = { requests: 0, active: 0, cancelled: 0, completed: 0, errors: 0 }
const encoder = new TextEncoder()
const component = (index: number) => ({
  id: `stream-item-${index}`, type: 'text', position: { colStart: 1, colSpan: 12 },
  params: { content: `Stream fragment ${index}`, markdown: false },
})

export default async function middleware(event: { request: Request }, next: () => Promise<Response>) {
  const request = event.request
  const path = new URL(request.url).pathname
  if (path === '/__fixture/stats') return Response.json(stats)
  if (path !== '/api/mcp/generative-ui-stream') return next()
  if (request.method !== 'POST') return new Response('POST required', { status: 405 })
  const { query } = await request.json()
  stats.requests++; stats.active++
  let finished = false
  const timers: ReturnType<typeof setTimeout>[] = []
  const finish = (cancelled: boolean) => {
    if (finished) return
    finished = true; timers.forEach(clearTimeout); stats.active--
    if (cancelled) stats.cancelled++; else stats.completed++
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (!finished) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      const sendComponent = (index: number) => send('component', { componentId: `stream-item-${index}`,
        sequenceId: index, component: component(index), position: { colStart: 1, colSpan: 12 } })
      timers.push(setTimeout(() => sendComponent(0), 30))
      if (query === 'error') {
        timers.push(setTimeout(() => {
          stats.errors++
          send('error', { error: 'fixture-error', message: 'Local fixture failed', recoverable: false })
          finish(false); controller.close()
        }, 90))
      } else {
        timers.push(setTimeout(() => sendComponent(1), query === 'slow' ? 700 : 110))
        timers.push(setTimeout(() => {
          send('complete', { layoutId: 'fixture-stream', componentsCount: 2, executionTimeMs: 150,
            firstTokenMs: 30, provider: 'mock', model: 'local-fixture', cached: false })
          finish(false); controller.close()
        }, query === 'slow' ? 1000 : 160))
      }
      request.signal.addEventListener('abort', () => { finish(true); try { controller.close() } catch { /* already cancelled */ } }, { once: true })
    },
    cancel() { finish(true) },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
}
