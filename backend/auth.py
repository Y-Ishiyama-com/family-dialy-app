"""
Cognito JWT 認証・認可（FastAPI不要版）
"""
import jwt
import json
import urllib.request
import urllib.error
import os
from typing import Optional, Dict
from functools import lru_cache


# Cognito JWKS URL
COGNITO_REGION = os.environ.get("AWS_REGION", "us-east-1")
COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID", "")
JWKS_URL = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"


class AuthenticationError(Exception):
    """認証エラー"""
    pass


@lru_cache(maxsize=1)
def get_jwks():
    """
    Cognito の公開鍵（JWKS）を取得してキャッシュ

    Returns:
        JWKS データ
    """
    try:
        COGNITO_REGION = os.environ.get("AWS_REGION", "us-east-1")
        COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID", "")
        JWKS_URL = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
        
        with urllib.request.urlopen(JWKS_URL, timeout=5) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception:
        return {"keys": []}


def verify_token(token: str) -> Dict:
    """
    JWT トークンを検証し、デコードされたトークン情報を返す

    Args:
        token: JWT トークン文字列

    Returns:
        デコードされたトークンのクレーム

    Raises:
        AuthenticationError: トークンが無効な場合
    """
    COGNITO_REGION = os.environ.get("AWS_REGION", "us-east-1")
    COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID", "")
    COGNITO_CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID", "")

    try:
        # トークンヘッダーから KID を取得
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        if not kid:
            raise AuthenticationError("Invalid token header")

        # JWKS から公開鍵を取得
        jwks = get_jwks()
        key = None
        for jwk_key in jwks.get("keys", []):
            if jwk_key.get("kid") == kid:
                # JWK を PEM フォーマットに変換
                from cryptography.hazmat.primitives.asymmetric import rsa
                from cryptography.hazmat.backends import default_backend
                import base64
                
                # RSA 公開鍵を再構築
                n = base64.urlsafe_b64decode(jwk_key['n'] + '==')
                e = base64.urlsafe_b64decode(jwk_key['e'] + '==')
                
                # PEM フォーマットで鍵を生成
                from cryptography.hazmat.primitives import serialization
                numbers = rsa.RSAPublicNumbers(int.from_bytes(e, 'big'), int.from_bytes(n, 'big'))
                key = numbers.public_key(default_backend())
                break

        if not key:
            raise AuthenticationError("Public key not found")

        # JWT を検証
        decode_options = {
            "algorithms": ["RS256"],
            "audience": COGNITO_CLIENT_ID,
            "issuer": f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}",
        }
        
        decoded = jwt.decode(token, key, **decode_options)
        
        # デコードされたトークンを返す
        return decoded

    except jwt.PyJWTError as e:
        raise AuthenticationError(f"Invalid token: {str(e)}")
    except AuthenticationError:
        raise
    except Exception as e:
        raise AuthenticationError(f"Token verification failed: {str(e)}")
