# GitHub Actions クイックスタート

GitHub Actions CI/CDを30分でセットアップするガイド

## 🚀 5ステップでセットアップ

### Step 1: OIDC Provider作成（5分）

```bash
# 1. OIDC Provider作成
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# 2. Trust Policyを編集
# docs/github-actions-trust-policy.json を開いて
# YOUR_GITHUB_USERNAME を実際のGitHubユーザー名に変更

# 3. IAMロール作成
aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document file://docs/github-actions-trust-policy.json

# 4. 開発環境用に広い権限を付与（本番は最小権限推奨）
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# 5. ARNを取得（メモしておく）
aws iam get-role --role-name GitHubActionsDeployRole --query 'Role.Arn' --output text
```

### Step 2: GitHub Secrets設定（5分）

GitHub Web UI で設定: https://github.com/YOUR_USERNAME/family-diary-app/settings/secrets/actions

**または GitHub CLI で一括設定:**

```bash
# 先に AWS から必要な情報を取得
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::$AWS_ACCOUNT_ID:role/GitHubActionsDeployRole"

# CDK アウトプットから取得（デプロイ後）
# CDK Deploy 実行後、以下を実行:
aws cloudformation describe-stacks \
  --stack-name family-diary-app-stack-dev \
  --query 'Stacks[0].Outputs' \
  --output table

# Secrets 設定
gh secret set AWS_ROLE_ARN --body "$ROLE_ARN"
gh secret set S3_BUCKET_NAME --body "family-diary-app-stack-dev-websitebucket75c24d94-p25qzd67wmex"
gh secret set CLOUDFRONT_DISTRIBUTION_ID --body "E33OL17IXJUU9J"
gh secret set VITE_API_ENDPOINT --body "https://gu4ywyuipf.execute-api.us-west-2.amazonaws.com/prod/"
gh secret set VITE_COGNITO_DOMAIN --body "family-diary-app-XXXX.auth.us-west-2.amazoncognito.com"
gh secret set VITE_COGNITO_CLIENT_ID --body "1nc230a14fr7k8jn4va0r8ulcd"
gh secret set VITE_COGNITO_REDIRECT_URI --body "https://d1l985y7ocpo2p.cloudfront.net/"
```

### Step 3: ワークフローファイル確認（1分）

すでに作成済み:
- `.github/workflows/deploy.yml`
- `.github/workflows/pr-check.yml`
- `.github/workflows/security-checks.yml`
- `.github/workflows/integration-tests.yml`
- `.github/workflows/verify-deployment.yml`

```bash
# 確認
ls -la .github/workflows/
```

### Step 4: テストデプロイ（5分）

```bash
# 軽微な変更をコミット
git add .github/workflows/*
git commit -m "ci: Setup GitHub Actions"
git push origin main

# GitHub Actionsページで実行確認
# https://github.com/YOUR_USERNAME/family-diary-app/actions
```

### Step 5: 動作確認（5分）

1. **Actions タブ**で "Deploy to AWS" ワークフローが実行されることを確認
2. すべてのジョブ（test-frontend, test-backend, deploy-backend, deploy-frontend）が成功
3. https://d1l985y7ocpo2p.cloudfront.net にアクセスして動作確認
4. 日記編集画面で「今日のお題」が表示されるか確認

---

## ✅ 完了チェックリスト

- [ ] AWS OIDC Provider作成済み
- [ ] IAMロール作成＆ARN取得済み
- [ ] GitHub Secrets 7項目設定済み
- [ ] mainブランチにpushして自動デプロイ成功
- [ ] 本番サイトで動作確認完了（日記・お題機能）

---

## 📋 必要な情報の取得コマンド

```bash
# S3バケット名
aws cloudformation describe-stacks \
  --stack-name family-diary-app-stack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucketName`].OutputValue' \
  --output text

# CloudFront Distribution ID
aws cloudformation describe-stacks \
  --stack-name family-diary-app-stack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text

# API Endpoint
aws cloudformation describe-stacks \
  --stack-name family-diary-app-stack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text

# Cognito ドメイン
aws cloudformation describe-stacks \
  --stack-name family-diary-app-stack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`CognitoDomainUrl`].OutputValue' \
  --output text

# Cognito クライアント ID
aws cloudformation describe-stacks \
  --stack-name family-diary-app-stack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`CognitoClientId`].OutputValue' \
  --output text
```

---

## 🔄 ワークフロー実行タイミング

| イベント | ワークフロー | 実行時間 |
|----------|-------------|---------|
| PR 作成・更新 | `PR Checks` + `Security & Quality` | ~5分 |
| main へのマージ | `Deploy to AWS` | ~10分 |
| デプロイ完了後 | `Pre-Deployment Verify` | ~3分 |
| 毎日 10:00 UTC | `Integration Tests` | ~3分 |

---

## 📚 詳細ドキュメント

- [🔐 詳細セットアップガイド](./GITHUB_ACTIONS_SETUP.md)
- [📊 CI/CD 完全ガイド](./GITHUB_ACTIONS_CI_CD.md)
- [📋 デプロイメント検証](./DEPLOYMENT_CHECKLIST.md)

---

## 🎓 Tips & Tricks

### ローカルで GitHub Actions をテスト

```bash
# act を使ってローカル実行
brew install act

# PR Check をテスト
act pull_request

# Deploy をテスト（本番環境注意）
act push
```

### ワークフロー実行ログ確認

```bash
# 最新の実行ログを取得
gh run list --workflow deploy.yml

# 詳細ログを表示
gh run view <RUN_ID> --log
```

### Secrets の確認（チェック用）

```bash
# 設定済み Secrets を確認
gh secret list
```

---

**初回セットアップ時間**: 約30分  
**継続的なメンテナンス**: なし（自動化対応）  
**本番環境対応**: ✅ 可能


# API Endpoint
aws cloudformation describe-stacks \
  --stack-name family-diary-app-stack-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text

# Cognito Client ID
aws cloudformation describe-stacks \
  --stack-name family-diary-app-stack-dev \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoClientId'].OutputValue" \
  --output text
```

---

## 🔧 よくあるエラー

### ❌ "AccessDenied" エラー

```bash
# 権限を再確認
aws iam get-role-policy --role-name GitHubActionsDeployRole --policy-name DeployPolicy
```

### ❌ "InvalidClientTokenId" エラー

```bash
# OIDC Providerが存在するか確認
aws iam list-open-id-connect-providers

# Trust Policyのリポジトリ名を再確認
aws iam get-role --role-name GitHubActionsDeployRole
```

### ❌ Secrets が読み込まれない

GitHubリポジトリ → Settings → Secrets and variables → Actions で確認

---

## 📚 詳細ドキュメント

- [完全セットアップガイド](GITHUB_ACTIONS_SETUP.md)
- [セキュリティベストプラクティス](GITHUB_ACTIONS_SETUP.md#セキュリティベストプラクティス)
- [トラブルシューティング](GITHUB_ACTIONS_SETUP.md#トラブルシューティング)

---

**完了時間**: 約20〜30分  
**必要な権限**: AWS Admin, GitHub Repo Admin
