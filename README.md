# Family Diary App

家族4人で使用する一言日記Webアプリケーション。個人認証、個人カレンダー、公開/非公開切り替え、写真添付機能を備えています。

## 技術スタック

- **バックエンド:** Python FastAPI + AWS Lambda
- **フロントエンド:** React + Vite
- **インフラ:** AWS CDK (TypeScript)
- **データベース:** Amazon DynamoDB
- **ストレージ:** Amazon S3
- **認証:** Amazon Cognito
- **API:** API Gateway
- **ホスティング:** CloudFront + S3

## プロジェクト構成

```
family-diary-app/
├── backend/              # Python FastAPI バックエンド
├── frontend/             # React フロントエンド
└── infrastructure/       # AWS CDK インフラコード (TypeScript)
```

## 環境構築

### 前提条件

- Node.js 18+
- Python 3.9+
- AWS CLI v2
- AWS アカウント

### ステップ

1. **リポジトリのクローン**
```bash
git clone <repository-url>
cd family-diary-app
```

2. **バックエンド環境構築**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. **フロントエンド環境構築**
```bash
cd frontend
npm install
```

4. **CDK 環境構築**
```bash
cd infrastructure
npm install
```

## ローカル開発

### バックエンド起動
```bash
cd backend
source venv/bin/activate
python main.py
```

### フロントエンド起動
```bash
cd frontend
npm run dev
```

### CDK デプロイ準備
```bash
cd infrastructure
npx cdk bootstrap
npx cdk synth
```

## AWS へのデプロイ

### 初回セットアップ
```bash
cd infrastructure
npx cdk bootstrap  # CloudFormation 用 S3 バケット作成（初回のみ）
npx cdk deploy --all
```

### 更新デプロイ
```bash
cd infrastructure
npx cdk deploy --all
```

### 注意: Lambda Deployment (Docker 環境が必要)

Windows 環境での Lambda deployment は Docker Desktop が必要です。以下の方法で対応できます：

**方法1: Docker Desktop をインストール（推奨）**
- [Docker Desktop をダウンロードしてインストール](https://www.docker.com/products/docker-desktop)
- インストール後、`cdk deploy` を実行

**方法2: ローカル開発での動作確認**
```bash
# backend を起動
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 別ターミナルで frontend を起動
cd frontend
npm install
npm run dev

# .env.local を修正
VITE_API_ENDPOINT=http://localhost:8000  # ローカルバックエンドに接続
```

## ファイル概要

### backend/
バックエンド FastAPI アプリケーション

### frontend/
フロントエンド React アプリケーション

### infrastructure/
AWS CDK で定義された AWS インフラストラクチャ

## トラブルシューティング

### Node.js バージョン不一致
```bash
node --version  # v18 以上か確認
nvm use 18      # Node バージョンマネージャー使用時
```

### Python venv エラー
```bash
rm -rf venv
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## ライセンス

MIT
