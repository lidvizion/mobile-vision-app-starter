import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check S3 environment variables
 * This helps diagnose Amplify environment variable issues
 */
export async function GET(request: NextRequest) {
  try {
    const s3EnvVars = {
      S3_BUCKET_NAME: process.env.S3_BUCKET_NAME ? '✅ SET' : '❌ NOT SET',
      S3_REGION: process.env.S3_REGION ? '✅ SET' : '❌ NOT SET',
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ? '✅ SET (***)' : '❌ NOT SET',
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ? '✅ SET (***)' : '❌ NOT SET',
      // Fallback vars
      AWS_REGION: process.env.AWS_REGION ? '✅ SET' : '❌ NOT SET',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? '✅ SET (***)' : '❌ NOT SET',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? '✅ SET (***)' : '❌ NOT SET',
      NEXT_PUBLIC_STORAGE_BUCKET: process.env.NEXT_PUBLIC_STORAGE_BUCKET ? '✅ SET' : '❌ NOT SET',
    }

    const values = {
      S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || null,
      S3_REGION: process.env.S3_REGION || null,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ? '***' + process.env.S3_ACCESS_KEY_ID.slice(-4) : null,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ? '***' + process.env.S3_SECRET_ACCESS_KEY.slice(-4) : null,
      AWS_REGION: process.env.AWS_REGION || null,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? '***' + process.env.AWS_ACCESS_KEY_ID.slice(-4) : null,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? '***' + process.env.AWS_SECRET_ACCESS_KEY.slice(-4) : null,
    }

    // Check if all required vars are set
    const allSet = !!(
      (process.env.S3_BUCKET_NAME || process.env.NEXT_PUBLIC_STORAGE_BUCKET) &&
      (process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1') &&
      (process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) &&
      (process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)
    )

    return NextResponse.json({
      status: allSet ? '✅ All S3 environment variables are set' : '❌ Missing required S3 environment variables',
      checks: s3EnvVars,
      values: values,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to check environment variables',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

