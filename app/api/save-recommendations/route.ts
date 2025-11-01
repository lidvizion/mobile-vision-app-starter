import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * /api/save-recommendations
 * Purpose: Save model recommendations to MongoDB for analytics
 * Methods: POST
 */

interface SaveRecommendationsRequest {
  query_id: string
  query_text: string
  keywords: string[]
  task_type?: string
  models: Array<{
    name: string
    model_id: string
    source: 'Roboflow' | 'Hugging Face'
    task: string
    url: string
    selected: boolean
    classes?: string[]
    downloads?: number
    likes?: number
    tags?: string[]
    supportsInference?: boolean
    inferenceStatus?: string
    isKnownWorking?: boolean
  }>
}

interface SaveRecommendationsResponse {
  status: 'success' | 'error'
  recommendation_id?: string
  message?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveRecommendationsRequest = await request.json()
    const { query_id, query_text, keywords, task_type, models } = body

    // Validate required fields
    if (!query_id || !query_text || !keywords || !models) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Missing required fields: query_id, query_text, keywords, models'
        },
        { status: 400 }
      )
    }

    // Generate unique recommendation ID
    const recommendationId = `uuid-modelrec-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`

    // Prepare recommendation record
    const recommendationRecord = {
      recommendation_id: recommendationId,
      query_id,
      query_text,
      keywords,
      task_type: task_type || 'detection',
      models,
      created_at: new Date().toISOString()
    }

    // Save to MongoDB
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()

    // Deduplicate models by name before saving
    const uniqueModelsMap = new Map<string, typeof models[0]>()
    models.forEach(model => {
      const key = model.name || model.model_id
      if (key && !uniqueModelsMap.has(key)) {
        uniqueModelsMap.set(key, model)
      }
    })
    const deduplicatedModels = Array.from(uniqueModelsMap.values())

    // Check if recommendation already exists for this query_id
    const existingRecommendation = await db.collection('model_recommendations').findOne({
      query_id: query_id
    })

    if (existingRecommendation) {
      // Update existing recommendation, merging unique models
      const existingModelNames = new Set(existingRecommendation.models?.map((m: any) => m.name || m.model_id) || [])
      const newModels = deduplicatedModels.filter(m => {
        const key = m.name || m.model_id
        return key && !existingModelNames.has(key)
      })

      if (newModels.length > 0) {
        await db.collection('model_recommendations').updateOne(
          { query_id: query_id },
          { 
            $set: {
              models: [...(existingRecommendation.models || []), ...newModels],
              updated_at: new Date().toISOString()
            }
          }
        )
        console.log(`✅ Updated recommendations: added ${newModels.length} new models`)
      } else {
        console.log(`ℹ️  No new models to add to existing recommendations`)
      }
    } else {
      // Create new recommendation record with deduplicated models
      const recommendationRecord = {
        recommendation_id: recommendationId,
        query_id,
        query_text,
        keywords,
        task_type: task_type || 'detection',
        models: deduplicatedModels,
        created_at: new Date().toISOString()
      }
      
      await db.collection('model_recommendations').insertOne(recommendationRecord)
      console.log(`✅ Saved ${deduplicatedModels.length} unique model recommendations to MongoDB`)
    }

    console.log('✅ Model recommendations saved:', {
      recommendation_id: recommendationId,
      query_id,
      models_count: deduplicatedModels.length,
      original_count: models.length
    })

    // Build response
    const response: SaveRecommendationsResponse = {
      status: 'success',
      recommendation_id: recommendationId,
      message: 'Model recommendations saved successfully'
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ Save recommendations error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to save model recommendations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Retrieve model recommendations by query_id
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryId = searchParams.get('query_id')

    if (!queryId) {
      return NextResponse.json(
        { status: 'error', message: 'query_id is required' },
        { status: 400 }
      )
    }

    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()

    const recommendations = await db
      .collection('model_recommendations')
      .find({ query_id: queryId })
      .sort({ created_at: -1 })
      .limit(10)
      .toArray()

    return NextResponse.json({
      status: 'success',
      count: recommendations.length,
      recommendations
    })
  } catch (error) {
    console.error('❌ Get recommendations error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to retrieve recommendations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
