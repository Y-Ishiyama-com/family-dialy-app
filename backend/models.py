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

