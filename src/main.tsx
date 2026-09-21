import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import ComponentLibrary from './ComponentLibrary'
import './typography.css'
import './styles.css'

const isComponentLibrary = window.location.pathname.replace(/\/$/, '').endsWith('/components')

if (import.meta.env.PROD) {
  // immediate: false — новый worker ставится в очередь и активируется при
  // следующем холодном старте. Перезагружать страницу под руками у пользователя
  // нельзя: в форме города могут быть несохранённые правки.
  registerSW({ immediate: false })
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
