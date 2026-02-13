"""
データモデル定義 - dataclassesを使用（依存パッケージゼロ）
"""
from dataclasses import dataclass, asdict
from typing import Optional, List
from datetime import datetime


@dataclass
class DiaryEntry:
    """日記エントリモデル"""
    username: str
    date: str
    content: str
    mood: str = "normal"
    weather: str = "sunny"
    photos: List[str] = None
    is_public: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    def __post_init__(self):
        if self.photos is None:
            self.photos = []
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()
        if self.updated_at is None:
            self.updated_at = datetime.utcnow().isoformat()
    
    def to_dict(self):
        """辞書に変換"""
        return asdict(self)


@dataclass
class DailyPrompt:
    """毎日のお題モデル"""
    date: str  # YYYY-MM-DD format
    prompt: str  # The daily prompt/question
    category: Optional[str] = None  # e.g., "seasonal", "event", "reflection", "fun"
    created_at: Optional[str] = None
    expire_at: Optional[int] = None  # Unix timestamp for DynamoDB TTL
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()
        if self.expire_at is None:
            # Set expiration to 30 days from creation
            from datetime import timedelta
            expire_date = datetime.utcnow() + timedelta(days=30)
            self.expire_at = int(expire_date.timestamp())
    
    def to_dict(self):
        """辞書に変換"""
        return asdict(self)

