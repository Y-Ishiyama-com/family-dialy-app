"""
FastAPI アプリケーションのメインエントリポイント
"""
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
import boto3
from datetime import datetime
from typing import Optional
from pathlib import Path

# .env ファイルから環境変数を読み込み（ローカル開発時）
backend_dir = Path(__file__).parent
env_path = backend_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

from .auth import get_current_user, optional_verify_token
from .database import DiaryDatabase
from .models import DiaryEntry, DailyPrompt

app = FastAPI(title="Family Diary API", version="1.0.0")

# 許可するオリジンのリスト
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3004", 
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3004",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

# CORSミドルウェアを追加
@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    """
    手動 CORS ミドルウェア
    すべてのレスポンス（エラーを含む）に CORS ヘッダーを追加
    """
    origin = request.headers.get("origin", "NO-ORIGIN")
    method = request.method
    path = request.url.path
    
    if method == "OPTIONS":
        # プリフライトリクエスト
        if origin in ALLOWED_ORIGINS:
            return JSONResponse(
                content={},
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Max-Age": "3600",
                }
            )
        else:
            return JSONResponse(content={"error": "Forbidden"}, status_code=403)
    
    # 通常のリクエスト
    response = await call_next(request)
    
    # すべてのレスポンスに CORS ヘッダーを追加
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    return response

# 古い CORSMiddleware は削除
# (既に削除されていることを確認)

# DynamoDB テーブル名を環境変数から取得
TABLE_NAME = os.environ.get("DYNAMODB_TABLE_NAME", "diary_entries")
PHOTO_BUCKET_NAME = os.environ.get("PHOTO_BUCKET_NAME", "")

# Database インスタンス
db = DiaryDatabase(TABLE_NAME)

# S3 クライアント
s3_client = boto3.client("s3")


@app.get("/health")
def health_check():
    """ヘルスチェックエンドポイント"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/")
def root():
    """ルートエンドポイント"""
    return {"message": "Family Diary API", "version": "1.0.0"}


@app.get("/diary/{date}")
async def get_diary_entry(
    date: str,
    user_id: Optional[str] = Depends(optional_verify_token),
):
    """
    特定日付のエントリを取得

    - 認証あり：本人のエントリを取得
    - 認証なし：公開エントリのみ取得可能（家族カレンダー用）
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    entry = db.get_entry(user_id, date)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    return {
        "user_id": entry["user_id"],
        "date": entry["date"],
        "entry_text": entry["entry_text"],
        "is_public": entry.get("is_public") == "true",
        "photo_url": entry.get("photo_url"),
        "created_at": entry["created_at"],
        "updated_at": entry["updated_at"],
    }


@app.post("/diary/{date}")
async def create_or_update_diary_entry(
    date: str,
    entry_data: dict,
    user_id: str = Depends(get_current_user),
):
    """
    日記エントリを作成または更新

    - 認証必須
    - 本人のエントリのみ作成・更新可能
    """
    # 既存エントリがあるかチェック
    existing_entry = db.get_entry(user_id, date)

    if existing_entry:
        # 更新
        updated = db.update_entry(
            user_id=user_id,
            date=date,
            entry_text=entry_data.get("entry_text"),
            is_public=entry_data.get("is_public", False),
            photo_url=entry_data.get("photo_url"),
        )
        return {
            "message": "Entry updated",
            "entry": updated,
        }
    else:
        # 新規作成
        entry = db.put_entry(
            user_id=user_id,
            date=date,
            entry_text=entry_data.get("entry_text"),
            is_public=entry_data.get("is_public", False),
            photo_url=entry_data.get("photo_url"),
        )
        return {
            "message": "Entry created",
            "entry": entry,
        }


@app.delete("/diary/{date}")
async def delete_diary_entry(
    date: str,
    user_id: str = Depends(get_current_user),
):
    """
    日記エントリを削除

    - 認証必須
    - 本人のエントリのみ削除可能
    """
    # エントリが存在するかチェック
    entry = db.get_entry(user_id, date)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    db.delete_entry(user_id, date)
    return {"message": "Entry deleted", "date": date}


@app.post("/diary/{date}/photo")
async def get_photo_presigned_url(
    date: str,
    user_id: str = Depends(get_current_user),
):
    """
    写真アップロード用のプリサイン URL を取得

    - 認証必須
    - クライアントはこの URL を使用して直接 S3 にアップロード
    """
    # S3 キーを生成（user#haru → haru に変換して # を URL から除外）
    username = user_id.replace("user#", "")
    photo_key = f"photos/{username}/{date}/{datetime.now().timestamp()}.jpg"

    # プリサイン URL を生成（15分有効）
    presigned_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": PHOTO_BUCKET_NAME,
            "Key": photo_key,
            "ContentType": "image/jpeg",
        },
        ExpiresIn=900,  # 15 minutes
    )

    return {
        "presigned_url": presigned_url,
        "photo_key": photo_key,
    }


@app.get("/family/calendar/{year}/{month}")
async def get_family_calendar(
    year: int,
    month: int,
    user_id: str = Depends(get_current_user),
):
    """
    家族カレンダー：月間の公開エントリを取得

    - 認証必須
    - 公開エントリ（全員分）+ 自分の非公開エントリ
    """
    # 公開エントリを取得
    public_entries = db.query_public_entries_for_month(year, month)

    # 自分のエントリ（公開・非公開両方）を取得
    my_entries = db.query_month(user_id, year, month)

    # マージ（重複排除）
    entries_map = {}
    for entry in public_entries:
        key = f"{entry['user_id']}#{entry['date']}"
        entries_map[key] = entry

    for entry in my_entries:
        key = f"{entry['user_id']}#{entry['date']}"
        entries_map[key] = entry

    # レスポンス形式に変換
    calendar_entries = [
        FamilyCalendarEntry(
            user_id=entry["user_id"],
            date=entry["date"],
            entry_text=entry["entry_text"],
            photo_url=entry.get("photo_url"),
        )
        for entry in entries_map.values()
    ]

    return {
        "entries": [
            {
                "user_id": entry["user_id"],
                "date": entry["date"],
                "entry_text": entry["entry_text"],
                "photo_url": entry.get("photo_url"),
            }
            for entry in entries_map.values()
        ],
        "year": year,
        "month": month,
    }
