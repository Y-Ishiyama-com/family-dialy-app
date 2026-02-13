# GitHub Actions CI/CD 実装ガイド

Family Diary App のための包括的な GitHub Actions CI/CD パイプラインが実装されました。

## 🎯 概要

4つのワークフローで構成された完全なCI/CDパイプライン：

| ワークフロー | トリガー | 目的 | 実行時間 |
|-------------|---------|------|---------|
| **Deploy to AWS** | main ブランチへの push | メインデプロイ | ~10分 |
| **PR Checks** | Pull Request 作成・更新 | PR検証 | ~5分 |
| **Security & Quality** | PR・Push（main） | セキュリティ・コード品質 | ~5分 |
| **Integration Tests** | 手動実行・毎日10:00 UTC | システム統合テスト | ~3分 |
| **Pre-Deployment Verify** | デプロイ後・手動実行 | デプロイ検証 | ~3分 |

---

## 📁 ワークフローファイル構成

```
.github/workflows/
├── deploy.yml                    # メインデプロイワークフロー
├── pr-check.yml                  # PR検証ワークフロー
├── security-checks.yml           # セキュリティ・品質チェック
├── integration-tests.yml         # 統合テスト
└── verify-deployment.yml         # デプロイ検証
```

---

## 1️⃣ Deploy to AWS ワークフロー

### トリガー
- `main` ブランチへの `push`
- Pull Request の作成・更新（テストのみ）
- 手動実行（`workflow_dispatch`）

### ジョブ構成

#### 1. `test-frontend`
```yaml
目的: フロントエンドのテスト・バリデーション
実行内容:
  - Node.js 18 セットアップ
  - npm install
  - npm run test (存在する場合)
  - npm run lint (存在する場合)
```

#### 2. `test-backend`
```yaml
目的: バックエンドのテスト・バリデーション
実行内容:
  - Python 3.11 セットアップ
  - pip install requirements.txt
  - pytest 実行
  - Lambda 関数の Python コンパイルチェック
  - モジュールインポート検証
```

#### 3. `deploy-backend` (main push 時のみ)
```yaml
目的: インフラ・Lambda をデプロイ
実行内容:
  - AWS OIDC 認証
  - CDK dependencies インストール
  - npm run build (TypeScript コンパイル)
  - cdk deploy (CloudFormation デプロイ)
  - Bedrock アクセス確認
  - DynamoDB テーブル検証
  - Lambda 関数存在確認
  - EventBridge ルール確認
依存: test-frontend, test-backend が成功
```

#### 4. `deploy-frontend` (main push 時のみ)
```yaml
目的: React アプリを S3・CloudFront にデプロイ
実行内容:
  - AWS OIDC 認証
  - npm install
  - npm run build (Vite ビルド)
  - S3 sync（キャッシュ設定付き）
  - CloudFront キャッシュ無効化
  - デプロイ検証
環境変数:
  - VITE_API_ENDPOINT
  - VITE_COGNITO_DOMAIN
  - VITE_COGNITO_CLIENT_ID
  - VITE_COGNITO_REDIRECT_URI
依存: deploy-backend が成功
```

### 環境変数

```yaml
AWS_REGION: us-west-2
NODE_VERSION: '18'
PYTHON_VERSION: '3.11'
BEDROCK_MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0'
```

### 使用する Secrets

```
AWS_ROLE_ARN                    # GitHub Actions 用 IAM ロール ARN
S3_BUCKET_NAME                  # フロントエンド S3 バケット
CLOUDFRONT_DISTRIBUTION_ID      # CloudFront ディストリビューション ID
VITE_API_ENDPOINT               # API Gateway エンドポイント
VITE_COGNITO_DOMAIN             # Cognito ドメイン
VITE_COGNITO_CLIENT_ID          # Cognito クライアント ID
VITE_COGNITO_REDIRECT_URI       # Cognito リダイレクト URI
```

---

## 2️⃣ PR Checks ワークフロー

### トリガー
- Pull Request 作成・更新（main ブランチ対象）

### ジョブ構成

#### 1. `lint-frontend`
- Node.js セットアップ
- npm lint 実行

#### 2. `build-frontend`
- Node.js セットアップ
- npm run build 実行

#### 3. `build-infrastructure`
- Node.js セットアップ
- npm run build (TypeScript コンパイル)
- `cdk synth` (CloudFormation テンプレート生成)

#### 4. `test-backend`
- Python セットアップ
- pytest 実行

#### 5. `validate-backend`
- Python ファイルのコンパイルチェック
- モジュールインポート検証

#### 6. `pr-summary`
- すべてのジョブの結果をサマリー表示

---

## 3️⃣ Security & Quality Checks ワークフロー

### トリガー
- Pull Request 作成・更新
- main ブランチへの push

### チェック項目

#### 1. `dependency-check`
```
- npm audit (Frontend)
- npm audit (Infrastructure)
  警告レベル: moderate
```

#### 2. `python-security`
```
- bandit (セキュリティ脆弱性検査)
- safety (依存関係の既知脆弱性チェック)
```

#### 3. `code-quality`
```
- flake8 (PEP 8 スタイルチェック)
- pylint (コード品質スコアリング)
  最小スコア: 7.0
```

#### 4. `infrastructure-validation`
```
- TypeScript コンパイル
- CDK synth
- CDK context 検証
```

---

## 4️⃣ Integration Tests ワークフロー

### トリガー
- 手動実行（`workflow_dispatch`）
- 毎日 10:00 UTC に自動実行（スケジュール）

### テスト項目

#### 1. `test-prompt-generation`
```
検証内容:
  - DynamoDB diary_prompts テーブル状態
  - Lambda family-diary-prompt-generator 存在確認
  - Lambda 関数直接実行
  - DynamoDB にお題が保存されているか確認
```

#### 2. `test-api-endpoint`
```
検証内容:
  - API Gateway エンドポイント設定確認
  - /health エンドポイントレスポンス確認
```

#### 3. `test-eventbridge-rule`
```
検証内容:
  - EventBridge ルール DailyPromptGenerationRule 確認
  - ルールの有効/無効状態確認
  - スケジュール表現確認
  - Lambda ターゲット設定確認
```

---

## 5️⃣ Pre-Deployment Verification ワークフロー

### トリガー
- Deploy ワークフロー完了後（自動）
- 手動実行（`workflow_dispatch`）

### 検証項目

#### 1. `verify-deployment`
```
検証内容:
  ✓ deployment verification スクリプト実行
  ✓ Lambda 関数設定確認
  ✓ DynamoDB テーブル確認
  ✓ API Gateway ヘルスチェック
  ✓ S3 バケット内容確認
  ✓ CloudFront ディストリビューション確認
```

---

## 🔐 セットアップ手順

### ステップ 1: AWS OIDC Provider 設定

```bash
# OIDC Provider 作成
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### ステップ 2: IAM ロール作成

```bash
# Trust Policy を編集（docs/github-actions-trust-policy.json）
# YOUR_GITHUB_USERNAME を実際のユーザー名に変更

aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document file://docs/github-actions-trust-policy.json

# 権限を付与
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# ARN を取得
aws iam get-role \
  --role-name GitHubActionsDeployRole \
  --query 'Role.Arn' \
  --output text
```

### ステップ 3: GitHub Secrets 設定

GitHub リポジトリ → Settings → Secrets and variables → Actions

以下 7 つの Secret を設定：

```
AWS_ROLE_ARN                              = arn:aws:iam::ACCOUNT_ID:role/GitHubActionsDeployRole
S3_BUCKET_NAME                            = family-diary-app-stack-dev-websitebucket...
CLOUDFRONT_DISTRIBUTION_ID                = E33OL17IXJUU9J
VITE_API_ENDPOINT                         = https://XXXXX.execute-api.us-west-2.amazonaws.com/prod/
VITE_COGNITO_DOMAIN                       = family-diary-app-XXXX.auth.us-west-2.amazoncognito.com
VITE_COGNITO_CLIENT_ID                    = 1nc230a14fr7k8jn4va0r8ulcd
VITE_COGNITO_REDIRECT_URI                 = https://d1l985y7ocpo2p.cloudfront.net/
```

### ステップ 4: テストデプロイ

```bash
# リポジトリにコミット
git add .github/workflows/*
git commit -m "ci: Add GitHub Actions CI/CD workflows"
git push origin main

# GitHub Actions タブで実行確認
```

---

## 📊 ワークフロー実行フロー

```
┌─────────────────────────────────────────────┐
│ Event: PR created/updated on main branch    │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
   ┌─────────────┐   ┌──────────────────┐
   │ PR Checks   │   │ Security Checks  │
   ├─────────────┤   ├──────────────────┤
   │✓ Lint FE    │   │✓ Dep check       │
   │✓ Build FE   │   │✓ Bandit/Safety  │
   │✓ Build Infra│   │✓ Code quality   │
   │✓ Test BE    │   │✓ CDK validate   │
   │✓ Validate BE│   └──────────────────┘
   └─────────────┘
        │
        └─────────────┬──────────────────┐
                      ▼                   ▼ (if approved)
                  ┌────────────────┐  ┌──────────────┐
                  │ PR Approved    │  │ Merge to main│
                  └────────────────┘  └──────┬───────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │ Deploy to AWS    │
                                    ├──────────────────┤
                                    │✓ Test FE         │
                                    │✓ Test BE         │
                                    │✓ Deploy Backend  │
                                    │✓ Deploy Frontend │
                                    └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │ Verify Deployment│
                                    ├──────────────────┤
                                    │✓ Check Lambda    │
                                    │✓ Check DynamoDB │
                                    │✓ Check API       │
                                    │✓ Check S3/CF     │
                                    └──────────────────┘
```

---

## 🚀 デプロイフロー

### 開発時
```
Feature Branch → PR → PR Checks + Security → Merge → Deploy
```

### 本番環境（main ブランチ）
```
Push to main → Test FE/BE → Deploy Backend → Deploy Frontend → Verify
        ↓
    ~10分かかる
```

### 統合テスト（手動・自動）
```
毎日 10:00 UTC または 手動トリガー
    ↓
Prompt Generation 確認
API Health Check
EventBridge ルール確認
```

---

## 📈 CI/CD メトリクス

### テスト カバレッジ
- ✓ Frontend: Linting + Build
- ✓ Backend: Unit Tests + Syntax Check
- ✓ Infrastructure: CDK Synth Validation
- ✓ Security: Dependency + Code Quality

### デプロイ時間
- PR Check: ~5分
- Deploy: ~10分
- Verify: ~3分

### 失敗時の対応
- PR Check 失敗: マージ不可
- Deploy 失敗: 自動ロールバック（CloudFormation）
- Verify 失敗: アラート通知

---

## 🔧 トラブルシューティング

### OIDC 認証エラー
```
Error: Unable to assume role with OIDC token
```
**解決方法**:
1. Trust Policy の `YOUR_GITHUB_USERNAME` を確認
2. OIDC Provider が正しく作成されているか確認
3. IAM ロル ARN が正しいか確認

### デプロイ権限不足
```
Error: User is not authorized
```
**解決方法**:
```bash
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

### Lambda タイムアウト
```
Task timed out after 60.00 seconds
```
**解決方法**:
`main-stack.ts` でタイムアウトを増やす：
```typescript
timeout: cdk.Duration.seconds(120),
```

---

## 📚 関連ドキュメント

- [GitHub Actions セットアップガイド](./GITHUB_ACTIONS_SETUP.md)
- [クイックスタート](./QUICKSTART_GITHUB_ACTIONS.md)
- [デプロイメントチェックリスト](./DEPLOYMENT_CHECKLIST.md)
- [「今日のお題」機能ドキュメント](./DAILY_PROMPT_FEATURE.md)

---

**作成日**: 2024年12月  
**最終更新**: 2024年12月  
**ステータス**: ✅ 実装完了、本番対応可
