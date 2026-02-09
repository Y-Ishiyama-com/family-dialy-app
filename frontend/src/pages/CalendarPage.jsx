/**
 * カレンダーページ
 * 家族の公開エントリを月別にリスト表示
 */

import { useState, useEffect } from 'react'
import { getFamilyCalendar } from '../services/apiService'
import FamilyCalendar from '../components/FamilyCalendar'
import './CalendarPage.css'

export default function CalendarPage() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 月のエントリを読み込み
  useEffect(() => {
    loadCalendarEntries()
  }, [currentYear, currentMonth])

  const loadCalendarEntries = async () => {
    setLoading(true)
    setError('')

    try {
      const data = await getFamilyCalendar(currentYear, currentMonth)
      setEntries(data.entries || [])
    } catch (err) {
      setError(err.message || 'カレンダーの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

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
          <h1>📅 家族カレンダー</h1>
          <p className="subtitle">家族の公開した日記を見てみよう</p>
        </div>

        {error && <div className="error-message">{error}</div>}

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
          <FamilyCalendar year={currentYear} month={currentMonth} entries={entries} />
        )}
      </div>
    </div>
  )
}
