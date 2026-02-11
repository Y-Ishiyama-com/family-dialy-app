/**
 * S3 ストレージサービス
 * バックエンド経由で写真を処理
 */

/**
 * 写真を S3 にアップロード（プリサイン URL を使用）
 * プリサイン URL はバックエンドで生成
 */
export const uploadPhotoToS3 = async (presignedUrl, photoKey, file) => {
  try {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      // ヘッダーを送信しない（署名検証との一貫性を保つ）
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`)
    }

    // S3 URL を返す（CloudFrontは写真バケットを経由しない）
    const bucketName = presignedUrl.split('.s3.')[0].split('//')[1]
    const s3Url = `https://${bucketName}.s3.amazonaws.com/${photoKey}`
    return s3Url
  } catch (error) {
    console.error('Upload photo error:', error)
    throw error
  }
}

/**
 * S3 から写真を削除
 * 注：バックエンドで削除エンドポイントを実装予定
 */
export const deletePhotoFromS3 = async (photoKey) => {
  try {
    // TODO: バックエンドで削除エンドポイント作成
    console.log('Photo deletion should be handled by backend:', photoKey)
  } catch (error) {
    console.error('Delete photo error:', error)
    throw error
  }
}
