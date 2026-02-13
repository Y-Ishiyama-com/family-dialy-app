# 「今日のお題」機能 デプロイチェックリスト

## Pre-デプロイ チェック

### 環境確認
- [ ] AWS CLIがインストール済み
- [ ] AWS認証情報が設定済み（`aws configure` で確認）
- [ ] Node.js 18+ がインストール済み
- [ ] Python 3.11+ がインストール済み
- [ ] AWS CDK v2 がインストール済み (`npm install -g aws-cdk`)

### Bedrockの準備
- [ ] AWSコンソール → Bedrock → Model Access にアクセス
- [ ] 「anthropic.claude-3-sonnet-20240229-v1:0」にアクセスリクエストを送信
- [ ] ステータスが「Access granted」になるまで待機（数分～数時間）
- [ ] **重要**: Bedrockへのアクセスが有効なリージョンで作業する
  - [ ] 東京リージョン (ap-northeast-1) → 東京でのアクセスは確認不要
  - [ ] その他リージョン → 該当リージョンで有効化が必要

### コード確認
- [ ] `backend/prompt_generator_lambda.py` が作成済み
- [ ] `backend/models.py` に `DailyPrompt` クラスが追加済み
- [ ] `backend/database.py` にプロンプト関連メソッドが追加済み
- [ ] `backend/api_handler.py` に `/prompt` エンドポイントが追加済み
- [ ] `infrastructure/lib/main-stack.ts` が更新済み
  - [ ] `diaryPromptsTable` が定義されている
  - [ ] `promptGeneratorFunction` Lambda が定義されている
  - [ ] EventBridgeルール `promptGenerationRule` が定義されている
- [ ] `frontend/src/components/DailyPrompt.jsx` が作成済み
- [ ] `frontend/src/components/DailyPrompt.css` が作成済み
- [ ] `frontend/src/services/apiService.js` に `getPrompt()` が追加済み
- [ ] `frontend/src/pages/DiaryPage.jsx` が更新済み

## デプロイ手順

### ステップ1: CDKの準備
```bash
cd infrastructure
npm install
```

### ステップ2: CDKのブートストラップ（初回のみ）
```bash
cdk bootstrap
```

### ステップ3: リソースを確認
```bash
cdk diff
# 新しく追加されるリソースを確認
# - diary_prompts テーブル
# - family-diary-prompt-generator Lambda
# - DailyPromptGenerationRule EventBridge ルール
```

### ステップ4: CDKでデプロイ
```bash
cdk deploy
# y を入力してデプロイを開始
```

**デプロイ時間**: 通常5～10分

### ステップ5: フロントエンドの更新
```bash
cd frontend
npm run build
# または開発サーバーで動作確認
npm run dev
```

## Post-デプロイ 検証

### 自動検証スクリプト実行
```bash
python3 docs/verify_deployment.py
```

このスクリプトは以下を確認します：
- Bedrockへのアクセス
- DynamoDBテーブルの存在
- Lambda関数の設定
- EventBridgeルール設定
- Lambda直接実行テスト
- DynamoDBのデータ確認

### 手動検証

#### 1. Lambda 関数の動作確認
```bash
# Lambda 関数を直接実行
aws lambda invoke \
  --function-name family-diary-prompt-generator \
  --payload '{}' \
  response.json

# レスポンスを確認
cat response.json
# 成功例: { "statusCode": 200, "body": {...} }
```

#### 2. DynamoDB の確認
```bash
# AWS CloudShell または AWS CLI で実行
aws dynamodb get-item \
  --table-name diary_prompts \
  --key '{"date": {"S": "2024-12-15"}}'
# item が返されれば OK
```

#### 3. EventBridge ルールの確認
```bash
# ルールが有効になっているか確認
aws events describe-rule \
  --name DailyPromptGenerationRule-Updated

# ターゲットが設定されているか確認
aws events list-targets-by-rule \
  --rule DailyPromptGenerationRule-Updated
```

#### 4. CloudWatch Logs の確認
```bash
aws logs tail /aws/lambda/family-diary-prompt-generator --follow
# Lambda の実行ログをリアルタイムで表示
```

#### 5. フロントエンド動作確認
1. ブラウザで日記編集ページ を開く
2. 開発者ツール → Network タブ
3. API リクエスト `/prompt` をチェック
   - Status: 200
   - Response に prompt フィールドがあるか確認
4. DailyPrompt コンポーネントがお題を表示しているか確認
5. 日付変更時にお題が更新されるか確認

## トラブルシューティング

### エラー: "Bedrock へのアクセス拒否"
```
Error: User is not authorized to perform: bedrock:InvokeModel
```
**解決方法**:
1. AWSコンソール → Bedrock → Model Access
2. 「anthropic.claude-3-sonnet-20240229-v1:0」への アクセス許可を確認
3. ステータスが「Access granted」であることを確認
4. 数分待機後に再度テスト

### エラー: "DynamoDB テーブルが見つからない"
```
Error: Requested resource not found
```
**解決方法**:
```bash
# CDK デプロイを再実行
cdk deploy
```

### エラー: "Lambda タイムアウト"
```
At 2024-12-15T09:00:00Z Lambda function timed out
```
**解決方法**:
1. `main-stack.ts` の `promptGeneratorFunction` タイムアウトを増やす
   ```typescript
   timeout: cdk.Duration.seconds(120),  // 60秒から120秒に変更
   ```
2. CDK デプロイ実行

### EventBridge が実行されない
**チェック項目**:
- [ ] EventBridge ルールが「有効」になっているか
  ```bash
  aws events describe-rule --name DailyPromptGenerationRule-Updated
  # "State": "ENABLED" であることを確認
  ```
- [ ] Lambda にルールの実行権限があるか
  ```bash
  aws lambda get-policy --function-name family-diary-prompt-generator
  ```
- [ ] CloudWatch Logs でルールの実行履歴を確認
  ```bash
  aws logs tail /aws/events/ --follow
  ```

### お題がフロントエンドに表示されない
**チェック項目**:
1. ブラウザコンソール (F12) でエラーを確認
2. Network タブで `/prompt` リクエストをチェック
   - Status が 200 か確認
   - Response に `prompt` フィールドがあるか確認
3. API Gateway がエンドポイントを公開しているか確認
4. CORS設定が正しいか確認

## ロールバック方法

CDK デプロイ前の状態に戻す場合：

```bash
# リソースを削除
cdk destroy

# 確認メッセージで "y" を入力
```

**注意**: このコマンドでDynamoDB テーブルもすべて削除されます。重要なデータがある場合は before削除してください。

## 本番環境へのデプロイ

### 推奨事項
- [ ] CloudWatch アラーム を設定 (Lambda エラー、DynamoDB トロットリング)
- [ ] DynamoDB バックアップ を有効化
- [ ] Lambda 層 で依存関係を管理
- [ ] タイム ゾーン対応 (複数タイムゾーン対応の場合)
- [ ] お題のバリエーション強化 (複数プロンプトテンプレート)

### セキュリティチェック
- [ ] Lambda IAMロール の最小権限設定 ✓（既に設定済み）
- [ ] DynamoDB 暗号化 有効 ✓（既に設定済み）
- [ ] API Gateway 認証 有効 ✓（JWT認証）
- [ ] CORS 設定 確認

---

**最終確認日**: 2024年12月
**ステータス**: ✓ 実装完了、デプロイ準備完了
