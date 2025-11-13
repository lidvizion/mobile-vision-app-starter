import { NextRequest, NextResponse } from 'next/server'

/**
 * Check status of background search and return additional models if available
 * This endpoint is called by the frontend to check for new models
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const keywords = searchParams.get('keywords')
    const taskType = searchParams.get('task_type')
    
    if (!keywords) {
      return NextResponse.json(
        { error: 'Keywords parameter is required' },
        { status: 400 }
      )
    }
    
    const cacheKey = `background-${keywords.split(',').join('-')}-${taskType}`
    const completionKey = `completed-${cacheKey}`
    
    // Check if background search has completed
    if (!globalThis.searchCache) {
      globalThis.searchCache = new Map()
    }
    
    const backgroundModels = globalThis.searchCache.get(cacheKey)
    const isCompleted = globalThis.searchCache.get(completionKey)
    
    if (isCompleted) {
      // Background search has completed (regardless of whether models were found)
      return NextResponse.json({
        success: true,
        status: 'completed',
        models: backgroundModels || [],
        count: backgroundModels ? backgroundModels.length : 0,
        message: backgroundModels && backgroundModels.length > 0 
          ? `Found ${backgroundModels.length} additional models!`
          : 'Background search completed - no additional models found'
      })
    } else if (backgroundModels && backgroundModels.length > 0) {
      // Models found but completion not marked (shouldn't happen, but handle gracefully)
      return NextResponse.json({
        success: true,
        status: 'completed',
        models: backgroundModels,
        count: backgroundModels.length,
        message: `Found ${backgroundModels.length} additional models!`
      })
    } else {
      // Background search is still running
      return NextResponse.json({
        success: true,
        status: 'running',
        models: [],
        count: 0,
        message: 'Background search is still running...'
      })
    }
    
  } catch (error) {
    console.error('❌ Background search status error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
