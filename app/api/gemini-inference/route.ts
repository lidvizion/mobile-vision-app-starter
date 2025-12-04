import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface GeminiInferenceRequest {
  model_id: string
  inputs: string // base64 image or URL
  parameters?: {
    prompt?: string
    task?: string
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = `gemini_${Date.now()}_${Math.random().toString(36).substring(7)}`

  try {
    // Log raw request for debugging
    const rawBody = await request.text()
    console.log('📥 Raw request body (first 100 chars):', rawBody.substring(0, 100))
    
    const body: GeminiInferenceRequest = JSON.parse(rawBody)
    const { model_id, inputs, parameters } = body

    // Validate API key
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Gemini API key not configured',
          message: 'Add GEMINI_API_KEY to .env.local',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' })

    // Convert base64 to proper format for Gemini
    let imageData: string
    let mimeType: string = 'image/jpeg'

    if (inputs.startsWith('data:')) {
      // Extract mime type and base64 data
      const matches = inputs.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        mimeType = matches[1]
        imageData = matches[2]
      } else {
        throw new Error('Invalid base64 image format')
      }
    } else {
      // Fetch image from URL and convert to base64
      const response = await fetch(inputs)
      const buffer = await response.arrayBuffer()
      imageData = Buffer.from(buffer).toString('base64')
      mimeType = response.headers.get('content-type') || 'image/jpeg'
    }

    // Determine task and create appropriate prompt
    const task = parameters?.task || 'object-detection'
    let prompt = parameters?.prompt || ''

    if (!prompt) {
      switch (task) {
        case 'object-detection':
          prompt = `Analyze this image and detect all objects. For each object found, provide:
1. The object label/class name
2. A confidence score (0-1)
3. The bounding box coordinates as [x_min, y_min, x_max, y_max] normalized to 0-1 range

Return the results as a JSON array with this exact format:
[
  {
    "label": "object_name",
    "score": 0.95,
    "box": {
      "xmin": 0.1,
      "ymin": 0.2,
      "xmax": 0.5,
      "ymax": 0.8
    }
  }
]

IMPORTANT: Return ONLY the JSON array, no additional text or markdown formatting.`
          break
        
        case 'classification':
        case 'image-classification':
          prompt = `Classify this image. Identify the main subject or category.
Return the results as a JSON array with this exact format:
[
  {
    "label": "category_name",
    "score": 0.95
  }
]

Provide top 5 most likely categories.
IMPORTANT: Return ONLY the JSON array, no additional text or markdown formatting.`
          break
        
        case 'segmentation':
        case 'instance-segmentation':
          prompt = `Analyze this image and identify all distinct objects/instances for segmentation.
For each instance, provide:
1. The object label
2. A confidence score
3. A description of the object's location

Return as JSON array:
[
  {
    "label": "object_name",
    "score": 0.95,
    "mask": "description of object location and boundaries"
  }
]

IMPORTANT: Return ONLY the JSON array, no additional text or markdown formatting.`
          break
        
        default:
          prompt = `Analyze this image and provide detailed information about what you see. 
Return the results as a JSON array with detected objects and their properties.`
      }
    }

    // Call Gemini API
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageData,
          mimeType: mimeType
        }
      }
    ])

    const response = result.response
    const text = response.text()

    // Parse JSON response
    let results: any[]
    try {
      // Remove markdown code blocks if present
      let cleanText = text.trim()
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      results = JSON.parse(cleanText)
      
      // Ensure it's an array
      if (!Array.isArray(results)) {
        results = [results]
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON, returning raw text:', parseError)
      // If parsing fails, create a simple result structure
      results = [{
        label: 'analysis',
        description: text,
        score: 1.0
      }]
    }

    // Filter results by confidence threshold
    // Note: Gemini API returns results with its own confidence scores (0-1 range)
    // We filter to only include detections with confidence >= 0.3 to show more bounding boxes in the UI
    const CONFIDENCE_THRESHOLD = 0.3
    results = results.filter((result: any) => {
      const score = result.score || result.confidence || 0
      return score >= CONFIDENCE_THRESHOLD
    })

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      model_id: 'gemini-3-pro-preview',
      results,
      requestId,
      timestamp: new Date().toISOString(),
      duration
    })

  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('Gemini inference failed:', {
      requestId,
      duration,
      error: error.message,
      stack: error.stack
    })

    return NextResponse.json({
      success: false,
      model_id: 'gemini-3-pro-preview',
      error: {
        type: 'inference_error',
        message: error.message || 'Gemini inference failed',
        retryable: true
      },
      requestId,
      timestamp: new Date().toISOString(),
      duration
    }, { status: 500 })
  }
}
