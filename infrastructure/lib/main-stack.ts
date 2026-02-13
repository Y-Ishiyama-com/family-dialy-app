import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';

/**
 * Main stack that contains all resources
 */
export class FamilyDiaryMainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // === Cognito User Pool ===
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'family-diary-pool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireSymbols: false,
        requireUppercase: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.OPTIONAL,
    });

    // Create Cognito Domain
    const userPoolDomain = userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: 'family-diary-app',
      },
    });

    const userPoolClient = userPool.addClient('UserPoolClient', {
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: false,
        adminUserPassword: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: [
          'http://localhost:3000',
          'http://localhost:3000/callback',
          'http://localhost:5173',
          'http://localhost:5173/callback',
          'https://d1l985y7ocpo2p.cloudfront.net',
          'https://d1l985y7ocpo2p.cloudfront.net/callback',
        ],
      },
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
    });

    // === DynamoDB Table ===
    const diaryTable = new dynamodb.Table(this, 'DiaryTable', {
      tableName: 'diary_entries',
      partitionKey: {
        name: 'user_id#date',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
    });

    // Add GSI for querying by user_id and date
    diaryTable.addGlobalSecondaryIndex({
      indexName: 'user_id-date-index',
      partitionKey: {
        name: 'user_id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Add GSI for public entries
    diaryTable.addGlobalSecondaryIndex({
      indexName: 'is_public-date-index',
      partitionKey: {
        name: 'is_public',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // === DynamoDB Table for Daily Prompts ===
    const diaryPromptsTable = new dynamodb.Table(this, 'DiaryPromptsTable', {
      tableName: 'diary_prompts',
      partitionKey: {
        name: 'date',
        type: dynamodb.AttributeType.STRING,  // YYYY-MM-DD format
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
    });

    // Enable TTL (Time To Live) to auto-delete old prompts after 30 days
    diaryPromptsTable.addTimeToLiveAttribute('expireAt');

    // === S3 Bucket for Photos ===
    const photoBucket = new s3.Bucket(this, 'PhotoBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // === Lambda Function ===
    const diaryFunction = new lambda.Function(this, 'DiaryFunction', {
      functionName: 'family-diary-api',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'api_handler.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: [
          'auth.py',
          'main.py',
          'lambda_handler.py',
          'requirements.txt',
          'requirements-lambda.txt',
          '__pycache__',
          '*.pyc',
          '.venv',
          'layers',
        ],
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        DYNAMODB_TABLE_NAME: diaryTable.tableName,
        DYNAMODB_PROMPTS_TABLE_NAME: diaryPromptsTable.tableName,
        PHOTO_BUCKET_NAME: photoBucket.bucketName,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        // CORS許可オリジン（カンマ区切りで複数指定可能）
        // 本番: CloudFrontドメイン、開発: localhost
        ALLOWED_ORIGINS: 'https://d1l985y7ocpo2p.cloudfront.net,http://localhost:5173',
        // 開発環境でのCORSバイパス（本番では無効化推奨）
        ALLOW_DEV_CORS_BYPASS: 'false',
      },
    });

    // Grant permissions
    diaryTable.grantReadWriteData(diaryFunction);
    diaryPromptsTable.grantReadWriteData(diaryFunction);
    photoBucket.grantReadWrite(diaryFunction);
    diaryFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:GetUser', 'cognito-idp:ListUsers'],
        resources: [userPool.userPoolArn],
      })
    );

    // === Lambda Function for Daily Prompt Generation ===
    const promptGeneratorFunction = new lambda.Function(this, 'PromptGeneratorFunction', {
      functionName: 'family-diary-prompt-generator',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'prompt_generator_lambda.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: [
          'auth.py',
          'main.py',
          'api_handler.py',
          'lambda_handler.py',
          'requirements.txt',
          'requirements-lambda.txt',
          '__pycache__',
          '*.pyc',
          '.venv',
          'layers',
        ],
      }),
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        DYNAMODB_PROMPTS_TABLE_NAME: diaryPromptsTable.tableName,
        BEDROCK_MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0',
      },
    });

    // Grant permissions for Prompt Generator Lambda
    diaryPromptsTable.grantReadWriteData(promptGeneratorFunction);
    
    // Add Bedrock permissions
    promptGeneratorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
        ],
      })
    );

    // === EventBridge Rule for Daily Prompt Generation ===
    // Schedule: Daily at 9:00 AM JST (00:00 UTC)
    const promptGenerationRule = new events.Rule(this, 'DailyPromptGenerationRule', {
      schedule: events.Schedule.cron({
        hour: '0',      // 00:00 UTC = 09:00 JST (+9)
        minute: '0',
        day: '*',
        month: '*',
        year: '*',
      }),
      description: 'Trigger daily prompt generation (9:00 AM JST)',
    });

    // Add Lambda as target
    promptGenerationRule.addTarget(
      new targets.LambdaFunction(promptGeneratorFunction, {
        deadLetterQueue: undefined,  // Optional: add DLQ for failed invocations
      })
    );

    // === Cognito Authorizer for API Gateway ===
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
      authorizerName: 'CognitoAuthorizer',
    });

    // === API Gateway ===
    const api = new apigateway.RestApi(this, 'DiaryApiV2', {
      restApiName: 'Family Diary API v2',
      description: 'API for Family Diary Application',
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        // レート制限設定（家族4人向け緩め設定）
        throttlingBurstLimit: 50,   // 瞬間最大50リクエスト
        throttlingRateLimit: 20,    // 定常20リクエスト/秒
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ['https://d1l985y7ocpo2p.cloudfront.net'],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
        ],
        allowCredentials: true,
      },
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(diaryFunction, {
      proxy: true,
      allowTestInvoke: true,
    });

    // Health check endpoint (認証不要)
    const health = api.root.addResource('health');
    health.addMethod('GET', lambdaIntegration);

    // Diary endpoints (認証必要)
    const diary = api.root.addResource('diary');
    const diaryDate = diary.addResource('{date}');
    diaryDate.addMethod('GET', lambdaIntegration, {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    diaryDate.addMethod('POST', lambdaIntegration, {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    diaryDate.addMethod('DELETE', lambdaIntegration, {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Photo upload endpoint (認証必要)
    const photo = diaryDate.addResource('photo');
    photo.addMethod('POST', lambdaIntegration, {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Family calendar endpoint (認証必要)
    const family = api.root.addResource('family');
    const calendar = family.addResource('calendar');
    const year = calendar.addResource('{year}');
    const month = year.addResource('{month}');
    month.addMethod('GET', lambdaIntegration, {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // My calendar endpoint (認証必要)
    const myResource = api.root.addResource('my');
    const myCalendarResource = myResource.addResource('calendar');
    const myYearResource = myCalendarResource.addResource('{year}');
    const myMonthResource = myYearResource.addResource('{month}');
    myMonthResource.addMethod('GET', lambdaIntegration, {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // === Gateway Responses for CORS on Auth Errors ===
    // 401 Unauthorizedレスポンスに明示的にCORSヘッダーを追加
    api.addGatewayResponse('Unauthorized', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      statusCode: '401',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'https://d1l985y7ocpo2p.cloudfront.net'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
        'Access-Control-Allow-Methods': "'GET,POST,DELETE,OPTIONS'",
        'Access-Control-Allow-Credentials': "'true'",
      },
    });

    // 403 Access Deniedレスポンスに明示的にCORSヘッダーを追加
    api.addGatewayResponse('AccessDenied', {
      type: apigateway.ResponseType.ACCESS_DENIED,
      statusCode: '403',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'https://d1l985y7ocpo2p.cloudfront.net'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
        'Access-Control-Allow-Methods': "'GET,POST,DELETE,OPTIONS'",
        'Access-Control-Allow-Credentials': "'true'",
      },
    });

    // === Usage Plan for Rate Limiting ===
    // 月間クォータ設定（家族4人向け: 月間5000リクエスト）
    const usagePlan = api.addUsagePlan('FamilyDiaryUsagePlan', {
      name: 'Family Diary Usage Plan',
      description: 'Rate limiting for family diary app (4 users)',
      throttle: {
        burstLimit: 50,    // 瞬間最大50リクエスト
        rateLimit: 20,     // 定常20リクエスト/秒
      },
      quota: {
        limit: 5000,       // 月間5000リクエスト
        period: apigateway.Period.MONTH,
      },
    });

    // Usage PlanをAPIステージに関連付け
    usagePlan.addApiStage({
      stage: api.deploymentStage,
    });

    // === S3 Bucket for Website ===
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // === CloudFront Distribution ===
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'OAI for Family Diary Website',
    });

    websiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [websiteBucket.arnForObjects('*')],
        principals: [
          new iam.CanonicalUserPrincipal(
            originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    // Grant CloudFront read access to photo bucket
    photoBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [photoBucket.arnForObjects('*')],
        principals: [
          new iam.CanonicalUserPrincipal(
            originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessIdentity(websiteBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      additionalBehaviors: {
        'photos/*': {
          origin: S3BucketOrigin.withOriginAccessIdentity(photoBucket, {
            originAccessIdentity,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enableLogging: false,
      comment: 'Family Diary Website Distribution',
    });

    // === Outputs ===
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'CognitoClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: userPoolDomain.domainName,
      description: 'Cognito Domain Name (prefix only)',
    });

    new cdk.CfnOutput(this, 'CognitoDomainUrl', {
      value: `https://${userPoolDomain.domainName}.auth.${cdk.Aws.REGION}.amazoncognito.com`,
      description: 'Cognito Domain Full URL',
    });

    new cdk.CfnOutput(this, 'HostingUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront distribution URL',
    });

    new cdk.CfnOutput(this, 'PhotoBucketName', {
      value: photoBucket.bucketName,
      description: 'S3 bucket for photo storage',
    });

    new cdk.CfnOutput(this, 'PromptTableName', {
      value: diaryPromptsTable.tableName,
      description: 'DynamoDB table for daily prompts',
    });
  }
}
