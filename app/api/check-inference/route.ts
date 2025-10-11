import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/check-inference
 * Purpose: Check if a Hugging Face model supports inference API
 * 
 * Endpoint: POST https://api-inference.huggingface.co/models/<model_id>
 * 
 * Example Request:
 * POST /api/check-inference
 * {
 *   "model_id": "roboflow/YOLOv8-Basketball-Detection"
 * }
 * 
 * Example Response:
 * {
 *   "supportsInference": true,
 *   "inferenceEndpoint": "https://api-inference.huggingface.co/models/roboflow/YOLOv8-Basketball-Detection",
 *   "status": "ready"
 * }
 */

interface CheckInferenceRequest {
  model_id: string
}

interface CheckInferenceResponse {
  supportsInference: boolean
  inferenceEndpoint?: string
  status: 'ready' | 'loading' | 'error' | 'unavailable'
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckInferenceRequest = await request.json()
    const { model_id } = body

    if (!model_id) {
      return NextResponse.json(
        { error: 'model_id is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY
    const inferenceEndpoint = `https://api-inference.huggingface.co/models/${model_id}`

    // Try to get model info to check if inference is supported
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    // Send a lightweight OPTIONS request to check availability
    const response = await fetch(inferenceEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputs: ''  // Empty input just to test availability
      })
    })

    const status = response.status

    // Status codes:
    // 200 = Model is ready
    // 503 = Model is loading
    // 401/403 = Authentication issue
    // 404 = Model doesn't support inference

    let inferenceStatus: 'ready' | 'loading' | 'error' | 'unavailable' = 'unavailable'
    let supportsInference = false

    if (status === 200) {
      inferenceStatus = 'ready'
      supportsInference = true
    } else if (status === 503) {
      // Model exists but is loading
      const data = await response.json().catch(() => ({}))
      if (data.estimated_time) {
        inferenceStatus = 'loading'
        supportsInference = true
      }
    } else if (status === 401 || status === 403) {
      // Authentication issue - can't determine
      inferenceStatus = 'unavailable'
      supportsInference = false
    } else {
      // Model doesn't support inference or doesn't exist
      inferenceStatus = 'unavailable'
      supportsInference = false
    }

    const result: CheckInferenceResponse = {
      supportsInference,
      inferenceEndpoint: supportsInference ? inferenceEndpoint : undefined,
      status: inferenceStatus
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Check inference error:', error)
    return NextResponse.json(
      {
        supportsInference: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      } as CheckInferenceResponse,
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check multiple models at once
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const modelIds = searchParams.get('model_ids')?.split(',') || []

    if (modelIds.length === 0) {
      return NextResponse.json(
        { error: 'model_ids parameter is required' },
        { status: 400 }
      )
    }

    // Check all models in parallel
    const results = await Promise.all(
      modelIds.map(async (model_id) => {
        const response = await fetch(`${request.nextUrl.origin}/api/check-inference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model_id })
        })
        const data = await response.json()
        return {
          model_id,
          ...data
        }
      })
    )

    return NextResponse.json({ results })

  } catch (error) {
    console.error('Batch check inference error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

