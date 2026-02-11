import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * Stack for S3 Buckets (Photos and Frontend Hosting)
 */
export class StorageStack extends cdk.Stack {
  public readonly photoBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket for photo storage
    this.photoBucket = new s3.Bucket(this, 'PhotoBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ['*'], // Restrict to your domain in production
          allowedHeaders: ['*'],
          exposedHeaders: [
            'ETag',
            'x-amz-server-side-encryption',
            'x-amz-request-id',
            'x-amz-id-2',
          ],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'CleanupIncompleteUploads',
          enabled: true,
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'PhotoBucketName', {
      value: this.photoBucket.bucketName,
      description: 'S3 Photo Bucket Name',
    });

    new cdk.CfnOutput(this, 'PhotoBucketArn', {
      value: this.photoBucket.bucketArn,
      description: 'S3 Photo Bucket ARN',
    });
  }
}
