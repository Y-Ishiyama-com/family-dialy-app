import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * Stack for DynamoDB Table
 */
export class DatabaseStack extends cdk.Stack {
  public readonly diaryTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB Table for Diary Entries
    this.diaryTable = new dynamodb.Table(this, 'DiaryEntriesTable', {
      tableName: 'diary_entries',
      partitionKey: {
        name: 'user_id#date',
        type: dynamodb.AttributeType.STRING,
      },
      // No sort key - user_id#date is unique per entry
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev environment only
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: false, // Enable for production
    });

    // Add GSI for querying by user_id and date separately
    this.diaryTable.addGlobalSecondaryIndex({
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

    // Add GSI for is_public entries (for family calendar view)
    this.diaryTable.addGlobalSecondaryIndex({
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

    // Outputs
    new cdk.CfnOutput(this, 'TableName', {
      value: this.diaryTable.tableName,
      description: 'DynamoDB Table Name',
    });

    new cdk.CfnOutput(this, 'TableArn', {
      value: this.diaryTable.tableArn,
      description: 'DynamoDB Table ARN',
    });
  }
}
