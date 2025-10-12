import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * /api/run-inference
 * Purpose: Run inference on a Hugging Face model
 * 
 * Endpoint: POST https://api-inference.huggingface.co/models/<model_id>
 * 
 * Example Request:
 * POST /api/run-inference
 * {
 *   "model_id": "roboflow/YOLOv8-Basketball-Detection",
 *   "inputs": "https://example.com/image.jpg"  // or base64 string
 * }
 * 
 * Example Response:
 * [
 *   {"label": "basketball_player", "score": 0.97, "box": {...}},
 *   {"label": "basketball", "score": 0.93, "box": {...}}
 * ]
 */

interface RunInferenceRequest {
  model_id: string
  inputs: string  // URL or base64 image
  parameters?: Record<string, any>
}

export async function POST(request: NextRequest) {
  try {
    const body: RunInferenceRequest = await request.json()
    const { model_id, inputs, parameters } = body

    if (!model_id || !inputs) {
      return NextResponse.json(
        { error: 'model_id and inputs are required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'Hugging Face API key not configured',
          message: 'Add HUGGINGFACE_API_KEY to .env.local'
        },
        { status: 500 }
      )
    }

    const inferenceEndpoint = `https://api-inference.huggingface.co/models/${model_id}`
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    console.log('🔮 Running inference', {
      requestId,
      modelId: model_id,
      timestamp: new Date().toISOString()
    })

    // Determine if inputs is a URL or base64
    let imageData = inputs
    
    // If it's a base64 string, extract the actual data
    if (inputs.startsWith('data:image')) {
      const base64Data = inputs.split(',')[1]
      imageData = base64Data
    }

    // HF Inference API expects raw image data, not JSON
    const response = await fetch(inferenceEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'x-request-id': requestId
      },
      body: Buffer.from(imageData, 'base64')
    })

    if (!response.ok) {
      const errorText = await response.text()
      const duration = Date.now() - startTime
      console.error('❌ HF inference failed', {
        requestId,
        modelId: model_id,
        status: response.status,
        duration,
        error: errorText
      })

      if (response.status === 503) {
        const errorData = JSON.parse(errorText)
        return NextResponse.json(
          {
            error: 'Model is loading',
            estimated_time: errorData.estimated_time,
            status: 'loading'
          },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { 
          error: 'Inference failed',
          details: errorText,
          status: response.status
        },
        { status: response.status }
      )
    }

    const result = await response.json()
    const duration = Date.now() - startTime

    console.log('✅ HF inference success', {
      requestId,
      modelId: model_id,
      duration,
      resultCount: Array.isArray(result) ? result.length : 1,
      timestamp: new Date().toISOString()
    })

    // Normalize response based on task type
    return NextResponse.json({
      success: true,
      model_id,
      results: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Run inference error:', error)
    return NextResponse.json(
      {
        error: 'Inference request failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

