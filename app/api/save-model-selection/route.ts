import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * /api/save-model-selection
 * Purpose: Save selected model + user query to MongoDB for analytics
 * Methods: POST (save), GET (fetch)
 */

// -------------------------
// Interfaces
// -------------------------
interface SaveModelRequest {
  user_id?: string
  query_id: string
  model: {
    name: string
    source: string
    url: string
    task?: string
    description?: string
    classes?: string[] // Add classes field
  }
  session_id?: string
}

interface SaveModelResponse {
  status: 'success' | 'error'
  selection_id?: string
  redirect?: string
  message?: string
}

// -------------------------
// POST — Save model selection
// -------------------------
export async function POST(request: NextRequest) {
  try {
    const body: SaveModelRequest = await request.json()
    const { user_id, query_id, model, session_id } = body

    // Validate required fields
    if (!query_id || !model?.name || !model?.source) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Missing required fields: query_id, model.name, model.source'
        },
        { status: 400 }
      )
    }

    // Generate unique selection ID
    const selectionId = `uuid-select-${crypto.randomUUID()}`

    // Prepare record
    const selectionRecord = {
      selection_id: selectionId,
      user_id: user_id || 'anonymous',
      query_id,
      model_name: model.name,
      source: model.source as 'Roboflow' | 'Hugging Face',
      classes: model.classes || null, // Add classes field
      selected_at: new Date().toISOString(),
      session_id: session_id || null
    }

    // Save to MongoDB
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()

    // Insert selection record
    await db.collection('user_model_selection').insertOne(selectionRecord)

    // Optionally mark selected model in recommendations
    await db.collection('model_recommendations').updateOne(
      { query_id, 'models.name': model.name },
      { $set: { 'models.$.selected': true } }
    )

    console.log('✅ Model selection saved:', selectionRecord)

    // Generate redirect slug
    const modelSlug = model.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Build response
    const response: SaveModelResponse = {
      status: 'success',
      selection_id: selectionId,
      redirect: `/setup?model=${modelSlug}`,
      message: 'Model selection saved successfully'
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ Save model selection error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to save model selection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// -------------------------
// GET — Retrieve user selections 
// -------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const queryId = searchParams.get('query_id')

    if (!userId && !queryId) {
      return NextResponse.json(
        { status: 'error', message: 'Either user_id or query_id is required' },
        { status: 400 }
      )
    }

    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()

    const query: Record<string, string> = {}
    if (userId) query.user_id = userId
    if (queryId) query.query_id = queryId

    const selections = await db
      .collection('user_model_selection')
      .find(query)
      .sort({ selected_at: -1 })
      .limit(10)
      .toArray()

    return NextResponse.json({
      status: 'success',
      count: selections.length,
      selections
    })
  } catch (error) {
    console.error('❌ Get selections error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to retrieve selections',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
