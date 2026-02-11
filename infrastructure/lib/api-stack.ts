import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

/**
 * Props for API Stack
 */
export interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  diaryTable: dynamodb.Table;
  photoBucket: s3.Bucket;
}

/**
 * Stack for API Gateway + Lambda
 */
export class ApiStack extends cdk.Stack {
  public readonly apiEndpoint: string;
  public readonly diaryFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Create Lambda Function (依存パッケージゼロ - boto3のみ使用)
    // API GatewayのJWT Authorizerで認証を処理
    this.diaryFunction = new lambda.Function(this, 'DiaryFunction', {
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
        AWS_REGION: cdk.Stack.of(this).region,
        COGNITO_USER_POOL_ID: props.userPool.userPoolId,
        COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
        DYNAMODB_TABLE_NAME: props.diaryTable.tableName,
        PHOTO_BUCKET_NAME: props.photoBucket.bucketName,
      },
    });

    // Grant Lambda permissions
    props.diaryTable.grantReadWriteData(this.diaryFunction);
    props.photoBucket.grantReadWrite(this.diaryFunction);

    // Create JWT Authorizer for Cognito
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [props.userPool],
      identitySource: 'method.request.header.Authorization',
      authorizerName: 'CognitoAuthorizer',
    });

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'DiaryApiV2', {
      restApiName: 'Family Diary API v2',
      description: 'API for Family Diary Application',
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      defaultCorsPreflightOptions: {
        // 本番環境: CloudFrontドメインのみを許可
        allowOrigins: ['https://d1l985y7ocpo2p.cloudfront.net'],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
        ],
        allowCredentials: true,
      },
    });

    // Lambda Integration
    const lambdaIntegration = new apigateway.LambdaIntegration(this.diaryFunction, {
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

    // Store API endpoint
    this.apiEndpoint = api.url;

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: this.diaryFunction.functionArn,
      description: 'Lambda function ARN',
    });
  }
}
