/**
 * 毎日のお題を表示するコンポーネント
 * 日記編集画面の上部に表示され、ユーザーの書く内容のきっかけになる
 */

import './DailyPrompt.css'

export default function DailyPrompt({
  prompt = null,
  category = 'daily',
  loading = false,
  error = null,
}) {
  if (loading) {
    return (
      <div className="daily-prompt loading">
        <div className="prompt-spinner"></div>
        <p className="prompt-text">お題を準備中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="daily-prompt error">
        <span className="prompt-icon">⚠️</span>
        <p className="prompt-text">{error}</p>
      </div>
    )
  }

  if (!prompt) {
    return (
      <div className="daily-prompt empty">
        <span className="prompt-icon">✨</span>
        <p className="prompt-text">本日のお題はまだ生成されていません</p>
      </div>
    )
  }

  // カテゴリに応じたアイコンを選択
  const getCategoryIcon = (cat) => {
    const iconMap = {
      seasonal: '🍂',
      event: '🎉',
      reflection: '💭',
      fun: '🎈',
      historical: '📜',
      spring: '🌸',
      summer: '☀️',
      autumn: '🍁',
      winter: '❄️',
      daily: '📝',
    }
    return iconMap[cat] || '✨'
  }

  return (
    <div className="daily-prompt">
      <div className="prompt-container">
        <div className="prompt-header">
          <span className="prompt-icon">{getCategoryIcon(category)}</span>
          <span className="prompt-label">今日のお題</span>
        </div>
        <p className="prompt-text">{prompt}</p>
        <div className="prompt-hint">
          💡 このお題をきっかけに、今日の気持ちや出来事を書いてみてください
        </div>
      </div>
    </div>
  )
}
