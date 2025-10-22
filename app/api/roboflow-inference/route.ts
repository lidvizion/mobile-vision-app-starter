import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/roboflow-inference
 * Purpose: Run inference on Roboflow models using their serverless API
 * Based on the Roboflow API documentation and examples provided
 */

interface RoboflowInferenceRequest {
  model_url: string
  api_key: string
  image: string // Base64 encoded image
  parameters?: {
    confidence?: number
    overlap?: number
    max_detections?: number
  }
}

interface RoboflowInferenceResponse {
  success: boolean
  results: any[]
  model_info: {
    name: string
    url: string
    version: string
  }
  processing_time: number
  timestamp: string
}

export async function POST(request: NextRequest) {
  try {
    const body: RoboflowInferenceRequest = await request.json()
    const { model_url, api_key, image, parameters = {} } = body

    if (!model_url || !api_key || !image) {
      return NextResponse.json(
        { error: 'model_url, api_key, and image are required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Running Roboflow inference on: ${model_url}`)

    const startTime = Date.now()

    // Prepare the request parameters
    const requestParams = {
      api_key,
      ...parameters
    }

    // Remove the 'image' parameter from params since we'll send it in the body
    delete (requestParams as any).image

    // Make the request to Roboflow serverless API
    const response = await fetch(model_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        ...Object.fromEntries(Object.entries(requestParams).map(([key, value]) => [key, String(value)])),
        image: image // Send image as form data
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Roboflow API error:', response.status, errorText)
      return NextResponse.json(
        { 
          error: 'Roboflow inference failed', 
          details: errorText,
          status: response.status 
        },
        { status: response.status }
      )
    }

    const results = await response.json()
    const processingTime = Date.now() - startTime

    // Extract model info from the URL
    const urlParts = model_url.split('/')
    const modelName = urlParts[urlParts.length - 2] || 'Unknown Model'
    const version = urlParts[urlParts.length - 1] || '1'

    const responseData: RoboflowInferenceResponse = {
      success: true,
      results: results.predictions || results.detections || results,
      model_info: {
        name: modelName,
        url: model_url,
        version: version
      },
      processing_time: processingTime,
      timestamp: new Date().toISOString()
    }

    console.log(`✅ Roboflow inference completed in ${processingTime}ms`)
    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Roboflow inference error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * Example usage:
 * 
 * POST /api/roboflow-inference
 * {
 *   "model_url": "https://serverless.roboflow.com/motorcycle_traffic_intersection_model-9zgnv/26",
 *   "api_key": "KJWhVAnYok8rniIdzCbZ",
 *   "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
 *   "parameters": {
 *     "confidence": 0.5,
 *     "overlap": 0.3,
 *     "max_detections": 100
 *   }
 * }
 */