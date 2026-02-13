import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * Stack for DynamoDB Table
 */
export class DatabaseStack extends cdk.Stack {
  public readonly diaryTable: dynamodb.Table;
  public readonly diaryPromptsTable: dynamodb.Table;

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

    // Create DynamoDB Table for Daily Prompts
    this.diaryPromptsTable = new dynamodb.Table(this, 'DiaryPromptsTable', {
      tableName: 'diary_prompts',
      partitionKey: {
        name: 'date',
        type: dynamodb.AttributeType.STRING,  // YYYY-MM-DD format
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev environment only
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: false, // Enable for production
      timeToLiveAttribute: 'expireAt',  // Auto-delete old prompts after 30 days
    });

    // Add GSI to query prompts by date range (for fetching recent prompts)
    this.diaryPromptsTable.addGlobalSecondaryIndex({
      indexName: 'createdAt-index',
      partitionKey: {
        name: 'createdAt',
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

    new cdk.CfnOutput(this, 'PromptTableName', {
      value: this.diaryPromptsTable.tableName,
      description: 'DynamoDB Prompts Table Name',
    });

    new cdk.CfnOutput(this, 'TableArn', {
      value: this.diaryTable.tableArn,
      description: 'DynamoDB Table ARN',
    });

    new cdk.CfnOutput(this, 'PromptTableArn', {
      value: this.diaryPromptsTable.tableArn,
      description: 'DynamoDB Prompts Table ARN',
    });
  }
}
