import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Map Hugging Face pipeline tags to specific task types
 */
function mapPipelineTagToTaskType(pipelineTag: string): string {
  const taskTypeMap: { [key: string]: string } = {
    'image-classification': 'Image Classification',
    'object-detection': 'Object Detection',
    'image-segmentation': 'Image Segmentation',
    'image-to-image': 'Image to Image',
    'text-to-image': 'Text to Image',
    'image-to-text': 'Image to Text',
    'depth-estimation': 'Depth Estimation',
    'image-to-video': 'Image to Video',
    'zero-shot-image-classification': 'Zero-Shot Image Classification',
    'mask-generation': 'Mask Generation',
    'zero-shot-object-detection': 'Zero-Shot Object Detection',
    'image-feature-extraction': 'Image Feature Extraction',
    'keypoint-detection': 'Keypoint Detection',
    'video-classification': 'Video Classification',
    'text-to-video': 'Text to Video',
    'image-to-3d': 'Image to 3D',
    'text-to-3d': 'Text to 3D'
  }
  
  return taskTypeMap[pipelineTag] || 'Object Detection'
}

/**
 * Calculate keyword relevance score for a model
 */
function calculateKeywordRelevance(model: NormalizedModel, keywords: string[]): number {
  let score = 0
  const modelText = `${model.name} ${model.description} ${(model.tags || []).join(' ')}`.toLowerCase()
  
  keywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase()
    
    // Exact keyword match in model name (highest score)
    if (model.name.toLowerCase().includes(lowerKeyword)) {
      score += 200
    }
    
    // Keyword match in description
    if (model.description.toLowerCase().includes(lowerKeyword)) {
      score += 100
    }
    
    // Keyword match in tags
    if (model.tags?.some(tag => tag.toLowerCase().includes(lowerKeyword))) {
      score += 150
    }
    
    // Partial keyword match (word boundary)
    const regex = new RegExp(`\\b${lowerKeyword}`, 'i')
    if (regex.test(modelText)) {
      score += 50
    }
  })
  
  return score
}

/**
 * /api/model-search
 * Purpose: Search Roboflow Universe and Hugging Face for pre-trained models
 * Returns normalized model results from both sources
 */

interface ModelSearchRequest {
  keywords: string[]
  task_type?: string
  limit?: number
  page?: number  // Page number for pagination (1-based)
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
    const { keywords, task_type, limit = 20, page = 1 } = body // Add page parameter for pagination

    if (!keywords || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords are required' },
        { status: 400 }
      )
    }

    // Check cache first (include page in cache key)
    const cacheKey = `${keywords.join('-')}-${task_type || 'all'}-page${page}`
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
      // Calculate keyword relevance score
      const aKeywordScore = calculateKeywordRelevance(a, keywords)
      const bKeywordScore = calculateKeywordRelevance(b, keywords)
      
      // Prioritize keyword match over task match
      const aTaskMatch = task_type && a.task.includes(task_type) ? 50 : 0
      const bTaskMatch = task_type && b.task.includes(task_type) ? 50 : 0
      
      // Combined score: keyword relevance + task match + downloads
      const aScore = aKeywordScore + aTaskMatch + Math.log(a.downloads + 1)
      const bScore = bKeywordScore + bTaskMatch + Math.log(b.downloads + 1)
      
      return bScore - aScore
    })

    // Calculate pagination
    const pageSize = 9 // Show 9 models per page (3x3 grid)
    const totalPages = Math.ceil(inferenceReadyModels.length / pageSize)
    const currentPage = Math.min(Math.max(1, page), totalPages) // Clamp between 1 and totalPages
    const startIdx = (currentPage - 1) * pageSize
    const endIdx = startIdx + pageSize
    
    // Get models for current page
    const paginatedModels = sortedModels.slice(startIdx, endIdx)

    // Response for frontend (only inference-ready models)
    const response = {
      models: paginatedModels,
      total: inferenceReadyModels.length,
      displayed: paginatedModels.length,
      hasMore: currentPage < totalPages,
      remaining: Math.max(0, inferenceReadyModels.length - endIdx),
      sources: {
        roboflow: roboflowModels.filter(m => m.supportsInference).length,
        huggingface: huggingFaceModels.filter(m => m.supportsInference).length
      },
      pagination: {
        page: currentPage,
        pageSize: pageSize,
        totalPages: totalPages,
        totalModels: inferenceReadyModels.length,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
        nextPage: currentPage < totalPages ? currentPage + 1 : null,
        previousPage: currentPage > 1 ? currentPage - 1 : null
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
      keywords: keywords,
      task_type: task_type,
      timestamp: new Date().toISOString()
    }

    console.log(`💾 Saving to MongoDB:`)
    console.log(`   - Total models fetched: ${allModelsIncludingNonInference.length}`)
    console.log(`   - Inference-ready: ${inferenceReadyModels.length}`)
    console.log(`   - Non-inference: ${allModelsIncludingNonInference.length - inferenceReadyModels.length}`)
    console.log(`📄 Pagination:`)
    console.log(`   - Page ${currentPage} of ${totalPages}`)
    console.log(`   - Showing ${paginatedModels.length} models`)
    console.log(`   - Remaining: ${response.remaining} models`)

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
    // Build search query - prioritize the first keyword for better relevance
    const primaryKeyword = keywords[0] || ''
    const additionalTerms = keywords.slice(1)
    
    // Create search query - use basketball+vision for basketball models
    let query = primaryKeyword
    if (primaryKeyword === 'basketball') {
      query += '+vision'  // This matches the working HF search that found basketball models
    } else {
      // For other keywords, add task type
      if (taskType) {
        const hfTask = mapTaskToHuggingFace(taskType)
        if (hfTask) query += `+${hfTask}`
      }
      // Add additional keywords but with less weight
      additionalTerms.forEach(term => {
        if (term !== primaryKeyword) {
          query += `+${term}`
        }
      })
    }
    
    // Fetch MORE models for better coverage (100 instead of 30)
    // First search without pipeline_tag filter to get broader results
    const url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&sort=downloads&limit=100`
    
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
        // ✅ EXCLUDE INAPPROPRIATE CONTENT
        const modelId = model.id.toLowerCase()
        const modelName = (model.model_name || '').toLowerCase()
        const tags = (model.tags || []).map((t: string) => t.toLowerCase())
        const description = (model.description || '').toLowerCase()
        
        // Block NSFW and inappropriate models
        const inappropriateTerms = ['nsfw', 'porn', 'adult', 'explicit', 'sexual', 'nude']
        const hasInappropriateContent = inappropriateTerms.some(term => 
          modelId.includes(term) || modelName.includes(term) || 
          description.includes(term) || tags.includes(term)
        )
        
        if (hasInappropriateContent) {
          return false
        }
        
        // ✅ FILTER FOR COMPUTER VISION MODELS ONLY
        // Check if this is a Computer Vision model based on pipeline_tag or other indicators
        const isCVModel = isComputerVisionModel(model)
        const matchesKeywords = matchesSearchKeywords(model, keywords)
        
        // Keep model if it's CV-related OR matches search keywords
        // This ensures we get relevant models even if they don't have standard CV tags
        if (!isCVModel && !matchesKeywords) {
          return false
        }
        
        // If filterForInference is false, return ALL models (for analytics)
        if (!filterForInference) {
          return true  // Keep everything for analytics
        }
        
        // ✅ For UI display, only check if model supports inference
        // HF Search API doesn't return inference field, so we use library_name as proxy
        // Only "transformers" library models support Inference API
        const hasTransformersLibrary = model.library_name === 'transformers'
        
        // Also check if inference field exists and is positive (for models that have it)
        const hasInferenceField = model.inference === 'warm' || model.inference === 'hosted' || model.inference === 'Inference API'
        
        // Keep model if it has inference support
        return hasTransformersLibrary || hasInferenceField
      })
      // Sort by downloads (all have inference already)
      .sort((a: any, b: any) => {
        return b.downloads - a.downloads
      })
    
    console.log(`🎯 Filtered to ${filteredData.length} CV models, checking inference support...`)
    
    // ✅ Process ALL models efficiently
    // For models with library_name === 'transformers', we can skip the individual fetch
    // For others, we need to check individually (but in batches to avoid rate limits)
    const modelsWithInferenceCheck = await Promise.all(
      filteredData.map(async (model: any) => {
        // If model has transformers library, we know it supports inference
        if (model.library_name === 'transformers') {
          return { 
            ...model, 
            inferenceStatus: model.inference || 'transformers' 
          }
        }
        
        // For non-transformers models, check if they have explicit inference field
        // Skip individual API calls to handle 100 models efficiently
        return { 
          ...model, 
          inferenceStatus: model.inference || null 
        }
      })
    )
    
    console.log(`🔍 Processed ${modelsWithInferenceCheck.length} models for inference support`)
    
    return modelsWithInferenceCheck
      .map((model: any) => {
        const modelName = model.id.split('/').pop() || model.id
        const author = model.id.split('/')[0] || 'Unknown'
        
        // Extract specific task type from pipeline_tag (Computer Vision tasks)
        const pipelineTag = model.pipeline_tag || 'object-detection'
        const taskType = mapPipelineTagToTaskType(pipelineTag)
        
        // Clean up description - remove redundant task type and download count
        let cleanDescription = model.description || ''
        
        // Remove patterns like "- object detection model with 1234 downloads"
        cleanDescription = cleanDescription.replace(/\s*-\s*\w+\s+\w+\s+model\s+with\s+\d+[\w\s]*downloads?/gi, '')
        
        // Remove patterns like "- object detection model"
        cleanDescription = cleanDescription.replace(/\s*-\s*\w+\s+\w+\s+model/gi, '')
        
        // Clean up any double spaces or trailing/leading spaces
        cleanDescription = cleanDescription.replace(/\s+/g, ' ').trim()
        
        // Use the inference data from individual model fetch OR fall back to library_name check
        const supportsInference = model.inferenceStatus === 'warm' || 
                                 model.inferenceStatus === 'hosted' || 
                                 model.inferenceStatus === 'Inference API' ||
                                 model.library_name === 'transformers'
        
        return {
          id: model.id,  // ✅ Full model ID (e.g., "roboflow/YOLOv8-Basketball-Detection")
          name: modelName,
          source: 'Hugging Face' as const,
          description: cleanDescription || modelName, // Use cleaned description
          url: `https://huggingface.co/${model.id}`,
          modelUrl: `https://huggingface.co/${model.id}`,
          image: `https://huggingface.co/${model.id}/resolve/main/thumbnail.jpg`,
          thumbnail: `https://huggingface.co/${model.id}/resolve/main/thumbnail.jpg`,
          metrics: {
            FPS: 30, // Default estimate
            modelSize: 'Unknown'
          },
          task: taskType, // Use specific task type (e.g., "Object Detection", "Image Classification")
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

/**
 * Check if a model is a Computer Vision model based on pipeline_tag and other indicators
 */
function isComputerVisionModel(model: any): boolean {
  const pipelineTag = model.pipeline_tag?.toLowerCase() || ''
  const tags = (model.tags || []).map((t: string) => t.toLowerCase())
  const description = (model.description || '').toLowerCase()
  
  // Computer Vision pipeline tags
  const cvPipelineTags = [
    'image-classification', 'object-detection', 'image-segmentation',
    'image-to-image', 'text-to-image', 'image-to-text', 'depth-estimation',
    'image-to-video', 'zero-shot-image-classification', 'mask-generation',
    'zero-shot-object-detection', 'image-feature-extraction', 'keypoint-detection',
    'video-classification', 'text-to-video', 'image-to-3d', 'text-to-3d',
    'image-text-to-text' // Include multimodal vision-language models
  ]
  
  // Computer Vision related tags and keywords
  const cvKeywords = [
    'vision', 'image', 'video', 'object', 'detection', 'classification',
    'segmentation', 'yolo', 'detr', 'resnet', 'mobilenet', 'efficientnet',
    'swin', 'vit', 'clip', 'dalle', 'stable-diffusion', 'controlnet'
  ]
  
  // Check pipeline tag
  if (cvPipelineTags.includes(pipelineTag)) {
    return true
  }
  
  // Check tags and description for CV keywords
  const hasCVKeywords = cvKeywords.some(keyword => 
    tags.includes(keyword) || description.includes(keyword)
  )
  
  return hasCVKeywords
}

/**
 * Check if a model matches search keywords (for relevance)
 */
function matchesSearchKeywords(model: any, keywords: string[]): boolean {
  const modelId = model.id.toLowerCase()
  const modelName = (model.model_name || '').toLowerCase()
  const description = (model.description || '').toLowerCase()
  const tags = (model.tags || []).map((t: string) => t.toLowerCase())
  
  // Check if any keyword appears in model metadata
  return keywords.some(keyword => {
    const lowerKeyword = keyword.toLowerCase()
    return modelId.includes(lowerKeyword) || 
           modelName.includes(lowerKeyword) || 
           description.includes(lowerKeyword) || 
           tags.some((tag: string) => tag.includes(lowerKeyword))
  })
}

