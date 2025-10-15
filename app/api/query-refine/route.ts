import { NextRequest, NextResponse } from 'next/server'

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

    // Extract keywords using ChatGPT API
    const extracted = await extractKeywordsWithChatGPT(query)
    const allKeywords = extracted.keywords
    
    // Determine task type from ChatGPT response
    const taskType = extracted.task_type || 'detection'

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
      keywords: allKeywords,
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
 * Extract keywords using ChatGPT API (direct fetch)
 */
async function extractKeywordsWithChatGPT(query: string) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a computer vision expert. Extract keywords from user queries for searching Hugging Face models.

Return a JSON object with:
- keywords: array of 3-5 most relevant keywords for model search
- task_type: one of "detection", "classification", "segmentation", "object-detection", "image-classification"
- use_case: brief description

Focus on:
- Main objects/subjects (e.g., "basketball", "cars", "people")
- Computer vision tasks (e.g., "detection", "classification")
- Domain-specific terms (e.g., "sports", "medical", "retail")

Example input: "Identify basketball shots and player positions"
Example output: {"keywords": ["basketball", "sports", "detection", "players", "positions"], "task_type": "object-detection", "use_case": "basketball player detection"}`
          },
          { role: "user", content: query }
        ],
        temperature: 0.3,
        max_tokens: 200
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No response content from ChatGPT')
    }

    return JSON.parse(content)
  } catch (error) {
    console.error('ChatGPT API error:', error)
    
    // Fallback to simple keyword extraction
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['identify', 'detect', 'find', 'locate', 'show', 'get'].includes(word))
    
    return {
      keywords: words.slice(0, 5),
      task_type: 'object-detection',
      use_case: 'computer vision task'
    }
  }
}

