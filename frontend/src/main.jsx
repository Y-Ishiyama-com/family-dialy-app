import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

console.log('🚀 main.jsx loaded');
console.log('📦 Root element:', document.getElementById('root'));

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
  console.log('✅ React app rendered successfully');
} catch (error) {
  console.error('❌ React app render error:', error);
}
