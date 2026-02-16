/**
 * ファミリーカレンダーコンポーネント
 * 日付ごとにグループ化され、お題とユーザー名を横並びで表示
 * クリックするとポップアップで詳細を表示
 */

import { useState } from 'react'
import './FamilyCalendar.css'

export default function FamilyCalendar({
  month = 1,
  entries = [],
  prompts = {}, // 日付ごとのお題
}) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedEntries, setSelectedEntries] = useState([])

  // エントリを日付でグループ化
  const groupEntriesByDate = () => {
    const grouped = {}

    entries.forEach((entry) => {
      const cleanDate = entry.date.replace(/-(public|private)$/, '')
      
      if (!grouped[cleanDate]) {
        grouped[cleanDate] = []
      }
      grouped[cleanDate].push(entry)
    })

    return grouped
  }

  // 日付フォーマット：2024-02-08 → 2月8日(木)
  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00')
    const weekDays = ['日', '月', '火', '水', '木', '金', '土']
    const weekDay = weekDays[date.getDay()]
    return `${month}月${date.getDate()}日(${weekDay})`
  }

  // 今日の日付
  const today = new Date().toISOString().split('T')[0]

  // 日付かどうかを判定
  const isToday = (dateStr) => dateStr === today

  // ユーザー名を取得（user#を削除）
  const getUsername = (userId) => userId.replace('user#', '')

  // リストアイテムをクリック時の処理
  const handleDateClick = (dateStr, dayEntries) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null)
      setSelectedEntries([])
    } else {
      setSelectedDate(dateStr)
      setSelectedEntries(dayEntries)
    }
  }

  const groupedEntries = groupEntriesByDate()
  const sortedDates = Object.keys(groupedEntries).sort()

  if (sortedDates.length === 0) {
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
      {sortedDates.map((dateStr) => {
        const dayEntries = groupedEntries[dateStr]
        const isExpanded = selectedDate === dateStr
        const isTodayDate = isToday(dateStr)
        const prompt = prompts[dateStr] || null
        const usernames = [...new Set(dayEntries.map((e) => getUsername(e.user_id)))]
        const hasPrivate = dayEntries.some((e) => e.date.endsWith('-private'))

        return (
          <div key={dateStr}>
            {/* 日付リストアイテム */}
            <div
              className={`date-list-item ${isTodayDate ? 'today' : ''} ${hasPrivate ? 'has-private' : ''}`}
              onClick={() => handleDateClick(dateStr, dayEntries)}
            >
              <div className="date-list-header">
                {/* 1行目：日付 + ユーザー名 + 展開アイコン */}
                <div className="date-header-row">
                  <div className="date-info">
                    {isTodayDate && <span className="today-badge">今日</span>}
                    <span className="date-text">{formatDate(dateStr)}</span>
                  </div>

                  <div className="users-info">
                    <span className="users-names">{usernames.join(', ')}</span>
                    {hasPrivate && <span className="private-indicator">🔒</span>}
                  </div>

                  <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                </div>

                {/* 2行目：お題 */}
                {prompt && (
                  <div className="prompt-row">
                    <span className="prompt-icon">📝</span>
                    <span className="prompt-text">{prompt}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ポップアップ表示 */}
            {isExpanded && (
              <div className="date-popup">
                <div className="popup-content">
                  <div className="popup-header">
                    <h3>{formatDate(dateStr)}</h3>
                    <button
                      className="popup-close"
                      onClick={() => {
                        setSelectedDate(null)
                        setSelectedEntries([])
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {prompt && (
                    <div className="popup-prompt">
                      <span className="prompt-icon">📝</span>
                      <div className="prompt-content">
                        <p className="prompt-title">本日のお題</p>
                        <p className="prompt-value">{prompt}</p>
                      </div>
                    </div>
                  )}

                  <div className="entries-container">
                    {selectedEntries.map((entry, idx) => (
                      <div
                        key={`${entry.user_id}-${entry.date}-${idx}`}
                        className={`popup-entry ${entry.date.endsWith('-private') ? 'private' : 'public'}`}
                      >
                        <div className="entry-user">
                          <span className="user-icon">👤</span>
                          <span className="user-name">{getUsername(entry.user_id)}</span>
                          {entry.date.endsWith('-private') && (
                            <span className="private-badge">🔒 非公開</span>
                          )}
                        </div>
                        <div className="entry-body">
                          <div className="entry-text">{entry.entry_text}</div>
                          {entry.photo_url && (
                            <div className="entry-photo">
                              <img
                                src={entry.photo_url}
                                alt="日記の写真"
                                onError={(e) => {
                                  console.error('写真の読み込みエラー:', entry.photo_url)
                                  e.target.style.display = 'none'
                                  const errorDiv = document.createElement('div')
                                  errorDiv.className = 'photo-error'
                                  errorDiv.style.cssText = 'padding: 10px; background: #fee; color: #c33; border-radius: 4px; font-size: 0.9em;'
                                  errorDiv.textContent = '⚠️ 写真の読み込みに失敗しました'
                                  if (!e.target.parentElement.querySelector('.photo-error')) {
                                    e.target.parentElement.appendChild(errorDiv)
                                  }
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}