"""
DynamoDB データベース操作
"""
import boto3
from boto3.dynamodb.conditions import Key
from datetime import datetime
from typing import Optional, List
import os
import uuid
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
        item = {
            "user_id#date": key,
            "user_id": user_id,
            "date": date,
            "entry_text": entry_text,
            "is_public": "true" if is_public else "false",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
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
        item["updated_at"] = datetime.now().isoformat()
        
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
        
        item = {
            "user_id#date": f"{user_id}#{date}",
            "user_id": user_id,
            "date": date,
            "entry_text": entry_text,
            "is_public": "true" if is_public else "false",  # String for GSI
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
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
        
        update_expr = "SET updated_at = :updated_at"
        expr_attr_values = {":updated_at": datetime.now().isoformat()}

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
            "updated_at": datetime.utcnow().isoformat(),
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
        
        # 署名付きURL（読み込み用、24時間有効）を生成
        presigned_url = self.s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': self.photo_bucket,
                'Key': photo_key,
            },
            ExpiresIn=86400  # 24時間
        )
        return presigned_url
    
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
    
    def get_calendar_entries(self, username: str, year: int, month: int) -> List[dict]:
        """カレンダー用の月間エントリを取得"""
        return self.query_month(username, year, month)
