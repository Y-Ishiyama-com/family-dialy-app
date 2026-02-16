"""
AWS Lambda エントリポイント - ASGI to AWS Lambda Proxy Integration
"""
from mangum import Mangum
from main import app

# Lambda handler with proper settings for API Gateway Proxy Integration
handler = Mangum(app, lifespan="off")

