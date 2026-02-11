/**
 * バックエンド統合テスト用スクリプト
 * ブラウザコンソールで実行して API 動作確認
 */

// テスト環境設定
window.TEST = {
  API_ENDPOINT: 'http://localhost:8000',
  
  // テスト 1: ヘルスチェック
  async testHealth() {
    try {
      const response = await fetch(`${this.API_ENDPOINT}/health`)
      const data = await response.json()
      console.log('✅ ヘルスチェック成功:', data)
      return data
    } catch (error) {
      console.error('❌ ヘルスチェック失敗:', error)
      return null
    }
  },

  // テスト 2: ルートエンドポイント
  async testRoot() {
    try {
      const response = await fetch(`${this.API_ENDPOINT}/`)
      const data = await response.json()
      console.log('✅ ルートエンドポイント成功:', data)
      return data
    } catch (error) {
      console.error('❌ ルートエンドポイント失敗:', error)
      return null
    }
  },

  // テスト 3: Swagger UI アクセス確認
  async testDocsAvailable() {
    try {
      const response = await fetch(`${this.API_ENDPOINT}/docs`)
      if (response.ok) {
        console.log('✅ Swagger UI アクセス可能')
        console.log(`   URL: ${this.API_ENDPOINT}/docs`)
        return true
      }
    } catch (error) {
      console.error('❌ Swagger UI アクセス失敗:', error)
      return false
    }
  },

  // テスト すべて実行
  async runAllTests() {
    console.log('🧪 統合テスト開始\n')
    console.log('バックエンド API テスト')
    console.log('========================')
    
    await this.testRoot()
    await this.testHealth()
    await this.testDocsAvailable()
    
    console.log('\n✨ テスト完了')
    console.log('\nフロントエンド側からの API 接続テスト:')
    console.log('  TEST.testHealth()   - ヘルスチェック')
    console.log('  TEST.testRoot()     - ルートエンドポイント')
    console.log('  TEST.testDocsAvailable() - Swagger UI確認')
  }
}

// 自動実行
window.TEST.runAllTests()
