#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FamilyDiaryMainStack } from '../lib/main-stack';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';
const appName = app.node.tryGetContext('appName') || 'family-diary-app';

// Main stack that will contain all sub-stacks
new FamilyDiaryMainStack(app, `${appName}-stack-${environment}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  stackName: `${appName}-stack-${environment}`,
});

app.synth();
