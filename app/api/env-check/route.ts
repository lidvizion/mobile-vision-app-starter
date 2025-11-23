import { NextRequest, NextResponse } from 'next/server'

/**
 * Diagnostic endpoint to check environment variables
 * GET /api/env-check
 */
export async function GET(request: NextRequest) {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        envVars: {
            MONGODB_URI: process.env.MONGODB_URI ? {
                isSet: true,
                length: process.env.MONGODB_URI.length,
                preview: process.env.MONGODB_URI.substring(0, 20) + '...' // Show first 20 chars only
            } : {
                isSet: false,
                message: 'MONGODB_URI is NOT set - this is why models are not loading!'
            },
            ROBOFLOW_API_KEY: process.env.ROBOFLOW_API_KEY ? {
                isSet: true,
                length: process.env.ROBOFLOW_API_KEY.length
            } : {
                isSet: false
            },
            OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET',
            HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY ? 'SET' : 'NOT SET'
        },
        recommendation: process.env.MONGODB_URI
            ? 'MongoDB URI is configured. Check connection string validity.'
            : '⚠️ CRITICAL: Set MONGODB_URI in AWS Amplify environment variables!'
    }

    return NextResponse.json(diagnostics, { status: 200 })
}
