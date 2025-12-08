import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { markModelAsWorking, markModelAsFailed } from '@/lib/mongodb/validatedModels'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * /api/run-inference
 * Purpose: Run inference on a Hugging Face model
 * 
 * Endpoint: POST https://router.huggingface.co/hf-inference/models/<model_id>
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

interface ModelError {
  type: 'api_unavailable' | 'input_format' | 'loading_state' | 'unknown'
  message: string
  statusCode?: number
  retryable: boolean
  guidance: string
  hfLink: string
}

interface InferenceResult {
  success: boolean
  model_id: string
  results?: any
  error?: ModelError
  requestId: string
  timestamp: string
  duration: number
  retryCount?: number
}

/**
 * Classify error type and provide appropriate guidance
 */
function classifyError(statusCode: number, errorText: string, model_id: string): ModelError {
  const hfLink = `https://huggingface.co/${model_id}`
  
  if (statusCode === 404) {
    return {
      type: 'api_unavailable',
      message: 'Model not available via API',
      statusCode,
      retryable: false,
      guidance: 'This model is not available through the Hugging Face Inference API. You can view and download it directly from Hugging Face.',
      hfLink
    }
  }
  
  if (statusCode === 503) {
    return {
      type: 'loading_state',
      message: 'Model is loading or crashed',
      statusCode,
      retryable: true,
      guidance: 'The model is currently loading or has crashed. This usually resolves itself. You can also view the model on Hugging Face to check its status.',
      hfLink
    }
  }
  
  if (statusCode === 400 && errorText.includes('input')) {
    return {
      type: 'input_format',
      message: 'Input format error',
      statusCode,
      retryable: true,
      guidance: 'The input format is not compatible with this model. We\'ll try alternative formats automatically.',
      hfLink
    }
  }
  
  return {
    type: 'unknown',
    message: errorText || 'Unknown error occurred',
    statusCode,
    retryable: false,
    guidance: 'An unexpected error occurred. You can view the model on Hugging Face for more information.',
    hfLink
  }
}

/**
 * Detect model type based on model ID and common patterns
 */
function detectModelType(model_id: string): string {
  const id = model_id.toLowerCase()
  
  // Image Classification models
  if (id.includes('resnet') || id.includes('vit') || id.includes('efficientnet') || 
      id.includes('mobilenet') || id.includes('densenet') || id.includes('swin')) {
    return 'image-classification'
  }
  
  // Object Detection models
  if (id.includes('detr') || id.includes('yolo') || id.includes('rcnn') || 
      id.includes('retinanet') || id.includes('detection')) {
    return 'object-detection'
  }
  
  // Segmentation models
  if (id.includes('segmentation') || id.includes('mask') || id.includes('deeplab') ||
      id.includes('unet') || id.includes('fpn')) {
    return 'image-segmentation'
  }
  
  // Text models
  if (id.includes('bert') || id.includes('gpt') || id.includes('t5') || 
      id.includes('roberta') || id.includes('distilbert') || id.includes('electra')) {
    return 'text-model'
  }
  
  // CLIP models (vision-language)
  if (id.includes('clip')) {
    return 'vision-language'
  }
  
  // Default to image classification for unknown models
  return 'image-classification'
}

/**
 * Generate appropriate input formats based on model type
 */
function generateInputFormats(originalInput: string, modelType: string): Array<{input: any, contentType: string}> {
  const formats: Array<{input: any, contentType: string}> = []
  
  // Extract base64 data if it's a data URL
  const base64Data = originalInput.startsWith('data:') ? originalInput.split(',')[1] : originalInput
  
  switch (modelType) {
    case 'image-classification':
    case 'object-detection':
    case 'image-segmentation':
    case 'vision-language':
      formats.push(
        // Format 1: Full data URL (most common)
        { input: originalInput, contentType: 'application/json' },
        
        // Format 2: Base64 without prefix
        { input: base64Data, contentType: 'application/json' },
        
        // Format 3: Test with a known working image URL
        { input: 'https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/tasks/car.jpg', contentType: 'application/json' },
        
        // Format 4: Raw binary data
        { input: Buffer.from(base64Data, 'base64'), contentType: 'application/octet-stream' },
        
        // Format 5: Simple base64 string
        { input: base64Data, contentType: 'text/plain' }
      )
      break
      
    case 'text-model':
      formats.push(
        // Format 1: Direct text input
        { input: originalInput, contentType: 'application/json' },
        
        // Format 2: Wrapped in object
        { input: { inputs: originalInput }, contentType: 'application/json' },
        
        // Format 3: Text content type
        { input: originalInput, contentType: 'text/plain' }
      )
      break
      
    default:
      // Fallback formats
      formats.push(
        { input: originalInput, contentType: 'application/json' },
        { input: base64Data, contentType: 'application/json' },
        { input: Buffer.from(base64Data, 'base64'), contentType: 'application/octet-stream' }
      )
  }
  
  return formats
}

/**
 * Try different input formats for the same model based on model type
 */
async function tryAlternativeInputFormats(
  model_id: string, 
  originalInput: string, 
  parameters: any, 
  apiKey: string,
  maxRetries: number = 5
): Promise<InferenceResult> {
  
  // Detect model type and create appropriate input formats
  const modelType = detectModelType(model_id)
  const inputFormats = generateInputFormats(originalInput, modelType)
  
  console.log(`🔍 Detected model type: ${modelType} for ${model_id}`)
  console.log(`🔄 Will try ${inputFormats.length} different input formats`)
  
  for (let i = 0; i < Math.min(inputFormats.length, maxRetries); i++) {
    const format = inputFormats[i]
    
    try {
      console.log(`🔄 Retry ${i + 1}: Trying ${format.contentType} format for ${model_id}`)
      
      // Prepare request body and parameters based on content type and model type
      let requestBody: BodyInit
      let contentType = format.contentType
      let modelParameters = parameters
      
      // Adjust parameters based on model type
      if (modelType === 'image-classification' && !modelParameters) {
        modelParameters = { top_k: 5 }
      } else if (modelType === 'object-detection' && !modelParameters) {
        modelParameters = { threshold: 0.5 }
      } else if (modelType === 'text-model' && !modelParameters) {
        modelParameters = { max_length: 100 }
      }
      
      if (format.contentType === 'application/json') {
        requestBody = JSON.stringify({
          inputs: format.input,
          ...(modelParameters && { parameters: modelParameters })
        })
      } else if (format.contentType === 'application/octet-stream') {
        requestBody = format.input
        contentType = 'application/octet-stream'
      } else {
        requestBody = format.input
      }
      
      const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model_id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': contentType
        },
        body: requestBody,
        signal: AbortSignal.timeout(15000)
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log(`✅ Retry ${i + 1} succeeded for ${model_id}`)
        
        // Mark model as working in MongoDB
        try {
          await markModelAsWorking(
            model_id,
            detectModelType(model_id),
            result,
            'hosted'
          )
        } catch (dbError) {
          console.warn(`Failed to update MongoDB for ${model_id}:`, dbError)
        }
        
        return {
          success: true,
          model_id,
          results: result,
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          duration: Date.now(),
          retryCount: i + 1
        }
      }
      
      // If still failing, log the error but continue to next format
      const errorText = await response.text()
      console.log(`❌ Retry ${i + 1} failed for ${model_id}: ${response.status} - ${errorText}`)
      
    } catch (error) {
      console.log(`❌ Retry ${i + 1} error for ${model_id}:`, error)
    }
  }
  
  // All retries failed
  const error = classifyError(400, 'All input formats failed', model_id)
  
  // Mark model as failed in MongoDB
  try {
    await markModelAsFailed(
      model_id,
      detectModelType(model_id),
      'All input formats failed',
      'input_format'
    )
  } catch (dbError) {
    console.warn(`Failed to update MongoDB for ${model_id}:`, dbError)
  }
  
  return {
    success: false,
    model_id,
    error,
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    duration: Date.now(),
    retryCount: maxRetries
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  let model_id: string = ''
  
  try {
    const body: RunInferenceRequest = await request.json()
    const { model_id: modelId, inputs, parameters } = body
    model_id = modelId

    // PRIORITY 1: Check for Gemini models FIRST (before any other logic)
    if (model_id === 'gemini-3-pro-preview' || model_id.toLowerCase().includes('gemini')) {
      // Validate inputs for Gemini
      if (!inputs) {
        return NextResponse.json(
          { 
            error: 'inputs are required',
            requestId,
            timestamp: new Date().toISOString()
          },
          { status: 400 }
        )
      }

      // Always forward to /api/gemini-inference which handles Lambda/local routing
      console.log('🔄 Forwarding Gemini request to /api/gemini-inference', {
        model_id,
        hasInputs: !!inputs,
        task: parameters?.task
      })

      const geminiResponse = await fetch(`${request.nextUrl.origin}/api/gemini-inference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id,
          inputs,
          parameters
        })
      })

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text()
        throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`)
      }

      const geminiResult = await geminiResponse.json()
      const duration = Date.now() - startTime

      return NextResponse.json({
        success: true,
        results: geminiResult.results || geminiResult,
        model_id,
        timestamp: new Date().toISOString(),
        duration,
        requestId
      })
    }

    // Validation for non-Gemini models
    if (!model_id || !inputs) {
      return NextResponse.json(
        { 
          error: 'model_id and inputs are required',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      )
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'Hugging Face API key not configured',
          message: 'Add HUGGINGFACE_API_KEY to .env.local',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }

    console.log('🔮 Running inference with new InferenceClient', {
      requestId,
      modelId: model_id,
      timestamp: new Date().toISOString(),
      inputType: inputs.startsWith('data:') ? 'base64' : 'url',
      inputLength: inputs.length,
      inputPreview: inputs.substring(0, 50) + '...'
    })

    // Initialize OpenAI client with Hugging Face router endpoint
    const client = new OpenAI({
      baseURL: "https://router.huggingface.co/v1",
      apiKey: apiKey,
    })
    
    console.log('📤 Using OpenAI-compatible endpoint with Hugging Face router:', {
      inputFormat: inputs.startsWith('data:') ? 'data URL (base64)' : 'HTTP URL',
      hasParameters: Object.keys(parameters || {}).length > 0,
      baseURL: "https://router.huggingface.co/v1",
      provider: 'auto' // Let Hugging Face choose the best provider
    })
    
    // For computer vision tasks, we need to use the direct inference endpoint
    // since the OpenAI-compatible endpoint is for chat completions only
    const inferenceEndpoint = `https://router.huggingface.co/hf-inference/models/${model_id}`
    
    // Prepare the request payload
    const payload = {
      inputs: inputs,
      parameters: parameters || {}
    }
    
    console.log('🚀 Calling Hugging Face inference endpoint directly:', {
      endpoint: inferenceEndpoint,
      modelId: model_id,
      parameters: JSON.stringify(parameters || {}, null, 2)
    })
    
    const response = await fetch(inferenceEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000) // 30 seconds
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Inference failed: ${response.status} ${response.statusText} - ${errorText}`)
    }
    
    const results = await response.json()

    const duration = Date.now() - startTime
    
    console.log('✅ Inference successful with new InferenceClient', {
      requestId,
      modelId: model_id,
      duration,
      resultCount: Array.isArray(results) ? results.length : 'not array'
    })

    // Mark model as working in MongoDB (background task)
    try {
      await markModelAsWorking(
        model_id,
        detectModelType(model_id),
        results,
        'hosted'
      )
    } catch (dbError) {
      console.warn('⚠️ Failed to update model status in MongoDB:', dbError)
    }

    return NextResponse.json({
      success: true,
      model_id,
      results,
      requestId,
      timestamp: new Date().toISOString(),
      duration
    })

  } catch (error: any) {
    const duration = Date.now() - startTime
    
    console.error('❌ Inference failed with new InferenceClient', {
      requestId,
      modelId: model_id,
      duration,
      error: error.message,
      errorType: error.name
    })

    // Mark model as failed in MongoDB (background task)
    try {
      await markModelAsFailed(
        model_id,
        detectModelType(model_id),
        error.message,
        'unknown'
      )
      console.log(`❌ Auto-marked ${model_id} as failed in MongoDB`)
    } catch (dbError) {
      console.warn('⚠️ Failed to update model status in MongoDB:', dbError)
    }

    // Create a user-friendly error response
    const modelError: ModelError = {
      type: 'unknown',
      message: error.message || 'Inference failed',
      retryable: true,
      guidance: 'Try again later or check if the model is available',
      hfLink: `https://huggingface.co/${model_id}`
    }

    return NextResponse.json({
      success: false,
      model_id,
      error: modelError,
      requestId,
      timestamp: new Date().toISOString(),
      duration
    }, { status: 500 })
  }
}

