# GitHub Actions CI/CD セットアップガイド

このドキュメントでは、Family Diary AppのGitHub Actions CI/CDを設定する手順を説明します。

## 📋 前提条件

- GitHub リポジトリへのAdmin権限
- AWSアカウントへのアクセス
- AWS CLI インストール済み
- 既存のAWS CDKスタックがデプロイ済み

---

## 🔐 Step 1: AWS OIDC Provider の設定

GitHub ActionsがAWSにアクセスするため、OIDC Providerを作成します。

### 1.1 IAM OIDC Providerの作成

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 1.2 IAMロールの作成

以下のJSONファイルを `github-actions-trust-policy.json` として保存:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::772438672412:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/family-diary-app:*"
        }
      }
    }
  ]
}
```

**重要**: `YOUR_GITHUB_USERNAME` を実際のGitHubユーザー名/組織名に置き換えてください。

IAMロールを作成:

```bash
aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document file://github-actions-trust-policy.json \
  --description "Role for GitHub Actions to deploy Family Diary App"
```

### 1.3 IAMポリシーのアタッチ

デプロイに必要な権限を付与:

```bash
# 管理ポリシーをアタッチ（開発環境用）
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

**本番環境では最小権限の原則に従い、カスタムポリシーを作成してください:**

<details>
<summary>本番環境向けカスタムポリシー（クリックで展開）</summary>

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "lambda:*",
        "apigateway:*",
        "cognito-idp:*",
        "dynamodb:*",
        "cloudfront:*",
        "iam:*",
        "logs:*",
        "ssm:GetParameter"
      ],
      "Resource": "*"
    }
  ]
}
```

</details>

### 1.4 ロールARNの取得

```bash
aws iam get-role --role-name GitHubActionsDeployRole --query 'Role.Arn' --output text
```

出力例: `arn:aws:iam::772438672412:role/GitHubActionsDeployRole`

このARNを次のステップで使用します。

---

## 🔑 Step 2: GitHub Secrets の設定

GitHubリポジトリの Settings → Secrets and variables → Actions で以下を設定:

### 必須シークレット

| Secret名 | 値 | 説明 |
|----------|-----|------|
| `AWS_ROLE_ARN` | `arn:aws:iam::772438672412:role/GitHubActionsDeployRole` | Step 1で作成したロールのARN |
| `S3_BUCKET_NAME` | `family-diary-app-stack-dev-websitebucket75c24d94-p25qzd67wmex` | S3バケット名 |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E33OL17IXJUU9J` | CloudFront Distribution ID |

### フロントエンド環境変数

| Secret名 | 値 | 説明 |
|----------|-----|------|
| `VITE_API_ENDPOINT` | `https://gu4ywyuipf.execute-api.us-west-2.amazonaws.com/prod/` | API Gateway URL |
| `VITE_COGNITO_DOMAIN` | `family-diary-app-<account-id>.auth.us-west-2.amazoncognito.com` | Cognito Domain |
| `VITE_COGNITO_CLIENT_ID` | `1nc230a14fr7k8jn4va0r8ulcd` | Cognito Client ID |
| `VITE_COGNITO_REDIRECT_URI` | `https://d1l985y7ocpo2p.cloudfront.net/` | Cognito Redirect URI |

### シークレット設定方法

```bash
# GitHub CLIを使った設定（推奨）
gh secret set AWS_ROLE_ARN --body "arn:aws:iam::772438672412:role/GitHubActionsDeployRole"
gh secret set S3_BUCKET_NAME --body "family-diary-app-stack-dev-websitebucket75c24d94-p25qzd67wmex"
gh secret set CLOUDFRONT_DISTRIBUTION_ID --body "E33OL17IXJUU9J"

# フロントエンド環境変数
gh secret set VITE_API_ENDPOINT --body "https://gu4ywyuipf.execute-api.us-west-2.amazonaws.com/prod/"
gh secret set VITE_COGNITO_DOMAIN --body "family-diary-app-XXXX.auth.us-west-2.amazoncognito.com"
gh secret set VITE_COGNITO_CLIENT_ID --body "1nc230a14fr7k8jn4va0r8ulcd"
gh secret set VITE_COGNITO_REDIRECT_URI --body "https://d1l985y7ocpo2p.cloudfront.net/"
```

---

## 🚀 Step 3: ワークフローファイルの配置

以下のファイルが自動的に作成されています:

```
.github/
└── workflows/
    ├── deploy.yml       # メインのデプロイワークフロー
    └── pr-check.yml     # PRチェック用ワークフロー
```

### deploy.yml の動作

**トリガー:**
- `main` ブランチへのpush
- Pull Request作成時（テストのみ）
- 手動実行（workflow_dispatch）

**ジョブフロー:**
```
test-frontend → test-backend → deploy-backend → deploy-frontend
```

### pr-check.yml の動作

**トリガー:**
- Pull Request作成時

**チェック内容:**
- フロントエンドのリント
- フロントエンドのビルド
- インフラのビルド（TypeScript）
- CDK Synth（dry-run）
- バックエンドのテスト

---

## 🧪 Step 4: テストデプロイ

### 4.1 ローカルでワークフローをテスト

```bash
# act を使用（Docker必要）
brew install act  # macOS
# or
choco install act  # Windows

# ワークフローをローカル実行
act -j test-frontend
```

### 4.2 手動トリガーでテスト

1. GitHubリポジトリ → Actions タブ
2. "Deploy to AWS" ワークフローを選択
3. "Run workflow" → "Run workflow" ボタンをクリック

### 4.3 通常のデプロイフロー

```bash
# 変更をコミット
git add .
git commit -m "feat: Add new feature"
git push origin main

# GitHub Actionsが自動的に実行されます
```

---

## 📊 Step 5: モニタリングとトラブルシューティング

### GitHub Actionsログの確認

1. リポジトリ → Actions タブ
2. 実行されたワークフローをクリック
3. 各ジョブの詳細ログを確認

### よくあるエラーと対処法

#### ❌ Error: "AccessDenied"

**原因:** IAMロールの権限不足

**対処:**
```bash
# ロールにポリシーをアタッチ
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

#### ❌ Error: "No credentials found"

**原因:** OIDC設定が不正

**対処:**
1. `AWS_ROLE_ARN` シークレットが正しいか確認
2. Trust Policyのリポジトリ名が正しいか確認
3. OIDC Providerが存在するか確認:
```bash
aws iam list-open-id-connect-providers
```

#### ❌ Error: "Stack update failed"

**原因:** CDKスタックの競合

**対処:**
```bash
# ローカルで確認
cd infrastructure
npx cdk diff

# 必要に応じて手動でロールバック
npx cdk deploy --rollback
```

#### ❌ Error: "S3 bucket not found"

**原因:** `S3_BUCKET_NAME` が間違っている

**対処:**
```bash
# 正しいバケット名を確認
aws s3 ls | grep family-diary

# GitHubシークレットを更新
gh secret set S3_BUCKET_NAME --body "正しいバケット名"
```

---

## 🔒 セキュリティベストプラクティス

### 1. 最小権限の原則

開発環境では `AdministratorAccess` を使用していますが、本番環境では以下のように制限してください:

```bash
# カスタムポリシーの作成
aws iam create-policy \
  --policy-name FamilyDiaryDeployPolicy \
  --policy-document file://deploy-policy.json

# ロールにカスタムポリシーをアタッチ
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::772438672412:policy/FamilyDiaryDeployPolicy
```

### 2. ブランチ保護

`main` ブランチへの直接pushを制限:

1. Settings → Branches → Add rule
2. Branch name pattern: `main`
3. 以下を有効化:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require conversation resolution before merging

### 3. Environment Secrets

本番環境のシークレットは Environment レベルで管理:

1. Settings → Environments → New environment
2. Name: `production`
3. Environment secretsを設定
4. Deployment protection rules を設定（必要に応じて）

---

## 🔄 Step 6: 継続的インテグレーション（CI）の拡張

### テストの追加

#### フロントエンドテスト（Vitest）

```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

`frontend/package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

#### バックエンドテスト（pytest）

```bash
cd backend
pip install pytest pytest-cov
```

`backend/test_api_handler.py`:
```python
def test_health_endpoint():
    from api_handler import handle_health
    result = handle_health({})
    assert result['statusCode'] == 200
```

### コードカバレッジレポート

`.github/workflows/pr-check.yml` に追加:

```yaml
- name: Generate coverage report
  run: |
    pytest --cov=. --cov-report=xml
    
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage.xml
```

---

## 📈 Step 7: デプロイメント戦略

### Blue-Green Deployment

CDKで複数環境を管理:

```typescript
// infrastructure/bin/app.ts
const devStack = new MainStack(app, 'family-diary-app-stack-dev', {
  env: { account: '772438672412', region: 'us-west-2' }
});

const prodStack = new MainStack(app, 'family-diary-app-stack-prod', {
  env: { account: '772438672412', region: 'us-west-2' }
});
```

### Rollback 戦略

デプロイ失敗時の自動ロールバック:

```yaml
- name: Deploy with rollback
  run: |
    npx cdk deploy --require-approval never --rollback || {
      echo "Deployment failed, rolling back..."
      aws cloudformation cancel-update-stack --stack-name family-diary-app-stack-dev
      exit 1
    }
```

---

## 📝 まとめ

### 設定完了チェックリスト

- [ ] AWS OIDC Provider作成済み
- [ ] IAMロール作成済み（適切な権限付与）
- [ ] GitHub Secrets設定済み（全8項目）
- [ ] ワークフローファイル配置済み
- [ ] 手動トリガーでテストデプロイ成功
- [ ] mainブランチへのpushで自動デプロイ成功
- [ ] CloudFrontキャッシュクリア確認済み

### 運用フロー

**通常の開発:**
```bash
git checkout -b feature/new-feature
# コード変更
git commit -m "feat: Add new feature"
git push origin feature/new-feature
# GitHub上でPR作成 → PR Checks実行
# レビュー＆承認
# Merge to main → 自動デプロイ
```

**緊急修正:**
```bash
git checkout -b hotfix/critical-fix
# 修正
git push origin hotfix/critical-fix
# PRスキップしてmainにマージ → 即座にデプロイ
```

---

## 🆘 サポート

問題が発生した場合:

1. [GitHub Actions ログ](https://github.com/YOUR_USERNAME/family-diary-app/actions)を確認
2. [AWS CloudWatch Logs](https://console.aws.amazon.com/cloudwatch/)でLambdaエラーを確認
3. このリポジトリのIssuesで質問

---

**最終更新**: 2026年2月10日
