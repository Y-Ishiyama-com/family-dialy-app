/**
 * ファミリーカレンダーコンポーネント
 * 日付リスト形式で表示（スマホ対応）
 */

import { useState } from 'react'
import './FamilyCalendar.css'

export default function FamilyCalendar({
  month = 1,
  entries = [],
}) {
  const [expandedDate, setExpandedDate] = useState(null)

  // エントリを日付でグループ化してソート
  const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date))

  // 日付フォーマット：2024-02-08-public → 2月8日(木)
  const formatDate = (dateStr) => {
    // -public/-private suffix を削除
    const cleanDate = dateStr.replace(/-(public|private)$/, '')
    const date = new Date(cleanDate)
    const weekDays = ['日', '月', '火', '水', '木', '金', '土']
    const weekDay = weekDays[date.getDay()]
    return `${month}月${date.getDate()}日(${weekDay})`
  }

  // 今日の日付（比較用にsuffixなし）
  const today = new Date().toISOString().split('T')[0]
  
  // 日付の比較（suffixを除去して比較）
  const isTodayEntry = (dateStr) => {
    const cleanDate = dateStr.replace(/-(public|private)$/, '')
    return cleanDate === today
  }

  // 非公開日記かどうかを判定
  const isPrivateEntry = (dateStr) => {
    return dateStr.endsWith('-private')
  }

  // エントリの展開・折りたたみ
  const toggleExpand = (date) => {
    setExpandedDate(expandedDate === date ? null : date)
  }

  if (sortedEntries.length === 0) {
    return (
      <div className="family-calendar-list">
        <div className="empty-state">
          <p>📝 この月の公開日記はまだありません</p>
          <p className="empty-hint">家族が日記を公開すると、ここに表示されます</p>
        </div>
      </div>
    )
  }

  return (
    <div className="family-calendar-list">
      {sortedEntries.map((entry) => {
        const isExpanded = expandedDate === entry.date
        const isToday = isTodayEntry(entry.date)
        const isPrivate = isPrivateEntry(entry.date)

        return (
          <div
            key={`${entry.user_id}-${entry.date}`}
            className={`entry-item ${isToday ? 'today' : ''} ${isPrivate ? 'private' : ''}`}
            onClick={() => toggleExpand(entry.date)}
          >
            <div className="entry-header">
              <div className="entry-date">
                {isToday && <span className="today-badge">今日</span>}
                <span className="date-text">{formatDate(entry.date)}</span>
              </div>
              <div className="entry-meta">
                <span className={`user-badge ${isPrivate ? 'private' : ''}`}>{entry.user_id.replace('user#', '')}</span>
                {isPrivate && <span className="private-badge">🔒</span>}
                <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
              </div>
            </div>

            {isExpanded && (
              <div className="entry-content">
                <div className="entry-text">{entry.entry_text}</div>
                {entry.photo_url && (
                  <div className="entry-photo">
                    <img src={entry.photo_url} alt="日記の写真" />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
