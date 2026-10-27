import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initBrowserApi } from './browser-api'

// Tự động kích hoạt API khi chạy trên trình duyệt web ngoài Electron (Cốc Cốc, Chrome)
initBrowserApi()

const rootElement = document.getElementById('root')

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
