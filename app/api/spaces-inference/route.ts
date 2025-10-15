import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * /api/spaces-inference
 * Purpose: Run inference on Hugging Face Spaces (Gradio apps)
 * Methods: POST
 */

interface SpacesInferenceRequest {
  space_id: string  // e.g., "hippoiam10/yolo_hippo"
  inputs: string    // Base64 data URL or image URL
  parameters?: Record<string, any>
}

interface SpacesInferenceResponse {
  success: boolean
  space_id: string
  results?: any
  error?: string
  requestId: string
  timestamp: string
  duration: number
}

/**
 * POST - Run inference on a Hugging Face Space
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()

  try {
    const body: SpacesInferenceRequest = await request.json()
    const { space_id, inputs, parameters } = body

    if (!space_id || !inputs) {
      return NextResponse.json(
        { 
          success: false,
          space_id: space_id || '',
          error: 'space_id and inputs are required',
          requestId,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime
        },
        { status: 400 }
      )
    }

    console.log(`🚀 Running inference on Hugging Face Space: ${space_id}`)

    // Format: https://{username}-{space_name}.hf.space/api/predict
    const spaceUrl = `https://${space_id.replace('/', '-')}.hf.space/api/predict`

    const payload = {
      data: [inputs],
      ...(parameters && { fn_index: 0, api_name: '/predict' })
    }

    const response = await fetch(spaceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Spaces inference failed for ${space_id}:`, response.status, errorText)
      
      return NextResponse.json({
        success: false,
        space_id,
        error: `Space inference failed: ${response.status} ${errorText}`,
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      })
    }

    const result = await response.json()
    console.log(`✅ Spaces inference successful for ${space_id}`)

    return NextResponse.json({
      success: true,
      space_id,
      results: result,
      requestId,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    })

  } catch (error) {
    console.error('❌ Spaces inference error:', error)
    
    return NextResponse.json({
      success: false,
      space_id: (request as any).space_id || '',
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}

/**
 * GET - Get information about a Hugging Face Space
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const spaceId = searchParams.get('space_id')

    if (!spaceId) {
      return NextResponse.json(
        { error: 'space_id parameter is required' },
        { status: 400 }
      )
    }

    // Get space information from Hugging Face API
    const spaceUrl = `https://huggingface.co/api/spaces/${spaceId}`
    const response = await fetch(spaceUrl)

    if (!response.ok) {
      return NextResponse.json(
        { error: `Space not found: ${spaceId}` },
        { status: 404 }
      )
    }

    const spaceInfo = await response.json()

    return NextResponse.json({
      space_id: spaceId,
      info: spaceInfo,
      inference_url: `https://${spaceId.replace('/', '-')}.hf.space/api/predict`
    })

  } catch (error) {
    console.error('❌ Get space info error:', error)
    return NextResponse.json(
      { error: 'Failed to get space information' },
      { status: 500 }
    )
  }
}
