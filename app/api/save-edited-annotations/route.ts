import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * /api/save-edited-annotations
 * Purpose: Save edited annotations to inference_jobs collection as versioned fields
 * 
 * Stores in inference_jobs collection:
 * {
 *   "job_id": "uuid-job-123",
 *   "edited_annotations": { edited_detections: [...], created_at: "...", version: 1 },
 *   "edited_annotations2": { edited_detections: [...], created_at: "...", version: 2 },
 *   "edited_annotations3": { edited_detections: [...], created_at: "...", version: 3 },
 *   ...
 * }
 */

interface SaveEditedAnnotationsRequest {
  job_id?: string  // Optional: if provided, use this to find the inference job
  original_timestamp?: string  // Alternative: use timestamp + model_id + image_url to find job
  original_image_url?: string
  model_id: string
  task: string
  edited_detections?: Array<{
    class: string
    confidence: number
    bbox: {
      x: number
      y: number
      width: number
      height: number
    }
  }>
  edited_labels?: Array<{
    class: string
    score: number
    confidence: 'high' | 'medium' | 'low' | 'very_low'
  }>
  edited_segmentation?: Array<{
    class: string
    area: number
    color: string
    mask?: string | null
    bbox?: {
      x: number
      y: number
      width: number
      height: number
    } | null
    points?: Array<{ x: number; y: number }>
    pixelStrip?: any
  }>
  edited_keypoint_detections?: Array<{
    class: string
    confidence: number
    bbox: {
      x: number
      y: number
      width: number
      height: number
    }
    keypoints: Array<{
      x: number
      y: number
      confidence: number
      class_id?: number
      class?: string
    }>
    class_id?: number
    detection_id?: string
  }>
}

interface SaveEditedAnnotationsResponse {
  success: boolean
  version: number
  message: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveEditedAnnotationsRequest = await request.json()
    const {
      job_id,
      original_timestamp,
      original_image_url,
      model_id,
      task,
      edited_detections,
      edited_labels,
      edited_segmentation,
      edited_keypoint_detections
    } = body

    // Validate required fields - must have at least one annotation type
    if (!model_id) {
      return NextResponse.json(
        { error: 'model_id is required' },
        { status: 400 }
      )
    }

    const hasAnnotations = (edited_detections && edited_detections.length > 0) || 
                           (edited_labels && edited_labels.length > 0) || 
                           (edited_segmentation && edited_segmentation.length > 0) || 
                           (edited_keypoint_detections && edited_keypoint_detections.length > 0)

    if (!hasAnnotations) {
      return NextResponse.json(
        { error: 'At least one annotation type (detections, labels, segmentation, or keypoint_detections) is required' },
        { status: 400 }
      )
    }

    // Must have either job_id or (original_timestamp + original_image_url) to find the inference job 
    if (!job_id && (!original_timestamp || !original_image_url)) {
      return NextResponse.json(
        { error: 'Either job_id or (original_timestamp + original_image_url) is required to find the inference job' },
        { status: 400 }
      )
    }

      const { getDatabase } = await import('@/lib/mongodb/connection')
      const db = await getDatabase()
      
    // Find the inference job
    let query: any = {}
    if (job_id) {
      query.job_id = job_id
    } else {
      // Prioritize timestamp matching (most reliable)
      // Then try model_id + image_url combination
      if (original_timestamp) {
        // First try exact timestamp match
        const timestampConditions = [
          { created_at: original_timestamp },
          { timestamp: original_timestamp }
        ]
        
        // If model_id is provided and not 'unknown', also require it to match
        if (model_id && model_id !== 'unknown') {
          const escapedModelId = model_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          query.$and = [
            { $or: timestampConditions },
            {
              $or: [
                { model_id: model_id },
                { model_id: { $regex: escapedModelId, $options: 'i' } }
              ]
            }
          ]
        } else {
          query.$or = timestampConditions
        }
      } else {
        // No timestamp - fall back to model_id + image_url
        if (model_id && model_id !== 'unknown') {
          query.model_id = model_id
        }
        
        if (original_image_url) {
          const base64Part = original_image_url.includes(',') 
            ? original_image_url.split(',')[1] 
            : original_image_url
          
          if (query.model_id) {
            query.$and = [
              { model_id: query.model_id },
              {
                $or: [
                  { image_url: original_image_url },
                  { image_url: base64Part },
                  { image_url: { $regex: base64Part.substring(0, Math.min(100, base64Part.length)) } }
                ]
              }
            ]
            delete query.model_id
          } else {
            query.$or = [
              { image_url: original_image_url },
              { image_url: base64Part },
              { image_url: { $regex: base64Part.substring(0, Math.min(100, base64Part.length)) } }
            ]
          }
        }
      }
    }

    let inferenceJob = await db.collection('inference_jobs').findOne(query)

    if (!inferenceJob) {
      // Try a more lenient search - prioritize timestamp, then model_id
      let lenientQuery: any = {}
      
      if (original_timestamp) {
        // Try to find jobs created around the same time (within 10 minutes)
        const timestamp = new Date(original_timestamp)
        const tenMinutesAgo = new Date(timestamp.getTime() - 10 * 60 * 1000)
        const tenMinutesLater = new Date(timestamp.getTime() + 10 * 60 * 1000)
        
        lenientQuery.created_at = {
          $gte: tenMinutesAgo.toISOString(),
          $lte: tenMinutesLater.toISOString()
        }
        
        // Optionally also match model_id if provided
        if (model_id && model_id !== 'unknown') {
          lenientQuery.$or = [
            { model_id: model_id },
            { model_id: { $regex: model_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
          ]
        }
      } else if (model_id && model_id !== 'unknown') {
        // No timestamp - just match by model_id and get most recent
        lenientQuery.model_id = model_id
      }
      
      const lenientResult = await db.collection('inference_jobs')
        .find(lenientQuery)
        .sort({ created_at: -1 })
        .limit(1)
        .toArray()
      
      if (lenientResult.length > 0) {
        inferenceJob = lenientResult[0]
      } else {
        return NextResponse.json(
          { 
            error: 'Inference job not found. Please ensure the original inference was saved to the database.',
            details: `Searched with: timestamp=${original_timestamp ? 'provided' : 'missing'}, model_id=${model_id}, image_url=${original_image_url ? 'provided' : 'missing'}. The inference job may not have been saved, or the identifiers do not match.`
          },
          { status: 404 }
        )
      }
    }

    // Determine the next version number
    // Check existing edited_annotations fields: edited_annotations, edited_annotations2, edited_annotations3, etc. 
    let version = 1
    const existingVersions: number[] = []
    
    // Check for edited_annotations (version 1)
    if (inferenceJob.edited_annotations) {
      existingVersions.push(1)
    }
    
    // Check for edited_annotations2, edited_annotations3, etc.
    let checkVersion = 2
    while (inferenceJob[`edited_annotations${checkVersion}`]) {
      existingVersions.push(checkVersion)
      checkVersion++
    }
    
    // Next version is the highest existing version + 1, or 1 if none exist
    version = existingVersions.length > 0 ? Math.max(...existingVersions) + 1 : 1

    // Prepare the edited annotation record
    const editedAnnotationRecord: any = {
      task: task,
      created_at: new Date().toISOString(),
      version: version
    }

    // Include only the annotation types that were provided
    if (edited_detections && edited_detections.length > 0) {
      editedAnnotationRecord.edited_detections = edited_detections
    }
    if (edited_labels && edited_labels.length > 0) {
      editedAnnotationRecord.edited_labels = edited_labels
    }
    if (edited_segmentation && edited_segmentation.length > 0) {
      editedAnnotationRecord.edited_segmentation = edited_segmentation
    }
    if (edited_keypoint_detections && edited_keypoint_detections.length > 0) {
      editedAnnotationRecord.edited_keypoint_detections = edited_keypoint_detections
    }

    // Determine the field name
    const fieldName = version === 1 ? 'edited_annotations' : `edited_annotations${version}`

    // Update the inference job with the new edited annotations version
    const updateResult = await db.collection('inference_jobs').updateOne(
      { _id: inferenceJob._id },
      {
        $set: {
          [fieldName]: editedAnnotationRecord
        }
      }
    )

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to update inference job' },
        { status: 500 }
      )
    }

    const responseData: SaveEditedAnnotationsResponse = {
      success: true,
      version: version,
      message: `Edited annotations saved successfully as version ${version}`
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('❌ Save edited annotation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to save edited annotation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

