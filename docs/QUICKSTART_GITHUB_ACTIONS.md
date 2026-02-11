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

```bash
# GitHub CLIで一括設定
gh secret set AWS_ROLE_ARN --body "arn:aws:iam::772438672412:role/GitHubActionsDeployRole"
gh secret set S3_BUCKET_NAME --body "family-diary-app-stack-dev-websitebucket75c24d94-p25qzd67wmex"
gh secret set CLOUDFRONT_DISTRIBUTION_ID --body "E33OL17IXJUU9J"
gh secret set VITE_API_ENDPOINT --body "https://gu4ywyuipf.execute-api.us-west-2.amazonaws.com/prod/"
gh secret set VITE_COGNITO_DOMAIN --body "family-diary-app-XXXX.auth.us-west-2.amazoncognito.com"
gh secret set VITE_COGNITO_CLIENT_ID --body "1nc230a14fr7k8jn4va0r8ulcd"
gh secret set VITE_COGNITO_REDIRECT_URI --body "https://d1l985y7ocpo2p.cloudfront.net/"
```

または[GitHub Web UI](https://github.com/YOUR_USERNAME/family-diary-app/settings/secrets/actions)で手動設定

### Step 3: ワークフローファイル確認（1分）

すでに作成済み:
- `.github/workflows/deploy.yml`
- `.github/workflows/pr-check.yml`

```bash
# 確認
ls -la .github/workflows/
```

### Step 4: テストデプロイ（5分）

```bash
# 軽微な変更をコミット
git add .
git commit -m "ci: Setup GitHub Actions"
git push origin main

# GitHub Actionsページで実行確認
# https://github.com/YOUR_USERNAME/family-diary-app/actions
```

### Step 5: 動作確認（5分）

1. **Actions タブ**で "Deploy to AWS" ワークフローが実行されることを確認
2. すべてのジョブ（test-frontend, test-backend, deploy-backend, deploy-frontend）が成功
3. https://d1l985y7ocpo2p.cloudfront.net にアクセスして動作確認

---

## ✅ 完了チェックリスト

- [ ] AWS OIDC Provider作成済み
- [ ] IAMロール作成＆ARN取得済み
- [ ] GitHub Secrets 7項目設定済み
- [ ] mainブランチにpushして自動デプロイ成功
- [ ] 本番サイトで動作確認完了

---

## 📋 必要な情報の取得コマンド

```bash
# S3バケット名
aws s3 ls | grep family-diary

# CloudFront Distribution ID
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='Family Diary Website Distribution'].Id" \
  --output text

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
