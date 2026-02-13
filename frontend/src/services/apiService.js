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
  }

  // URLの正規化：ダブルスラッシュを避ける
  const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT.slice(0, -1) : API_ENDPOINT
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const fullUrl = `${baseUrl}${normalizedPath}`

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    // トークンが無効・期限切れ
    signOut()
    
    // ログイン画面へリダイレクト
    window.location.href = '/'
    
    // リダイレクト待機
    return new Promise(() => {})
  }

  if (!response.ok) {
    // レスポンスボディを一度だけ読み取る
    const contentType = response.headers.get('content-type')
    let errorMessage = `API error: ${response.status}`
    
    try {
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json()
        errorMessage = errorData.error || errorData.detail || errorMessage
      } else {
        const errorText = await response.text()
        errorMessage = errorText || errorMessage
      }
    } catch (parseError) {
      // Parse error occurred, use status code message
    }
    
    throw new Error(errorMessage)
  }

  return await response.json()
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
 * 家族カレンダーを取得（月間・公開日記のみ）
 */
export const getFamilyCalendar = async (year, month) => {
  return apiCall(`/family/calendar/${year}/${month}`, { method: 'GET' })
}

/**
 * 自分のカレンダーを取得（月間・公開/非公開すべて）
 */
export const getMyCalendar = async (year, month) => {
  return apiCall(`/my/calendar/${year}/${month}`, { method: 'GET' })
}

/**
 * ヘルスチェック
 */
export const healthCheck = async () => {
  return fetch(`${API_ENDPOINT}/health`).then((res) => res.json())
}

/**
 * 指定日のお題を取得
 */
export const getPrompt = async (date = null) => {
  // dateが指定されない場合は今日の日付を使用
  const queryDate = date || new Date().toISOString().split('T')[0]
  return apiCall(`/prompt?date=${queryDate}`, { method: 'GET' })
}
