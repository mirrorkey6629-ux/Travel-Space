import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Приложение публикуется под префиксом. Он берётся из той же переменной, что
// читает API, поэтому у клиента и сервера один источник правды.
const basePath = (process.env.BASE_PATH ?? '/travel').replace(/\/+$/, '')

// Один и тот же proxy нужен и dev-серверу, и preview: собранную PWA негде
// проверить оффлайн, если preview не умеет ходить в живой API.
const proxy = { [`${basePath}/api`]: 'http://127.0.0.1:3000' }

export default defineConfig({
  // Vite подставляет base в HTML, в url() внутри CSS и в import.meta.env.BASE_URL.
  // Пути, которые JS собирает сам, он не переписывает — там нужен BASE_URL.
  base: `${basePath}/`,
  plugins: [
    react(),
    VitePWA({
      // injectManifest, а не generateSW: precache и ревизии отдаём workbox, но
      // докачку с токеном и отчёт о прогрессе чужой абстракцией не выразить.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Регистрация вызывается вручную из main.tsx, поэтому плагину её
      // встраивать не нужно. prompt + immediate: false означают, что новый
      // worker ждёт и берёт управление при следующем холодном старте:
      // перезагрузка посреди незакрытой формы города потеряла бы правки.
      injectRegister: null,
      registerType: 'prompt',
      // Крупные растровые картинки в precache не идут: autumn-garden.jpg весит
      // 5.4 МБ и растянул бы установку. Их забирает фоновая докачка.
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,webmanifest}'] },
      manifest: {
        name: 'Travel Space',
        short_name: 'Travel Space',
        description: 'Совместное планирование путешествий',
        lang: 'ru',
        display: 'standalone',
        background_color: '#080808',
        theme_color: '#080808',
        icons: [
          { src: 'assets/app-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'assets/app-icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'assets/app-icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    host: true,
    proxy,
  },
  preview: {
    host: true,
    proxy,
  },
  build: {
    // Lightning CSS drops the unprefixed backdrop-filter for this target set.
    // Keep the authored declarations so glass cards work in every browser.
    cssMinify: false,
  },
})
