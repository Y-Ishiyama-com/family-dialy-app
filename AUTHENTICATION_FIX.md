# 認証問題の修正 - 完全ガイド

## 📋 問題の要約
ユーザーがログインに成功した直後に自動的にログアウトされてしまう問題が発生していました。

### 根本原因
1. **APIサービスの自動ログアウト**: API呼び出しで401エラーが返されると、アプリケーションが即座に全てのトークンをクリアして強制ログアウトしていた
2. **CDKデプロイメント問題**: infrastractureの変更がCDKに検出されず、修正したコードがデプロイされていなかった

---

## 🔧 実装された修正

### 1. **Lambda関数コード直接更新** (GitHub Actions ワークフロー)
**ファイル**: `.github/workflows/deploy.yml`

CDKのアセットハッシング問題を回避するため、CDKデプロイ後にAWS Lambda APIを使用して関数コードを直接更新します：

```yaml
- name: Force Update Lambda Function Code
  run: |
    cd backend
    zip -r lambda-deployment.zip api_handler.py prompt_generator_lambda.py database.py models.py requirements.txt
    
    # API Handler の更新
    aws lambda update-function-code \
      --function-name family-diary-api-handler \
      --zip-file fileb://lambda-deployment.zip \
      --region us-west-2
    
    # Prompt Generator の更新  
    aws lambda update-function-code \
      --function-name family-diary-prompt-generator \
      --zip-file fileb://lambda-deployment.zip \
      --region us-west-2
```

**効果**: CDKが「no changes」と報告しても、Lambda関数コードは確実に最新バージョンで実行される

---

### 2. **APIサービス: 401エラーハンドリング修正**
**ファイル**: `frontend/src/services/apiService.js`

```javascript
if (response.status === 401) {
  // localStorage に有効なトークンが存在するか確認
  const storedToken = localStorage.getItem('auth_token')
  const expiresAt = localStorage.getItem('expires_at')
  const now = Date.now()
  
  if (storedToken && expiresAt && parseInt(expiresAt) > now) {
    // トークンはまだ有効 - API side の一時的なエラーかもしれない
    // 自動ログアウトしない、エラーをスロー
    throw new Error('API returned 401 but token is still valid. Please refresh the page.')
  } else {
    // トークンが本当に期限切れ - ログアウト
    signOut()
    window.location.href = '/'
  }
}
```

**効果**: DOMContentLoaded時の404/429などの一時的なAPIエラーで誤ってログアウトされなくなる

---

### 3. **認証サービス: トークン管理** (既に実装済み)
**ファイル**: `frontend/src/services/authService.js`

✅ `isLoggedIn()` - 同期的にトークンの有効性を確認  
✅ `saveToken()` - JWT の `exp` クレームからトークン有効期限を抽出して保存  
✅ `appendLog()` - localStorage にデバッグログを保存（ブラウザコンソール: `window.viewAuthLogs()`)  

---

## ✅ テスト手順

### ステップ1: デプロイメント確認
```bash
# GitHub Actions ワークフローが実行されたことを確認
# https://github.com/Y-Ishiyama-com/family-dialy-app/actions

# 最新デプロイウィザード：
# 1. "Deploy to AWS" ワークフローが成功
# 2. "Force Update Lambda Function Code" ステップが完了
# 3. フロントエンドが S3 にアップロード済み
# 4. CloudFront キャッシュが無効化済み
```

### ステップ2: ログイン テスト
1. **CloudFront URL へアクセス**: https://d1l985y7ocpo2p.cloudfront.net
2. **ログインページで認証情報を入力**
3. **サインイン ボタンをクリック**
4. **ブラウザコンソールでログを確認**:
   ```javascript
   // ブラウザコンソールで実行
   window.viewAuthLogs()
   ```

### ステップ3: デバッグログの確認
期待されるログシーケンス：
```
[HH:MM:SS] 📝 [signIn] Attempting sign in for username: user@example.com
[HH:MM:SS] ✅ [signIn] Sign in successful, saving tokens...
[HH:MM:SS] 🔓 [saveToken] Decoded token exp: 1234567890
[HH:MM:SS] ✅ [saveToken] Token saved with expiry: 2024-01-01 12:34:56
[HH:MM:SS] ✅ [signIn] Tokens saved for user: user@example.com
[HH:MM:SS] 🔐 API Request: /diary/2024-01-01-public
[HH:MM:SS] ⏰ [isLoggedIn] Token valid: true, Remaining: 3599s
```

### ステップ4: トークン永続性テスト
1. **ログイン後、日記ページがロード**
2. **ブラウザをリロード** (F5)
3. **ユーザーがログインしたまま** (自動ログアウトされない)
4. **localStorage でトークン確認**:
   ```javascript
   localStorage.getItem('auth_token')    // JWT トークンが存在
   localStorage.getItem('expires_at')    // 有効期限がミリ秒で保存
   JSON.parse(localStorage.getItem('auth_debug_logs')).slice(-5)  // 最新5件のログ
   ```

---

## 🔍 トラブルシューティング

### 問題: `window.viewAuthLogs()` が undefined
**原因**: viewAuthLogs 関数が App.jsx で定義されていない  
**対策**: ブラウザコンソールで直接確認:
```javascript
JSON.parse(localStorage.getItem('auth_debug_logs')).forEach(log => console.log(log))
```

### 問題: ログイン後も「401 Unauthorized」エラーが表示される
**原因**: API側でトークン検証が失敗  
**対策**:
1. cloudFront キャッシュを完全にクリア
2. Lambda 関数が最新バージョンで実行されているか確認:
   ```bash
   aws lambda get-function-code-location \
     --function-name family-diary-api-handler \
     --region us-west-2
   ```

### 問題: ページリロード後にログアウト
**原因**: トークンの有効期限が切れている  
**対策**: 再度ログイン（トークンは1時間有効）

---

## 📊 コード変更サマリー

| フィル | 変更内容 | 効果 |
|------|-------|------|
| `.github/workflows/deploy.yml` | Lambda 直接更新ステップを追加 | CDK の "no changes" 問題を回避 |
| `frontend/src/services/apiService.js` | 401 ハンドラーで有効期限チェック | 有効なトークンで 401 受信時の誤ったログアウトを防止 |
| `frontend/src/services/authService.js` | ✅ 既に修正済み（isLoggedIn 同期化） | トークン状態の正確な確認 |

---

## 📈 期待される動作

### ✅修正前
1. ログイン実行 ✓
2. トークン保存 ✓
3. **ページ遷移時に API 呼び出し** → 401
4. **自動 signOut() が実行される** ✗
5. ユーザーが強制ログアウト ✗

### ✅ 修正後
1. ログイン実行 ✓
2. トークン保存 ✓
3. ページ遷移時に API 呼び出し → 401
4. **トークンの有効期限をチェック**
5. トークンが有効 → エラーを表示（ログアウトしない） ✓
6. ユーザーがログイン状態を維持 ✓

---

## 🚀 デプロイメント確認

### AWS Console での確認
```bash
# Lambda 関数が最新コードで実行されているか確認
aws lambda get-function \
  --function-name family-diary-api-handler \
  --region us-west-2 \
  --query 'Configuration.LastModified'

# DynamoDB テーブルが存在するか確認
aws dynamodb describe-table \
  --table-name diary_prompts \
  --region us-west-2

# API Gateway へのアクセステスト
curl -X GET https://gu4ywyuipf.execute-api.us-west-2.amazonaws.com/prod/health
```

---

## 📝 注意事項

- トークンの有効期限は **1時間** です（Cognito 設定に基づく）
- リフレッシュトークンは `getToken()` で自動的に使用されます（5分以内に期限切れの場合）
- localStorage のデバッグログは **最新100件** を保持します
- CloudFront キャッシュは各デプロイメント後に自動無効化されます

---

## 次のステップ

1. GitHub Actions でワークフロー実行完了を確認
2. CloudFront URL でアプリケーションにアクセス
3. ブラウザコンソールでデバッグログを確認
4. 複数の日記セッションでテスト

質問がある場合は、ブラウザコンソールのログメッセージを確認して共有してください。
