import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { fetchMultipleModelClasses } from '@/lib/huggingface/fetchModelClasses'

/**
 * Fetch model description from Hugging Face README.md
 */
async function fetchModelDescription(modelId: string): Promise<string | null> {
  try {
    const readmeUrl = `https://huggingface.co/${modelId}/raw/main/README.md`
    const response = await fetch(readmeUrl)
    
    if (!response.ok) {
      return null
    }
    
    const readmeContent = await response.text()
    
    // Extract description from README
    // Look for content after the YAML front matter (---)
    const lines = readmeContent.split('\n')
    let inYamlFrontMatter = false
    let description = ''
    let foundMeaningfulContent = false
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // Check for YAML front matter boundaries
      if (line.trim() === '---') {
        inYamlFrontMatter = !inYamlFrontMatter
        continue
      }
      
      // Skip YAML front matter
      if (inYamlFrontMatter) {
        continue
      }
      
      // Skip empty lines at the start
      if (line.trim() === '') {
        continue
      }
      
      // Skip markdown headers, images, and other formatting
      if (line.startsWith('#') || 
          line.startsWith('![') || 
          line.startsWith('|') ||
          line.startsWith('```') ||
          line.startsWith('<!--') ||
          line.trim() === '') {
        continue
      }
      
      // Look for meaningful content (not just HTML comments or boilerplate)
      const cleanLine = line.trim()
      if (cleanLine.length > 20 && 
          !cleanLine.toLowerCase().includes('this model card has been generated') &&
          !cleanLine.toLowerCase().includes('provide a quick summary') &&
          !cleanLine.toLowerCase().includes('model-index') &&
          !cleanLine.toLowerCase().includes('metrics:') &&
          !cleanLine.startsWith('<!--')) {
        description = cleanLine
        foundMeaningfulContent = true
        break
      }
    }
    
    // If no meaningful content found, try to get a better description
    if (!foundMeaningfulContent) {
      // Look for any paragraph that might contain useful info
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.length > 30 && 
            line.includes(' ') && // Contains spaces (likely a sentence)
            !line.startsWith('#') &&
            !line.startsWith('!') &&
            !line.startsWith('|') &&
            !line.startsWith('```') &&
            !line.startsWith('<!--') &&
            !line.toLowerCase().includes('model-index') &&
            !line.toLowerCase().includes('metrics:')) {
          description = line
          break
        }
      }
    }
    
    // Clean up the description
    if (description) {
      // Remove HTML comments first
      description = description
        .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
        .replace(/\*([^*]+)\*/g, '$1') // Remove italic
        .replace(/`([^`]+)`/g, '$1') // Remove code formatting
        .replace(/^[^\w]*/, '') // Remove leading non-word characters
        .trim()
      
      // Only return if it's a reasonable length and meaningful content
      if (description.length > 10 && description.length < 200 && 
          !description.toLowerCase().includes('model-index') &&
          !description.toLowerCase().includes('metrics:') &&
          !description.toLowerCase().includes('this model card has been generated') &&
          !description.toLowerCase().includes('provide a quick summary')) {
        return description
      }
    }
    
    return null
  } catch (error) {
    console.warn(`Failed to fetch description for ${modelId}:`, error)
    return null
  }
}

/**
 * Fetch descriptions for multiple models in parallel
 */
async function fetchMultipleModelDescriptions(modelIds: string[]): Promise<Record<string, string | null>> {
  const results = await Promise.all(
    modelIds.map(async (modelId) => ({
      modelId,
      description: await fetchModelDescription(modelId)
    }))
  )
  
  return results.reduce((acc, { modelId, description }) => {
    acc[modelId] = description
    return acc
  }, {} as Record<string, string | null>)
}

/**
 * Determine model type based on classes and pipeline tag
 */
function determineModelType(model: any, classes?: string[]): {
  type: 'custom' | 'generative' | 'unspecified'
  tier: 1 | 2 | 3
  displayLabel: string
  description: string
  taskType: 'object-detection' | 'classification' | 'segmentation' | 'captioning' | 'qa' | 'embedding' | 'general'
  displayFormat: {
    type: 'bounding-boxes' | 'labels' | 'masks' | 'text' | 'embeddings' | 'general'
    requiresImage: boolean
    requiresText: boolean
    outputType: 'structured' | 'text' | 'numerical'
    visualization: 'overlay' | 'sidebar' | 'modal' | 'inline'
  }
} {
  const pipelineTag = model.pipeline_tag?.toLowerCase() || ''
  
  // Tier 1: Custom/Task-specific CV models with explicit classes
  if (classes && classes.length > 0 && classes[0] !== 'LABEL_0') {
    // Determine specific task type based on pipeline tag and model name
    let taskType: 'object-detection' | 'classification' | 'segmentation' | 'captioning' | 'qa' | 'embedding' | 'general' = 'general'
            let displayFormat: {
              type: 'bounding-boxes' | 'labels' | 'masks' | 'text' | 'embeddings' | 'general'
              requiresImage: boolean
              requiresText: boolean
              outputType: 'structured' | 'text' | 'numerical'
              visualization: 'overlay' | 'sidebar' | 'modal' | 'inline'
            } = {
              type: 'general',
              requiresImage: true,
              requiresText: false,
              outputType: 'structured',
              visualization: 'sidebar'
            }
    
    // Check model name and description for task type clues
    const modelName = model.name?.toLowerCase() || ''
    const modelDescription = model.description?.toLowerCase() || ''
    const combinedText = `${pipelineTag} ${modelName} ${modelDescription}`
    
    if (combinedText.includes('object-detection') || 
        combinedText.includes('detection') || 
        combinedText.includes('yolo') || 
        combinedText.includes('detr') ||
        combinedText.includes('faster-rcnn') ||
        combinedText.includes('retinanet') ||
        combinedText.includes('bounding') ||
        combinedText.includes('bbox')) {
      taskType = 'object-detection'
      displayFormat.type = 'bounding-boxes'
      displayFormat.visualization = 'overlay'
    } else if (combinedText.includes('classification') || 
               combinedText.includes('image-classification') ||
               combinedText.includes('classify') ||
               combinedText.includes('resnet') ||
               combinedText.includes('vit') ||
               combinedText.includes('efficientnet')) {
      taskType = 'classification'
      displayFormat.type = 'labels'
    } else if (combinedText.includes('segmentation') || 
               combinedText.includes('mask') ||
               combinedText.includes('deeplab') ||
               combinedText.includes('unet') ||
               combinedText.includes('mask-rcnn')) {
      taskType = 'segmentation'
      displayFormat.type = 'masks'
      displayFormat.visualization = 'overlay'
    }
    
    return {
      type: 'custom',
      tier: 1,
      displayLabel: 'Custom Model',
      description: `Detects ${classes.length} specific classes: ${classes.slice(0, 3).join(', ')}${classes.length > 3 ? '...' : ''}`,
      taskType,
      displayFormat
    }
  }
  
  // Tier 2: Generative vision-language models
  const modelName = model.name?.toLowerCase() || ''
  const modelDescription = model.description?.toLowerCase() || ''
  const combinedText = `${pipelineTag} ${modelName} ${modelDescription}`
  
  const generativeTags = ['image-to-text', 'multimodal', 'text-generation', 'visual-question-answering', 'image-captioning']
  const generativeKeywords = ['blip', 'llava', 'llama', 'phi', 'qwen', 'instruct', 'caption', 'captioning', 'vision-language', 'vlm', 'vision-language-model']
  
  if (generativeTags.some(tag => pipelineTag.includes(tag)) || 
      generativeKeywords.some(keyword => combinedText.includes(keyword))) {
    let taskType: 'captioning' | 'qa' | 'general' = 'general'
    let displayFormat: {
      type: 'bounding-boxes' | 'labels' | 'masks' | 'text' | 'embeddings' | 'general'
      requiresImage: boolean
      requiresText: boolean
      outputType: 'structured' | 'text' | 'numerical'
      visualization: 'overlay' | 'sidebar' | 'modal' | 'inline'
    } = {
      type: 'text',
      requiresImage: true,
      requiresText: false,
      outputType: 'text',
      visualization: 'modal'
    }
    
    if (combinedText.includes('captioning') || 
        combinedText.includes('image-to-text') || 
        combinedText.includes('caption') ||
        combinedText.includes('blip')) {
      taskType = 'captioning'
      displayFormat.visualization = 'sidebar'
    } else if (combinedText.includes('question-answering') || 
               combinedText.includes('qa') ||
               combinedText.includes('instruct')) {
      taskType = 'qa'
      displayFormat.requiresText = true
    }
    
    return {
      type: 'generative',
      tier: 2,
      displayLabel: 'Generative Vision',
      description: 'Returns free-text descriptions and answers about images',
      taskType,
      displayFormat
    }
  }
  
  // Tier 3: Unspecified/Legacy models
  return {
    type: 'unspecified',
    tier: 3,
    displayLabel: 'Vision Model',
    description: 'No predefined labels — responses vary by prompt',
    taskType: 'general',
    displayFormat: {
      type: 'general',
      requiresImage: true,
      requiresText: false,
      outputType: 'text',
      visualization: 'modal'
    }
  }
}

/**
 * Calculate enhanced relevance score with model type consideration
 */
function calculateEnhancedRelevance(model: any, keywords: string[], classes?: string[]): number {
  const modelTypeInfo = determineModelType(model, classes)
  let baseScore = 0
  
  // HIGHEST PRIORITY: Known working models (verified to work with Inference API)
  if (model.isKnownWorking) {
    baseScore += 500 // Massive boost to ensure these appear first
  }
  
  // Base keyword relevance
  const modelText = `${model.name} ${model.description} ${model.tags?.join(' ') || ''}`.toLowerCase()
  const keywordMatches = keywords.filter(keyword => 
    modelText.includes(keyword.toLowerCase())
  ).length
  baseScore += keywordMatches * 20
  
  // Tier-based scoring
  switch (modelTypeInfo.tier) {
    case 1: // Custom models with classes
      baseScore += 100
      // Bonus for class keyword matches
      if (classes) {
        const classMatches = keywords.filter(keyword =>
          classes.some(cls => cls.toLowerCase().includes(keyword.toLowerCase()))
        ).length
        baseScore += classMatches * 30
      }
      break
    case 2: // Generative models
      baseScore += 50
      break
    case 3: // Unspecified models
      baseScore += 10
      break
  }
  
  // Downloads bonus (logarithmic to prevent huge models from dominating)
  baseScore += Math.log(model.downloads + 1) * 5
  
  // Bonus for models from trusted organizations (more likely to work)
  if (model.id?.startsWith('microsoft/') || 
      model.id?.startsWith('google/') || 
      model.id?.startsWith('facebook/') ||
      model.id?.startsWith('openai/')) {
    baseScore += 100
  }
  
  return baseScore
}

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
  source: 'roboflow' | 'huggingface'
  description: string
  url: string
  modelUrl: string
  image?: string
  thumbnail?: string
  metrics?: {
    mAP?: number
    accuracy?: number
    precision?: number
    recall?: number
    FPS?: number
    modelSize?: string
  }
  task: string
  author: string
  downloads: number
  views?: number
  likes?: number
  stars?: number
  tags?: string[]
  classes?: string[]
  updatedAt?: string
  lastUpdated?: string
  trainingImages?: number
  modelId?: string
  frameworks: string[]
  platforms: string[]
  supportsInference?: boolean
  inferenceEndpoint?: string
  inferenceStatus?: string
  isKnownWorking?: boolean // Flag for verified working models
  // Enhanced model type information
  modelType?: 'custom' | 'generative' | 'unspecified'
  modelTypeInfo?: {
    type: 'custom' | 'generative' | 'unspecified'
    tier: 1 | 2 | 3
    displayLabel: string
    description: string
    taskType: 'object-detection' | 'classification' | 'segmentation' | 'captioning' | 'qa' | 'embedding' | 'general'
    displayFormat: {
      type: 'bounding-boxes' | 'labels' | 'masks' | 'text' | 'embeddings' | 'general'
      requiresImage: boolean
      requiresText: boolean
      outputType: 'structured' | 'text' | 'numerical'
      visualization: 'overlay' | 'sidebar' | 'modal' | 'inline'
    }
  }
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
    
    console.log(`✅ Live inference-ready models (hosted/warm): ${inferenceReadyModels.length}`)
    
    // Sort inference-ready models by enhanced relevance
    const sortedModels = inferenceReadyModels.sort((a, b) => {
      // Calculate enhanced relevance scores (will be updated after classes are fetched)
      const aScore = calculateKeywordRelevance(a, keywords)
      const bScore = calculateKeywordRelevance(b, keywords)
      
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

    // Fetch classes and descriptions for ALL Hugging Face models (not just current page)
    const allHfModelIds = inferenceReadyModels
      .filter(m => m.source === 'huggingface' && m.id)
      .map(m => m.id)
    
    let classesMap: Record<string, string[]> = {}
    let descriptionsMap: Record<string, string> = {}
    
    if (allHfModelIds.length > 0) {
      console.log(`📝 Fetching classes and descriptions for ${allHfModelIds.length} HF models...`)
      
      try {
        // Fetch both classes and descriptions in parallel
        const [classesResults, descriptionsResults] = await Promise.all([
          fetchMultipleModelClasses(allHfModelIds),
          fetchMultipleModelDescriptions(allHfModelIds)
        ])
        
        // Extract successful classes
        Object.entries(classesResults).forEach(([modelId, result]) => {
          if (result.success && result.classes) {
            classesMap[modelId] = result.classes
            console.log(`   ✅ ${modelId}: ${result.classes.length} classes`)
          } else {
            console.log(`   ⚠️  ${modelId}: No classes found`)
          }
        })
        
        // Extract successful descriptions
        Object.entries(descriptionsResults).forEach(([modelId, description]) => {
          if (description) {
            descriptionsMap[modelId] = description
            console.log(`   📝 ${modelId}: "${description.substring(0, 50)}..."`)
          } else {
            console.log(`   ⚠️  ${modelId}: No description found`)
          }
        })
        
      } catch (error) {
        console.error('Error fetching classes/descriptions:', error)
        // Continue without classes/descriptions if fetch fails
      }
    }

    // Add classes, better descriptions, and model type information to paginated models
    const paginatedModelsWithMetadata = paginatedModels.map(model => {
      const betterDescription = model.source === 'huggingface' && descriptionsMap[model.id]
        ? descriptionsMap[model.id]
        : model.description
      
      // Get classes for this model
      const modelClasses = model.source === 'huggingface' && classesMap[model.id]
        ? classesMap[model.id]
        : model.classes // Use existing classes for Roboflow models
      
      // Determine model type and add type information
      const modelTypeInfo = determineModelType(model, modelClasses)
      
      return {
        ...model,
        description: betterDescription,
        classes: modelClasses,
        modelType: modelTypeInfo.type,
        modelTypeInfo: modelTypeInfo
      }
    })

    // Re-sort with enhanced relevance scoring now that we have classes and model types
    const finalSortedModels = paginatedModelsWithMetadata.sort((a, b) => {
      const aScore = calculateEnhancedRelevance(a, keywords, a.classes)
      const bScore = calculateEnhancedRelevance(b, keywords, b.classes)
      
      return bScore - aScore
    })

    // Response for frontend (only inference-ready models)
    const response = {
      models: finalSortedModels,
      total: inferenceReadyModels.length,
      displayed: finalSortedModels.length,
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
    console.log(`   - Live inference-ready (hosted/warm): ${inferenceReadyModels.length}`)
    console.log(`   - Non-live (download required): ${allModelsIncludingNonInference.length - inferenceReadyModels.length}`)
    console.log(`📄 Pagination:`)
    console.log(`   - Page ${currentPage} of ${totalPages}`)
    console.log(`   - Showing ${paginatedModels.length} models`)
    console.log(`   - Remaining: ${response.remaining} models`)

    // Generate query ID for this search
    const queryId = `uuid-query-${Date.now()}`
    
    // Update analytics data with query ID
    const analyticsDataWithQueryId = {
      ...analyticsData,
      query_id: queryId
    }
    
    // Cache the UI response AND save analytics data to MongoDB
    await saveSearchCache(cacheKey, response)
    await saveSearchAnalytics(queryId, analyticsDataWithQueryId)
    
    // Save ALL inference-ready models to recommendations (not just paginated ones)
    // Process ALL inference-ready models with metadata
    const allModelsWithMetadata = inferenceReadyModels.map(model => {
      const modelClasses = model.classes || (model.id && classesMap[model.id] ? classesMap[model.id] : undefined)
      const modelTypeInfo = determineModelType(model, modelClasses)
      
      return {
        ...model,
        classes: modelClasses,
        modelType: modelTypeInfo?.type || 'unspecified',
        modelTypeInfo: modelTypeInfo
      }
    })
    
    // Sort all models by enhanced relevance
    const allSortedModels = allModelsWithMetadata.sort((a, b) => {
      const aScore = calculateEnhancedRelevance(a, keywords, a.classes)
      const bScore = calculateEnhancedRelevance(b, keywords, b.classes)
      return bScore - aScore
    })
    
    await saveModelRecommendations(queryId, allSortedModels, classesMap)

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

    console.log(`🔍 Searching Roboflow: ${query}`)
    const response = await fetch(url)
    if (!response.ok) {
      console.error('Roboflow API error:', response.statusText)
      return []
    }

    const data = await response.json()
    console.log(`✅ Found ${data.results?.length || 0} models on Roboflow`)

    // Fetch detailed model information for each result
    const modelsWithDetails = await Promise.all(
      (data.results || []).map(async (model: any) => {
        try {
          // Fetch detailed model info
          const detailUrl = `https://api.roboflow.com/universe/${model.workspace}/${model.project}?api_key=${apiKey}`
          const detailResponse = await fetch(detailUrl)
          
          let detailedInfo: any = {}
          if (detailResponse.ok) {
            detailedInfo = await detailResponse.json()
          }

          // Extract classes from the detailed model info
          const classes = detailedInfo.classes || model.classes || []
          
          // Create better description
          let description = model.description || detailedInfo.description
          if (!description || description.length < 20) {
            if (classes.length > 0) {
              description = `Detects ${classes.join(', ')} in images`
            } else {
              description = `${model.name} model for ${taskType || 'computer vision'}`
            }
          }

          return {
            id: `${model.workspace}/${model.project}`,
            name: model.name || model.project,
            source: 'roboflow' as const,
            description: description,
            url: `https://universe.roboflow.com/${model.workspace}/${model.project}`,
            image: model.image || model.thumbnail || detailedInfo.thumbnail,
            metrics: {
              mAP: detailedInfo.map50 || model.map || model.accuracy,
              precision: detailedInfo.precision || model.precision,
              recall: detailedInfo.recall || model.recall,
              FPS: 30, // Default estimate
              modelSize: model.size || 'Medium'
            },
            task: mapRoboflowTaskToStandard(model.type || detailedInfo.type),
            author: model.workspace || detailedInfo.workspace,
            downloads: model.downloads || model.runs || detailedInfo.downloads || 0,
            views: model.views || detailedInfo.views || 0,
            stars: model.stars || detailedInfo.stars || 0,
            frameworks: ['Roboflow', 'TFLite', 'ONNX'],
            platforms: ['mobile', 'web', 'edge'],
            tags: model.tags || detailedInfo.tags || [],
            classes: classes,
            modelId: detailedInfo.model_id || `${model.workspace}/${model.project}/1`, // Roboflow model ID format
            trainingImages: detailedInfo.training_images || model.training_images,
            lastUpdated: detailedInfo.updated_at || model.updated_at,
            supportsInference: true, // Roboflow models support inference via API
            inferenceEndpoint: `https://serverless.roboflow.com/${model.workspace}/${model.project}/1`
          }
        } catch (error) {
          console.warn(`Failed to fetch details for ${model.workspace}/${model.project}:`, error)
          // Fallback to basic model info
          return {
            id: `${model.workspace}/${model.project}`,
            name: model.name || model.project,
            source: 'roboflow' as const,
            description: model.description || `${model.name} model for ${taskType || 'computer vision'}`,
            url: `https://universe.roboflow.com/${model.workspace}/${model.project}`,
            image: model.image || model.thumbnail,
            metrics: {
              mAP: model.map || model.accuracy,
              FPS: 30,
              modelSize: model.size || 'Medium'
            },
            task: mapRoboflowTaskToStandard(model.type),
            author: model.workspace,
            downloads: model.downloads || model.runs || 0,
            frameworks: ['Roboflow', 'TFLite', 'ONNX'],
            platforms: ['mobile', 'web', 'edge'],
            supportsInference: true,
            inferenceEndpoint: `https://serverless.roboflow.com/${model.workspace}/${model.project}/1`
          }
        }
      })
    )

    return modelsWithDetails

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
        
        // Known working models from popular organizations (verified to work with Inference API)
        const knownWorkingModels = [
          'microsoft/resnet-50',
          'microsoft/resnet-18', 
          'microsoft/resnet-152',
          'google/vit-base-patch16-224',
          'google/vit-large-patch16-224',
          'facebook/detr-resnet-50',
          'facebook/detr-resnet-101',
          'openai/clip-vit-base-patch32',
          'openai/clip-vit-large-patch14'
        ]
        
        const isKnownWorking = knownWorkingModels.includes(model.id)
        
        // Balanced approach: prioritize known working models, but allow others with better indicators
        const hasGoodInferenceIndicators = 
          model.library_name === 'transformers' && 
          (model.pipeline_tag === 'image-classification' ||
           model.pipeline_tag === 'zero-shot-image-classification' ||
           model.pipeline_tag === 'object-detection' ||
           model.pipeline_tag === 'image-segmentation') &&
          (model.downloads > 10000 || // Popular models more likely to be hosted
           model.id.startsWith('microsoft/') ||
           model.id.startsWith('google/') ||
           model.id.startsWith('facebook/') ||
           model.id.startsWith('openai/'))
        
        const supportsInference = isKnownWorking || hasGoodInferenceIndicators
        
        return {
          id: model.id,  // ✅ Full model ID (e.g., "roboflow/YOLOv8-Basketball-Detection")
          name: modelName,
          source: 'huggingface' as const,
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
          // Inference API support (live/hosted models)
          supportsInference: supportsInference,
          inferenceEndpoint: supportsInference ? `https://api-inference.huggingface.co/models/${model.id}` : undefined,
          inferenceStatus: supportsInference ? 'live' : 'unavailable',
          isKnownWorking: isKnownWorking // Flag for verified working models
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
 * Save model recommendations to MongoDB
 */
async function saveModelRecommendations(queryId: string, models: any[], classesMap: Record<string, string[]>) {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()
    
    // Map models with classes
    const modelsWithClasses = models.map(model => ({
      name: model.name,
      model_id: model.id,
      source: model.source === 'huggingface' ? 'Hugging Face' : 'Roboflow',
      task: model.task,
      metrics: {
        mAP: model.metrics?.mAP || 0,
        accuracy: model.metrics?.accuracy || 0,
        FPS: model.metrics?.FPS || 0,
        modelSize: model.metrics?.modelSize || 'Unknown'
      },
      url: model.modelUrl,
      selected: false,
      classes: model.classes || (model.id && classesMap[model.id] ? classesMap[model.id] : undefined)
    }))
    
    const recommendationRecord = {
      recommendation_id: `uuid-modelrec-${Date.now()}`,
      query_id: queryId,
      models: modelsWithClasses,
      created_at: new Date().toISOString()
    }
    
    await db.collection('model_recommendations').insertOne(recommendationRecord)
    console.log(`✅ Saved ${modelsWithClasses.length} model recommendations to MongoDB`)
    
  } catch (error) {
    console.error('❌ Failed to save model recommendations:', error)
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
      keywords: analyticsData.keywords || [], // Include search keywords
      task_type: analyticsData.task_type || null, // Include task type
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

