/**
 * API ゲートウェイ統合サービス
 */

import { config } from '../config/awsConfig'
import { getToken, signOut } from './authService'

const API_ENDPOINT = config.apiEndpoint

/**
 * API リクエストを実行（JWT トークン付き）
 */
const apiCall = async (path, options = {}) => {
  const token = await getToken() // RefreshToken自動更新に対応
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
    console.log(`🔐 API Request: ${path}`)
    console.log(`   Token (first 30 chars): ${token.substring(0, 30)}...`)
    console.log(`   Authorization header: Bearer ${token.substring(0, 30)}...`)
  } else {
    console.warn(`⚠️  API Request: ${path} - NO TOKEN FOUND`)
  }

  try {
    const response = await fetch(`${API_ENDPOINT}${path}`, {
      ...options,
      headers,
    })

    if (response.status === 401) {
      // トークンが無効・期限切れ
      console.error('❌ 401 Unauthorized - Token expired or invalid')
      
      // ローカルストレージをクリア
      signOut()
      
      // ログイン画面へリダイレクト
      window.location.href = '/'
      
      // リダイレクト待機
      return new Promise(() => {})
    }

    if (!response.ok) {
      try {
        const errorData = await response.json()
        console.error(`❌ API Error: ${response.status} - ${errorData.error || errorData.detail || JSON.stringify(errorData)}`)
        throw new Error(errorData.error || errorData.detail || `API error: ${response.status}`)
      } catch (parseError) {
        // JSONパース失敗時
        const errorText = await response.text()
        console.error(`❌ API Error: ${response.status} - ${errorText}`)
        throw new Error(`API error: ${response.status}`)
      }
    }

    return await response.json()
  } catch (error) {
    // ネットワークエラーやその他のエラー
    console.error('🔴 API Call Error:', error)
    throw error
  }
}

/**
 * 日記エントリを取得
 */
export const getDiaryEntry = async (date) => {
  return apiCall(`/diary/${date}`, { method: 'GET' })
}

/**
 * 日記エントリを作成・更新
 */
export const saveDiaryEntry = async (date, entryText, isPublic, photoUrl = null) => {
  return apiCall(`/diary/${date}`, {
    method: 'POST',
    body: JSON.stringify({
      entry_text: entryText,
      is_public: isPublic,
      photo_url: photoUrl,
    }),
  })
}

/**
 * 日記エントリを削除
 */
export const deleteDiaryEntry = async (date) => {
  return apiCall(`/diary/${date}`, { method: 'DELETE' })
}

/**
 * 写真をアップロード
 */
export const uploadPhoto = async (date, file) => {
  const reader = new FileReader()
  return new Promise((resolve, reject) => {
    reader.onload = async (e) => {
      // Data URLからBase64部分を抽出
      const base64Data = e.target.result.split(',')[1]
      try {
        const response = await apiCall(`/diary/${date}/photo`, {
          method: 'POST',
          body: JSON.stringify({
            image: base64Data,
          }),
        })
        resolve(response)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * 写真アップロード用プリサイン URL を取得
 */
export const getPhotoPresignedUrl = async (date) => {
  const response = await apiCall(`/diary/${date}/photo`, {
    method: 'POST',
  })
  return response
}

/**
 * 家族カレンダーを取得（月間）
 */
export const getFamilyCalendar = async (year, month) => {
  return apiCall(`/family/calendar/${year}/${month}`, { method: 'GET' })
}

/**
 * ヘルスチェック
 */
export const healthCheck = async () => {
  return fetch(`${API_ENDPOINT}/health`).then((res) => res.json())
}
