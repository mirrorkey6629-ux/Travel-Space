import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Приложение публикуется под префиксом. Он берётся из той же переменной, что
// читает API, поэтому у клиента и сервера один источник правды.
const basePath = (process.env.BASE_PATH ?? '/travel').replace(/\/+$/, '')

export default defineConfig({
  // Vite подставляет base в HTML, в url() внутри CSS и в import.meta.env.BASE_URL.
  // Пути, которые JS собирает сам, он не переписывает — там нужен BASE_URL.
  base: `${basePath}/`,
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      [`${basePath}/api`]: 'http://127.0.0.1:3000',
    },
  },
  preview: {
    host: true,
  },
  build: {
    // Lightning CSS drops the unprefixed backdrop-filter for this target set.
    // Keep the authored declarations so glass cards work in every browser.
    cssMinify: false,
  },
})
