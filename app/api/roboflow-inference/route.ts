import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

/**
 * /api/roboflow-inference
 * Purpose: Run inference on Roboflow models using Python SDK with serverless API
 * Uses the official Roboflow Python SDK for better authentication and reliability
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

    // Use Python script for inference with proper SDK authentication
    const pythonScript = path.join(process.cwd(), 'roboflow_inference.py')
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python')
    
    const pythonProcess = spawn(venvPython, [
      pythonScript,
      model_url,
      api_key,
      image,
      JSON.stringify(parameters)
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000 // 30 second timeout
    })

    let stdout = ''
    let stderr = ''

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    const exitCode = await new Promise<number>((resolve) => {
      pythonProcess.on('close', (code) => {
        resolve(code || 0)
      })
    })

    if (exitCode !== 0) {
      console.error('Python script failed:', stderr)
      return NextResponse.json(
        { 
          error: 'Inference failed', 
          details: stderr || 'Python script execution failed'
        },
        { status: 500 }
      )
    }

    try {
      // Extract JSON from stdout (handle Roboflow loading messages)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in Python output')
      }
      
      const result = JSON.parse(jsonMatch[0])
      
      if (!result.success) {
        return NextResponse.json(
          { 
            error: 'Inference failed', 
            details: result.error || 'Unknown error'
          },
          { status: 500 }
        )
      }

      const processingTime = Date.now() - startTime

      // Extract model info from the URL
      const urlParts = model_url.split('/')
      const modelName = urlParts[urlParts.length - 2] || 'Unknown Model'
      const version = urlParts[urlParts.length - 1] || '1'

      const responseData: RoboflowInferenceResponse = {
        success: true,
        results: result.predictions || [],
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

    } catch (parseError) {
      console.error('Failed to parse Python output:', parseError)
      console.error('Python stdout:', stdout)
      console.error('Python stderr:', stderr)
      
      return NextResponse.json(
        { 
          error: 'Failed to parse inference results', 
          details: 'Invalid JSON from Python script'
        },
        { status: 500 }
      )
    }

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
 *   "model_url": "https://universe.roboflow.com/dataset-uda7h/car-detection-rbao0/model/1",
 *   "api_key": "KJWhVAnYok8rniIdzCbZ", 
 *   "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
 *   "parameters": {
 *     "confidence": 0.5,
 *     "overlap": 0.3,
 *     "max_detections": 100
 *   }
 * }
 * 
 * The API will automatically convert:
 * - universe.roboflow.com URLs → serverless.roboflow.com URLs
 * - detect.roboflow.com URLs → serverless.roboflow.com URLs
 */