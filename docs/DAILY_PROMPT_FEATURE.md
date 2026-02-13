# 「今日のお題」機能 実装ガイド

## 概要
毎日異なるテーマで日記を書く際のきっかけになる「お題」をBedrock（Claude 3 Sonnet）で生成し、日記編集画面に表示する機能です。

## 実装内容

### 1. **バックエンド（Backend）**

#### DynamoDBテーブル：`diary_prompts`
- **PK (Partition Key)**: `date` (YYYY-MM-DD形式)
- **属性**:
  - `prompt`: 生成されたお題テキスト
  - `category`: カテゴリ（seasonal, event, reflection, fun等）
  - `created_at`: 作成タイムスタンプ
  - `expireAt`: TTL属性（30日後に自動削除）

#### API エンドポイント

**GET /prompt**
```
パラメータ:
  - date (optional): 日付（YYYY-MM-DD形式、デフォルト：本日）

レスポンス例:
{
  "date": "2024-12-15",
  "prompt": "最近、新しく始めたことはありますか？",
  "category": "reflection",
  "created_at": "2024-12-15T09:00:00Z"
}
```

#### Lambda関数：`prompt_generator_lambda.py`
- **トリガー**: EventBridge（毎日UTC 00:00 = JST 09:00）
- **処理内容**:
  1. 過去14日間のお題をDynamoDBから取得
  2. Bedrockを呼び出してお題を生成
  3. 季節・特別な日付情報をプロンプトに含める
  4. 生成されたお題をDynamoDBに保存
  5. 重複チェック（既に本日のお題が存在しないか確認）

**Bedrockプロンプト**:
- 前向きで思考を促す内容
- 季節・イベント・天気などの状況を考慮
- 過去のお題と異なる観点でのテーマ
- 家族向けのテーマ設定

### 2. **インフラストラクチャ（CDK）**

#### リソース追加

**DynamoDBテーブル** (`main-stack.ts`)
```typescript
const diaryPromptsTable = new dynamodb.Table(this, 'DiaryPromptsTable', {
  tableName: 'diary_prompts',
  partitionKey: { name: 'date', type: AttributeType.STRING },
  ttl: { attribute: 'expireAt', enabled: true }
})
```

**Lambda関数** (`main-stack.ts`)
```typescript
const promptGeneratorFunction = new lambda.Function(...)
- 環境変数: DYNAMODB_PROMPTS_TABLE_NAME, BEDROCK_MODEL_ID
- Bedrock呼び出し権限が必要
```

**EventBridgeルール** (`main-stack.ts`)
```typescript
// 毎日UTC 00:00 (JST 09:00)に実行
schedule: Schedule.cron({ hour: '0', minute: '0' })
```

### 3. **フロントエンド（Frontend）

#### 新コンポーネント：`DailyPrompt.jsx`
- お題を表示するコンポーネント
- カテゴリに応じたアイコン表示
- ローディング状態とエラーハンドリング

#### 既存コンポーネント更新
**`DiaryPage.jsx`**:
- DailyPromptコンポーネントを組み込み
- `getPrompt()` APIを日記読み込み時に呼び出し
- 日付変更時にお題も自動更新

**`apiService.js`**:
- 新メソッド追加: `getPrompt(date)`

## デプロイ手順

### 前提条件
- AWS CDKがインストール済み
- AWS認証情報が設定済み
- Bedrockモデルへのアクセスが有効（初回はAWSコンソールで有効化が必要）

### 1. Bedrockへのアクセス許可（初回のみ）
1. AWSコンソール → Bedrock → Model Access
2. Claude 3 Sonnet (anthropic.claude-3-sonnet-20240229-v1:0) にアクセス許可を付与
3. 数分待機

### 2. CDKデプロイ
```bash
cd infrastructure
npm install  # 初回のみ
cdk deploy   # デプロイ実行
```

**デプロイで追加されるリソース**:
- DynamoDBテーブル: `diary_prompts`
- Lambda関数: `family-diary-prompt-generator`
- EventBridgeルール: `DailyPromptGenerationRule`
- IAM ロール・ポリシー

### 3. Lambdaレイヤーの更新（オプション）
Bedrockが比較的新しいサービスなため、Lambda環境にboto3の最新版が必要な場合があります：

```bash
# Lambda Layerの作成（オプション）
python3 -m venv layer_env
source layer_env/bin/activate  # Windows: layer_env\Scripts\activate
pip install --target python boto3>=1.28.0

# レイヤーをZIP化
zip -r lambda-layer.zip python/

# CDKで参照（main-stack.tsで設定）
```

## 動作確認

### ローカルテスト（開発環境）
```python
# prompt_generator_lambda.pyを直接実行
import prompt_generator_lambda
event = {}
context = None
result = prompt_generator_lambda.lambda_handler(event, context)
print(result)
```

### AWS上での動作確認
1. **CloudWatch Logs確認**:
   - Lambda関数のログを確認
   - エラーがないか確認

2. **DynamoDB確認**:
   - 本日の日付でitemが存在するか確認
   - `prompt`フィールドにお題が保存されているか確認

3. **フロントエンド確認**:
   - ブラウザの開発者ツール → Network タブ
   - `/prompt` APIリクエストが成功しているか確認
   - DailyPromptコンポーネントがお題を表示しているか

### 手動テスト（EventBridge前）
```bash
# AWS CLIでLambda関数を直接実行
aws lambda invoke \
  --function-name family-diary-prompt-generator \
  --payload '{}' \
  response.json

cat response.json
```

## トラブルシューティング

### Bedrockが呼び出せない
- [ ] Model Accessで Claude 3 Sonnet を有効化したか
- [ ] IAM ロールに `bedrock:InvokeModel` 権限があるか
- [ ] リージョンが Bedrock をサポートしているか (us-east-1, us-west-2, ap-northeast-1等)

### お題が生成されない
- [ ] DynamoDB テーブル `diary_prompts` が存在するか
- [ ] Lambda関数に `DYNAMODB_PROMPTS_TABLE_NAME` 環境変数が設定されているか
- [ ] CloudWatch Logsでエラーメッセージを確認

### EventBridgeが実行されない
- [ ] EventBridgeルール `DailyPromptGenerationRule` が有効になっているか
- [ ] タイムゾーン設定が正確か（UTC 00:00 = JST 09:00）
- [ ] CloudWatch Logs でルールの実行履歴を確認

### フロントエンドに表示されない
- [ ] `/prompt` APIエンドポイントが DynamoDB にアクセスできるか
- [ ] API Gateway のエンドポイント正しいか
- [ ] ブラウザの Network タブで API レスポンスを確認

## 今後の拡張案

1. **複数言語対応**: 日本語以外のお題生成
2. **ユーザープリファレンス**: ユーザーの興味に基づくお題カスタマイズ
3. **ランキング**: 人気のあるお題の集計
4. **オフラインフォールバック**: お題生成失敗時のデフォルト質問セット
5. **AI学習**: ユーザーの日記内容に基づくお題最適化

## 参考資料

- [AWS Bedrock ドキュメント](https://docs.aws.amazon.com/bedrock/)
- [Claude API リファレンス](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [AWS CDK DynamoDB](https://docs.aws.amazon.com/cdk/latest/guide/work_with_cdk_v1.html)
- [AWS Lambda EventBridge](https://docs.aws.amazon.com/lambda/latest/dg/services-eventbridge.html)

---

**最終更新**: 2024年12月
**実装者向け注記**: このドキュメントは実装プロセス中に作成されました。環境に応じて追加の設定が必要な場合があります。
