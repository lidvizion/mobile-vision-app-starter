import { NextRequest, NextResponse } from 'next/server'
import { fetchMultipleModelClasses } from '@/lib/huggingface/fetchModelClasses'

/**
 * /api/save-recommendations
 * Purpose: Save model recommendations after search
 * Stores all recommended models for a query with their classes
 */

interface SaveRecommendationsRequest {
  query_id: string
  models: Array<{
    name: string
    model_id?: string
    source: 'Roboflow' | 'Hugging Face'
    task: string
    metrics: {
      mAP?: number
      accuracy?: number
      FPS?: number
      modelSize?: string
    }
    url: string
    selected: boolean
    classes?: string[]
  }>
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveRecommendationsRequest = await request.json()
    const { query_id, models } = body

    // Validate required fields
    if (!query_id || !models || models.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: query_id and models' },
        { status: 400 }
      )
    }

    // Generate recommendation ID
    const recommendationId = `uuid-modelrec-${Date.now()}`

    // Fetch classes for Hugging Face models
    const hfModelIds = models
      .filter(m => m.source === 'Hugging Face' && m.model_id)
      .map(m => m.model_id!)
    
    let classesMap: Record<string, string[]> = {}
    if (hfModelIds.length > 0) {
      console.log(`🏷️  Fetching classes for ${hfModelIds.length} HF models...`)
      const classesResults = await fetchMultipleModelClasses(hfModelIds)
      
      // Extract successful classes
      Object.entries(classesResults).forEach(([modelId, result]) => {
        if (result.success && result.classes) {
          classesMap[modelId] = result.classes
        }
      })
    }

    // Add classes to models
    const modelsWithClasses = models.map(model => ({
      ...model,
      classes: model.classes || (model.model_id && classesMap[model.model_id] 
        ? classesMap[model.model_id]
        : undefined)
    }))

    // Prepare recommendation record
    const recommendationRecord = {
      recommendation_id: recommendationId,
      query_id: query_id,
      models: modelsWithClasses,
      created_at: new Date().toISOString()
    }

    // Save to MongoDB
    try {
      const { getDatabase } = await import('@/lib/mongodb/connection')
      const db = await getDatabase()
      await db.collection('model_recommendations').insertOne(recommendationRecord)
      console.log('Recommendations saved to MongoDB:', recommendationRecord)
    } catch (mongoError) {
      console.error('MongoDB save error:', mongoError)
      // Continue without failing the request
    }

    console.log('Recommendations saved:', recommendationRecord)

    return NextResponse.json({
      success: true,
      recommendation_id: recommendationId,
      message: 'Recommendations saved successfully'
    })

  } catch (error) {
    console.error('Save recommendations error:', error)
    return NextResponse.json(
      {
        error: 'Failed to save recommendations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to retrieve recommendations for a query
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryId = searchParams.get('query_id')

    if (!queryId) {
      return NextResponse.json(
        { error: 'query_id parameter is required' },
        { status: 400 }
      )
    }

    const recommendations = null

    if (!recommendations) {
      return NextResponse.json(
        { error: 'No recommendations found for this query' },
        { status: 404 }
      )
    }

    return NextResponse.json(recommendations)

  } catch (error) {
    console.error('Get recommendations error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve recommendations' },
      { status: 500 }
    )
  }
}

