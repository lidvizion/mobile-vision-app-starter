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

// REMOVED: First POST function - keeping only the updated one below

/**
 * Search Roboflow Universe
 * GET https://universe.roboflow.com/search?query=<query>&tasks=object-detection
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
 * Filter out models that we know have failed in the past
 */
async function filterOutKnownFailedModels(models: any[]): Promise<any[]> {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()
    
    // Get list of models that have failed recently (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const failedModels = await db.collection('validated_models')
      .find({ 
        validated: false, 
        works: false,
        checked_at: { $gte: thirtyDaysAgo }
      })
      .project({ model_id: 1 })
      .toArray()
    
    const failedModelIds = new Set(failedModels.map(m => m.model_id))
    
    const filteredModels = models.filter(model => !failedModelIds.has(model.id))
    
    if (failedModelIds.size > 0) {
      console.log(`🚫 Filtered out ${failedModelIds.size} known failed models`)
    }
    
    return filteredModels
  } catch (error) {
    console.error('Error filtering failed models:', error)
    return models // Return original list if filtering fails
  }
}

/**
 * Prioritize models that we know are working from our database
 */
async function addTrustedModels(models: any[], keywords: string[]): Promise<any[]> {
  try {
    // Check if search is detection-related
    const searchText = keywords.join(' ').toLowerCase()
    const isDetectionSearch = searchText.includes('detection') || 
                             searchText.includes('detect') ||
                             searchText.includes('object') ||
                             searchText.includes('classification') ||
                             searchText.includes('recognition') ||
                             searchText.includes('bounding') ||
                             searchText.includes('localization') ||
                             searchText.includes('vehicles') ||
                             searchText.includes('traffic') ||
                             searchText.includes('basketball') ||
                             searchText.includes('sports')
    
    // Always include trusted models for any search
    console.log(`🔍 Search text: "${searchText}", isDetectionSearch: ${isDetectionSearch}`)
    
    // Trusted organization models - prioritize detection models for detection searches
    const trustedModels = isDetectionSearch ? [
      // Detection models first for detection searches
      {
        id: 'facebook/detr-resnet-50',
        downloads: 5000000,
        inference: true,
        library_name: 'transformers',
        pipeline_tag: 'object-detection',
        description: 'Facebook DETR - state-of-the-art object detection model',
        tags: ['facebook', 'detr', 'object-detection', 'detection']
      },
      {
        id: 'facebook/detr-resnet-101',
        downloads: 2000000,
        inference: true,
        library_name: 'transformers',
        pipeline_tag: 'object-detection',
        description: 'Facebook DETR ResNet-101 - high accuracy object detection',
        tags: ['facebook', 'detr', 'object-detection', 'detection']
      },
      {
        id: 'microsoft/table-transformer-detection',
        downloads: 1946640,
        inference: true,
        library_name: 'transformers',
        pipeline_tag: 'object-detection',
        description: 'Microsoft Table Transformer - specialized object detection model',
        tags: ['microsoft', 'object-detection', 'table', 'detection']
      },
      // Classification models as fallback
      {
        id: 'microsoft/resnet-50',
        downloads: 10000000,
        inference: true,
        library_name: 'transformers',
        pipeline_tag: 'image-classification',
        description: 'Microsoft ResNet-50 - excellent for object detection and classification',
        tags: ['microsoft', 'resnet', 'image-classification', 'object-detection']
      }
    ] : [
      // Classification models first for non-detection searches
      {
        id: 'microsoft/resnet-50',
        downloads: 10000000,
        inference: true,
        library_name: 'transformers',
        pipeline_tag: 'image-classification',
        description: 'Microsoft ResNet-50 - excellent for object detection and classification',
        tags: ['microsoft', 'resnet', 'image-classification', 'object-detection']
      },
      {
        id: 'facebook/detr-resnet-50',
        downloads: 5000000,
        inference: true,
        library_name: 'transformers',
        pipeline_tag: 'object-detection',
        description: 'Facebook DETR - state-of-the-art object detection model',
        tags: ['facebook', 'detr', 'object-detection', 'detection']
      }
    ]
    
    // Add trusted models that aren't already in the list
    const existingIds = new Set(models.map(m => m.id))
    const newTrustedModels = trustedModels.filter(m => !existingIds.has(m.id))
    
    if (newTrustedModels.length > 0) {
      console.log(`✅ Added ${newTrustedModels.length} trusted organization models`)
      return [...models, ...newTrustedModels]
    }
    
    return models
  } catch (error) {
    console.error('Error adding trusted models:', error)
    return models
  }
}

async function prioritizeKnownWorkingModels(models: any[]): Promise<any[]> {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()
    
    // Get list of models that are confirmed working (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const workingModels = await db.collection('validated_models')
      .find({ 
        validated: true, 
        works: true,
        workingDate: { $gte: thirtyDaysAgo }
      })
      .project({ model_id: 1, workingDate: 1 })
      .toArray()
    
    const workingModelIds = new Set(workingModels.map(m => m.model_id))
    
    // Sort: Working models first, then by original order
    const sortedModels = models.sort((a, b) => {
      const aIsWorking = workingModelIds.has(a.id)
      const bIsWorking = workingModelIds.has(b.id)
      
      if (aIsWorking && !bIsWorking) return -1
      if (!aIsWorking && bIsWorking) return 1
      return 0 // Keep original order for same type
    })
    
    if (workingModelIds.size > 0) {
      console.log(`✅ Prioritized ${workingModelIds.size} known working models`)
    }
    
    return sortedModels
  } catch (error) {
    console.error('Error prioritizing working models:', error)
    return models // Return original list if prioritization fails
  }
}

/**
 * Search Hugging Face Hub
 * 
 * Endpoint: GET https://huggingface.co/api/models?search=<query>
 * Example: curl -H "Authorization: Bearer $HF_TOKEN" \
 *   "https://huggingface.co/api/models?search=object-detection"
 * 
 * Response:
 * [
 *   {
 *     "id": "roboflow/YOLOv8-Object-Detection",
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
    // Simple search query construction
    const searchQuery = keywords.slice(0, 2).join('+') // Use first 2 keywords
    
    const url = `https://huggingface.co/api/models?search=${encodeURIComponent(searchQuery)}&sort=downloads&limit=500`
    
    console.log(`🔍 HF Search:`, {
      keywords,
      searchQuery,
      url
    })
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }
    
    // Authorization is optional - API works without token but has rate limits
    const apiKey = process.env.HUGGINGFACE_API_KEY
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    console.log('🔍 Searching Hugging Face:', searchQuery)
    const response = await fetch(url, { headers })
    
    if (!response.ok) {
      console.error('❌ HF API error:', response.status, response.statusText)
      return []
    }

    const data = await response.json()
    
    if (!Array.isArray(data)) {
      console.error('Unexpected HF API response format')
      return []
    }

    console.log(`✅ Found ${data.length} total models on Hugging Face`)

    // Log some sample models for debugging
    const sampleModels = data.slice(0, 10).map(m => ({
      id: m.id,
      downloads: m.downloads,
      inference: m.inference,
      library_name: m.library_name,
      pipeline_tag: m.pipeline_tag
    }))
    console.log(`📊 Sample models (first 10):`, sampleModels)
    
    // Count models by inference status
    const inferenceStats = data.reduce((acc, model) => {
      const status = model.inference || 'undefined'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})
    console.log(`📈 Inference status breakdown:`, inferenceStats)

    // Define known working models for reference
    const verifiedWorkingModels = [
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

    const filteredData = data
      .filter((model: any) => {
        // ✅ EXCLUDE INAPPROPRIATE CONTENT
        const modelId = model.id.toLowerCase()
        const inappropriateTerms = ['nsfw', 'porn', 'adult', 'explicit', 'sexual', 'nude']
        const hasInappropriateContent = inappropriateTerms.some(term => 
          modelId.includes(term)
        )
        
        if (hasInappropriateContent) {
          return false
        }
        
        // ✅ INTELLIGENT FILTERING: Prioritize Microsoft/Facebook models + good general models + specialized models
        const hasTransformersLibrary = model.library_name === 'transformers'
        const hasEndpointsCompatible = (model.tags || []).includes('endpoints_compatible')
        const hasInferenceSupport = model.inference === true || model.inference === 'hosted' || model.inference === 'warm' || hasEndpointsCompatible
        
        // Check if model is from trusted organizations (Microsoft, Facebook/Meta, Google, etc.)
        const isTrustedOrganization = model.id.toLowerCase().includes('microsoft/') ||
                                     model.id.toLowerCase().includes('facebook/') ||
                                     model.id.toLowerCase().includes('meta/') ||
                                     model.id.toLowerCase().includes('google/') ||
                                     model.id.toLowerCase().includes('huggingface/') ||
                                     model.id.toLowerCase().includes('openai/')
        
        // Check if model is relevant to search keywords
        const searchKeywords = keywords.map(k => k.toLowerCase())
        const modelText = `${model.id} ${model.description || ''}`.toLowerCase()
        const isRelevantToSearch = searchKeywords.some(keyword => 
          modelText.includes(keyword) || 
          (keyword === 'detection' && modelText.includes('detect')) ||
          (keyword === 'classification' && modelText.includes('classify'))
        )
        
        // Different thresholds based on relevance and model type
        const hasHighDownloads = (model.downloads || 0) >= 50000 // High threshold for general models
        const hasReasonableDownloads = (model.downloads || 0) >= 1000 // Medium threshold
        const hasAnyDownloads = (model.downloads || 0) >= 1 // Low threshold for specialized models
        
        // Show models if they meet any of these criteria:
        // 1. Trusted organization models (Microsoft, Facebook, etc.) - ALWAYS include
        // 2. High downloads + transformers
        // 3. Relevant to search + reasonable downloads + transformers  
        // 4. Relevant to search + any downloads + transformers (for specialized models)
        return hasTransformersLibrary && (
          isTrustedOrganization ||
          (hasHighDownloads) ||
          (isRelevantToSearch && hasReasonableDownloads) ||
          (isRelevantToSearch && hasAnyDownloads)
        )
      })
      // Sort: Trusted organizations first, then known working models, then by downloads
      .sort((a: any, b: any) => {
        const aIsWorking = verifiedWorkingModels.includes(a.id)
        const bIsWorking = verifiedWorkingModels.includes(b.id)
        
        // Check if models are from trusted organizations
        const aIsTrusted = a.id.toLowerCase().includes('microsoft/') ||
                          a.id.toLowerCase().includes('facebook/') ||
                          a.id.toLowerCase().includes('meta/') ||
                          a.id.toLowerCase().includes('google/') ||
                          a.id.toLowerCase().includes('huggingface/') ||
                          a.id.toLowerCase().includes('openai/')
        
        const bIsTrusted = b.id.toLowerCase().includes('microsoft/') ||
                          b.id.toLowerCase().includes('facebook/') ||
                          b.id.toLowerCase().includes('meta/') ||
                          b.id.toLowerCase().includes('google/') ||
                          b.id.toLowerCase().includes('huggingface/') ||
                          b.id.toLowerCase().includes('openai/')
        
        // Priority 1: Trusted organization models first
        if (aIsTrusted && !bIsTrusted) return -1
        if (!aIsTrusted && bIsTrusted) return 1
        
        // Priority 2: Known working models second
        if (aIsWorking && !bIsWorking) return -1
        if (!aIsWorking && bIsWorking) return 1
        
        // Priority 3: Among same type, sort by downloads (highest first)
        const downloadDiff = b.downloads - a.downloads
        if (downloadDiff !== 0) return downloadDiff
        
        // Priority 4: If downloads are equal, sort by likes (highest first)
        return (b.likes || 0) - (a.likes || 0)
      })
    
    console.log(`🎯 Filtered to ${filteredData.length} CV models using intelligent filtering (trusted orgs + high downloads + relevant specialized models)`)
    
    // Log top filtered models for debugging
    const topFiltered = filteredData.slice(0, 5).map(m => ({
      id: m.id,
      downloads: m.downloads,
      inference: m.inference,
      isKnownWorking: verifiedWorkingModels.includes(m.id)
    }))
    console.log(`🏆 Top filtered models:`, topFiltered)
    
    // Add trusted models if search is detection-related
    const trustedEnhancedData = await addTrustedModels(filteredData, keywords)
    
    // Additional validation: Check against our MongoDB database of failed models
    const validatedData = await filterOutKnownFailedModels(trustedEnhancedData)
    
    // Re-sort after adding trusted models to ensure they appear first
    const reSortedData = validatedData.sort((a: any, b: any) => {
      const aIsWorking = verifiedWorkingModels.includes(a.id)
      const bIsWorking = verifiedWorkingModels.includes(b.id)
      
      // Check if models are from trusted organizations
      const aIsTrusted = a.id.toLowerCase().includes('microsoft/') ||
                        a.id.toLowerCase().includes('facebook/') ||
                        a.id.toLowerCase().includes('meta/') ||
                        a.id.toLowerCase().includes('google/') ||
                        a.id.toLowerCase().includes('huggingface/') ||
                        a.id.toLowerCase().includes('openai/')
      
      const bIsTrusted = b.id.toLowerCase().includes('microsoft/') ||
                        b.id.toLowerCase().includes('facebook/') ||
                        b.id.toLowerCase().includes('meta/') ||
                        b.id.toLowerCase().includes('google/') ||
                        b.id.toLowerCase().includes('huggingface/') ||
                        b.id.toLowerCase().includes('openai/')
      
      // Check if search is detection-related
      const searchText = keywords.join(' ').toLowerCase()
      const isDetectionSearch = searchText.includes('detection') || 
                               searchText.includes('detect') ||
                               searchText.includes('object') ||
                               searchText.includes('vehicles') ||
                               searchText.includes('traffic') ||
                               searchText.includes('basketball') ||
                               searchText.includes('sports')
      
      // Priority 1: For detection searches, prioritize detection models
      if (isDetectionSearch) {
        const aIsDetection = a.pipeline_tag === 'object-detection' || a.task === 'detection'
        const bIsDetection = b.pipeline_tag === 'object-detection' || b.task === 'detection'
        
        if (aIsDetection && !bIsDetection) return -1
        if (!aIsDetection && bIsDetection) return 1
      }
      
      // Priority 2: Trusted organization models
      if (aIsTrusted && !bIsTrusted) return -1
      if (!aIsTrusted && bIsTrusted) return 1
      
      // Priority 3: Known working models
      if (aIsWorking && !bIsWorking) return -1
      if (!aIsWorking && bIsWorking) return 1
      
      // Priority 4: Among same type, sort by downloads (highest first)
      const downloadDiff = b.downloads - a.downloads
      if (downloadDiff !== 0) return downloadDiff
      
      // Priority 5: If downloads are equal, sort by likes (highest first)
      return (b.likes || 0) - (a.likes || 0)
    })
    
    // Boost models that we know are working from our database
    const prioritizedData = await prioritizeKnownWorkingModels(reSortedData)
    
    console.log(`✅ Final result: ${prioritizedData.length} validated CV models`)
    
    return prioritizedData
      .map((model: any) => {
        const modelName = model.id.split('/').pop() || model.id
        const author = model.id.split('/')[0] || 'Unknown'
        const pipelineTag = model.pipeline_tag || 'object-detection'
        const taskType = mapPipelineTagToTaskType(pipelineTag)
        let cleanDescription = model.description || ''
        
        // Clean up any double spaces or trailing/leading spaces
        cleanDescription = cleanDescription.replace(/\s+/g, ' ').trim()
        
        // Mark models based on known working status
        
        const isKnownWorking = verifiedWorkingModels.includes(model.id)
        // More permissive inference support detection for transformers models
        const hasEndpointsCompatible = (model.tags || []).includes('endpoints_compatible')
        const hasExplicitInference = model.inference === true || model.inference === 'hosted' || model.inference === 'warm'
        const isTransformersModel = model.library_name === 'transformers'
        
        // For transformers models, assume they support inference unless explicitly marked otherwise
        const supportsInference = hasExplicitInference || hasEndpointsCompatible || (isTransformersModel && model.inference !== false)
        
        // Enhanced model type determination for better categorization
        const modelTypeInfo = determineModelType(model, model.classes)
        
        return {
          id: model.id,
          name: modelName,
          source: 'huggingface' as const,
          description: cleanDescription || modelName,
          url: `https://huggingface.co/${model.id}`,
          modelUrl: `https://huggingface.co/${model.id}`,
          thumbnail: `https://huggingface.co/${model.id}/resolve/main/thumbnail.jpg`,
          task: mapHFTaskToStandard(pipelineTag),
          author: author,
          downloads: model.downloads || 0,
          likes: model.likes || 0,
          tags: model.tags || [],
          frameworks: [],
          platforms: [],
          supportsInference,
          isKnownWorking,
          inferenceEndpoint: `https://api-inference.huggingface.co/models/${model.id}`,
          // Enhanced model type information for better categorization
          modelType: modelTypeInfo.type,
          modelTypeInfo: modelTypeInfo
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
 * Background validation function (runs in parallel, doesn't block user)
 */
async function validateModelsInBackground(models: any[]): Promise<void> {
  console.log(`🧪 Background validation starting for ${models.length} models...`)
  
  const { markModelAsValidated } = await import('@/lib/mongodb/validatedModels')
  
  // Validate models in parallel (like the optimized Python script)
  const validationPromises = models.map(async (model) => {
    try {
      const modelId = model.id
      const taskType = model.task || model.pipeline_tag || 'unknown'
      
      // Quick warmup precheck
      const headResponse = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
        method: 'HEAD',
        headers: { 'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}` },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      
      if (!headResponse.ok) {
        // Endpoint not available
        await markModelAsValidated(modelId, false, `Endpoint not available (${headResponse.status})`)
        return
      }
      
      // Try actual inference
      const testInputs = getTestInputForTask(taskType)
      const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testInputs),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      })
      
      if (response.ok) {
        const result = await response.json()
        await markModelAsValidated(modelId, true, result, {
          task_type: taskType,
          downloads: model.downloads,
          likes: model.likes,
          tags: model.tags,
          hosted: true,
          warm: false,
          inferenceStatus: 'hosted'
        })
        console.log(`✅ Background validated: ${modelId}`)
      } else {
        const errorText = await response.text()
        await markModelAsValidated(modelId, false, errorText)
        console.log(`❌ Background failed: ${modelId} (${response.status})`)
      }
      
    } catch (error) {
      console.error(`❌ Background validation error for ${model.id}:`, error)
      await markModelAsValidated(model.id, false, (error as Error).message)
    }
  })
  
  // Wait for all validations to complete
  await Promise.allSettled(validationPromises)
  console.log(`🧪 Background validation completed for ${models.length} models`)
}

/**
 * Get test input for task type
 */
function getTestInputForTask(taskType: string): any {
  const testInputs = {
    'image-classification': {
      inputs: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      parameters: { top_k: 5 }
    },
    'object-detection': {
      inputs: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      parameters: { threshold: 0.5 }
    },
    'fill-mask': {
      inputs: 'The capital of France is [MASK].',
      parameters: {}
    },
    'feature-extraction': {
      inputs: 'This is a sample text for feature extraction.',
      parameters: {}
    },
    'text-generation': {
      inputs: 'The future of AI is',
      parameters: { max_length: 50 }
    }
  }
  
  return testInputs[taskType as keyof typeof testInputs] || testInputs['image-classification']
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

/**
 * Save model recommendations to MongoDB (matches existing structure from save-model-selection)
 */
async function saveModelRecommendations(queryId: string, models: NormalizedModel[], keywords: string[], taskType?: string): Promise<void> {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()
    
    // Map models to match the existing structure expected by save-model-selection
    const modelsWithClasses = models.map(model => ({
      name: model.name,
      source: model.source === 'huggingface' ? 'Hugging Face' : 'Roboflow',
      task: model.task,
      url: model.modelUrl,
      selected: false, // Will be updated when user selects a model
      classes: model.classes || undefined,
      // Additional metadata for analytics
      downloads: model.downloads,
      likes: model.likes || 0,
      tags: model.tags || [],
      supportsInference: model.supportsInference,
      inferenceStatus: model.inferenceStatus,
      isKnownWorking: model.isKnownWorking
    }))
    
    // Use the same structure as expected by save-model-selection API
    const recommendationRecord = {
      recommendation_id: `uuid-modelrec-${Date.now()}`,
      query_id: queryId,
      query_text: keywords.join(' '),
      keywords: keywords,
      task_type: taskType || 'detection',
      models: modelsWithClasses,
      created_at: new Date().toISOString()
    }
    
    await db.collection('model_recommendations').insertOne(recommendationRecord)
    console.log(`✅ Saved ${modelsWithClasses.length} model recommendations to MongoDB`)
    
  } catch (error) {
    console.error('❌ Failed to save model recommendations:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keywords, task_type, limit = 20, page = 1 } = body as ModelSearchRequest
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords array is required' },
        { status: 400 }
      )
    }
    
    console.log(`🔍 Model search request:`, { keywords, task_type, limit, page })
    
    // Generate unique query ID for tracking
    const queryId = `uuid-query-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    
    // Search Hugging Face models
    const huggingFaceModels = await searchHFModels(keywords, task_type, true)
    
    console.log(`📊 Found ${huggingFaceModels.length} Hugging Face models`)
    
    // Apply pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedModels = huggingFaceModels.slice(startIndex, endIndex)
    
    // Save model recommendations to MongoDB (background task)
    if (paginatedModels.length > 0) {
      saveModelRecommendations(queryId, paginatedModels, keywords, task_type).catch(err => 
        console.error('Background recommendation save error:', err)
      )
    }
    
    // Save search analytics
    try {
      const { getDatabase } = await import('@/lib/mongodb/connection')
      const db = await getDatabase()
      
      const searchRecord = {
        query_id: queryId,
        user_id: 'anonymous', // TODO: Get from auth when available
        query_text: keywords.join(' '),
        keywords: keywords,
        task_type: task_type || 'detection',
        total_results: huggingFaceModels.length,
        returned_results: paginatedModels.length,
        page: page,
        limit: limit,
        created_at: new Date().toISOString()
      }
      
      await db.collection('search_cache').insertOne(searchRecord)
      console.log(`✅ Saved search analytics to MongoDB`)
      
    } catch (error) {
      console.error('Search analytics save error:', error)
    }
    
    return NextResponse.json({
      success: true,
      models: paginatedModels,
      pagination: {
        page,
        limit,
        total: huggingFaceModels.length,
        totalPages: Math.ceil(huggingFaceModels.length / limit),
        hasNextPage: endIndex < huggingFaceModels.length,
        hasPrevPage: page > 1
      },
      queryId,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Model search error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

