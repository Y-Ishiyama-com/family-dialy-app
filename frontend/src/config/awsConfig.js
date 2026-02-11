/**
 * AWS 設定
 * 環境変数から必要な設定を読み込む
 */

// 環境変数の取得
export const config = {
  apiEndpoint: import.meta.env.VITE_API_ENDPOINT,
  cognitoUserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  cognitoClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  awsRegion: import.meta.env.VITE_AWS_REGION || 'us-west-2',
  photoBucket: import.meta.env.VITE_PHOTO_BUCKET,
}

// 環境変数の検証
export const validateConfig = () => {
  const required = ['apiEndpoint', 'cognitoUserPoolId', 'cognitoClientId']
  const missing = required.filter((key) => !config[key])

  if (missing.length > 0) {
    console.warn(
      `Missing environment variables: ${missing.join(', ')}. ` +
        'Please copy .env.local.example to .env.local and fill in the values.'
    )
  }
}
