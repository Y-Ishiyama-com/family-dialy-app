import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

/**
 * Stack for AWS Cognito User Pool
 */
export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'FamilyDiaryUserPool', {
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

    // Create User Pool Domain
    this.userPoolDomain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: 'family-diary-app',
      },
    });

    // Create User Pool Client
    this.userPoolClient = this.userPool.addClient('FamilyDiaryClient', {
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

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: this.userPoolDomain.domainName,
      description: 'Cognito Domain Name',
    });

    new cdk.CfnOutput(this, 'CognitoDomainUrl', {
      value: `https://${this.userPoolDomain.domainName}.auth.${cdk.Aws.REGION}.amazoncognito.com`,
      description: 'Cognito Domain URL',
    });
  }
}
