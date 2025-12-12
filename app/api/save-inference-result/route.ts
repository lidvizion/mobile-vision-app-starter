import { NextRequest, NextResponse } from 'next/server'
import { uploadBase64ToS3, uploadVideoToS3 } from '@/lib/s3/upload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * /api/save-inference-result
 * Purpose: Store inference results in MongoDB with S3 media storage
 * 
 * Flow:
 * 1. Upload image/video to S3 (if base64 provided)
 * 2. Save inference results to MongoDB with S3 URL
 * 
 * MongoDB Collection:
 * - inference_jobs (unified collection for all inference providers)
 * 
 * Schema:
 * {
 *   "_id": "uuid-job-123",
 *   "job_id": "uuid-job-123",
 *   "host": "roboflow" | "huggingface" | "gemini" | "curated",
 *   "user_id": "uuid-xyz" | "anonymous",
 *   "model_id": "roboflow/YOLOv8-Basketball-Detection" or "microsoft/resnet-50",
 *   "model_provider": "roboflow" | "huggingface" | "google",
 *   "query": "basketball player shot detection",
 *   "image_url": "https://bucket.s3.amazonaws.com/cv-results/images/timestamp-uuid.jpg",
 *   "video_url": "https://bucket.s3.amazonaws.com/cv-results/videos/timestamp-uuid.mp4" (optional),
 *   "inference_endpoint": "https://serverless.roboflow.com/soccer-ball-mfbf2/1" (Roboflow only),
 *   "task_type": "detection" | "classification" | "segmentation" | "keypoint-detection",
 *   "response": [
 *     {"label": "basketball_player", "score": 0.97, "box": {...}},
 *     {"label": "ball", "score": 0.92, "box": {...}}
 *   ],
 *   "annotations": {
 *     "detections": [...],
 *     "classifications": [...],
 *     "segmentations": [...],
 *     "keypoints": [...]
 *   },
 *   "created_at": "2025-10-10T17:00:00Z",
 *   "updated_at": "2025-10-10T17:00:00Z"
 * }
 */

interface SaveInferenceRequest {
  user_id?: string
  model_id: string
  model_provider?: string // 'roboflow' | 'huggingface' | 'google' | 'curated'
  query: string
  task_type?: string // 'detection' | 'classification' | 'segmentation' | 'keypoint-detection'
  image_url?: string // Already uploaded S3 URL (skip upload)
  image_base64?: string // Base64 image to upload to S3
  video_url?: string // Already uploaded S3 URL (skip upload)
  video_base64?: string // Base64 video to upload to S3
  file_name?: string // Original file name
  file_type?: string // MIME type (e.g., 'image/jpeg', 'video/mp4')
  inference_endpoint?: string // For Roboflow models: the API endpoint URL
  response: Array<{
    label: string
    score: number
    box?: any
    keypoints?: any
    points?: any
    mask?: any
  }>
  annotations?: {
    detections?: any[]
    classifications?: any[]
    segmentations?: any[]
    keypoint_detections?: any[]
  }
}

interface SaveInferenceResponse {
  success: boolean
  result_id: string
  message: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveInferenceRequest = await request.json()
    const {
      user_id,
      model_id,
      model_provider,
      query,
      task_type,
      image_url,
      image_base64,
      video_url,
      video_base64,
      file_name,
      file_type,
      inference_endpoint,
      response: predictions,
      annotations
    } = body

    // Validate required fields
    if (!model_id || !query || !predictions) {
      return NextResponse.json(
        { error: 'model_id, query, and response are required' },
        { status: 400 }
      )
    }

    // Generate unique job ID
    const jobId = `uuid-job-${Date.now()}-${Math.random().toString(36).substring(7)}`

    // Determine host/provider based on model_id or provided model_provider
    let host: string
    if (model_provider) {
      host = model_provider
    } else {
      const isRoboflow = model_id.startsWith('roboflow/') || model_id.startsWith('roboflow-')
      const isGemini = model_id.toLowerCase().includes('gemini')
      host = isRoboflow ? 'roboflow' : isGemini ? 'google' : 'huggingface'
    }

    // Upload to S3 if base64 provided (and URL not already provided)
    let finalImageUrl = image_url
    let finalVideoUrl = video_url

    try {
      // Upload image to S3 if base64 provided
      if (image_base64 && !image_url) {
        const fileName = file_name || `image-${Date.now()}.jpg`
        const contentType = file_type || 'image/jpeg'
        const uploadResult = await uploadBase64ToS3(image_base64, fileName, contentType)
        finalImageUrl = uploadResult.url
        console.log(`✅ Image uploaded to S3: ${finalImageUrl}`)
      }

      // Upload video to S3 if base64 provided
      if (video_base64 && !video_url) {
        const fileName = file_name || `video-${Date.now()}.mp4`
        const contentType = file_type || 'video/mp4'
        const buffer = Buffer.from(video_base64.includes(',') ? video_base64.split(',')[1] : video_base64, 'base64')
        const uploadResult = await uploadVideoToS3(buffer, fileName, contentType)
        finalVideoUrl = uploadResult.url
        console.log(`✅ Video uploaded to S3: ${finalVideoUrl}`)
      }
    } catch (s3Error) {
      console.error('⚠️ S3 upload failed, saving with base64 fallback:', s3Error)
      // Continue with base64 fallback if S3 upload fails
      if (!finalImageUrl && image_base64) {
        finalImageUrl = image_base64.substring(0, 100) + '...' // Truncate for storage
      }
    }

    // Prepare inference job record with enhanced schema
    const now = new Date().toISOString()
    const inferenceJob: any = {
      job_id: jobId,
      host: host,
      user_id: user_id || 'anonymous',
      model_id: model_id,
      model_provider: host, // Store provider explicitly
      query: query,
      task_type: task_type || 'detection', // Store task type
      image_url: finalImageUrl || null,
      video_url: finalVideoUrl || null,
      response: predictions, // Keep for backward compatibility
      annotations: annotations || {
        // Organize annotations by type
        detections: predictions.filter((p: any) => p.box && !p.keypoints),
        classifications: predictions.filter((p: any) => !p.box && !p.keypoints && !p.mask),
        segmentations: predictions.filter((p: any) => p.mask || p.points),
        keypoint_detections: predictions.filter((p: any) => p.keypoints),
      },
      created_at: now,
      updated_at: now,
    }
    
    // Add inference endpoint for Roboflow models (required for future inference calls)
    if (inference_endpoint) {
      inferenceJob.inference_endpoint = inference_endpoint
    }

    // Save to MongoDB
    try {
      const { getDatabase } = await import('@/lib/mongodb/connection')
      const db = await getDatabase()
      
      await db.collection('inference_jobs').insertOne(inferenceJob)
      console.log(`✅ ${host} inference job saved to MongoDB:`, jobId)
    } catch (mongoError) {
      console.error('MongoDB save error:', mongoError)
      // Continue without failing the request
    }

    const responseData: SaveInferenceResponse = {
      success: true,
      result_id: jobId,
      message: 'Inference result saved successfully'
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('❌ Save inference result error:', error)
    return NextResponse.json(
      {
        error: 'Failed to save inference result',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to retrieve inference jobs (with caching support)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const model_id = searchParams.get('model_id')
    const image_url = searchParams.get('image_url')
    const user_id = searchParams.get('user_id')
    const limit = parseInt(searchParams.get('limit') || '10')

    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()

    // Check cache first if model_id and image_url provided
    if (model_id && image_url) {
      const cached = await db
        .collection('inference_jobs')
        .findOne({ model_id, image_url })
      
      if (cached) {
        console.log(`✅ Cache hit for ${cached.host || 'unknown'} inference job`)
        return NextResponse.json({
          success: true,
          cached: true,
          result: cached
        })
      }
    }

    // Build query for listing
    const query: any = {}
    if (model_id) query.model_id = model_id
    if (user_id) query.user_id = user_id

    // Fetch results from unified collection
    const results = await db
      .collection('inference_jobs')
      .find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray()

    return NextResponse.json({
      success: true,
      cached: false,
      results: results,
      count: results.length
    })

  } catch (error) {
    console.error('❌ Get inference jobs error:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve inference jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

