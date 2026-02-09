/**
 * 写真アップロードコンポーネント
 * ドラッグ&ドロップ または ファイル選択でアップロード
 */

import { useRef, useState } from 'react'
import './PhotoUpload.css'

export default function PhotoUpload({ onUpload = () => {}, loading = false }) {
  const fileInputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFile = (file) => {
    // 画像ファイルのみを受け付ける
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルのみをアップロードできます')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズは 5MB 以下にしてください')
      return
    }

    onUpload(file)
  }

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  return (
    <div className="photo-upload">
      <div
        className={`upload-zone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="upload-content">
          <div className="upload-icon">📷</div>
          <p className="upload-text">
            {loading ? (
              <>アップロード中...</>
            ) : (
              <>
                写真をドラッグ&ドロップ または
                <button
                  type="button"
                  className="upload-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  クリックして選択
                </button>
              </>
            )}
          </p>
          <p className="upload-hint">最大 5MB の画像ファイル</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={loading}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  )
}
