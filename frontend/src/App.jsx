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

  // グローバルに認証ログを確認できる関数を追加
  useEffect(() => {
    window.viewAuthLogs = () => {
      const logs = localStorage.getItem('auth_debug_logs')
      if (!logs) {
        console.log('❌ No debug logs found')
        return
      }
      const parsedLogs = JSON.parse(logs)
      console.clear()
      console.log('=== AUTHENTICATION DEBUG LOGS ===')
      parsedLogs.forEach((log, index) => {
        console.log(`${index + 1}. ${log}`)
      })
      console.log('=== END OF LOGS ===')
      return parsedLogs
    }
    
    window.clearAuthLogs = () => {
      localStorage.removeItem('auth_debug_logs')
      console.log('✅ Debug logs cleared')
    }
    
    console.log('💡 TIP: Use window.viewAuthLogs() to see authentication debug logs')
  }, [])

  useEffect(() => {
    try {
      // 環境変数の検証
      validateConfig()
      
      // ログイン状態を確認
      const loginStatus = isLoggedIn()
      setLoggedIn(loginStatus)
      setLoading(false)
    } catch (error) {
      console.error('App initialization error:', error)
      setLoading(false)
    }
  }, [])

  const handleLogout = () => {
    signOut()
    setLoggedIn(false)
  }

  const handleLoginSuccess = () => {
    setLoggedIn(true)
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

