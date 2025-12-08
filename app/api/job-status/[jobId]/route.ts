import { NextRequest, NextResponse } from 'next/server'
import { getJob } from '@/lib/mongodb/jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/job-status/[jobId]
 * Purpose: Poll job status for async inference jobs
 * 
 * Returns job status and results when available
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const job = await getJob(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Return job status
    return NextResponse.json({
      job_id: job.job_id,
      status: job.status,
      result: job.result,
      error: job.error,
      created_at: job.created_at,
      updated_at: job.updated_at,
      duration_ms: job.duration_ms,
    })

  } catch (error: any) {
    console.error('Job status error:', error)
    return NextResponse.json(
      { error: 'Failed to get job status', details: error.message },
      { status: 500 }
    )
  }
}
