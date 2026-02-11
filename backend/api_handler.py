"""
API Gateway Lambda Proxy統合用ハンドラー
API GatewayのJWT Authorizerで認証済み
boto3のみで動作（依存パッケージゼロ）
"""
import json
import os
from typing import Any, Dict
from datetime import datetime
import base64

from database import DiaryDatabase
from models import DiaryEntry

# 環境変数
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE_NAME")
PHOTO_BUCKET = os.environ.get("PHOTO_BUCKET_NAME")
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "https://d1l985y7ocpo2p.cloudfront.net")

# データベース初期化
db = DiaryDatabase(DYNAMODB_TABLE, PHOTO_BUCKET)

# CORS許可オリジンをパース（カンマ区切り）
ALLOWED_ORIGINS_LIST = [origin.strip() for origin in ALLOWED_ORIGINS.split(",") if origin.strip()]


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    API Gateway Lambda Proxyイベントを処理
    認証はAPI Gateway JWT Authorizerで完了済み
    """
    try:
        # リクエスト情報を取得
        path = event.get("path", "")
        method = event.get("httpMethod", "")
        headers = event.get("headers", {})
        query_params = event.get("queryStringParameters") or {}  # 将来的にページネーションやフィルタリングで使用予定
        body = event.get("body", "")
        
        # パス正規化（/prod/ プレフィックスを削除）
        if path.startswith("/prod"):
            path = path[5:]
        
        print(f"Request: {method} {path}")
        
        # 動的CORS処理: リクエストのOriginを検証
        request_origin = headers.get("origin") or headers.get("Origin", "")
        allowed_origin = get_allowed_origin(request_origin)
        
        # CORSヘッダー（許可されたOriginのみ）
        cors_headers = {
            "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        }
        
        # 許可されたOriginの場合のみAccess-Control-Allow-Originを追加
        if allowed_origin:
            cors_headers["Access-Control-Allow-Origin"] = allowed_origin
            cors_headers["Access-Control-Allow-Credentials"] = "true"
            print(f"CORS: Allowed origin = {allowed_origin}")
        else:
            print(f"CORS: Origin '{request_origin}' not in allowed list: {ALLOWED_ORIGINS_LIST}")
        
        # OPTIONSリクエスト（プリフライト）
        if method == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": cors_headers,
                "body": ""
            }
        
        # ヘルスチェック（認証不要）
        if path == "/health" and method == "GET":
            return handle_health(cors_headers)
        
        # 認証済みユーザー情報を取得（API Gateway Authorizerから）
        request_context = event.get("requestContext", {})
        authorizer = request_context.get("authorizer", {})
        claims = authorizer.get("claims", {})
        
        # ユーザー名を取得
        username = claims.get("cognito:username") or claims.get("username")
        if not username:
            # 認証情報がない場合:
            # - 明示的にローカル開発用バイパスが許可されている場合のみ test-user を使用
            # - それ以外は 401 を返す
            allow_dev_bypass = os.environ.get("ALLOW_DEV_AUTH_BYPASS", "").lower() == "true"
            if allow_dev_bypass:
                print("Warning: No username in claims, using development bypass as 'test-user'")
                username = "test-user"
            else:
                print("Error: No username in claims and development bypass is disabled")
                return error_response(401, "認証情報が無効です", cors_headers)
        
        print(f"Authenticated user: {username}")
        
        # ルーティング（すべて認証済み）
        if path == "/" and method == "GET":
            return handle_get_recent_diaries(username, cors_headers)
        
        # 写真アップロード（より具体的なパスを先にチェック）
        elif path.startswith("/diary/") and path.endswith("/photo") and method == "POST":
            date_str = path.split("/")[-2]
            return handle_upload_photo(username, date_str, body, cors_headers)
        
        elif path.startswith("/diary/") and method == "GET":
            date_str = path.split("/")[-1]
            return handle_get_diary(username, date_str, cors_headers)
        
        elif path.startswith("/diary/") and method == "POST":
            date_str = path.split("/")[-1]
            return handle_save_diary(username, date_str, body, cors_headers)
        
        elif path.startswith("/diary/") and method == "DELETE":
            date_str = path.split("/")[-1]
            return handle_delete_diary(username, date_str, cors_headers)
        
        elif path.startswith("/family/calendar/") and method == "GET":
            parts = path.split("/")
            year, month = int(parts[-2]), int(parts[-1])
            return handle_get_calendar(username, year, month, cors_headers)
        
        # 404
        return error_response(404, "エンドポイントが見つかりません", cors_headers)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return error_response(500, "内部サーバーエラー", cors_headers)


def handle_health(headers: Dict) -> Dict:
    """ヘルスチェック"""
    return success_response({"status": "healthy", "message": "API is running"}, headers)


def handle_get_recent_diaries(username: str, headers: Dict) -> Dict:
    """最近の日記一覧取得"""
    entries = db.get_user_diaries(username, limit=30)
    return success_response({"entries": entries}, headers)


def handle_get_diary(username: str, date_str: str, headers: Dict) -> Dict:
    """特定日の日記取得"""
    entry = db.get_diary_entry(username, date_str)
    if not entry:
        return error_response(404, "日記が見つかりません", headers)
    
    # フロントエンド向けにフィールド名を変換
    response_data = {
        "entry_text": entry.get("content", ""),
        "photo_url": entry.get("photos", [])[0] if entry.get("photos") else "",
        "is_public": entry.get("is_public", "false") == "true",  # 文字列からbooleanに変換
        "mood": entry.get("mood", "normal"),
        "weather": entry.get("weather", "sunny"),
        "date": entry.get("date", ""),
        "created_at": entry.get("created_at", ""),
        "updated_at": entry.get("updated_at", ""),
    }
    return success_response(response_data, headers)


def handle_save_diary(username: str, date_str: str, body: str, headers: Dict) -> Dict:
    """日記保存"""
    try:
        data = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return error_response(400, "無効なJSON形式", headers)
    
    # バリデーション（entry_text または content を受け入れ）
    content = data.get("entry_text") or data.get("content", "")
    if not content:
        return error_response(400, "日記内容が必要です", headers)
    
    # photo_url を photos 配列に変換
    photo_url = data.get("photo_url")
    photos = data.get("photos", [])
    if photo_url and photo_url not in photos:
        photos = [photo_url]
    
    # 日記エントリー作成
    entry = DiaryEntry(
        username=username,
        date=date_str,
        content=content,
        mood=data.get("mood", "normal"),
        weather=data.get("weather", "sunny"),
        photos=photos,
        is_public=data.get("is_public", False)
    )
    
    # 保存
    db.save_diary_entry(entry)
    
    return success_response({"message": "日記を保存しました", "entry": entry.__dict__}, headers)


def handle_upload_photo(username: str, date_str: str, body: str, headers: Dict) -> Dict:
    """写真をS3にアップロード"""
    try:
        data = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return error_response(400, "無効なJSON形式", headers)
    
    image_data = data.get("image")
    if not image_data:
        return error_response(400, "画像データが必要です", headers)
    
    # Base64デコード
    try:
        image_bytes = base64.b64decode(image_data)
    except Exception:
        return error_response(400, "無効な画像データ", headers)
    
    # S3にアップロード
    try:
        photo_key = f"{username}/{date_str}/{datetime.utcnow().timestamp()}.jpg"
        photo_url = db.upload_photo(username, date_str, image_bytes, photo_key)
        
        return success_response({"photo_url": photo_url}, headers)
    except Exception as e:
        return error_response(500, f"アップロードエラー: {str(e)}", headers)


def handle_delete_diary(username: str, date_str: str, headers: Dict) -> Dict:
    """日記削除"""
    db.delete_diary_entry(username, date_str)
    return success_response({"message": "日記を削除しました"}, headers)


def handle_get_calendar(username: str, year: int, month: int, headers: Dict) -> Dict:
    """カレンダー取得"""
    entries = db.get_calendar_entries(username, year, month)
    
    # フロントエンド向けにフィールド名を変換
    transformed_entries = []
    for entry in entries:
        transformed_entry = {
            "user_id": entry.get("user_id", ""),
            "date": entry.get("date", ""),
            "entry_text": entry.get("content", ""),
            "photo_url": entry.get("photos", [])[0] if entry.get("photos") else "",
            "is_public": entry.get("is_public", "false") == "true",
            "mood": entry.get("mood", "normal"),
            "weather": entry.get("weather", "sunny"),
            "created_at": entry.get("created_at", ""),
            "updated_at": entry.get("updated_at", ""),
        }
        transformed_entries.append(transformed_entry)
    
    return success_response({"entries": transformed_entries}, headers)


def success_response(data: Any, headers: Dict) -> Dict:
    """成功レスポンス"""
    return {
        "statusCode": 200,
        "headers": {**headers, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False, default=str)
    }


def get_allowed_origin(request_origin: str) -> str:
    """
    リクエストのOriginが許可リストに含まれているか検証
    
    Args:
        request_origin: リクエストヘッダーのOrigin
    
    Returns:
        許可されている場合はそのOrigin、許可されていない場合は空文字列
    """
    if not request_origin:
        return ""
    
    # 許可リストと完全一致チェック
    if request_origin in ALLOWED_ORIGINS_LIST:
        return request_origin
    
    # localhost開発環境の特別処理（オプション）
    if request_origin.startswith("http://localhost:") or request_origin.startswith("http://127.0.0.1:"):
        # 開発環境バイパスが有効な場合のみ許可
        allow_dev_bypass = os.environ.get("ALLOW_DEV_CORS_BYPASS", "").lower() == "true"
        if allow_dev_bypass:
            print(f"Warning: Development CORS bypass enabled for {request_origin}")
            return request_origin
    
    return ""


def error_response(status_code: int, message: str, headers: Dict) -> Dict:
    """エラーレスポンス"""
    return {
        "statusCode": status_code,
        "headers": {**headers, "Content-Type": "application/json"},
        "body": json.dumps({"error": message}, ensure_ascii=False)
    }
