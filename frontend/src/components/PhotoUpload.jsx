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

    // 長辺が 640px 以上の場合は 640px に縮小する
    const MAX_SIDE = 640
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const { naturalWidth: w, naturalHeight: h } = img
      const longestSide = Math.max(w, h)

      if (longestSide < MAX_SIDE) {
        // リサイズ不要
        onUpload(file)
        return
      }

      const scale = MAX_SIDE / longestSide
      const destW = Math.round(w * scale)
      const destH = Math.round(h * scale)

      const canvas = document.createElement('canvas')
      canvas.width = destW
      canvas.height = destH
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, destW, destH)

      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const quality = mimeType === 'image/jpeg' ? 0.85 : undefined
      canvas.toBlob(
        (blob) => {
          const resizedFile = new File([blob], file.name, { type: mimeType })
          onUpload(resizedFile)
        },
        mimeType,
        quality
      )
    }

    img.src = objectUrl
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
