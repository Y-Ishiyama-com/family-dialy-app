/**
 * ログインページ
 */

import { useState } from 'react'
import { signIn, signUp, demoSignIn, respondToNewPasswordChallenge } from '../services/authService'
import './LoginPage.css'

// 開発モード判定（環境変数でCognito未設定の場合）
const isDevelopmentMode = import.meta.env.VITE_COGNITO_USER_POOL_ID?.includes('xxxxxxxxx')

export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('signin') // 'signin', 'signup', or 'newpassword'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [session, setSession] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDemoLogin = () => {
    setError('')
    setLoading(true)
    try {
      demoSignIn('demo-user')
      onLoginSuccess()
    } catch (err) {
      setError('デモログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      onLoginSuccess()
    } catch (err) {
      // NEW_PASSWORD_REQUIRED チャレンジの場合
      if (err.message?.startsWith('NEW_PASSWORD_REQUIRED:')) {
        const sessionToken = err.message.split(':')[1]
        setSession(sessionToken)
        setMode('newpassword')
        setError('初回ログインです。新しいパスワードを設定してください。')
      } else {
        setError(err.message || 'ログインに失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleNewPassword = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await respondToNewPasswordChallenge(email, newPassword, session)
      onLoginSuccess()
    } catch (err) {
      setError(err.message || 'パスワード変更に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }

    setLoading(true)

    try {
      await signUp(email, password, email)
      setError('') // サインアップ成功後、エラーをクリア
      setMode('signin') // ログインモードに戻す
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message || 'サインアップに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-box">
          <h1>Family Diary App</h1>
          <p className="subtitle">家族で日記をシェアしよう</p>

          {isDevelopmentMode && (
            <div className="demo-mode-banner">
              🔧 開発モード（Cognito未設定）
              <button 
                type="button"
                className="demo-login-btn" 
                onClick={handleDemoLogin}
                disabled={loading}
              >
                デモログイン
              </button>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          {mode === 'newpassword' ? (
            // 新しいパスワード設定フォーム
            <form onSubmit={handleNewPassword}>
              <div className="form-group">
                <label htmlFor="newPassword">新しいパスワード</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8文字以上、大文字・小文字・数字を含む"
                  required
                  disabled={loading}
                  minLength={8}
                />
              </div>
              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                {loading ? '処理中...' : 'パスワードを設定'}
              </button>
            </form>
          ) : (
            <>
              <div className="mode-tabs">
                <button
                  className={`tab ${mode === 'signin' ? 'active' : ''}`}
                  onClick={() => setMode('signin')}
                >
                  ログイン
                </button>
                <button
                  className={`tab ${mode === 'signup' ? 'active' : ''}`}
                  onClick={() => setMode('signup')}
                >
                  登録
                </button>
              </div>

              <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}>
            <div className="form-group">
              <label htmlFor="email">
                {mode === 'signin' ? 'ユーザー名 または メールアドレス' : 'メールアドレス'}
              </label>
              <input
                id="email"
                type={mode === 'signin' ? 'text' : 'email'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={mode === 'signin' ? 'ユーザー名 または メールアドレス' : 'example@gmail.com'}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">パスワード</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {mode === 'signup' && (
              <div className="form-group">
                <label htmlFor="confirmPassword">パスワード（確認）</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            )}

            <button
              type="submit"
              className="submit-button"
              disabled={loading}
            >
              {loading ? '処理中...' : mode === 'signin' ? 'ログイン' : '登録'}
            </button>
          </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
