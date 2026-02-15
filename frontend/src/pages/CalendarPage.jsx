/**
 * カレンダーページ
 * 公開日記（全ユーザー）と非公開日記（自分のみ）を切り替え表示
 */

import { useState, useEffect } from 'react'
import { getFamilyCalendar, getMyCalendar, getPrompt } from '../services/apiService'
import FamilyCalendar from '../components/FamilyCalendar'
import './CalendarPage.css'

export default function CalendarPage() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [entries, setEntries] = useState([])
  const [prompts, setPrompts] = useState({}) // 日付ごとのお題
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('public') // 'public' or 'private'

  // 指定日のお題を取得
  const loadPromptsForMonth = async () => {
    try {
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
      const promptsData = {}

      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        try {
          const response = await getPrompt(date)
          if (response && response.prompt) {
            promptsData[date] = response.prompt
          }
        } catch (err) {
          // 各日付のお題取得エラーは無視
          console.log(`お題の取得に失敗しました: ${date}`)
        }
      }

      setPrompts(promptsData)
    } catch (err) {
      console.error('月間お題の取得に失敗:', err)
    }
  }

  // 月のエントリを読み込み
  useEffect(() => {
    const loadCalendarEntries = async () => {
      setLoading(true)
      setError('')

      try {
        let data
        if (activeTab === 'public') {
          // 公開日記（全ユーザー）
          data = await getFamilyCalendar(currentYear, currentMonth)
        } else {
          // 非公開日記（自分のみ）
          data = await getMyCalendar(currentYear, currentMonth)
          // 非公開日記のみフィルタリング
          const filteredEntries = (data.entries || []).filter(entry => !entry.is_public)
          data = { entries: filteredEntries }
        }
        setEntries(data.entries || [])
      } catch (err) {
        setError(err.message || 'カレンダーの読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }

    loadCalendarEntries()
    loadPromptsForMonth()
  }, [currentYear, currentMonth, activeTab])

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const handleToday = () => {
    const now = new Date()
    setCurrentYear(now.getFullYear())
    setCurrentMonth(now.getMonth() + 1)
  }

  const monthName = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(currentYear, currentMonth - 1, 1))

  return (
    <div className="calendar-page">
      <div className="calendar-container">
        <div className="calendar-header">
          <h1>📅 カレンダー</h1>
          <p className="subtitle">
            {activeTab === 'public' ? '家族の公開した日記を見てみよう' : '自分の非公開日記'}
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* タブ切り替え */}
        <div className="calendar-tabs">
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

        <div className="calendar-controls">
          <button className="nav-button" onClick={handlePrevMonth}>
            ← 前月
          </button>
          <button className="today-button" onClick={handleToday}>
            今月
          </button>
          <button className="nav-button" onClick={handleNextMonth}>
            来月 →
          </button>
        </div>

        <div className="calendar-title">{monthName}</div>

        {loading ? (
          <div className="loading-state">読み込み中...</div>
        ) : (
          <FamilyCalendar 
            year={currentYear}
            month={currentMonth}
            entries={entries}
            prompts={prompts}
          />
        )}
      </div>
    </div>
  )
}