import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import ComponentLibrary from './ComponentLibrary'
import './typography.css'
import './styles.css'

const isComponentLibrary = window.location.pathname.replace(/\/$/, '').endsWith('/components')

// immediate: false — новый worker ставится в очередь и активируется при
// следующем холодном старте. Перезагружать страницу под руками у пользователя
// нельзя: в форме города могут быть несохранённые правки.
registerSW({ immediate: false })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isComponentLibrary ? <ComponentLibrary /> : <App />}
  </React.StrictMode>,
)
