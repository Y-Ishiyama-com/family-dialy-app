"""
Lambda function to generate daily prompts using Bedrock
Triggered by EventBridge on a daily schedule

環境変数:
- DYNAMODB_PROMPTS_TABLE_NAME: DynamoDBプロンプトテーブル名
- BEDROCK_MODEL_ID: BedrockモデルID（デフォルト: anthropic.claude-3-sonnet-20240229-v1:0）
"""
import json
import os
import boto3
from datetime import datetime, timedelta
from typing import List, Dict, Any
import sys
import pytz

# DynamoDB と Bedrock クライアント
dynamodb = boto3.resource("dynamodb")
bedrock = boto3.client("bedrock-runtime")

PROMPTS_TABLE_NAME = os.environ.get("DYNAMODB_PROMPTS_TABLE_NAME")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0")

if not PROMPTS_TABLE_NAME:
    raise ValueError("DYNAMODB_PROMPTS_TABLE_NAME environment variable not set")

prompts_table = dynamodb.Table(PROMPTS_TABLE_NAME)


def get_recent_prompts(days: int = 14) -> List[Dict[str, Any]]:
    """
    過去 N 日間のお題を取得（重複チェック用）
    
    Args:
        days: 何日前までを取得するか
    
    Returns:
        お題リスト
    """
    try:
        jst = pytz.timezone('Asia/Tokyo')
        start_date = (datetime.now(jst) - timedelta(days=days)).strftime("%Y-%m-%d")
        
        # テーブルスキャン
        response = prompts_table.scan(
            FilterExpression="attribute_exists(#d) AND #d >= :start_date",
            ExpressionAttributeNames={"#d": "date"},
            ExpressionAttributeValues={":start_date": start_date}
        )
        
        items = response.get("Items", [])
        items.sort(key=lambda x: x.get("date", ""), reverse=True)
        return items
    except Exception as e:
        print(f"Error getting recent prompts: {e}")
        return []


def get_context_info() -> Dict[str, str]:
    """
    生成時の状況情報を取得（季節、イベント、天気など）
    
    Returns:
        コンテキスト情報
    """
    today = datetime.now(pytz.timezone('Asia/Tokyo'))
    month = today.month
    day = today.day
    
    context = {
        "date": today.strftime("%Y-%m-%d"),
        "month": str(month),
        "day": str(day),
    }
    
    # 季節情報を取得
    if month in [3, 4, 5]:
        context["season"] = "spring"
    elif month in [6, 7, 8]:
        context["season"] = "summer"
    elif month in [9, 10, 11]:
        context["season"] = "autumn"
    else:
        context["season"] = "winter"
    
    # 特別な日付を検出
    special_dates = {
        "1-1": "New Year",
        "2-14": "Valentine's Day",
        "3-8": "International Women's Day",
        "4-1": "April Fools' Day",
        "5-5": "Children's Day",
        "7-7": "Tanabata",
        "8-15": "O-Bon Festival",
        "9-23": "Autumn Equinox",
        "10-31": "Halloween",
        "11-3": "Culture Day",
        "12-25": "Christmas",
    }
    
    date_key = f"{month}-{day}"
    if date_key in special_dates:
        context["special_event"] = special_dates[date_key]
    
    return context


def generate_prompt_with_bedrock(context: Dict[str, str], recent_prompts: List[Dict]) -> str:
    """
    Bedrockを使用してお題を生成
    
    Args:
        context: コンテキスト情報
        recent_prompts: 過去のお題リスト
    
    Returns:
        生成されたお題テキスト
    """
    # 過去のお題をテキスト化
    recent_prompts_text = ""
    if recent_prompts:
        recent_prompts_text = "過去のお題の例:\n"
        for i, prompt in enumerate(recent_prompts[:7], 1):
            recent_prompts_text += f"{i}. 【{prompt.get('date')}】{prompt.get('prompt')}\n"
    
    # コンテキスト情報をテキスト化
    context_text = f"""
現在の日付: {context.get('date')}
季節: {context.get('season')}
"""
    
    if "special_event" in context:
        context_text += f"特別な日: {context.get('special_event')}\n"
    
    # Bedrock プロンプト
    system_prompt = """あなたは家族の日記用のお題生成AIです。
毎日異なるテーマの思考を促すような質問やお題を生成してください。

以下の条件を満たすお題を1つだけ生成してください：
1. 前向きで思考を促すような内容
2. 短く、1～2文で表現できる内容
3. 日記を書く際のきっかけになるような質問形式が理想的
4. 季節やイベント、天気などの状況を考慮する
5. 過去のお題と異なる観点や違うテーマのお題
6. 個人開発の規模で実現可能な、家族向けのテーマ

【出力形式】
お題テキストのみを返してください（説明は不要）。"""

    user_message = f"""{context_text}

{recent_prompts_text}

上記を踏まえて、本日のお題を1つだけ生成してください。
出力は日本語で、お題テキストのみを返してください。"""

    try:
        response = bedrock.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 200,
                "system": system_prompt,
                "messages": [
                    {
                        "role": "user",
                        "content": user_message
                    }
                ]
            })
        )
        
        result = json.loads(response["body"].read())
        
        # Claude の応答から テキストを抽出
        if "content" in result and len(result["content"]) > 0:
            prompt_text = result["content"][0].get("text", "").strip()
            return prompt_text
        else:
            print(f"Unexpected Bedrock response format: {result}")
            return None
    
    except Exception as e:
        print(f"Error calling Bedrock: {e}")
        return None


def save_prompt(date: str, prompt: str, category: str = "daily") -> bool:
    """
    生成されたお題をDynamoDBに保存
    
    Args:
        date: 日付
        prompt: お題テキスト
        category: カテゴリ
    
    Returns:
        成功した場合 True
    """
    try:
        jst = pytz.timezone('Asia/Tokyo')
        now_jst = datetime.now(jst)
        expire_date = now_jst + timedelta(days=30)
        
        item = {
            "date": date,
            "prompt": prompt,
            "category": category,
            "created_at": now_jst.isoformat(),
            "expireAt": int(expire_date.timestamp()),
        }
        
        prompts_table.put_item(Item=item)
        print(f"Successfully saved prompt for {date}: {prompt}")
        return True
    except Exception as e:
        print(f"Error saving prompt to DynamoDB: {e}")
        return False


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda ハンドラーメイン関数
    EventBridge のトリガーで毎日実行される
    
    Returns:
        結果レスポンス
    """
    jst = pytz.timezone('Asia/Tokyo')
    now_jst = datetime.now(jst)
    print(f"Prompt generation Lambda triggered at {now_jst.isoformat()}")
    
    try:
        # コンテキスト情報を取得
        context_info = get_context_info()
        today_date = context_info["date"]
        
        # 既に本日のお題が存在するか確認
        existing = prompts_table.get_item(Key={"date": today_date})
        if "Item" in existing:
            print(f"Prompt already exists for {today_date}")
            return {
                "statusCode": 200,
                "body": json.dumps({
                    "message": f"Prompt already exists for {today_date}",
                    "date": today_date,
                    "prompt": existing["Item"].get("prompt")
                })
            }
        
        # 過去 14 日間のお題を取得
        recent_prompts = get_recent_prompts(days=14)
        print(f"Retrieved {len(recent_prompts)} recent prompts")
        
        # Bedrock でお題を生成
        generated_prompt = generate_prompt_with_bedrock(context_info, recent_prompts)
        
        if not generated_prompt:
            return {
                "statusCode": 500,
                "body": json.dumps({
                    "error": "Failed to generate prompt",
                    "date": today_date
                })
            }
        
        # DynamoDB に保存
        success = save_prompt(
            date=today_date,
            prompt=generated_prompt,
            category=context_info.get("special_event", context_info.get("season", "daily"))
        )
        
        if not success:
            return {
                "statusCode": 500,
                "body": json.dumps({
                    "error": "Failed to save prompt to DynamoDB",
                    "date": today_date,
                    "prompt": generated_prompt
                })
            }
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Prompt generated and saved successfully",
                "date": today_date,
                "prompt": generated_prompt,
                "category": context_info.get("special_event", context_info.get("season", "daily"))
            })
        }
    
    except Exception as e:
        print(f"Error in lambda_handler: {e}")
        import traceback
        traceback.print_exc()
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e)
            })
        }
