import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/save-edited-annotations
 * Purpose: Save edited annotations as version 2 in MongoDB
 * 
 * Schema:
 * {
 *   "_id": ObjectId,
 *   "original_timestamp": "2025-10-10T17:00:00Z",
 *   "original_image_url": "data:image/jpeg;base64,...",
 *   "model_id": "roboflow/YOLOv8-Basketball-Detection",
 *   "task": "detection",
 *   "edited_detections": [
 *     {
 *       "class": "basketball",
 *       "confidence": 0.95,
 *       "bbox": { "x": 100, "y": 200, "width": 50, "height": 50 }
 *     }
 *   ],
 *   "version": 2,
 *   "created_at": "2025-10-10T17:30:00Z"
 * }
 */

interface SaveEditedAnnotationsRequest {
  original_timestamp: string
  original_image_url: string
  model_id: string
  task: string
  edited_detections: Array<{
    class: string
    confidence: number
    bbox: {
      x: number
      y: number
      width: number
      height: number
    }
  }>
  version: number
}

interface SaveEditedAnnotationsResponse {
  success: boolean
  annotation_id: string
  message: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveEditedAnnotationsRequest = await request.json()
    const {
      original_timestamp,
      original_image_url,
      model_id,
      task,
      edited_detections,
      version
    } = body

    // Validate required fields
    if (!original_timestamp || !original_image_url || !model_id || !edited_detections || version !== 2) {
      return NextResponse.json(
        { error: 'original_timestamp, original_image_url, model_id, edited_detections, and version (2) are required' },
        { status: 400 }
      )
    }

    // Generate unique annotation ID
    const annotationId = `annot-v2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Prepare annotation record
    const annotationRecord: any = {
      annotation_id: annotationId,
      original_timestamp: original_timestamp,
      original_image_url: original_image_url,
      model_id: model_id,
      task: task,
      edited_detections: edited_detections,
      version: version,
      created_at: new Date().toISOString()
    }

    // Save to MongoDB
    try {
      const { getDatabase } = await import('@/lib/mongodb/connection')
      const db = await getDatabase()
      
      await db.collection('edited_annotations').insertOne(annotationRecord)
      console.log(`✅ Edited annotation saved to MongoDB:`, annotationId)
    } catch (mongoError) {
      console.error('MongoDB save error:', mongoError)
      return NextResponse.json(
        {
          error: 'Failed to save edited annotation to database',
          details: mongoError instanceof Error ? mongoError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

    const responseData: SaveEditedAnnotationsResponse = {
      success: true,
      annotation_id: annotationId,
      message: 'Edited annotations saved successfully as version 2'
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

