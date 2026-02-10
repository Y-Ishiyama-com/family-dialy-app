# Family Diary App

🌍 家族4人で共有する一言日記Webアプリケーション。AWS上に完全デプロイ済みの本番環境で稼働しています。

**特徴**:
- 🔐 個人認証（Amazon Cognito + JWT）
- 🔄 RefreshToken自動更新（1時間ごとのログイン不要）
- 📝 公開/非公開日記の管理
- 📸 写真アップロード機能
- 👨‍👩‍👧‍👦 家族カレンダーで公開日記を共有
- 🌐 CloudFront配信で高速アクセス
- 🔒 API Gateway Cognito Authorizer + CORS制限
- 🛡️ API レート制限（月間5000リクエスト、50req/秒バースト）

## 本番環境

**URL**: https://d1l985y7ocpo2p.cloudfront.net

**テストユーザー**:
```
ユーザー名: test0
パスワード: parkS1203!
```

> ⚠️ テストユーザーのパスワードは本番環境では変更してください

---

## 技術スタック

| 層 | 技術 |
|---|---|
| **フロントエンド** | React 18 + Vite |
| **バックエンド** | Python 3.11 Lambda (boto3) |
| **API** | AWS API Gateway REST API |
| **認証** | Amazon Cognito (User Pool) |
| **データベース** | Amazon DynamoDB |
| **ストレージ** | Amazon S3 |
| **CDN** | CloudFront |
| **インフラコード** | AWS CDK (TypeScript) |

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│ ブラウザ (CloudFront: https://d1l985y7ocpo2p.cloudfront.net) │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
    ┌──────────┐          ┌───────────────┐
    │ Cognito  │          │  API Gateway  │
    │ User Pool│          │  (REST API)   │
    └────┬─────┘          └───────┬───────┘
         │                        │
         │                        ▼
         │                 ┌──────────────┐
         │                 │ Lambda       │
         │                 │ (api handler)│
         │                 └──────┬───────┘
         │                        │
         ├────────────┬───────────┤
         ▼            ▼           ▼
    ┌────────┐  ┌─────────┐  ┌────────┐
    │ DynamoDB│  │ S3      │  │ S3     │
    │ (diary) │  │(photos) │  │(dist)  │
    └─────────┘  └─────────┘  └────────┘
```

---

## プロジェクト構成

```
family-diary-app/
├── backend/
│   ├── api_handler.py          # Lambda handler (ルーティング・リクエスト処理)
│   ├── database.py             # DynamoDB/S3 操作
│   └── models.py               # データモデル
│
├── frontend/
│   ├── src/
│   │   ├── pages/              # ページコンポーネント (DiaryPage, CalendarPage)
│   │   ├── components/         # UI コンポーネント
│   │   ├── services/           # API呼び出し、認証処理
│   │   ├── config/             # AWS設定
│   │   └── App.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── dist/                   # ビルド出力（S3にホストされる）
│
└── infrastructure/
    ├── bin/
    │   └── app.ts              # CDK エントリーポイント
    ├── lib/
    │   └── main-stack.ts       # メインスタック（API Gateway, Lambda, Cognito, DynamoDB, S3, CloudFront）
    ├── cdk.json
    └── package.json
```

---

## クイックスタート（本番環境利用）

本番環境はすでにデプロイ済みです。以下URLにアクセスしてください:

```
https://d1l985y7ocpo2p.cloudfront.net
```

テストユーザーでログインして機能をお試しください。

---

## ローカル開発セットアップ

### 前提条件

- **Node.js** 18.0.0以上
- **Python** 3.11以上
- **AWS CLI** v2 (デプロイする場合)
- **Git**

### 1. リポジトリをクローン

```bash
git clone <repository-url>
cd family-diary-app
```

### 2. フロントエンド環境構築

```bash
cd frontend
npm install
```

### 3. バックエンド環境構築（オプション）

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

---

## ローカル開発実行

### フロントエンドのみ（推奨）

```bash
cd frontend
npm run dev
```

ブラウザで http://localhost:5173 にアクセス。本番APIに接続します。

### フロント + バックエンド（ローカルAPI）

```bash
# ターミナル1: バックエンド起動
cd backend
source venv/bin/activate  # または venv\Scripts\activate (Windows)
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# ターミナル2: フロントエンド起動
cd frontend
npm run dev
```

フロントエンドの `.env.local` で以下を設定:

```env
VITE_API_ENDPOINT=http://localhost:8000
VITE_COGNITO_DOMAIN=<your-cognito-domain>
VITE_COGNITO_CLIENT_ID=<your-client-id>
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/
VITE_AWS_REGION=us-west-2
```

---

## デプロイ

本番環境への変更をデプロイする手順:

### バックエンド変更のデプロイ

```bash
cd infrastructure
npm run build
cdk deploy --require-approval never
```

### フロントエンド変更のデプロイ

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://family-diary-app-stack-dev-websitebucket75c24d94-p25qzd67wmex/ --delete
aws cloudfront create-invalidation --distribution-id E33OL17IXJUU9J --paths "/*"
```

### フロントエンド + バックエンド両方デプロイ

```bash
# バックエンド先行デプロイ（必要な場合）
cd infrastructure
npm run build
cdk deploy --require-approval never

# フロントエンド後にデプロイ
cd ../frontend
npm run build
aws s3 sync dist/ s3://family-diary-app-stack-dev-websitebucket75c24d94-p25qzd67wmex/ --delete
aws cloudfront create-invalidation --distribution-id E33OL17IXJUU9J --paths "/*"
```

### レート制限の監視とメンテナンス

**月間利用状況の確認:**

```powershell
# Usage Plan IDを取得
$usagePlanId = aws apigateway get-usage-plans `
  --query "items[?name=='Family Diary Usage Plan'].id" --output text

# 今月の利用状況を確認
aws apigateway get-usage --usage-plan-id $usagePlanId `
  --start-date (Get-Date -Day 1).ToString("yyyy-MM-dd") `
  --end-date (Get-Date).ToString("yyyy-MM-dd")
```

**CloudWatch Metricsで429エラーを監視:**

```powershell
# 過去7日間の4XXエラー（429含む）を確認
aws cloudwatch get-metric-statistics `
  --namespace AWS/ApiGateway `
  --metric-name 4XXError `
  --dimensions Name=ApiName,Value="Family Diary API v2" `
  --start-time (Get-Date).AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ss") `
  --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
  --period 3600 `
  --statistics Sum
```

**レート制限の調整が必要な場合:**

[main-stack.ts](infrastructure/lib/main-stack.ts#L168) で以下の値を変更:
- `throttlingBurstLimit` - 瞬間最大リクエスト数
- `throttlingRateLimit` - 定常リクエスト/秒
- `quota.limit` - 月間クォータ

---

## 主な機能

### 📝 日記管理
- **公開日記**: 家族全員に表示
- **非公開日記**: 個人用（非表示）
- **作成, 編集, 削除**: フルCRUD対応

### 📸 写真機能
- 1日記あたり1枚の写真をアップロード可能
- Base64エンコーディングでLambda経由でS3に保存
- S3署名付きURLで安全にアクセス（24時間有効）

### 👨‍👩‍👧‍👦 家族カレンダー
- 月別の公開日記一覧表示
- タップして日記内容と写真を表示

### 🔐 認証
- **Amazon Cognitoによるユーザー管理**
  - JWT トークンベース認証
  - API Gateway Cognito Authorizer による自動検証
- **RefreshToken自動更新**
  - トークン有効期限: 1時間
  - 期限切れ5分前に自動更新
  - RefreshToken有効期限: 30日間
- **セキュリティ機能**
  - CORS制限（CloudFrontドメインのみ許可）
  - 401エラー時の自動ログアウト
  - Gateway Response設定で認証エラー時もCORS対応

### 🛡️ API Gateway レート制限

本番環境の安全性とコスト最適化のため、API Gatewayにレート制限を設定しています。

**設定値（家族4人向け緩め設定）:**

| 項目 | 設定値 | 説明 |
|------|--------|------|
| **Burst Limit** | 50リクエスト | 瞬間的に許容される最大リクエスト数 |
| **Rate Limit** | 20リクエスト/秒 | 定常的に処理できるリクエスト数 |
| **月間クォータ** | 5,000リクエスト | 1ヶ月あたりの総リクエスト数 |

**通常利用での消費予測:**
- 軽い利用（週2-3回）: 月間450リクエスト（9%）
- 通常利用（毎日1-2回）: 月間1,440リクエスト（29%）
- 積極的利用（毎日3-5回）: 月間3,600リクエスト（72%）

**レート制限到達時のレスポンス:**
```json
{
  "message": "Too Many Requests"
}
```
HTTPステータスコード: `429`

**保護対象:**
- DDoS攻撃
- ボット攻撃
- フロントエンドのバグ（無限ループなど）
- 意図しない高頻度アクセス

---

## API エンドポイント

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/diary/{date}` | 日記取得 |
| POST | `/diary/{date}` | 日記保存/更新 |
| DELETE | `/diary/{date}` | 日記削除 |
| POST | `/diary/{date}/photo` | 写真アップロード |
| GET | `/family/calendar/{year}/{month}` | 家族カレンダー取得 |
| GET | `/health` | ヘルスチェック |

**リクエスト形式**:
```json
{
  "entry_text": "本日の日記内容",
  "is_public": true,
  "photo_url": "https://..."
}
```

**写真アップロード**:
```json
{
  "image": "base64エンコードされた画像データ"
}
```

---

## 環境変数

### フロントエンド (.env.local)

```env
VITE_API_ENDPOINT=https://gu4ywyuipf.execute-api.us-west-2.amazonaws.com/prod/
VITE_COGNITO_DOMAIN=family-diary-app-<account-id>.auth.us-west-2.amazoncognito.com
VITE_COGNITO_CLIENT_ID=<Cognito Client ID>
VITE_COGNITO_REDIRECT_URI=https://d1l985y7ocpo2p.cloudfront.net/
VITE_AWS_REGION=us-west-2
```

### バックエンド (Lambda 環境変数)

Lambda関数に設定される環境変数（CDKで自動設定）:
- `DYNAMODB_TABLE` - DynamoDBテーブル名
- `S3_BUCKET` - S3フォトバケット名
- `COGNITO_USER_POOL_ID` - Cognito User Pool ID

---

## トラブルシューティング

### ログイン画面でエラーが出る

1. `.env.local` の Cognito 設定を確認
2. CloudFront でリダイレクトURLがホワイトリストに登録されているか確認

```bash
# Cognito User Pool のリダイレクトURL確認
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-west-2_c12cG3vOu \
  --client-id 1nc230a14fr7k8jn4va0r8ulcd
```

### 写真がアップロードできない

1. Lambda関数にS3権限があるか確認
2. S3バケットのCORS設定を確認
3. CloudWatch Logsで Lambda エラーを確認

```bash
# Lambda ログ確認
aws logs tail /aws/lambda/family-diary-api --follow
```

### RefreshTokenの動作確認

1. ログイン後、DevTools (F12) → **Console**
2. 以下のコマンドでトークン有効期限を確認:
```javascript
// LocalStorageのトークン有効期限を確認
const expiresAt = parseInt(localStorage.getItem('expires_at'))
const now = Date.now()
const minutesRemaining = Math.floor((expiresAt - now) / 60000)
console.log(`Token expires in ${minutesRemaining} minutes`)
console.log('RefreshToken:', localStorage.getItem('refresh_token') ? 'Available' : 'Missing')
```

3. 55分後に再度操作 → 自動的にトークンが更新されます
4. Consoleに `⏰ Token expiring soon, refreshing...` と `✅ Token refreshed successfully` が表示されることを確認

### 429エラー（Too Many Requests）が出る

**症状:** APIリクエストが `429 Too Many Requests` を返す

**原因と対処:**

1. **短時間に大量のリクエスト（開発/テスト時）**
   - バースト制限（50リクエスト）を超過
   - **対処:** 数秒待ってから再試行

2. **月間クォータ到達**
   - 月間5000リクエストを消費
   - **確認方法:**
   ```powershell
   # Usage Plan利用状況を確認
   aws apigateway get-usage-plans `
     --query "items[?name=='Family Diary Usage Plan'].id" --output text
   
   # 月初からの累積を確認
   aws apigateway get-usage --usage-plan-id <USAGE_PLAN_ID> `
     --start-date (Get-Date -Day 1).ToString("yyyy-MM-dd") `
     --end-date (Get-Date).ToString("yyyy-MM-dd")
   ```
   - **対処:** 月が変わるまで待つ、またはUsage Planの制限値を引き上げ

3. **フロントエンドのバグ（無限ループなど）**
   - ブラウザDevToolsのNetworkタブで異常なリクエストパターンを確認
   - **対処:** ページをリロード、ブラウザキャッシュをクリア

### CDK デプロイで失敗

```bash
# CDK出力をクリア
cd infrastructure
rm -rf cdk.out
npm run build
cdk deploy --require-approval never
```

---

## 本番環境の管理

### AWS リソース確認

```bash
# CloudFormation スタック確認
aws cloudformation list-stacks --query 'StackSummaries[?StackStatus!=`DELETE_COMPLETE`]'

# Lambda 関数確認
aws lambda list-functions --region us-west-2

# DynamoDB テーブル確認
aws dynamodb list-tables --region us-west-2

# S3 バケット確認
aws s3 ls
```

### CloudWatch ログ監視

```bash
# リアルタイムログ表示
aws logs tail /aws/lambda/family-diary-api --follow

# エラーのみ表示
aws logs filter-log-events /aws/lambda/family-diary-api --filter-pattern 'Error'
```

---

## ライセンス

MIT License

---

## 今後の改善予定

- [ ] JWT Authorizer有効化でセキュリティ強化
- [ ] リフレッシュトークン自動更新
- [ ] 複数枚写真のアップロード
- [ ] 画像最適化・サムネイル生成
- [ ] GitHub Actions CI/CD
- [ ] コスト最適化（DynamoDB On-Demand vs Provisioned）

---

**最終更新**: 2026年2月10日


