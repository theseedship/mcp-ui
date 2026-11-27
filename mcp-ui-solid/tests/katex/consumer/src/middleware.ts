export default function middleware(_event: unknown, next: () => Promise<Response>) {
  return next()
}
