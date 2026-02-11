/**
 * 日記編集ページ - 公開/非公開の2つを編集可能
 */

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import DiaryEntry from '../components/DiaryEntry'
import PhotoUpload from '../components/PhotoUpload'
import { getDiaryEntry, saveDiaryEntry, uploadPhoto, deleteDiaryEntry } from '../services/apiService'
import './DiaryPage.css'

export default function DiaryPage() {
  const { date } = useParams()
  const [currentDate, setCurrentDate] = useState(date || new Date().toISOString().split('T')[0])
  const [activeTab, setActiveTab] = useState('public') // 'public' or 'private'
  
  // 公開日記
  const [publicText, setPublicText] = useState('')
  const [publicPhotoUrl, setPublicPhotoUrl] = useState('')
  
  // 非公開日記
  const [privateText, setPrivateText] = useState('')
  const [privatePhotoUrl, setPrivatePhotoUrl] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // エントリを読み込み（公開と非公開の両方）
  useEffect(() => {
    const loadEntries = async () => {
      setLoading(true)
      setError('')

      try {
        // 公開日記を読み込み（date-public）
        try {
          const publicEntry = await getDiaryEntry(`${currentDate}-public`)
          setPublicText(publicEntry.entry_text || '')
          setPublicPhotoUrl(publicEntry.photo_url || '')
        } catch (err) {
          // エントリがない場合はスキップ
          setPublicText('')
          setPublicPhotoUrl('')
        }

        // 非公開日記を読み込み（date-private）
        try {
          const privateEntry = await getDiaryEntry(`${currentDate}-private`)
          setPrivateText(privateEntry.entry_text || '')
          setPrivatePhotoUrl(privateEntry.photo_url || '')
        } catch (err) {
          setPrivateText('')
          setPrivatePhotoUrl('')
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadEntries()
  }, [currentDate])

  const handleSave = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const isPublic = activeTab === 'public'
      const entryText = isPublic ? publicText : privateText
      const photoUrl = isPublic ? publicPhotoUrl : privatePhotoUrl
      
      // 日付にsuffixを付けて別エントリとして保存
      const dateKey = `${currentDate}-${activeTab}`
      
      await saveDiaryEntry(dateKey, entryText, isPublic, photoUrl)
      setSuccess(`${isPublic ? '公開' : '非公開'}日記を保存しました`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (file) => {
    try {
      // 日付にsuffixを付けて別エントリとして扱う
      const dateKey = `${currentDate}-${activeTab}`
      
      // バックエンドを経由して写真をアップロード
      const response = await uploadPhoto(dateKey, file)
      const photoUrl = response.photo_url
      
      if (activeTab === 'public') {
        setPublicPhotoUrl(photoUrl)
      } else {
        setPrivatePhotoUrl(photoUrl)
      }
      
      setSuccess('写真をアップロードしました')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async () => {
    const isPublic = activeTab === 'public'
    const confirmDelete = window.confirm(
      `${isPublic ? '公開' : '非公開'}日記（${currentDate}）を削除してもよろしいですか？\n\nこの操作は取り消せません。`
    )
    
    if (!confirmDelete) return
    
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const dateKey = `${currentDate}-${activeTab}`
      await deleteDiaryEntry(dateKey)
      
      // 削除後、フィールドをクリア
      if (isPublic) {
        setPublicText('')
        setPublicPhotoUrl('')
      } else {
        setPrivateText('')
        setPrivatePhotoUrl('')
      }
      
      setSuccess(`${isPublic ? '公開' : '非公開'}日記を削除しました`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const currentText = activeTab === 'public' ? publicText : privateText
  const setCurrentText = activeTab === 'public' ? setPublicText : setPrivateText
  const currentPhotoUrl = activeTab === 'public' ? publicPhotoUrl : privatePhotoUrl

  return (
    <div className="diary-page">
      <div className="diary-container">
        <div className="diary-header">
          <h1>📝 {currentDate}</h1>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="date-input"
          />
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {/* タブ切り替え */}
        <div className="diary-tabs">
          <button
            className={`tab-button ${activeTab === 'public' ? 'active' : ''}`}
            onClick={() => setActiveTab('public')}
          >
            🌍 公開日記
          </button>
          <button
            className={`tab-button private ${activeTab === 'private' ? 'active' : ''}`}
            onClick={() => setActiveTab('private')}
          >
            🔒 非公開日記
          </button>
        </div>

        <DiaryEntry
          text={currentText}
          isPublic={activeTab === 'public'}
          onChange={setCurrentText}
          onPublicChange={() => {}} // タブで管理するため無効化
          loading={loading}
          hidePublicToggle={true} // タブで管理するため非表示
        />

        {currentPhotoUrl && (
          <div className="photo-preview">
            <img 
              src={currentPhotoUrl} 
              alt="アップロード済みの写真" 
              style={{
                maxWidth: '100%',
                maxHeight: '300px',
                borderRadius: '8px',
                objectFit: 'cover'
              }}
              onError={(e) => {
                console.error('写真の読み込みエラー:', currentPhotoUrl)
                // エラーメッセージを表示
                e.target.style.display = 'none'
                const errorDiv = document.createElement('div')
                errorDiv.className = 'photo-error'
                errorDiv.style.cssText = 'padding: 20px; background: #fee; color: #c33; border-radius: 8px; margin: 10px 0;'
                errorDiv.textContent = '⚠️ 写真の読み込みに失敗しました。URLが期限切れでいる可能性があります。'
                if (!e.target.parentElement.querySelector('.photo-error')) {
                  e.target.parentElement.appendChild(errorDiv)
                }
              }}
            />
          </div>
        )}

        <PhotoUpload
          onUpload={handlePhotoUpload}
          loading={loading}
        />

        <button
          className={`save-button ${activeTab === 'private' ? 'private' : ''}`}
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? '保存中...' : `💾 ${activeTab === 'public' ? '公開日記を' : '非公開日記を'}保存`}
        </button>

        {(publicText || privateText) && (
          <button
            className={`delete-button ${activeTab === 'private' ? 'private' : ''}`}
            onClick={handleDelete}
            disabled={loading}
            title={`この${activeTab === 'public' ? '公開' : '非公開'}日記を削除します`}
          >
            {loading ? '削除中...' : `🗑️ ${activeTab === 'public' ? '公開日記を' : '非公開日記を'}削除`}
          </button>
        )}
      </div>
    </div>
  )
}
