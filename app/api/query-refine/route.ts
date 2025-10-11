import { NextRequest, NextResponse } from 'next/server'
import { extractKeywords } from '@/lib/keywordExtraction'
import { advancedQueryRefine, mapAdvancedTaskToSimple } from '@/lib/advancedQueryRefine'

/**
 * /api/query-refine
 * Purpose: Refine user text into optimized search keywords
 * Uses advanced NLP extraction with structured output
 */

interface QueryRefineRequest {
  query: string
  userId?: string
  useAdvanced?: boolean // Use advanced refinement with structured output
}

interface QueryRefineResponse {
  use_case: string
  keywords: string[]
  task_type: string
  query_id: string
  refined_query: string
  // Advanced fields (optional)
  advanced?: {
    task: string
    media_type: string
    realtime: boolean
    input_constraints: {
      resolution: string
      fps: number | null
      streaming: boolean
    }
    output_type: string
    hardware_target: string
    priority: string
    summary: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: QueryRefineRequest = await request.json()
    const { query, userId } = body

    // Validate input
    if (!query || typeof query !== 'string' || query.length < 10) {
      return NextResponse.json(
        { error: 'Query must be at least 10 characters' },
        { status: 400 }
      )
    }

    // Use advanced refinement for better keyword extraction
    const advancedResult = await advancedQueryRefine(query)
    
    // Also extract keywords using built-in NLP for backward compatibility
    const extracted = extractKeywords(query)
    
    // Combine keywords from both methods
    const combinedKeywords = [...advancedResult.keywords, ...extracted.allKeywords]
    const allKeywords = Array.from(new Set(combinedKeywords))
    
    // Use advanced task mapping
    const taskType = mapAdvancedTaskToSimple(advancedResult.task)

    // Generate use case identifier
    const useCase = allKeywords
      .slice(0, 3)
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')

    // Create refined query for search
    const refinedQuery = allKeywords.join(' ')

    // Generate unique query ID (using uuid format)
    const queryId = `uuid-query-${Date.now()}`

    // Prepare response
    const response: QueryRefineResponse = {
      use_case: useCase,
      keywords: allKeywords,
      task_type: taskType,
      query_id: queryId,
      refined_query: refinedQuery,
      // Include advanced analysis
      advanced: advancedResult
    }

    // Save to MongoDB using new schema
    const queryRecord = {
      query_id: queryId,
      user_id: userId || 'anonymous',
      query_text: query,
      keywords: extracted.allKeywords,
      task_type: taskType,
      created_at: new Date().toISOString()
    }

    // Save to MongoDB
    try {
      const { getDatabase } = await import('@/lib/mongodb/connection')
      const db = await getDatabase()
      await db.collection('user_queries').insertOne(queryRecord)
      console.log('Query saved to MongoDB:', queryRecord)
    } catch (mongoError) {
      console.error('MongoDB save error:', mongoError)
      // Continue without failing the request
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Query refine error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to refine query',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Optional: Enhanced version with OpenAI GPT-mini
 * Uncomment when ready to use OpenAI
 */
/*
async function refineWithOpenAI(query: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "Extract computer vision keywords from user query. Return JSON with: use_case, keywords (array), task_type (detection/classification/segmentation)"
      },
      { role: "user", content: query }
    ],
    temperature: 0.3,
    max_tokens: 200
  })

  return JSON.parse(completion.choices[0].message.content || '{}')
}
*/

