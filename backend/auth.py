"""
認証ユーティリティ
ローカル開発用のダミー実装
本番環境ではAPI Gateway Cognito Authorizerで認証済み
"""
from typing import Optional

async def get_current_user(token: str = None) -> str:
    """現在のユーザーを取得（ローカル開発: ダミー実装）"""
    return "test-user"

async def optional_verify_token(token: Optional[str] = None) -> Optional[str]:
    """オプショナルなトークン検証（ローカル開発: ダミー実装）"""
    return "test-user" if token else None