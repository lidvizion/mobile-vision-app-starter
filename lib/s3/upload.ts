import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'

// Initialize S3 client with support for both S3_* and AWS_* naming conventions
const AWS_REGION = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1'
const ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: ACCESS_KEY_ID && SECRET_ACCESS_KEY ? {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  } : undefined,
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME || process.env.NEXT_PUBLIC_STORAGE_BUCKET

export interface UploadResult {
  url: string
  key: string
  bucket: string
}

/**
 * Upload a file buffer to S3
 * @param fileBuffer - File buffer to upload
 * @param fileName - Original file name
 * @param contentType - MIME type (e.g., 'image/jpeg', 'video/mp4')
 * @param folder - Optional folder prefix (e.g., 'images', 'videos')
 * @returns S3 URL and key
 */
export async function uploadToS3(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folder: string = 'cv-results'
): Promise<UploadResult> {
  // Validate S3 configuration
  if (!BUCKET_NAME) {
    throw new Error('S3_BUCKET_NAME or NEXT_PUBLIC_STORAGE_BUCKET environment variable is not set')
  }

  if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error('S3_ACCESS_KEY_ID (or AWS_ACCESS_KEY_ID) and S3_SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEY) environment variables are required for S3 upload')
  }

  // Generate unique file key
  const fileExtension = fileName.split('.').pop() || 'jpg'
  const uniqueId = crypto.randomUUID()
  const timestamp = Date.now()
  const key = `${folder}/${timestamp}-${uniqueId}.${fileExtension}`

  // Upload to S3
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
    // Note: ACL may be disabled on bucket. Use bucket policy for public access instead.
    // ACL: 'public-read', // Uncomment if bucket allows ACLs
  })

  try {
    await s3Client.send(command)
    
    // Construct public URL
    const url = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`
    
    return {
      url,
      key,
      bucket: BUCKET_NAME,
    }
  } catch (error) {
    const errorDetails = error instanceof Error ? error.message : String(error)
    const errorCode = (error as any)?.$metadata?.httpStatusCode || 'unknown'
    const errorName = (error as any)?.name || 'UnknownError'
    
    console.error('❌ S3 upload error:', {
      error: errorDetails,
      code: errorCode,
      name: errorName,
      bucket: BUCKET_NAME,
      region: AWS_REGION,
      key: key
    })
    
    throw new Error(`S3 upload failed: ${errorDetails} (${errorName}, HTTP ${errorCode})`)
  }
}

/**
 * Upload base64 image to S3
 * @param base64Data - Base64 encoded image (with or without data URL prefix)
 * @param fileName - Original file name
 * @param contentType - MIME type (defaults to 'image/jpeg')
 * @returns S3 URL and key
 */
export async function uploadBase64ToS3(
  base64Data: string,
  fileName: string = 'image.jpg',
  contentType: string = 'image/jpeg'
): Promise<UploadResult> {
  // Remove data URL prefix if present
  const base64String = base64Data.includes(',') 
    ? base64Data.split(',')[1] 
    : base64Data

  // Convert base64 to buffer
  const buffer = Buffer.from(base64String, 'base64')
  
  return uploadToS3(buffer, fileName, contentType, 'cv-results/images')
}

/**
 * Upload video file to S3
 * @param fileBuffer - Video file buffer
 * @param fileName - Original file name
 * @param contentType - MIME type (e.g., 'video/mp4')
 * @returns S3 URL and key
 */
export async function uploadVideoToS3(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = 'video/mp4'
): Promise<UploadResult> {
  return uploadToS3(fileBuffer, fileName, contentType, 'cv-results/videos')
}

/**
 * Generate a presigned URL for uploading (alternative approach)
 * @param key - S3 object key
 * @param contentType - MIME type
 * @param expiresIn - URL expiration in seconds (default: 3600 = 1 hour)
 * @returns Presigned URL
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!BUCKET_NAME) {
    throw new Error('S3_BUCKET_NAME or NEXT_PUBLIC_STORAGE_BUCKET environment variable is not set')
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })

  const url = await getSignedUrl(s3Client, command, { expiresIn })
  return url
}

