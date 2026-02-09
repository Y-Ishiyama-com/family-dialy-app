/**
 * 日記エントリコンポーネント
 * テキスト入力、公開/非公開切り替え を表示
 */

import './DiaryEntry.css'

export default function DiaryEntry({
  text = '',
  isPublic = false,
  onChange = () => {},
  onPublicChange = () => {},
  loading = false,
  hidePublicToggle = false,
}) {
  return (
    <div className="diary-entry">
      {!hidePublicToggle && (
        <div className="entry-controls">
          <label className="public-toggle">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => onPublicChange(e.target.checked)}
              disabled={loading}
            />
            <span className="toggle-label">
              {isPublic ? '🔓 公開' : '🔒 非公開'}
            </span>
          </label>
        </div>
      )}

      <textarea
        className="entry-textarea"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="今日のできごとを記録してください..."
        disabled={loading}
        rows={12}
      />

      <div className="entry-info">
        <span className="char-count">{text.length} 文字</span>
      </div>
    </div>
  )
}
