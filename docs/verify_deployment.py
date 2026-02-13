#!/usr/bin/env python3
"""
「今日のお題」機能のデプロイ前検証スクリプト
AWS認証情報が設定されていることが前提
"""

import boto3
import sys
from datetime import datetime, timedelta

def check_bedrock_access():
    """Bedrockへのアクセスを確認"""
    print("\n✓ Bedrock アクセス確認")
    try:
        client = boto3.client('bedrock', region_name='us-east-1')  # Bedrockが利用可能なリージョン
        
        # モデル情報を取得
        response = client.get_foundation_model(modelIdentifier='anthropic.claude-3-sonnet-20240229-v1:0')
        print(f"  ✓ Claude 3 Sonnet が利用可能です")
        return True
    except Exception as e:
        print(f"  ✗ Bedrock アクセスエラー: {e}")
        print("    → Model Access で Claude 3 Sonnet を有効化してください")
        return False

def check_dynamodb_table():
    """DynamoDB テーブルを確認"""
    print("\n✓ DynamoDB テーブル確認")
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('diary_prompts')
        
        # テーブルが存在するか確認
        table.table_status
        print(f"  ✓ テーブル 'diary_prompts' が存在します")
        print(f"    - Status: {table.table_status}")
        print(f"    - ARN: {table.table_arn}")
        return True
    except Exception as e:
        print(f"  ✗ DynamoDB テーブルエラー: {e}")
        print("    → CDK デプロイを実行してください")
        return False

def check_lambda_function():
    """Lambda 関数を確認"""
    print("\n✓ Lambda 関数確認")
    try:
        client = boto3.client('lambda')
        response = client.get_function(FunctionName='family-diary-prompt-generator')
        
        function_config = response['Configuration']
        print(f"  ✓ Lambda 関数 'family-diary-prompt-generator' が存在します")
        print(f"    - Runtime: {function_config['Runtime']}")
        print(f"    - Handler: {function_config['Handler']}")
        print(f"    - Memory: {function_config['MemorySize']}MB")
        print(f"    - Timeout: {function_config['Timeout']}s")
        
        # 環境変数を確認
        env_vars = function_config.get('Environment', {}).get('Variables', {})
        required_vars = ['DYNAMODB_PROMPTS_TABLE_NAME', 'BEDROCK_MODEL_ID']
        
        for var in required_vars:
            if var in env_vars:
                print(f"    ✓ 環境変数 {var}: {env_vars[var]}")
            else:
                print(f"    ✗ 環境変数 {var} が見つかりません")
                return False
        
        return True
    except Exception as e:
        print(f"  ✗ Lambda 関数エラー: {e}")
        print("    → CDK デプロイを実行してください")
        return False

def check_eventbridge_rule():
    """EventBridge ルールを確認"""
    print("\n✓ EventBridge ルール確認")
    try:
        client = boto3.client('events')
        response = client.describe_rule(Name='DailyPromptGenerationRule-Updated')
        
        rule = response
        print(f"  ✓ ルール 'DailyPromptGenerationRule-Updated' が存在します")
        print(f"    - State: {rule['State']}")
        print(f"    - Schedule: {rule.get('ScheduleExpression', 'N/A')}")
        print(f"    - Description: {rule.get('Description', 'N/A')}")
        
        # ターゲットを確認
        targets = client.list_targets_by_rule(Rule='DailyPromptGenerationRule-Updated')
        if targets['Targets']:
            print(f"    ✓ ターゲット Lambda: {targets['Targets'][0]['Arn']}")
        else:
            print(f"    ✗ ターゲットが設定されていません")
            return False
        
        return True
    except Exception as e:
        print(f"  ✗ EventBridge ルールエラー: {e}")
        print("    → CDK デプロイを実行してください")
        return False

def test_lambda_invocation():
    """Lambda 関数を直接実行してテスト"""
    print("\n✓ Lambda 関数テスト実行")
    try:
        client = boto3.client('lambda')
        response = client.invoke(
            FunctionName='family-diary-prompt-generator',
            InvocationType='RequestResponse',
            Payload='{}'
        )
        
        status_code = response['StatusCode']
        if status_code == 200:
            print(f"  ✓ Lambda 実行成功")
            
            # レスポンスを解析
            import json
            response_payload = json.loads(response['Payload'].read())
            if response_payload.get('statusCode') == 200:
                body = json.loads(response_payload['body'])
                print(f"    - メッセージ: {body.get('message', 'N/A')}")
                if 'prompt' in body:
                    print(f"    - 生成されたお題: {body.get('prompt', 'N/A')}")
                print(f"    - カテゴリ: {body.get('category', 'N/A')}")
                return True
            else:
                print(f"  ✗ Lambda エラーレスポンス")
                print(f"    - Body: {response_payload.get('body', 'N/A')}")
                return False
        else:
            print(f"  ✗ Lambda 実行失敗: Status {status_code}")
            return False
    except Exception as e:
        print(f"  ✗ Lambda テスト実行エラー: {e}")
        return False

def check_recent_prompts():
    """過去のお題が保存されているか確認"""
    print("\n✓ DynamoDB データ確認")
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('diary_prompts')
        
        # 過去30日間のお題を取得
        today = datetime.utcnow()
        recent_prompts = []
        
        for days_ago in range(30):
            date = (today - timedelta(days=days_ago)).strftime('%Y-%m-%d')
            try:
                response = table.get_item(Key={'date': date})
                if 'Item' in response:
                    recent_prompts.append(response['Item'])
            except:
                pass
        
        if recent_prompts:
            print(f"  ✓ {len(recent_prompts)} 件のお題が保存されています")
            # 最新のお題を表示
            latest = recent_prompts[0]
            print(f"    - 最新: {latest['date']}")
            print(f"    - お題: {latest['prompt'][:80]}...")
        else:
            print(f"  ⚠ お題が保存されていません")
            print(f"    → Lambda 関数を実行してお題を生成してください")
        
        return True
    except Exception as e:
        print(f"  ✗ DynamoDB データ確認エラー: {e}")
        return False

def main():
    """メイン検証函数"""
    print("\n" + "="*60)
    print("「今日のお題」機能 デプロイ前検証")
    print("="*60)
    
    results = []
    
    # 各種チェック実行
    results.append(("Bedrock アクセス", check_bedrock_access()))
    results.append(("DynamoDB テーブル", check_dynamodb_table()))
    results.append(("Lambda 関数", check_lambda_function()))
    results.append(("EventBridge ルール", check_eventbridge_rule()))
    results.append(("DynamoDB データ", check_recent_prompts()))
    
    # 追加テスト（オプション）
    print("\n" + "-"*60)
    print("オプション: Lambda 直接実行テスト")
    print("-"*60)
    test_lambda_invocation()
    
    # 結果サマリー
    print("\n" + "="*60)
    print("検証結果サマリー")
    print("="*60)
    
    all_passed = True
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {name}")
        if not passed:
            all_passed = False
    
    print("\n" + "="*60)
    if all_passed:
        print("✓ すべての検証に合格しました！デプロイ準備完了です。")
        return 0
    else:
        print("✗ いくつかの検証が失敗しました。上記を修正してください。")
        return 1
    

if __name__ == '__main__':
    sys.exit(main())
