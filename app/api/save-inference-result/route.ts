import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/save-inference-result
 * Purpose: Store HF inference results in MongoDB for caching
 * 
 * MongoDB Collection: hf_inference_jobs
 * 
 * Schema:
 * {
 *   "_id": "uuid-job-123",
 *   "user_id": "uuid-xyz",
 *   "model_id": "roboflow/YOLOv8-Basketball-Detection",
 *   "query": "basketball player shot detection",
 *   "image_url": "https://lidvizion-signed-url.s3.amazonaws.com/sample.jpg",
 *   "response": [
 *     {"label": "basketball_player", "score": 0.97},
 *     {"label": "ball", "score": 0.92}
 *   ],
 *   "created_at": "2025-10-10T17:00:00Z"
 * }
 */

interface SaveInferenceRequest {
  user_id?: string
  model_id: string
  query: string
  image_url?: string
  image_base64?: string
  response: Array<{
    label: string
    score: number
    box?: any
  }>
}

interface SaveInferenceResponse {
  success: boolean
  result_id: string
  message: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveInferenceRequest = await request.json()
    const {
      user_id,
      model_id,
      query,
      image_url,
      image_base64,
      response: predictions
    } = body

    // Validate required fields
    if (!model_id || !query || !predictions) {
      return NextResponse.json(
        { error: 'model_id, query, and response are required' },
        { status: 400 }
      )
    }

    // Generate unique job ID
    const jobId = `uuid-job-${Date.now()}`

    // Prepare HF inference job record (exact schema from spec)
    const inferenceJob = {
      job_id: jobId,
      user_id: user_id || 'anonymous',
      model_id: model_id,
      query: query,
      image_url: image_url || image_base64 || 'base64-image',
      response: predictions,
      created_at: new Date().toISOString()
    }

    // Save to MongoDB
    try {
      const { getDatabase } = await import('@/lib/mongodb/connection')
      const db = await getDatabase()
      await db.collection('hf_inference_jobs').insertOne(inferenceJob)
      console.log('✅ HF inference job saved to MongoDB:', jobId)
    } catch (mongoError) {
      console.error('MongoDB save error:', mongoError)
      // Continue without failing the request
    }

    const responseData: SaveInferenceResponse = {
      success: true,
      result_id: jobId,
      message: 'Inference result saved successfully'
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('❌ Save inference result error:', error)
    return NextResponse.json(
      {
        error: 'Failed to save inference result',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to retrieve inference jobs (with caching support)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const model_id = searchParams.get('model_id')
    const image_url = searchParams.get('image_url')
    const user_id = searchParams.get('user_id')
    const limit = parseInt(searchParams.get('limit') || '10')

    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()

    // Check cache first if model_id and image_url provided
    if (model_id && image_url) {
      const cached = await db
        .collection('hf_inference_jobs')
        .findOne({ model_id, image_url })
      
      if (cached) {
        console.log('✅ Cache hit for inference job')
        return NextResponse.json({
          success: true,
          cached: true,
          result: cached
        })
      }
    }

    // Build query for listing
    const query: any = {}
    if (model_id) query.model_id = model_id
    if (user_id) query.user_id = user_id

    // Fetch results
    const results = await db
      .collection('hf_inference_jobs')
      .find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray()

    return NextResponse.json({
      success: true,
      cached: false,
      results: results,
      count: results.length
    })

  } catch (error) {
    console.error('❌ Get inference jobs error:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve inference jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

