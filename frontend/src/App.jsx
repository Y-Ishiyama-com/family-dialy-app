import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { isLoggedIn, signOut } from './services/authService'
import { validateConfig } from './config/awsConfig'
import LoginPage from './pages/LoginPage'
import DiaryPage from './pages/DiaryPage'
import CalendarPage from './pages/CalendarPage'
import Header from './components/Header'
import './App.css'

console.log('📱 App.jsx loaded');

function App() {
  console.log('🏗️ App component initializing');
  const [loggedIn, setLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('═══════════════════════════════════════════════════════════')
    console.log('🚀 [App.useEffect] App initialization started')
    console.log(`   Timer: ${new Date().toLocaleString('ja-JP')}`)
    try {
      // 環境変数の検証
      console.log('🔧 [App.useEffect] Validating config...')
      validateConfig()
      console.log('✅ [App.useEffect] Config validated')
      
      // localStorage の状態を確認
      console.log('📦 [App.useEffect] Checking localStorage state...')
      console.log(`   localStorage.length: ${localStorage.length}`)
      if (localStorage.length > 0) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          const value = localStorage.getItem(key)
          const displayValue = key.includes('token') || key.includes('auth_token') ? `${value.substring(0, 30)}...` : value
          console.log(`   ${i + 1}. "${key}": ${displayValue}`)
        }
      } else {
        console.log('   ⚠️ localStorage is EMPTY')
      }
      
      // ログイン状態を確認
      console.log('🔐 [App.useEffect] Calling isLoggedIn()...')
      const loginStatus = isLoggedIn()
      console.log(`🔐 [App.useEffect] Login status result: ${loginStatus}`)
      setLoggedIn(loginStatus)
      setLoading(false)
      console.log('✅ [App.useEffect] Initialization complete')
    } catch (error) {
      console.error('❌ [App.useEffect] App initialization error:', error);
      setLoading(false)
    }
    console.log('═══════════════════════════════════════════════════════════\n')
  }, [])

  const handleLogout = () => {
    signOut()
    setLoggedIn(false)
  }

  const handleLoginSuccess = () => {
    console.log('═══════════════════════════════════════════════════════════')
    console.log('🎯 [App.handleLoginSuccess] Login success callback triggered')
    console.log(`   Timer: ${new Date().toLocaleString('ja-JP')}`)
    console.log('📦 [App.handleLoginSuccess] Current localStorage:')
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      const value = localStorage.getItem(key)
      const displayValue = key.includes('token') || key.includes('auth_token') ? `${value.substring(0, 30)}...` : value
      console.log(`   ${i + 1}. "${key}": ${displayValue}`)
    }
    console.log('📝 [App.handleLoginSuccess] Setting loggedIn to true')
    setLoggedIn(true)
    console.log('✅ [App.handleLoginSuccess] State update triggered')
    console.log('═══════════════════════════════════════════════════════════\n')
  }

  if (loading) {
    console.log('⏳ Loading...');
    return <div className="loading">読み込み中...</div>
  }

  console.log('🎨 Rendering App, loggedIn:', loggedIn);

  return (
    <Router>
      <div className="app">
        {loggedIn && <Header onLogout={handleLogout} />}
        <Routes>
          {loggedIn ? (
            <>
              <Route path="/" element={<DiaryPage />} />
              <Route path="/diary/:date" element={<DiaryPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          ) : (
            <>
              <Route path="/" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  )
}

export default App

