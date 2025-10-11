import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * /api/model-search
 * Purpose: Search Roboflow Universe and Hugging Face for pre-trained models
 * Returns normalized model results from both sources
 */

interface ModelSearchRequest {
  keywords: string[]
  task_type?: string
  limit?: number
}

interface NormalizedModel {
  id: string
  name: string
  source: 'Roboflow' | 'Hugging Face'
  description: string
  url: string
  modelUrl: string
  image?: string
  thumbnail?: string
  metrics?: {
    mAP?: number
    accuracy?: number
    FPS?: number
    modelSize?: string
  }
  task: string
  author: string
  downloads: number
  likes?: number
  tags?: string[]
  updatedAt?: string
  frameworks: string[]
  platforms: string[]
  supportsInference?: boolean
  inferenceEndpoint?: string
  inferenceStatus?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ModelSearchRequest = await request.json()
    const { keywords, task_type, limit = 20 } = body

    if (!keywords || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords are required' },
        { status: 400 }
      )
    }

    // Check cache first
    const cacheKey = `${keywords.join('-')}-${task_type || 'all'}`
    const cachedResults = await checkSearchCache(cacheKey)
    
    if (cachedResults) {
      console.log('✅ Cache hit for search:', cacheKey)
      return NextResponse.json(cachedResults)
    }

    // Search both platforms in parallel (get ALL models, not filtered)
    const [roboflowModels, huggingFaceModels] = await Promise.all([
      searchRoboflowModels(keywords, task_type),
      searchHFModels(keywords, task_type, false) // false = don't filter, get all models
    ])

    // Merge ALL results (including non-inference models)
    const allModelsIncludingNonInference = [...roboflowModels, ...huggingFaceModels]
    
    console.log(`📚 Total models found (all): ${allModelsIncludingNonInference.length}`)
    
    // Filter for inference-ready models (for UI display only)
    const inferenceReadyModels = allModelsIncludingNonInference.filter(model => {
      return model.supportsInference === true
    })
    
    console.log(`✅ Inference-ready models (for UI): ${inferenceReadyModels.length}`)
    
    // Sort inference-ready models by relevance
    const sortedModels = inferenceReadyModels.sort((a, b) => {
      // Prioritize task match
      const aTaskMatch = task_type && a.task.includes(task_type) ? 100 : 0
      const bTaskMatch = task_type && b.task.includes(task_type) ? 100 : 0
      
      // Then by downloads
      const aScore = aTaskMatch + Math.log(a.downloads + 1)
      const bScore = bTaskMatch + Math.log(b.downloads + 1)
      
      return bScore - aScore
    })

    // Limit results for UI
    const limitedModels = sortedModels.slice(0, limit)

    // Response for frontend (only inference-ready models)
    const response = {
      models: limitedModels,
      total: inferenceReadyModels.length,
      sources: {
        roboflow: roboflowModels.filter(m => m.supportsInference).length,
        huggingface: huggingFaceModels.filter(m => m.supportsInference).length
      }
    }
    
    // Save ALL models to MongoDB (including non-inference ones for analytics)
    const analyticsData = {
      models: allModelsIncludingNonInference, // Save everything
      total_found: allModelsIncludingNonInference.length,
      inference_ready: inferenceReadyModels.length,
      non_inference: allModelsIncludingNonInference.length - inferenceReadyModels.length,
      sources: {
        roboflow: roboflowModels.length,
        huggingface: huggingFaceModels.length
      },
      timestamp: new Date().toISOString()
    }

    // Cache the UI response AND save analytics data to MongoDB
    await saveSearchCache(cacheKey, response)
    await saveSearchAnalytics(crypto.randomUUID(), analyticsData)

    return NextResponse.json(response)

  } catch (error) {
    console.error('Model search error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to search models',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Search Roboflow Universe
 * GET https://universe.roboflow.com/search?query=basketball&tasks=object-detection
 */
async function searchRoboflowModels(
  keywords: string[], 
  taskType?: string
): Promise<NormalizedModel[]> {
  try {
    const apiKey = process.env.ROBOFLOW_API_KEY
    if (!apiKey) {
      console.warn('Roboflow API key not configured')
      return []
    }

    const query = keywords.join(' ')
    let url = `https://api.roboflow.com/universe/search?query=${encodeURIComponent(query)}&limit=10&api_key=${apiKey}`
    
    if (taskType) {
      const roboflowTask = mapTaskToRoboflow(taskType)
      url += `&type=${roboflowTask}`
    }

    const response = await fetch(url)
    if (!response.ok) {
      console.error('Roboflow API error:', response.statusText)
      return []
    }

    const data = await response.json()

    return (data.results || []).map((model: any) => ({
      name: model.name || model.project,
      source: 'Roboflow' as const,
      description: model.description || `${model.name} model for ${taskType || 'computer vision'}`,
      url: `https://universe.roboflow.com/${model.workspace}/${model.project}`,
      image: model.image || model.thumbnail,
      metrics: {
        mAP: model.map || model.accuracy,
        FPS: 30, // Default estimate
        modelSize: model.size || 'Medium'
      },
      task: mapRoboflowTaskToStandard(model.type),
      author: model.workspace,
      downloads: model.downloads || model.runs || 0,
      frameworks: ['Roboflow', 'TFLite', 'ONNX'],
      platforms: ['mobile', 'web', 'edge']
    }))

  } catch (error) {
    console.error('Roboflow search error:', error)
    return []
  }
}

/**
 * Search Hugging Face Hub
 * 
 * Endpoint: GET https://huggingface.co/api/models?search=<query>
 * Example: curl -H "Authorization: Bearer $HF_TOKEN" \
 *   "https://huggingface.co/api/models?search=basketball+object-detection"
 * 
 * Response:
 * [
 *   {
 *     "id": "roboflow/YOLOv8-Basketball-Detection",
 *     "pipeline_tag": "object-detection",
 *     "private": false,
 *     "downloads": 1452,
 *     "likes": 22,
 *     "inference": true,
 *     "tags": ["vision", "yolo", "object-detection"]
 *   }
 * ]
 */
async function searchHFModels(
  keywords: string[], 
  taskType?: string,
  filterForInference: boolean = true // New parameter: filter for inference-ready models
): Promise<NormalizedModel[]> {
  try {
    // Build search query
    const searchTerms = [...keywords]
    if (taskType) {
      const hfTask = mapTaskToHuggingFace(taskType)
      if (hfTask) searchTerms.push(hfTask)
    }
    
    const query = searchTerms.join('+')
    const url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&sort=downloads&limit=10`
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }
    
    // Authorization is optional - API works without token but has rate limits
    const apiKey = process.env.HUGGINGFACE_API_KEY
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    console.log('🔍 Searching Hugging Face:', query)
    const response = await fetch(url, { headers })
    
    if (!response.ok) {
      console.error('Hugging Face API error:', response.status, response.statusText)
      return []
    }

    const data = await response.json()
    
    if (!Array.isArray(data)) {
      console.error('Unexpected HF API response format')
      return []
    }

    console.log(`✅ Found ${data.length} total models on Hugging Face`)

    const filteredData = data
      .filter((model: any) => {
        // Filter for CV models
        const tags = (model.tags || []).map((t: string) => t.toLowerCase())
        const isCVModel = tags.some((t: string) => 
          t.includes('vision') || t.includes('image') || 
          t.includes('detection') || t.includes('segmentation') || 
          t.includes('classification') || t.includes('yolo')
        ) || (model.pipeline_tag && (
          model.pipeline_tag.includes('image') || 
          model.pipeline_tag.includes('object') ||
          model.pipeline_tag.includes('detection')
        ))
        
        // If filterForInference is false, return ALL CV models (for analytics)
        if (!filterForInference) {
          return isCVModel
        }
        
        // ✅ FILTER FOR INFERENCE-READY MODELS (when filterForInference is true)
        // HF Search API doesn't return inference field, so we use library_name as proxy
        // Only "transformers" library models support Inference API
        const hasTransformersLibrary = model.library_name === 'transformers'
        
        // Also check if inference field exists and is positive (for models that have it)
        const hasInferenceField = model.inference === 'warm' || model.inference === 'hosted' || model.inference === 'Inference API'
        
        // Must be CV model AND (transformers library OR explicit inference support)
        return isCVModel && (hasTransformersLibrary || hasInferenceField)
      })
      // Sort by downloads (all have inference already)
      .sort((a: any, b: any) => {
        return b.downloads - a.downloads
      })
    
    console.log(`🎯 Filtered to ${filteredData.length} CV models, checking inference support...`)
    
    // ✅ FETCH INDIVIDUAL MODEL DETAILS to check inference support accurately
    const modelsWithInferenceCheck = await Promise.all(
      filteredData.slice(0, 20).map(async (model: any) => {
        const modelDetails = await fetchModelDetails(model.id)
        return { ...model, ...modelDetails }
      })
    )
    
    console.log(`🔍 Checked ${modelsWithInferenceCheck.length} models for inference support`)
    
    return modelsWithInferenceCheck
      .map((model: any) => {
        const modelName = model.id.split('/').pop() || model.id
        const author = model.id.split('/')[0] || 'Unknown'
        const pipelineTag = model.pipeline_tag || 'object-detection'
        
        // Use the inference data from individual model fetch
        const supportsInference = model.inferenceStatus === 'warm' || 
                                 model.inferenceStatus === 'hosted' || 
                                 model.inferenceStatus === 'Inference API'
        
        return {
          id: model.id,  // ✅ Full model ID (e.g., "roboflow/YOLOv8-Basketball-Detection")
          name: modelName,
          source: 'Hugging Face' as const,
          description: `${modelName} - ${pipelineTag.replace(/-/g, ' ')} model with ${model.downloads || 0} downloads`,
          url: `https://huggingface.co/${model.id}`,
          modelUrl: `https://huggingface.co/${model.id}`,
          image: `https://huggingface.co/${model.id}/resolve/main/thumbnail.jpg`,
          thumbnail: `https://huggingface.co/${model.id}/resolve/main/thumbnail.jpg`,
          metrics: {
            FPS: 30, // Default estimate
            modelSize: 'Unknown'
          },
          task: mapHFTaskToStandard(pipelineTag),
          author: author,
          downloads: model.downloads || 0,
          likes: model.likes || 0,
          tags: model.tags || [],
          frameworks: detectFrameworks(model.tags || []),
          platforms: ['Web', 'Cloud', 'Edge'],
          updatedAt: model.lastModified || new Date().toISOString(),
          // Inference API support
          supportsInference: supportsInference,
          inferenceEndpoint: supportsInference ? `https://api-inference.huggingface.co/models/${model.id}` : undefined,
          inferenceStatus: supportsInference ? 'ready' : 'unavailable'
        }
      })

  } catch (error) {
    console.error('Hugging Face search error:', error)
    return []
  }
}

/**
 * Fetch individual model details to check inference support
 * This makes an additional API call per model but gives accurate inference status
 */
async function fetchModelDetails(modelId: string): Promise<{ inferenceStatus: string | null }> {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(`https://huggingface.co/api/models/${modelId}`, { headers })
    
    if (!response.ok) {
      return { inferenceStatus: null }
    }

    const data = await response.json()
    
    return {
      inferenceStatus: data.inference || null
    }
  } catch (error) {
    console.error(`Error fetching details for ${modelId}:`, error)
    return { inferenceStatus: null }
  }
}

// Helper functions for task mapping
function mapTaskToRoboflow(task: string): string {
  const taskMap: Record<string, string> = {
    'detection': 'object-detection',
    'classification': 'classification',
    'segmentation': 'instance-segmentation'
  }
  return taskMap[task] || 'object-detection'
}

function mapRoboflowTaskToStandard(task: string): string {
  const taskMap: Record<string, string> = {
    'object-detection': 'detection',
    'classification': 'classification',
    'instance-segmentation': 'segmentation',
    'semantic-segmentation': 'segmentation'
  }
  return taskMap[task] || 'detection'
}

function mapTaskToHuggingFace(task: string): string {
  const taskMap: Record<string, string> = {
    'detection': 'object-detection',
    'classification': 'image-classification',
    'segmentation': 'image-segmentation'
  }
  return taskMap[task] || 'object-detection'
}

function mapHFTaskToStandard(pipelineTag: string): string {
  const taskMap: Record<string, string> = {
    'object-detection': 'detection',
    'image-classification': 'classification',
    'image-segmentation': 'segmentation',
    'zero-shot-image-classification': 'classification',
    'zero-shot-object-detection': 'detection'
  }
  return taskMap[pipelineTag] || 'detection'
}

function detectFrameworks(tags: string[]): string[] {
  const frameworks = new Set<string>()
  const frameworkMap: Record<string, string> = {
    'pytorch': 'PyTorch',
    'tensorflow': 'TensorFlow',
    'onnx': 'ONNX',
    'jax': 'JAX'
  }
  
  tags.forEach(tag => {
    const tagLower = tag.toLowerCase()
    Object.entries(frameworkMap).forEach(([key, value]) => {
      if (tagLower.includes(key)) {
        frameworks.add(value)
      }
    })
  })
  
  return Array.from(frameworks)
}


/**
 * Check if search results are cached in MongoDB
 */
async function checkSearchCache(cacheKey: string): Promise<any | null> {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()
    
    // Check if cache exists and is less than 1 hour old
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const cached = await db.collection('search_cache').findOne({
      cache_key: cacheKey,
      created_at: { $gte: oneHourAgo }
    })
    
    if (cached) {
      return cached.results
    }
    
    return null
  } catch (error) {
    console.error('Cache check error:', error)
    return null
  }
}

/**
 * Save search results to MongoDB cache
 */
async function saveSearchCache(cacheKey: string, results: any): Promise<void> {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()
    
    await db.collection('search_cache').updateOne(
      { cache_key: cacheKey },
      {
        $set: {
          cache_key: cacheKey,
          results: results,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      },
      { upsert: true }
    )
    
    console.log('✅ Search results cached in MongoDB:', cacheKey)
  } catch (error) {
    console.error('Cache save error:', error)
    // Don't fail the request if caching fails
  }
}

/**
 * Save ALL search results (including non-inference models) to MongoDB for analytics
 */
async function saveSearchAnalytics(queryId: string, analyticsData: any): Promise<void> {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()
    
    await db.collection('search_analytics').insertOne({
      query_id: queryId,
      total_models: analyticsData.total_found,
      inference_ready_count: analyticsData.inference_ready,
      non_inference_count: analyticsData.non_inference,
      all_models: analyticsData.models, // Save ALL models (including inference: null)
      sources: analyticsData.sources,
      created_at: analyticsData.timestamp
    })
    
    console.log(`📊 Saved ${analyticsData.total_found} models to analytics (${analyticsData.inference_ready} inference-ready, ${analyticsData.non_inference} non-inference)`)
  } catch (error) {
    console.error('Analytics save error:', error)
  }
}

