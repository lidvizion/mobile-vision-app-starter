import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generatePrompt } from '@/lib/geminiUtils'

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Map our model IDs to actual Google AI Gemini model names
 * Some models may be experimental or have different naming conventions
 */
function mapModelIdToGeminiModel(modelId: string): string {
  const modelIdLower = modelId.toLowerCase()
  
  // Map our model IDs to actual Gemini API model names
  if (modelIdLower.includes('2.0-flash-exp') || modelIdLower === 'gemini-2.0-flash-exp') {
    return 'gemini-2.0-flash-exp' // Experimental model
  }
  if (modelIdLower.includes('2.5-flash-lite') || modelIdLower === 'gemini-2.5-flash-lite') {
    return 'gemini-2.5-flash-lite'
  }
  if (modelIdLower.includes('2.5-flash') && !modelIdLower.includes('lite')) {
    return 'gemini-2.5-flash'
  }
  if (modelIdLower.includes('2.5-pro')) {
    return 'gemini-2.5-pro'
  }
  if (modelIdLower.includes('3-pro') || modelIdLower.includes('gemini-3-pro')) {
    // Gemini 3 Pro might not exist yet, fallback to 2.5-pro
    // When it becomes available, change this to 'gemini-3-pro'
    return 'gemini-2.5-pro' // Fallback until gemini-3-pro is available
  }
  
  // Default fallback
  return modelId || 'gemini-2.5-flash'
}

interface GeminiInferenceRequest {
  model_id: string
  inputs: string
  parameters?: {
    prompt?: string
    task?: string
    model?: string
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = `gemini_${Date.now()}_${Math.random().toString(36).substring(7)}`
  let model_id: string = 'unknown'

  console.log('🚀 /api/gemini-inference called', { requestId, timestamp: new Date().toISOString() })

  try {
    const body: GeminiInferenceRequest = await request.json()
    const { model_id: bodyModelId, inputs, parameters } = body
    model_id = bodyModelId

    console.log('📥 Request body received', {
      model_id: bodyModelId,
      hasInputs: !!inputs,
      inputLength: inputs?.length,
      task: parameters?.task,
      hasCustomPrompt: !!parameters?.prompt
    })

    // Check if Lambda endpoint is configured
    const lambdaEndpoint = process.env.GEMINI_LAMBDA_ENDPOINT
    console.log('🔍 DEBUG - GEMINI_LAMBDA_ENDPOINT:', lambdaEndpoint ? 'CONFIGURED' : 'NOT CONFIGURED')
    
    if (lambdaEndpoint) {
      console.log('✅ Using Lambda endpoint:', lambdaEndpoint)
      
      // Generate prompt based on task
      const task = parameters?.task || 'object-detection'
      const prompt = generatePrompt(task, parameters?.prompt)
      // Map model ID to actual Gemini API model name
      const modelToUse = parameters?.model 
        ? mapModelIdToGeminiModel(parameters.model)
        : mapModelIdToGeminiModel(bodyModelId)
      
      console.log('📤 Sending to Lambda', {
        task,
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 100) + '...',
        model: modelToUse,
        hasImage: !!inputs
      })
      
      // Forward to Lambda function
      const lambdaResponse = await fetch(lambdaEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: inputs,
          prompt: prompt,
          model: modelToUse,
          task: task
        })
      })
      
      console.log('📥 Lambda response status:', lambdaResponse.status, lambdaResponse.statusText)

      if (!lambdaResponse.ok) {
        const errorText = await lambdaResponse.text()
        throw new Error(`Lambda API error: ${lambdaResponse.status} - ${errorText}`)
      }

      const lambdaResult = await lambdaResponse.json()
      const duration = Date.now() - startTime

      return NextResponse.json({
        success: true,
        model_id: model_id, // Return the original model_id
        results: lambdaResult.data?.detections || lambdaResult.data || lambdaResult.results || [],
        requestId,
        timestamp: new Date().toISOString(),
        duration,
        source: 'lambda'
      })
    }

    // Fallback to local Gemini API if Lambda endpoint not configured
    console.log('⚠️ Lambda endpoint not configured, using local Gemini API')

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

    const genAI = new GoogleGenerativeAI(apiKey)
    // Map model ID to actual Gemini API model name
    const modelToUse = parameters?.model 
      ? mapModelIdToGeminiModel(parameters.model)
      : mapModelIdToGeminiModel(model_id)
    const model = genAI.getGenerativeModel({ model: modelToUse })

    let imageData: string
    let mimeType: string = 'image/jpeg'

    if (inputs.startsWith('data:')) {
      const matches = inputs.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        mimeType = matches[1]
        imageData = matches[2]
      } else {
        throw new Error('Invalid base64 image format')
      }
    } else {
      const response = await fetch(inputs)
      const buffer = await response.arrayBuffer()
      imageData = Buffer.from(buffer).toString('base64')
      mimeType = response.headers.get('content-type') || 'image/jpeg'
    }

    const task = parameters?.task || 'object-detection'
    const prompt = generatePrompt(task, parameters?.prompt)

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

    let results: any[]
    try {
      let cleanText = text.trim()
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      results = JSON.parse(cleanText)
      
      if (!Array.isArray(results)) {
        results = [results]
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', parseError)
      results = [{
        label: 'analysis',
        description: text,
        score: 1.0
      }]
    }

    const CONFIDENCE_THRESHOLD = 0.3
    results = results.filter((result: any) => {
      const score = result.score || result.confidence || 0
      return score >= CONFIDENCE_THRESHOLD
    })

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      model_id: model_id, // Return the original model_id
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
      model_id: model_id || 'unknown',
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
