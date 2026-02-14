"""
DynamoDB データベース操作
"""
import boto3
from boto3.dynamodb.conditions import Key
from datetime import datetime
from typing import Optional, List
import os
import uuid
import pytz
from models import DiaryEntry


class InMemoryDatabase:
    """開発モード用のメモリ内データベース"""
    
    def __init__(self, table_name: str):
        self.table_name = table_name
        self.data = {}  # key: "user_id#date", value: item
    
    def put_entry(
        self,
        user_id: str,
        date: str,
        entry_text: str,
        is_public: bool = False,
        photo_url: Optional[str] = None,
    ) -> dict:
        key = f"{user_id}#{date}"
        jst = pytz.timezone('Asia/Tokyo')
        now_jst = datetime.now(jst)
        item = {
            "user_id#date": key,
            "user_id": user_id,
            "date": date,
            "entry_text": entry_text,
            "is_public": "true" if is_public else "false",
            "created_at": now_jst.isoformat(),
            "updated_at": now_jst.isoformat(),
        }
        if photo_url:
            item["photo_url"] = photo_url
        
        self.data[key] = item
        return item
    
    def get_entry(self, user_id: str, date: str) -> Optional[dict]:
        key = f"{user_id}#{date}"
        return self.data.get(key)
    
    def update_entry(
        self,
        user_id: str,
        date: str,
        entry_text: Optional[str] = None,
        is_public: Optional[bool] = None,
        photo_url: Optional[str] = None,
    ) -> dict:
        key = f"{user_id}#{date}"
        if key not in self.data:
            raise KeyError(f"Entry not found: {key}")
        
        item = self.data[key]
        jst = pytz.timezone('Asia/Tokyo')
        item["updated_at"] = datetime.now(jst).isoformat()
        
        if entry_text is not None:
            item["entry_text"] = entry_text
        if is_public is not None:
            item["is_public"] = "true" if is_public else "false"
        if photo_url is not None:
            item["photo_url"] = photo_url
        
        return item
    
    def delete_entry(self, user_id: str, date: str) -> None:
        key = f"{user_id}#{date}"
        if key in self.data:
            del self.data[key]
    
    def query_month(self, user_id: str, year: int, month: int) -> list[dict]:
        start_date = f"{year:04d}-{month:02d}-01"
        end_date = f"{year:04d}-{month:02d}-31"
        
        results = []
        for key, item in self.data.items():
            if item["user_id"] == user_id and start_date <= item["date"] <= end_date:
                results.append(item)
        
        return results
    
    def query_public_entries_for_month(self, year: int, month: int) -> list[dict]:
        start_date = f"{year:04d}-{month:02d}-01"
        end_date = f"{year:04d}-{month:02d}-31"
        
        results = []
        for key, item in self.data.items():
            if item["is_public"] == "true" and start_date <= item["date"] <= end_date:
                results.append(item)
        
        return results


class DiaryDatabase:
    """DynamoDB テーブル操作クラス"""

    def __init__(self, table_name: str, photo_bucket: str = None):
        """
        DynamoDB テーブルとS3バケットを初期化

        Args:
            table_name: DynamoDB テーブル名
            photo_bucket: S3 バケット名（写真保存用）
        """
        # 開発モード判定: AWS認証情報がない、またはテーブルが存在しない場合
        use_in_memory = False
        
        try:
            dynamodb = boto3.resource("dynamodb")
            self.table = dynamodb.Table(table_name)
            # テーブル存在確認
            self.table.table_status
            self.table_name = table_name
        except Exception:
            use_in_memory = True
        
        if use_in_memory:
            self._in_memory = InMemoryDatabase(table_name)
        else:
            self._in_memory = None
        
        # S3クライアント
        self.photo_bucket = photo_bucket
        if photo_bucket:
            self.s3_client = boto3.client("s3")
        else:
            self.s3_client = None

    def put_entry(
        self,
        user_id: str,
        date: str,
        entry_text: str,
        is_public: bool = False,
        photo_url: Optional[str] = None,
    ) -> dict:
        """
        日記エントリを保存

        Args:
            user_id: ユーザーID
            date: 日付 (YYYY-MM-DD)
            entry_text: エントリテキスト
            is_public: 公開フラグ
            photo_url: 写真URL

        Returns:
            保存されたアイテム
        """
        if self._in_memory:
            return self._in_memory.put_entry(user_id, date, entry_text, is_public, photo_url)
        
        jst = pytz.timezone('Asia/Tokyo')
        now_jst = datetime.now(jst)
        item = {
            "user_id#date": f"{user_id}#{date}",
            "user_id": user_id,
            "date": date,
            "entry_text": entry_text,
            "is_public": "true" if is_public else "false",  # String for GSI
            "created_at": now_jst.isoformat(),
            "updated_at": now_jst.isoformat(),
        }
        if photo_url:
            item["photo_url"] = photo_url

        self.table.put_item(Item=item)
        return item

    def get_entry(self, user_id: str, date: str) -> Optional[dict]:
        """
        日記エントリを取得

        Args:
            user_id: ユーザーID
            date: 日付 (YYYY-MM-DD)

        Returns:
            エントリアイテム、見つからない場合は None
        """
        if self._in_memory:
            return self._in_memory.get_entry(user_id, date)
        
        response = self.table.get_item(
            Key={"user_id#date": f"{user_id}#{date}"}
        )
        return response.get("Item")

    def update_entry(
        self,
        user_id: str,
        date: str,
        entry_text: Optional[str] = None,
        is_public: Optional[bool] = None,
        photo_url: Optional[str] = None,
    ) -> dict:
        """
        日記エントリを更新

        Args:
            user_id: ユーザーID
            date: 日付 (YYYY-MM-DD)
            entry_text: エントリテキスト
            is_public: 公開フラグ
            photo_url: 写真URL

        Returns:
            更新されたアイテム
        """
        if self._in_memory:
            return self._in_memory.update_entry(user_id, date, entry_text, is_public, photo_url)
        
        jst = pytz.timezone('Asia/Tokyo')
        update_expr = "SET updated_at = :updated_at"
        expr_attr_values = {":updated_at": datetime.now(jst).isoformat()}

        if entry_text is not None:
            update_expr += ", entry_text = :entry_text"
            expr_attr_values[":entry_text"] = entry_text

        if is_public is not None:
            update_expr += ", is_public = :is_public"
            expr_attr_values[":is_public"] = "true" if is_public else "false"

        if photo_url is not None:
            update_expr += ", photo_url = :photo_url"
            expr_attr_values[":photo_url"] = photo_url

        response = self.table.update_item(
            Key={"user_id#date": f"{user_id}#{date}"},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_attr_values,
            ReturnValues="ALL_NEW",
        )
        return response.get("Attributes", {})

    def delete_entry(self, user_id: str, date: str) -> None:
        """
        日記エントリを削除

        Args:
            user_id: ユーザーID
            date: 日付 (YYYY-MM-DD)
        """
        if self._in_memory:
            return self._in_memory.delete_entry(user_id, date)
        
        self.table.delete_item(Key={"user_id#date": f"{user_id}#{date}"})

    def query_month(self, user_id: str, year: int, month: int) -> list[dict]:
        """
        月間エントリを取得

        Args:
            user_id: ユーザーID
            year: 年
            month: 月

        Returns:
            エントリリスト
        """
        if self._in_memory:
            return self._in_memory.query_month(user_id, year, month)
        
        # Query using GSI with user_id and date prefix
        start_date = f"{year:04d}-{month:02d}-01"
        # Last day of month calculation
        if month == 12:
            end_date = f"{year:04d}-{month:02d}-31"
        else:
            end_date = f"{year:04d}-{month:02d}-31"  # Simplified - handles all months

        response = self.table.query(
            IndexName="user_id-date-index",
            KeyConditionExpression=Key("user_id").eq(user_id)
            & Key("date").between(start_date, end_date),
        )
        return response.get("Items", [])

    def query_public_entries_for_month(self, year: int, month: int) -> list[dict]:
        """
        公開エントリを月間で取得（家族カレンダー用）

        Args:
            year: 年
            month: 月

        Returns:
            公開エントリリスト
        """
        if self._in_memory:
            return self._in_memory.query_public_entries_for_month(year, month)
        
        start_date = f"{year:04d}-{month:02d}-01"
        end_date = f"{year:04d}-{month:02d}-31"

        response = self.table.query(
            IndexName="is_public-date-index",
            KeyConditionExpression=Key("is_public").eq("true")
            & Key("date").between(start_date, end_date),
        )
        return response.get("Items", [])
    
    # 新しいメソッド（API Gateway統合用）
    def save_diary_entry(self, entry: DiaryEntry) -> dict:
        """日記エントリを保存"""
        jst = pytz.timezone('Asia/Tokyo')
        item = {
            "user_id#date": f"{entry.username}#{entry.date}",
            "user_id": entry.username,
            "date": entry.date,
            "content": entry.content,
            "mood": entry.mood,
            "weather": entry.weather,
            "photos": entry.photos,
            "is_public": "true" if entry.is_public else "false",  # DynamoDBインデックスは文字列型を期待
            "created_at": entry.created_at,
            "updated_at": datetime.now(jst).isoformat(),
        }
        
        if self._in_memory:
            self._in_memory.data[item["user_id#date"]] = item
        else:
            self.table.put_item(Item=item)
        return item
    
    def get_diary_entry(self, username: str, date: str) -> Optional[dict]:
        """特定日の日記を取得"""
        if self._in_memory:
            return self._in_memory.get_entry(username, date)
        
        response = self.table.get_item(
            Key={"user_id#date": f"{username}#{date}"}
        )
        return response.get("Item")
    
    def get_user_diaries(self, username: str, limit: int = 30) -> List[dict]:
        """ユーザーの日記一覧を取得"""
        if self._in_memory:
            results = [item for key, item in self._in_memory.data.items() if item.get("user_id") == username]
            return sorted(results, key=lambda x: x["date"], reverse=True)[:limit]
        
        response = self.table.query(
            IndexName="user_id-date-index",
            KeyConditionExpression=Key("user_id").eq(username),
            ScanIndexForward=False,
            Limit=limit
        )
        return response.get("Items", [])
    
    def delete_diary_entry(self, username: str, date: str) -> None:
        """日記を削除"""
        return self.delete_entry(username, date)
    
    def upload_photo(self, username: str, date: str, image_bytes: bytes, photo_key: str = None) -> str:
        """写真をS3にアップロード"""
        if not self.s3_client:
            raise Exception("S3 client not configured")
        
        if not photo_key:
            import uuid
            photo_id = str(uuid.uuid4())
            photo_key = f"photos/{username}/{date}/{photo_id}.jpg"
        
        self.s3_client.put_object(
            Bucket=self.photo_bucket,
            Key=photo_key,
            Body=image_bytes,
            ContentType="image/jpeg"
        )
        
        # S3キーを返す（URLではなく）
        return photo_key
    
    def generate_presigned_url(self, photo_key: str, expiration: int = 3600) -> str:
        """S3アップロード用のプリサインURLを生成"""
        if not self.s3_client:
            raise Exception("S3 client not configured")
        
        presigned_url = self.s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': self.photo_bucket,
                'Key': photo_key,
            },
            ExpiresIn=expiration
        )
        return presigned_url
    
    def extract_photo_key_from_url_or_key(self, photo_data: str) -> str:
        """
        DynamoDBから取得したデータがURLか S3キーかを判定し、S3キーを抽出
        
        - URLの場合：https://bucket.s3.amazonaws.com/KEY?params → KEY を抽出
        - S3キーの場合：KEY をそのまま返す
        """
        if not photo_data:
            return ""
        
        # URLで始まるかチェック
        if photo_data.startswith('http://') or photo_data.startswith('https://'):
            try:
                # URLをパース
                from urllib.parse import urlparse, unquote
                parsed = urlparse(photo_data)
                # パス部分を取得し、先頭の / を削除
                key = unquote(parsed.path).lstrip('/')
                return key
            except Exception as e:
                print(f"Error extracting key from URL {photo_data}: {e}")
                return ""
        
        # すでにS3キーの場合
        return photo_data
    
    def get_photo_url(self, photo_key: str, expiration: int = 86400) -> str:
        """S3キーから署名付き読み取りURLを生成（24時間有効）"""
        if not self.s3_client:
            raise Exception("S3 client not configured")
        
        if not photo_key:
            return ""
        
        # URLか S3キーかを判定して、S3キーを抽出
        photo_key = self.extract_photo_key_from_url_or_key(photo_key)
        
        if not photo_key:
            return ""
        
        try:
            presigned_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.photo_bucket,
                    'Key': photo_key,
                },
                ExpiresIn=expiration  # 24時間有効
            )
            return presigned_url
        except Exception as e:
            print(f"Error generating presigned URL for key {photo_key}: {e}")
            return ""
    
    def get_calendar_entries(self, username: str, year: int, month: int) -> List[dict]:
        """
        カレンダー用の月間公開エントリを取得（全ユーザー）
        
        Note: username パラメータは後方互換性のために残しているが、
        家族カレンダーでは全ユーザーの公開日記を取得する
        """
        return self.query_public_entries_for_month(year, month)
    
    # ===== Prompts Table Methods =====
    def __init_prompts_table(self):
        """Prompts テーブルを初期化（遅延初期化）"""
        if not hasattr(self, '_prompts_table'):
            prompts_table_name = os.environ.get("DYNAMODB_PROMPTS_TABLE_NAME")
            print(f"[DEBUG] DYNAMODB_PROMPTS_TABLE_NAME from env: {prompts_table_name}")
            if not prompts_table_name:
                raise ValueError("DYNAMODB_PROMPTS_TABLE_NAME environment variable not set")
            
            try:
                dynamodb = boto3.resource("dynamodb")
                self._prompts_table = dynamodb.Table(prompts_table_name)
                # テーブル存在確認
                self._prompts_table.table_status
                print(f"[DEBUG] Successfully initialized prompts table: {prompts_table_name}")
            except Exception as e:
                print(f"Warning: Could not initialize prompts table: {e}")
                self._prompts_table = None
    
    def save_prompt(self, date: str, prompt: str, category: Optional[str] = None) -> dict:
        """
        毎日のお題を保存
        
        Args:
            date: 日付 (YYYY-MM-DD)
            prompt: お題テキスト
            category: カテゴリ（seasonal, event, reflection, fun など）
        
        Returns:
            保存されたアイテム
        """
        self.__init_prompts_table()
        if not self._prompts_table:
            raise Exception("Prompts table not available")
        
        from datetime import timedelta
        jst = pytz.timezone('Asia/Tokyo')
        now_jst = datetime.now(jst)
        expire_date = now_jst + timedelta(days=30)
        
        item = {
            "date": date,
            "prompt": prompt,
            "category": category or "general",
            "created_at": now_jst.isoformat(),
            "expireAt": int(expire_date.timestamp()),
        }
        
        self._prompts_table.put_item(Item=item)
        return item
    
    def get_prompt(self, date: str) -> Optional[dict]:
        """
        指定日のお題を取得
        
        Args:
            date: 日付 (YYYY-MM-DD)
        
        Returns:
            お題アイテム、見つからない場合は None
        """
        self.__init_prompts_table()
        if not self._prompts_table:
            print(f"[DEBUG] Prompts table not initialized")
            return None
        
        try:
            print(f"[DEBUG] Querying prompts table for date: {date}")
            response = self._prompts_table.get_item(Key={"date": date})
            item = response.get("Item")
            print(f"[DEBUG] DynamoDB response: {response}")
            print(f"[DEBUG] Item found: {item}")
            return item
        except Exception as e:
            print(f"Error getting prompt for {date}: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_recent_prompts(self, days: int = 14) -> List[dict]:
        """
        過去 N 日間のお題を取得（重複チェック用）
        
        Args:
            days: 何日前までを取得するか
        
        Returns:
            お題リスト
        """
        self.__init_prompts_table()
        if not self._prompts_table:
            return []
        
        try:
            from datetime import timedelta, datetime
            jst = pytz.timezone('Asia/Tokyo')
            start_date = (datetime.now(jst) - timedelta(days=days)).strftime("%Y-%m-%d")
            
            # テーブルスキャン（開発環境用。本番ではGSIやQuery使用を推奨）
            response = self._prompts_table.scan(
                FilterExpression=f"#d >= :start_date",
                ExpressionAttributeNames={"#d": "date"},
                ExpressionAttributeValues={":start_date": start_date}
            )
            
            # 日付でソート（新しい順）
            items = response.get("Items", [])
            items.sort(key=lambda x: x.get("date", ""), reverse=True)
            return items
        except Exception as e:
            print(f"Error getting recent prompts: {e}")
            return []
