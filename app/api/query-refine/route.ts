import { NextRequest, NextResponse } from 'next/server'
import { extractKeywords } from '@/lib/keywordExtraction'

/**
 * /api/query-refine
 * Purpose: Refine user text into optimized search keywords
 * Uses keyword extraction to identify CV tasks and objects
 */

interface QueryRefineRequest {
  query: string
  userId?: string
}

interface QueryRefineResponse {
  use_case: string
  keywords: string[]
  task_type: string
  query_id: string
  refined_query: string
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

    // Extract keywords using built-in NLP
    const extracted = extractKeywords(query)
    const allKeywords = extracted.allKeywords
    
    // Determine task type from extracted tasks
    const taskType = extracted.tasks.length > 0 ? extracted.tasks[0] : 'detection'

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
      refined_query: refinedQuery
    }

    // Save to MongoDB using new schema
    const queryRecord = {
      query_id: queryId,
      user_id: userId || 'anonymous',
      query: query, // User's original query text
      keywords: extracted.allKeywords,
      task_type: taskType,
      timestamp: new Date().toISOString(), // Using timestamp for consistency
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

