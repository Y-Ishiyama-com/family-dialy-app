/**
 * ヘッダーコンポーネント - アイコンベースナビゲーション
 */

import { Link, useLocation } from 'react-router-dom'
import { getUserId } from '../services/authService'
import './Header.css'

export default function Header({ onLogout }) {
  const location = useLocation()
  const userId = getUserId()

  const isActive = (path) => location.pathname === path

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          📔 Family Diary
        </div>

        <nav className="icon-nav">
          <Link 
            to="/" 
            className={`icon-nav-item ${isActive('/') ? 'active' : ''}`}
            title="日記"
          >
            <span className="icon">📝</span>
            <span className="icon-label">日記</span>
          </Link>
          <Link 
            to="/calendar" 
            className={`icon-nav-item ${isActive('/calendar') ? 'active' : ''}`}
            title="カレンダー"
          >
            <span className="icon">📅</span>
            <span className="icon-label">カレンダー</span>
          </Link>
        </nav>

        <div className="header-right">
          <span className="user-info">{userId?.replace('user#', '')}</span>
          <button className="logout-button" onClick={onLogout}>
            ログアウト
          </button>
        </div>
      </div>
    </header>
  )
}
