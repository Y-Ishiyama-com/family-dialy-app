/**
 * 認証サービス - Cognito User Pool を使用
 */

import { config } from '../config/awsConfig'

// トークンをローカルストレージに保存
const TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const USER_ID_KEY = 'user_id'
const EXPIRES_AT_KEY = 'expires_at'
const DEBUG_LOG_KEY = 'auth_debug_logs'

/**
 * ログを保存（localStorage + console）
 */
const appendLog = (message) => {
  const now = new Date().toLocaleTimeString('ja-JP')
  const logMessage = `[${now}] ${message}`
  
  console.log(logMessage)
  
  // localStorage に保存（最新100件を保持）
  try {
    let logs = localStorage.getItem(DEBUG_LOG_KEY)
    logs = logs ? JSON.parse(logs) : []
    logs.push(logMessage)
    if (logs.length > 100) {
      logs.shift()
    }
    localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(logs))
  } catch (error) {
    console.warn('Failed to save debug log:', error)
  }
}

/**
 * ユーザーをサインアップ
 */
export const signUp = async (email, password, username = null) => {
  try {
    const response = await fetch(
      `https://cognito-idp.${config.awsRegion}.amazonaws.com/`,
      {
        method: 'POST',
        headers: {
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
          'Content-Type': 'application/x-amz-json-1.1',
        },
        body: JSON.stringify({
          ClientId: config.cognitoClientId,
          Username: username || email,
          Password: password,
          UserAttributes: [
            {
              Name: 'email',
              Value: email,
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      throw new Error('Sign up failed')
    }

    return await response.json()
  } catch (error) {
    console.error('Sign up error:', error)
    throw error
  }
}

/**
 * ユーザーをサインイン
 */
export const signIn = async (username, password) => {
  try {
    appendLog(`📝 [signIn] Attempting sign in for username: ${username}`)
    
    const response = await fetch(
      `https://cognito-idp.${config.awsRegion}.amazonaws.com/`,
      {
        method: 'POST',
        headers: {
          'X-Amz-Target':
            'AWSCognitoIdentityProviderService.InitiateAuth',
          'Content-Type': 'application/x-amz-json-1.1',
        },
        body: JSON.stringify({
          ClientId: config.cognitoClientId,
          AuthFlow: 'USER_PASSWORD_AUTH',
          AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      appendLog(`❌ [signIn] Sign in failed: ${errorData.message || 'Unknown error'}`)
      throw new Error(errorData.message || 'Sign in failed')
    }

    const data = await response.json()
    
    // NEW_PASSWORD_REQUIRED チャレンジの場合
    if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      appendLog(`⚠️ [signIn] Password change required`)
      throw new Error('NEW_PASSWORD_REQUIRED:' + data.Session)
    }
    
    const { AuthenticationResult } = data

    // トークンを保存
    if (AuthenticationResult) {
      appendLog(`✅ [signIn] Sign in successful, saving tokens...`)
      saveToken(
        AuthenticationResult.AccessToken,
        AuthenticationResult.IdToken,
        AuthenticationResult.RefreshToken
      )
      // ユーザーID はトークンから抽出
      const decoded = decodeToken(AuthenticationResult.IdToken)
      const username = decoded['cognito:username'] || decoded.sub
      saveUserId(username)
      appendLog(`✅ [signIn] Tokens saved for user: ${username}`)
    }
  } catch (error) {
    appendLog(`❌ [signIn] Error: ${error.message}`)
    throw error
  }
}

/**
 * パスワード変更チャレンジに応答
 */
export const respondToNewPasswordChallenge = async (username, newPassword, session) => {
  try {
    const response = await fetch(
      `https://cognito-idp.${config.awsRegion}.amazonaws.com/`,
      {
        method: 'POST',
        headers: {
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
          'Content-Type': 'application/x-amz-json-1.1',
        },
        body: JSON.stringify({
          ClientId: config.cognitoClientId,
          ChallengeName: 'NEW_PASSWORD_REQUIRED',
          Session: session,
          ChallengeResponses: {
            USERNAME: username,
            NEW_PASSWORD: newPassword,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Password change failed')
    }

    const data = await response.json()
    const { AuthenticationResult } = data

    // トークンを保存
    if (AuthenticationResult) {
      saveToken(
        AuthenticationResult.AccessToken,
        AuthenticationResult.IdToken,
        AuthenticationResult.RefreshToken
      )
      const decoded = decodeToken(AuthenticationResult.IdToken)
      const username = decoded['cognito:username'] || decoded.sub
      saveUserId('user#' + username)
    }

    return data
  } catch (error) {
    console.error('Password change error:', error)
    throw error
  }
}

/**
 * 開発モード用デモログイン
 */
export const demoSignIn = (username = 'demo-user') => {
  console.log('🔧 Demo mode: Signing in as', username)
  // ダミートークンを生成
  const dummyToken = 'demo-token-' + Date.now()
  const dummyUserId = 'user#' + username
  
  localStorage.setItem(TOKEN_KEY, dummyToken)
  localStorage.setItem(USER_ID_KEY, dummyUserId)
  // 24時間後に期限切れ
  const expiresAt = new Date(Date.now() + 86400000).getTime()
  localStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString())
  
  console.log('✅ Demo login successful:', { userId: dummyUserId })
  return { success: true, userId: dummyUserId }
}

/**
 * ユーザーをサインアウト
 */
export const signOut = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_ID_KEY)
  localStorage.removeItem(EXPIRES_AT_KEY)
}

/**
 * トークンを保存
 */
const saveToken = (accessToken, idToken, refreshToken) => {
  appendLog('💾 [saveToken] Saving tokens to localStorage...')
  localStorage.setItem(TOKEN_KEY, idToken || accessToken)
  
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  }
  
  // JWTトークンからexpを取得して有効期限を設定
  try {
    const decoded = decodeToken(idToken || accessToken)
    appendLog(`🔓 [saveToken] Decoded token exp: ${decoded.exp}`)
    
    if (decoded.exp) {
      const expiresAt = decoded.exp * 1000 // UNIX timestamp (秒) → ミリ秒
      localStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString())
      appendLog(`✅ [saveToken] Token saved with expiry: ${new Date(expiresAt).toLocaleString('ja-JP')}`)
    } else {
      // expが取得できない場合は1時間後をデフォルトに
      const expiresAt = new Date(Date.now() + 3600000).getTime()
      localStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString())
      appendLog(`⚠️ [saveToken] No exp in token, using default 1 hour`)
    }
  } catch (error) {
    appendLog(`⚠️ [saveToken] Failed to parse token expiration: ${error.message}`)
    const expiresAt = new Date(Date.now() + 3600000).getTime()
    localStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString())
  }
}

/**
 * ユーザーID を保存
 */
const saveUserId = (userId) => {
  localStorage.setItem(USER_ID_KEY, userId)
}

/**
 * RefreshTokenを使用してトークンを更新
 */
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  
  if (!refreshToken) {
    console.warn('⚠️ No refresh token available')
    return null
  }
  
  try {
    const response = await fetch(
      `https://cognito-idp.${config.awsRegion}.amazonaws.com/`,
      {
        method: 'POST',
        headers: {
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
          'Content-Type': 'application/x-amz-json-1.1',
        },
        body: JSON.stringify({
          ClientId: config.cognitoClientId,
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          AuthParameters: {
            REFRESH_TOKEN: refreshToken,
          },
        }),
      }
    )
    
    if (!response.ok) {
      console.error('❌ Token refresh failed')
      return null
    }
    
    const data = await response.json()
    const { AuthenticationResult } = data
    
    if (AuthenticationResult) {
      // 新しいトークンを保存（RefreshTokenは再利用）
      saveToken(
        AuthenticationResult.AccessToken,
        AuthenticationResult.IdToken,
        refreshToken // 既存のRefreshTokenを保持
      )
      console.log('✅ Token refreshed successfully')
      return AuthenticationResult.IdToken || AuthenticationResult.AccessToken
    }
    
    return null
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}

/**
 * 保存されたトークンを取得（必要に応じて自動更新）
 */
export const getToken = async () => {
  const token = localStorage.getItem(TOKEN_KEY)
  const expiresAt = localStorage.getItem(EXPIRES_AT_KEY)
  
  if (!token) {
    return null
  }
  
  // トークンの有効期限を確認（5分前にリフレッシュ）
  if (expiresAt) {
    const expiresAtTime = parseInt(expiresAt, 10)
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000
    
    // 有効期限が5分以内に切れる場合は更新
    if (now + fiveMinutes >= expiresAtTime) {
      console.log('⏰ Token expiring soon, refreshing...')
      const newToken = await refreshAccessToken()
      return newToken || token // 更新失敗時は既存トークンを返す
    }
  }
  
  return token
}

/**
 * 保存されたユーザーID を取得
 */
export const getUserId = () => {
  return localStorage.getItem(USER_ID_KEY)
}

/**
 * ユーザーがログイン済みか確認（同期的）
 * トークンの有効期限を簡易的に確認
 */
export const isLoggedIn = () => {
  const token = localStorage.getItem(TOKEN_KEY)
  const expiresAt = localStorage.getItem(EXPIRES_AT_KEY)
  
  appendLog(`🔍 [isLoggedIn] TOKEN_KEY: ${token ? '✅ exists' : '❌ missing'}, EXPIRES_AT_KEY: ${expiresAt ? '✅ exists' : '❌ missing'}`)

  if (!token || !expiresAt) {
    appendLog(`❌ [isLoggedIn] Token or expiresAt missing - NOT LOGGED IN`)
    return false
  }

  const expiresAtNum = parseInt(expiresAt, 10)
  const now = Date.now()
  const isValid = now < expiresAtNum
  const remaining = Math.round((expiresAtNum - now) / 1000)
  
  appendLog(`⏰ [isLoggedIn] Token valid: ${isValid}, Remaining: ${remaining}s`)
  
  return isValid
}

/**
 * JWT トークンをデコード
 */
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error('Token decode error:', error)
    return {}
  }
}
