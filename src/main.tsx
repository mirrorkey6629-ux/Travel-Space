import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import ComponentLibrary from './ComponentLibrary'
import './typography.css'
import './styles.css'

const isComponentLibrary = window.location.pathname.replace(/\/$/, '').endsWith('/components')

if (import.meta.env.PROD) {
  let updateSW: (reloadPage?: boolean) => Promise<void>
  updateSW = registerSW({
    immediate: true,
    // Reload не всегда закрывает старый client, поэтом waiting-worker мог
    // бесконечно оставаться в очереди. Активируем его и один раз перезагружаемся.
    onNeedRefresh: () => { void updateSW(true) },
    onRegisteredSW: (_url, registration) => {
      if (!registration) return
      const check = () => { if (navigator.onLine) void registration.update().catch(() => undefined) }
      check()
      window.addEventListener('online', check)
      window.addEventListener('focus', check)
      window.setInterval(check, 60 * 60 * 1_000)
    },
  })
} else if ('serviceWorker' in navigator) {
  // Старый production-worker не должен перехватывать локальную разработку:
  // иначе Vite обновляет код, а браузер продолжает показывать закэшированные
  // иконки и оболочку предыдущей сборки.
  void navigator.serviceWorker.getRegistrations().then((registrations) =>
    Promise.all(registrations.map((registration) => registration.unregister())),
  )
  if ('caches' in window) {
    void caches.keys().then((names) =>
      Promise.all(names.filter((name) => name.startsWith('travel-') || name.startsWith('workbox-')).map((name) => caches.delete(name))),
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isComponentLibrary ? <ComponentLibrary /> : <App />}
  </React.StrictMode>,
)
