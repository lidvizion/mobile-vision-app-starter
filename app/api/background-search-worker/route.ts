import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Background search worker endpoint
 * Runs heavy search operations and persists results to MongoDB
 * Called asynchronously from model-search
 */
interface WorkerRequest {
  query_id: string
  keywords: string[]
  task_type?: string
}

export async function POST(request: NextRequest) {
  let query_id: string | undefined
  
  try {
    const body: WorkerRequest = await request.json()
    query_id = body.query_id
    const { keywords, task_type } = body

    if (!query_id || !keywords || !Array.isArray(keywords)) {
      return NextResponse.json(
        { error: 'query_id and keywords array are required' },
        { status: 400 }
      )
    }

    console.log(`🔄 [Worker] Starting background search for query: ${query_id}`)

    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()

    // Update job status to 'running'
    await db.collection('search_jobs').updateOne(
      { query_id },
      {
        $set: {
          status: 'running',
          updated_at: new Date().toISOString()
        }
      }
    )

    // Search Hugging Face models
    let hfModels: any[] = []
    try {
      const apiKey = process.env.HUGGINGFACE_API_KEY
      if (apiKey) {
        // Use same search logic as model-search route
        const genericTerms = new Set(['segmentation', 'segformer', 'image-segmentation', 'detection', 'classification', 'object-detection'])
        const domainKeywords = keywords.filter(k => !genericTerms.has(k.toLowerCase()))
        const genericKeywords = keywords.filter(k => genericTerms.has(k.toLowerCase()))
        const prioritizedKeywords = [
          ...domainKeywords.slice(0, 2),
          ...genericKeywords.slice(0, 1)
        ].slice(0, 3)
        const searchQuery = (prioritizedKeywords.length > 0 ? prioritizedKeywords : keywords.slice(0, 3)).join('+')
        
        const url = `https://huggingface.co/api/models?search=${encodeURIComponent(searchQuery)}&sort=downloads&limit=100`
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
        
        const response = await fetch(url, { headers })
        if (response.ok) {
          const data = await response.json()
          if (Array.isArray(data)) {
            hfModels = data.slice(0, 100).map((model: any) => {
              const pipelineTag = model.pipeline_tag || 'image-classification'
              const name = (model.id || '').split('/').pop() || model.id
              const author = (model.id || '').split('/')[0] || 'Unknown'
              return {
                id: model.id,
                name,
                source: 'huggingface' as const,
                description: model.description || name,
                url: `https://huggingface.co/${model.id}`,
                modelUrl: `https://huggingface.co/${model.id}`,
                task: pipelineTag,
                author,
                downloads: model.downloads || 0,
                tags: model.tags || [],
                frameworks: [model.library_name].filter(Boolean),
                platforms: [],
                supportsInference: Boolean(model.inference || (pipelineTag && pipelineTag !== 'unknown')),
                inferenceEndpoint: `https://router.huggingface.co/hf-inference/models/${model.id}`,
                pipelineTag,
                libraryName: model.library_name,
                isCurated: false
              }
            })
          }
        }
      }
      
      // Save HF models to search_results
      if (hfModels.length > 0) {
        await db.collection('search_results').insertOne({
          query_id,
          source: 'hf',
          models: hfModels,
          created_at: new Date().toISOString()
        })
      }
      console.log(`✅ [Worker] Found ${hfModels.length} HF models`)
    } catch (err) {
      console.error('❌ [Worker] HF search failed:', err)
    }

    // Search Roboflow models (skip Python in production - would need HTTP API or Lambda)
    let rfModels: any[] = []
    // Note: Roboflow Python search is skipped here - can be added via HTTP API or Lambda later
    console.log(`⚠️ [Worker] Roboflow search skipped (Python not available in serverless)`)

    // Combine models
    const allBackgroundModels = [...rfModels, ...hfModels]

    // Save results to MongoDB
    if (allBackgroundModels.length > 0) {
      await db.collection('search_results').insertOne({
        query_id,
        source: 'background',
        models: allBackgroundModels,
        keywords,
        task_type: task_type || 'detection',
        created_at: new Date().toISOString()
      })
    }

    // Update job status to 'completed'
    await db.collection('search_jobs').updateOne(
      { query_id },
      {
        $set: {
          status: 'completed',
          updated_at: new Date().toISOString()
        }
      }
    )

    console.log(`✅ [Worker] Background search completed for query: ${query_id}`)

    return NextResponse.json({
      success: true,
      query_id,
      models_found: allBackgroundModels.length
    })

  } catch (error) {
    console.error('❌ [Worker] Background search failed:', error)

    // Mark job as failed
    if (query_id) {
      try {
        const { getDatabase } = await import('@/lib/mongodb/connection')
        const db = await getDatabase()
        await db.collection('search_jobs').updateOne(
          { query_id },
          {
            $set: {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
              updated_at: new Date().toISOString()
            }
          }
        )
      } catch (dbError) {
        console.error('❌ [Worker] Failed to update job status:', dbError)
      }
    }

    return NextResponse.json(
      { error: 'Background search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

