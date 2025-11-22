import { NextRequest, NextResponse } from 'next/server'

import { markModelAsWorking, markModelAsFailed } from '@/lib/mongodb/validatedModels'

// Allow longer execution time for inference in serverless environments
export const maxDuration = 30; // 30 seconds for Amplify/Vercel

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
    let extractedModelId = model_id || extractModelIdFromUrl(model_url)

    // Normalize model_id
    if (extractedModelId && !extractedModelId.startsWith('roboflow/')) {
      const urlExtracted = extractModelIdFromUrl(model_url)
      if (urlExtracted && urlExtracted !== 'roboflow/unknown') {
        extractedModelId = urlExtracted
      } else {
        const match = extractedModelId.match(/roboflow[\/-](.+?)(?:-\d+-\d+)?$/)
        if (match) {
          const identifier = match[1]
          if (identifier.includes('/')) {
            const parts = identifier.split('/')
            extractedModelId = `roboflow/${parts[parts.length - 1]}`
          } else {
            const cleaned = identifier.replace(/-\d+-\d+$/, '')
            extractedModelId = `roboflow/${cleaned}`
          }
        } else {
          extractedModelId = extractModelIdFromUrl(model_url)
        }
      }
    }

    const inferredTaskType = inferTaskType(model_url, task_type)

    console.log(`🔍 Running Roboflow inference on: ${model_url}`)
    console.log(`📋 Model ID: ${extractedModelId}, Task Type: ${inferredTaskType}`)

    const startTime = Date.now()

    // --- Node.js Inference Logic (Ported from Python) ---

    // 1. Determine Endpoint and Parse URL
    let apiEndpoint = '';
    let useServerless = false;
    let modelName = 'unknown';
    let version = 'unknown';

    if (model_url.includes('serverless.roboflow.com')) {
      // format: https://serverless.roboflow.com/project-name/version
      const urlClean = model_url.split('?')[0];
      const parts = urlClean.replace('https://serverless.roboflow.com/', '').split('/');
      if (parts.length >= 2) {
        modelName = parts[0];
        version = parts[1];
        apiEndpoint = `https://serverless.roboflow.com/${modelName}/${version}`;
        useServerless = true;
      } else {
        throw new Error('Invalid serverless URL format');
      }
    } else if (model_url.includes('detect.roboflow.com') || model_url.includes('segment.roboflow.com')) {
      // format: https://detect.roboflow.com/project/version or ?model=...
      const baseUrl = model_url.includes('segment') ? 'https://segment.roboflow.com/' : 'https://detect.roboflow.com/';
      if (model_url.includes('?model=')) {
        const modelMatch = model_url.match(/model=([^&]+)/);
        const versionMatch = model_url.match(/version=([^&]+)/);
        if (modelMatch && versionMatch) {
          modelName = modelMatch[1];
          version = versionMatch[1];
        } else {
          throw new Error('Could not extract model name and version from URL');
        }
      } else {
        const parts = model_url.replace(baseUrl, '').split('/');
        if (parts.length >= 2) {
          modelName = parts[0];
          version = parts[1];
        } else {
          throw new Error('Invalid detect URL format');
        }
      }
      apiEndpoint = `${baseUrl}${modelName}/${version}`;
      useServerless = false;
    } else {
      throw new Error('Please provide a serverless.roboflow.com or detect.roboflow.com URL');
    }

    // 2. Prepare Image Data
    let imageBase64 = image;
    if (imageBase64.startsWith('data:')) {
      imageBase64 = imageBase64.split(',')[1];
    }

    // 3. Prepare Query Parameters
    const queryParams = new URLSearchParams({
      api_key: finalApiKey
    });
    if (parameters.confidence) queryParams.append('confidence', parameters.confidence.toString());
    if (parameters.overlap) queryParams.append('overlap', parameters.overlap.toString());
    if (parameters.max_detections) queryParams.append('max_detections', parameters.max_detections.toString());

    // 4. Make API Request
    let response;
    const fullUrl = `${apiEndpoint}?${queryParams.toString()}`;

    if (useServerless) {
      // Serverless endpoint: POST raw base64 string with x-www-form-urlencoded
      response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: imageBase64
      });
    } else {
      // Detect endpoint: POST multipart/form-data
      const formData = new FormData();
      // Convert base64 to Blob
      const binaryString = atob(imageBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      formData.append('file', blob, 'image.jpg');

      response = await fetch(fullUrl, {
        method: 'POST',
        body: formData
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    // 5. Normalize Response (Ported from Python)
    const predictions: any[] = [];

    // Helper to add prediction
    const addPred = (p: any) => {
      predictions.push({
        class: p.class || p.top || 'unknown',
        confidence: p.confidence || p.score || 0.0,
        score: p.confidence || p.score || 0.0,
        ...p // Include other fields
      });
    };

    if (result.top) {
      // Simple classification
      predictions.push({
        class: result.top,
        confidence: result.confidence || 0.0,
        score: result.confidence || 0.0
      });
    } else if (result.predictions) {
      if (Array.isArray(result.predictions)) {
        // Detection or List Classification
        if (result.predictions.length > 0) {
          const first = result.predictions[0];
          // Check if it's classification (no bbox)
          if (!first.x && !first.bbox && (first.top || first.class)) {
            result.predictions.forEach((p: any) => addPred(p));
          } else {
            // Detection / Segmentation
            result.predictions.forEach((pred: any) => {
              if (typeof pred !== 'object') return;

              const centerX = pred.x || 0;
              const centerY = pred.y || 0;
              const width = pred.width || 0;
              const height = pred.height || 0;

              const x = centerX - (width / 2);
              const y = centerY - (height / 2);

              const predData: any = {
                class: pred.class || 'unknown',
                confidence: pred.confidence || 0.0,
                bbox: {
                  x, y, width, height,
                  center_x: centerX,
                  center_y: centerY
                },
                // Keep original fields
                x: centerX, y: centerY, width, height
              };

              if (pred.points) predData.points = pred.points;
              if (pred.mask) predData.mask = pred.mask;
              if (pred.class_id !== undefined) predData.class_id = pred.class_id;
              if (pred.detection_id) predData.detection_id = pred.detection_id;
              if (pred.keypoints) predData.keypoints = pred.keypoints;

              predictions.push(predData);
            });
          }
        }
      } else if (typeof result.predictions === 'object') {
        // Dictionary Classification
        Object.entries(result.predictions).forEach(([className, predData]: [string, any]) => {
          predictions.push({
            class: className,
            confidence: predData.confidence || 0.0,
            score: predData.confidence || 0.0,
            class_id: predData.class_id
          });
        });
        predictions.sort((a, b) => b.confidence - a.confidence);
      }
    } else if (Array.isArray(result)) {
      // List format
      result.forEach((p: any) => addPred(p));
    } else if (result.class) {
      // Fallback
      addPred(result);
    }

    const processingTime = Date.now() - startTime

    const responseData: RoboflowInferenceResponse = {
      success: true,
      results: predictions,
      predictions: predictions,
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
        predictions,
        'hosted'
      )
    } catch (dbError) {
      console.warn('⚠️ Failed to update model status in MongoDB:', dbError)
    }

    console.log(`✅ Roboflow inference completed in ${processingTime}ms`)
    return NextResponse.json(responseData)

  } catch (error: any) {
    console.error('Roboflow inference error:', error)

    // Attempt to mark as failed if we have model ID
    // We need to re-extract model ID here since it might fail before extraction
    try {
      const body = await request.clone().json().catch(() => ({}));
      const { model_url, task_type, model_id } = body;
      if (model_url) {
        const extractedModelId = model_id || extractModelIdFromUrl(model_url);
        const inferredTaskType = inferTaskType(model_url, task_type);
        await markModelAsFailed(
          extractedModelId || 'unknown',
          inferredTaskType,
          error.message || 'Unknown error',
          'unknown'
        );
      }
    } catch (e) {
      // Ignore error during error handling
    }

    return NextResponse.json(
      {
        error: 'Inference failed',
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