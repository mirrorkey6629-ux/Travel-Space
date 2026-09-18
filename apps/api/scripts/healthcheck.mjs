// Проба для HEALTHCHECK в образе: в alpine нет curl, а exec-форма CMD
// избавляет от экранирования регулярного выражения в строке Dockerfile.
const basePath = (process.env.BASE_PATH ?? '/travel').replace(/\/+$/, '')
const port = process.env.API_PORT ?? '3000'

try {
  const response = await fetch(`http://127.0.0.1:${port}${basePath}/api/health`, {
    signal: AbortSignal.timeout(4000),
  })
  process.exit(response.ok ? 0 : 1)
} catch {
  process.exit(1)
}
