import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { markModelAsWorking, markModelAsFailed } from '@/lib/mongodb/validatedModels'

/**
 * /api/roboflow-inference
 * Purpose: Run inference on Roboflow models using Python SDK with serverless API
 * Uses the official Roboflow Python SDK for better authentication and reliability
 */

interface RoboflowInferenceRequest {
  model_url: string
  api_key: string
  image: string // Base64 encoded image
  model_id?: string // Optional model ID (e.g., 'roboflow/model-identifier')
  task_type?: string // Optional task type (e.g., 'Object Detection', 'Instance Segmentation')
  parameters?: {
    confidence?: number
    overlap?: number
    max_detections?: number
  }
}

interface RoboflowInferenceResponse {
  success: boolean
  results: any[]
  predictions?: any[] // Include predictions for keypoint detection models
  model_info: {
    name: string
    url: string
    version: string
  }
  processing_time: number
  timestamp: string
}

/**
 * Extract model identifier from Roboflow URL
 */
function extractModelIdFromUrl(model_url: string): string {
  try {
    // Handle serverless.roboflow.com format: https://serverless.roboflow.com/project-name/version
    if (model_url.includes('serverless.roboflow.com')) {
      const urlClean = model_url.split('?')[0]
      const parts = urlClean.replace('https://serverless.roboflow.com/', '').split('/')
      if (parts.length >= 1) {
        return `roboflow/${parts[0]}`
      }
    }
    
    // Handle detect.roboflow.com format: https://detect.roboflow.com/?model=name&version=X
    if (model_url.includes('detect.roboflow.com')) {
      const modelMatch = model_url.match(/model=([^&]+)/)
      if (modelMatch) {
        return `roboflow/${modelMatch[1]}`
      }
      // Direct format: https://detect.roboflow.com/project-name/version
      const parts = model_url.replace('https://detect.roboflow.com/', '').split('/')
      if (parts.length >= 1 && parts[0] && !parts[0].includes('?')) {
        return `roboflow/${parts[0]}`
      }
    }
    
    // Handle segment.roboflow.com format (same as detect)
    if (model_url.includes('segment.roboflow.com')) {
      const modelMatch = model_url.match(/model=([^&]+)/)
      if (modelMatch) {
        return `roboflow/${modelMatch[1]}`
      }
      const parts = model_url.replace('https://segment.roboflow.com/', '').split('/')
      if (parts.length >= 1 && parts[0] && !parts[0].includes('?')) {
        return `roboflow/${parts[0]}`
      }
    }
    
    // Handle universe.roboflow.com format: https://universe.roboflow.com/workspace/project
    if (model_url.includes('universe.roboflow.com')) {
      const parts = model_url.replace('https://universe.roboflow.com/', '').split('/')
      if (parts.length >= 2) {
        return `roboflow/${parts[1]}`
      }
    }
  } catch (error) {
    console.warn('Failed to extract model ID from URL:', error)
  }
  
  return 'roboflow/unknown'
}

/**
 * Infer task type from model URL or default
 * Normalizes task types to match database format
 */
function inferTaskType(model_url: string, providedTaskType?: string): string {
  if (providedTaskType) {
    // Normalize task type format (e.g., 'object-detection' -> 'Object Detection')
    const normalized = providedTaskType
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
    
    // Handle special cases
    if (normalized.toLowerCase().includes('keypoint') || normalized.toLowerCase().includes('key-point') || normalized.toLowerCase().includes('pose')) {
      return 'Keypoint Detection'
    }
    if (normalized.toLowerCase().includes('segmentation')) {
      return 'Instance Segmentation'
    }
    if (normalized.toLowerCase().includes('detection')) {
      return 'Object Detection'
    }
    
    return normalized
  }
  
  // Infer from URL
  if (model_url.includes('segment.roboflow.com')) {
    return 'Instance Segmentation'
  }
  if (model_url.includes('detect.roboflow.com')) {
    return 'Object Detection'
  }
  // Note: Roboflow may add a dedicated keypoint endpoint in the future
  // For now, keypoint detection models may use detect.roboflow.com
  
  // Default
  return 'Object Detection'
}

export async function POST(request: NextRequest) {
  try {
    const body: RoboflowInferenceRequest = await request.json()
    const { model_url, api_key, image, model_id, task_type, parameters = {} } = body

    console.log('📊 Received inference parameters:', JSON.stringify(parameters, null, 2))

    // Use API key from request, or fallback to server's environment variable
    const finalApiKey = api_key && api_key !== 'server_env_var' 
      ? api_key 
      : (process.env.ROBOFLOW_API_KEY || api_key)

    if (!model_url || !finalApiKey || !image) {
      return NextResponse.json(
        { error: 'model_url, api_key (or ROBOFLOW_API_KEY env var), and image are required' },
        { status: 400 }
      )
    }

    // Extract or use provided model_id
    // Normalize model_id to use roboflow/ prefix format for consistency
    let extractedModelId = model_id || extractModelIdFromUrl(model_url)
    
    // If model_id is provided but doesn't have roboflow/ prefix, normalize it
    if (extractedModelId && !extractedModelId.startsWith('roboflow/')) {
      // Handle different formats:
      // 1. roboflow-tomas-gear-mxzjq/soccer-ball-mfbf2-1762011570126-0 (from search results)
      // 2. roboflow-soccer-ball-mfbf2-1762011570126-0 (from search results)
      // Should become: roboflow/soccer-ball-mfbf2
      
      // Try to extract from URL first (most reliable)
      const urlExtracted = extractModelIdFromUrl(model_url)
      if (urlExtracted && urlExtracted !== 'roboflow/unknown') {
        extractedModelId = urlExtracted
      } else {
        // Fallback: try to parse the provided model_id
        // Match pattern: roboflow-<workspace>/<project>-<timestamp>-<index>
        // or: roboflow-<project>-<timestamp>-<index>
        const match = extractedModelId.match(/roboflow[\/-](.+?)(?:-\d+-\d+)?$/)
        if (match) {
          const identifier = match[1]
          // If it has workspace/project format, extract just project
          if (identifier.includes('/')) {
            const parts = identifier.split('/')
            extractedModelId = `roboflow/${parts[parts.length - 1]}`
          } else {
            // Remove any trailing timestamp/index pattern (numbers separated by dashes)
            const cleaned = identifier.replace(/-\d+-\d+$/, '')
            extractedModelId = `roboflow/${cleaned}`
          }
        } else {
          // Last resort: use URL extraction
          extractedModelId = extractModelIdFromUrl(model_url)
        }
      }
    }
    
    const inferredTaskType = inferTaskType(model_url, task_type)
    
    console.log(`🔍 Running Roboflow inference on: ${model_url}`)
    console.log(`📋 Model ID: ${extractedModelId}, Task Type: ${inferredTaskType}`)

    const startTime = Date.now()

    // Use Python script for inference with proper SDK authentication
    // Pass image data via stdin to avoid E2BIG error (command line argument size limit)
    const pythonScript = path.join(process.cwd(), 'roboflow_inference.py')
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python')
    
    // Pass model_url, api_key, and parameters as arguments, image via stdin
    // Ensure parameters is always a valid JSON string
    const parametersJson = parameters && Object.keys(parameters).length > 0 
      ? JSON.stringify(parameters)
      : '{}'
    
    const pythonProcess = spawn(venvPython, [
      pythonScript,
      model_url,
      finalApiKey,
      parametersJson
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 40000 // 70 second timeout (60s for API + 10s buffer)
    })
    
    let stdout = ''
    let stderr = ''
    let stdinErrorMessage: string | null = null

    // Set up stdout/stderr listeners BEFORE writing to stdin
    // This ensures we capture all output
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    pythonProcess.stdin.on('error', (error: Error) => {
      stdinErrorMessage = error.message
      console.error('Stdin error:', error)
    })
    
    // Wait for stdin to finish writing before waiting for process to close
    await new Promise<void>((resolve, reject) => {
      const writeCallback = (error: Error | null | undefined) => {
        if (error) {
          stdinErrorMessage = error.message
          console.error('Error writing to stdin:', error)
          reject(error)
        } else {
          pythonProcess.stdin.end((endError: Error | null | undefined) => {
            if (endError) {
              stdinErrorMessage = endError.message
              reject(endError)
            } else {
              resolve()
            }
          })
        }
      }
      
      // Check if stdin is writable before writing
      if (pythonProcess.stdin.writable) {
        pythonProcess.stdin.write(image, writeCallback)
      } else {
        reject(new Error('Stdin is not writable'))
      }
    }).catch((error) => {
      // Error already handled above, but log it
      if (error && !stdinErrorMessage) {
        stdinErrorMessage = error.message || 'Unknown stdin error'
      }
    })

    // Wait for process to complete and ensure all output is captured
    const exitCode = await new Promise<number>((resolve) => {
      pythonProcess.on('close', (code) => {
        // Give streams a moment to finish flushing
        setTimeout(() => {
          resolve(code || 0)
        }, 200)
      })
      
      // Also handle error events
      pythonProcess.on('error', (error) => {
        console.error('Python process error:', error)
        stderr += error.message
        resolve(1)
      })
    })

    // Check for stdin errors first
    if (stdinErrorMessage !== null) {
      console.error('Stdin write error:', stdinErrorMessage)
      return NextResponse.json(
        { 
          error: 'Failed to send image data to inference script', 
          details: stdinErrorMessage
        },
        { status: 500 }
      )
    }

    if (exitCode !== 0) {
      console.error('Python script failed:', stderr)
      
      // Mark model as failed in MongoDB (background task)
      try {
        await markModelAsFailed(
          extractedModelId,
          inferredTaskType,
          stderr || 'Python script execution failed',
          'unknown'
        )
      } catch (dbError) {
        console.warn('⚠️ Failed to update model status in MongoDB:', dbError)
      }
      
      return NextResponse.json(
        { 
          error: 'Inference failed', 
          details: stderr || 'Python script execution failed'
        },
        { status: 500 }
      )
    }

    try {
      // Check if stdout is empty
      if (!stdout || stdout.trim().length === 0) {
        console.error('⚠️ Python script produced no stdout output')
        console.error('Python stderr:', stderr || '(empty)')
        console.error('Exit code:', exitCode)
        throw new Error('Python script produced no output. Check stderr for errors.')
      }
      
      // Extract JSON from stdout (handle Roboflow loading messages)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('⚠️ No JSON found in Python output')
        console.error('Python stdout:', stdout.substring(0, 500))
        console.error('Python stderr:', stderr || '(empty)')
        throw new Error('No JSON found in Python output')
      }
      
      const result = JSON.parse(jsonMatch[0])
      
      if (!result.success) {
        // Mark model as failed in MongoDB only for actual API/execution errors
        // Empty/null results are valid (just means no detections found) - don't mark as failed
        const errorMessage = result.error || 'Unknown error'
        
        // Only mark as failed if it's a real error (API failure, timeout, etc.)
        // NOT if it's:
        // - Empty/null results (valid - just means no detections)
        // - Parameter-related issues (shouldn't mark model as failed)
        // - Attribute errors from Python (code issues, not model issues)
        const isRealError = errorMessage && 
          errorMessage !== 'Unknown error' &&
          !errorMessage.toLowerCase().includes('null') && 
          !errorMessage.toLowerCase().includes('empty') &&
          !errorMessage.toLowerCase().includes('no predictions') &&
          !errorMessage.toLowerCase().includes('parameter') &&
          !errorMessage.toLowerCase().includes("'str' object has no attribute") &&
          !errorMessage.toLowerCase().includes("attribute") &&
          (errorMessage.toLowerCase().includes('api request failed') ||
           errorMessage.toLowerCase().includes('timeout') ||
           errorMessage.toLowerCase().includes('status') ||
           errorMessage.toLowerCase().includes('not found') ||
           errorMessage.toLowerCase().includes('invalid url') ||
           errorMessage.toLowerCase().includes('authentication') ||
           errorMessage.toLowerCase().includes('unauthorized'))
        
        if (isRealError) {
          try {
            await markModelAsFailed(
              extractedModelId,
              inferredTaskType,
              errorMessage,
              'unknown'
            )
          } catch (dbError) {
            console.warn('⚠️ Failed to update model status in MongoDB:', dbError)
          }
        } else {
          // Log but don't mark as failed for non-critical errors
          console.warn(`⚠️ Inference returned error but not marking model as failed: ${errorMessage}`)
        }
        
        return NextResponse.json(
          { 
            error: 'Inference failed', 
            details: errorMessage
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
        predictions: result.predictions || [], // Also include predictions for keypoint detection
        model_info: {
          name: modelName,
          url: model_url,
          version: version
        },
        processing_time: processingTime,
        timestamp: new Date().toISOString()
      }

      // Mark model as working in MongoDB (background task)
      try {
        await markModelAsWorking(
          extractedModelId,
          inferredTaskType,
          result.predictions || [],
          'hosted'
        )
        // Note: markModelAsWorking already logs the success message
      } catch (dbError) {
        console.warn('⚠️ Failed to update model status in MongoDB:', dbError)
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