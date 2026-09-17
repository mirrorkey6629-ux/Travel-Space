import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/travel/api': 'http://127.0.0.1:3000',
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
