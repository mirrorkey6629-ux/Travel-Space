import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ComponentLibrary from './ComponentLibrary'
import './typography.css'
import './styles.css'

const isComponentLibrary = window.location.pathname.replace(/\/$/, '').endsWith('/components')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isComponentLibrary ? <ComponentLibrary /> : <App />}
  </React.StrictMode>,
)
