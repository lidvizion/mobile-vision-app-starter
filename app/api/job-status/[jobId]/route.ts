import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb/connection'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface JobStatusResponse {
  success: boolean
  jobId: string
  status: 'processing' | 'complete' | 'failed' | 'not_found'
  result?: any
  error?: {
    message: string
    stack?: string
    type?: string
  }
  createdAt?: string
  completedAt?: string
  processingTime?: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params
  const timestamp = new Date().toISOString()

  try {
    console.log('JOB_STATUS_CHECK:', JSON.stringify({
      timestamp: timestamp,
      jobId: jobId
    }))

    const db = await getDatabase()
    const job = await db.collection('inference_jobs').findOne({ _id: jobId })

    if (!job) {
      console.error('JOB_NOT_FOUND:', JSON.stringify({
        timestamp: timestamp,
        jobId: jobId
      }))
      return NextResponse.json(
        {
          success: false,
          jobId: jobId,
          status: 'not_found',
          error: {
            message: `Job ${jobId} not found`
          }
        } as JobStatusResponse,
        { status: 404 }
      )
    }

    const response: JobStatusResponse = {
      success: true,
      jobId: jobId,
      status: job.status || 'processing',
      createdAt: job.createdAt,
      completedAt: job.completedAt || undefined
    }

    if (job.status === 'complete' && job.result) {
      response.result = job.result.results || job.result
      response.processingTime = job.result.processingTime
      
      console.log('JOB_STATUS_COMPLETE:', JSON.stringify({
        timestamp: timestamp,
        jobId: jobId,
        processingTime: response.processingTime,
        resultsCount: Array.isArray(response.result) ? response.result.length : 'not array'
      }))
    }

    if (job.status === 'failed' && job.error) {
      response.error = {
        message: job.error.message || 'Job failed',
        stack: job.error.stack,
        type: job.error.type
      }
      
      console.error('JOB_STATUS_FAILED:', JSON.stringify({
        timestamp: timestamp,
        jobId: jobId,
        error: response.error
      }))
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('JOB_STATUS_ERROR:', JSON.stringify({
      timestamp: timestamp,
      jobId: jobId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }))

    return NextResponse.json(
      {
        success: false,
        jobId: jobId,
        status: 'failed',
        error: {
          message: error instanceof Error ? error.message : 'Failed to check job status',
          stack: error instanceof Error ? error.stack : undefined
        }
      } as JobStatusResponse,
      { status: 500 }
    )
  }
}

