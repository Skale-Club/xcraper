import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { initSentry } from './lib/sentry'
import { loadPublicRuntimeConfig } from './lib/runtime-config'
import './index.css'

async function bootstrap() {
    await loadPublicRuntimeConfig()
    await initSentry()
    registerSW({ immediate: true })

    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    )
}

void bootstrap()
