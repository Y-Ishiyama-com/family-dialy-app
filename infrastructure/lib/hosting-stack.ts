import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * Props for Hosting Stack
 */
export interface HostingStackProps extends cdk.StackProps {
  apiEndpoint: string;
  cognitoClientId: string;
  userPoolId: string;
}

/**
 * Stack for CloudFront + S3 Static Website Hosting
 */
export class HostingStack extends cdk.Stack {
  public readonly distributionUrl: string;
  public readonly websiteBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: HostingStackProps) {
    super(scope, id, props);

    // Create S3 Bucket for Static Website
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA routing support
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev environment
      autoDeleteObjects: true, // For dev environment
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Origin Access Identity for CloudFront
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      'OriginAccessIdentity',
      {
        comment: 'OAI for Family Diary Website',
      }
    );

    // Grant CloudFront read access to S3 bucket
    this.websiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [this.websiteBucket.arnForObjects('*')],
        principals: [
          new iam.CanonicalUserPrincipal(
            originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessIdentity(this.websiteBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
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
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe
      enableLogging: false, // Enable for production
      comment: 'Family Diary Website Distribution',
    });

    this.distributionUrl = `https://${distribution.distributionDomainName}`;

    // Outputs
    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: this.distributionUrl,
      description: 'CloudFront Distribution URL',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket.bucketName,
      description: 'S3 bucket for website hosting',
    });

    // Create runtime config file for frontend
    new cdk.CfnOutput(this, 'FrontendConfig', {
      value: JSON.stringify({
        apiEndpoint: props.apiEndpoint,
        cognitoClientId: props.cognitoClientId,
        userPoolId: props.userPoolId,
        region: cdk.Aws.REGION,
      }),
      description: 'Frontend configuration (copy to .env.local)',
    });
  }
}
