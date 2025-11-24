import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/background-search-status?queryId=xxx
 * 
 * Poll this endpoint to check the status of a background search job
 * and retrieve results when complete.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryId = searchParams.get('queryId')

    if (!queryId) {
      return NextResponse.json(
        { error: 'queryId is required' },
        { status: 400 }
      )
    }

    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()

    // Get job status
    const job = await db.collection('background_search_jobs').findOne({
      query_id: queryId
    })

    if (!job) {
      return NextResponse.json({
        success: false,
        status: 'not_found',
        message: 'Background search job not found',
        models: [],
        count: 0
      })
    }

    // If completed, get results
    if (job.status === 'completed') {
      const results = await db.collection('background_search_results')
        .find({ query_id: queryId })
        .toArray()

      const allModels = results.flatMap(r => r.models || [])

      return NextResponse.json({
        success: true,
        status: 'completed',
        message: `Found ${allModels.length} additional models!`,
        models: allModels,
        count: allModels.length,
        jobId: job.job_id,
        completedAt: job.completed_at
      })
    }

    // If failed
    if (job.status === 'failed') {
      return NextResponse.json({
        success: false,
        status: 'failed',
        message: `Search failed: ${job.error || 'Unknown error'}`,
        models: [],
        count: 0,
        jobId: job.job_id,
        error: job.error
      })
    }

    // Return current status (pending or running)
    return NextResponse.json({
      success: true,
      status: job.status,
      message: job.status === 'running'
        ? 'Background search is in progress...'
        : 'Search is pending...',
      models: [],
      count: 0,
      jobId: job.job_id,
      startedAt: job.started_at
    })

  } catch (error) {
    console.error('❌ Background search status error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
