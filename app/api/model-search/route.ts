import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Allow longer execution time for Puppeteer scraping in serverless environments
export const maxDuration = 120; // 120 seconds for Amplify/Vercel
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
 * Create a new background search job in MongoDB
 */
async function createBackgroundJob(queryId: string, keywords: string[], taskType?: string): Promise<string> {
  const { getDatabase } = await import('@/lib/mongodb/connection')
  const db = await getDatabase()

  const jobId = `job-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const ttlExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await db.collection('background_search_jobs').insertOne({
    job_id: jobId,
    query_id: queryId,
    keywords,
    task_type: taskType || 'detection',
    status: 'pending',
    started_at: new Date().toISOString(),
    results_count: 0,
    ttl_expires_at: ttlExpires.toISOString()
  })

  console.log(`✅ Created background job: ${jobId}`)
  return jobId
}

/**
 * Update background job status
 */
async function updateJobStatus(
  jobId: string,
  status: 'running' | 'completed' | 'failed',
  resultsCount?: number,
  error?: string
): Promise<void> {
  const { getDatabase } = await import('@/lib/mongodb/connection')
  const db = await getDatabase()

  const update: any = {
    status,
    ...(status === 'completed' && { completed_at: new Date().toISOString() }),
    ...(resultsCount !== undefined && { results_count: resultsCount }),
    ...(error && { error })
  }

  await db.collection('background_search_jobs').updateOne(
    { job_id: jobId },
    { $set: update }
  )

  console.log(`📝 Updated job ${jobId} status: ${status}`)
}

/**
 * Save background search results to MongoDB
 */
async function saveBackgroundResults(
  jobId: string,
  queryId: string,
  models: any[],
  source: 'huggingface' | 'roboflow'
): Promise<void> {
  const { getDatabase } = await import('@/lib/mongodb/connection')
  const db = await getDatabase()

  const ttlExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await db.collection('background_search_results').insertOne({
    job_id: jobId,
    query_id: queryId,
    models,
    source,
    created_at: new Date().toISOString(),
    ttl_expires_at: ttlExpires.toISOString()
  })

  console.log(`💾 Saved ${models.length} ${source} models to MongoDB for job ${jobId}`)
}

/**
 * Get background search results from MongoDB
 */
async function getBackgroundResults(queryId: string): Promise<{
  status: string,
  models: any[],
  jobId?: string
}> {
  const { getDatabase } = await import('@/lib/mongodb/connection')
  const db = await getDatabase()

  // Get job status
  const job = await db.collection('background_search_jobs').findOne({
    query_id: queryId
  })

  if (!job) {
    return { status: 'not_found', models: [] }
  }

  // If job is completed, get results
  if (job.status === 'completed') {
    const results = await db.collection('background_search_results')
      .find({ query_id: queryId })
      .toArray()

    const allModels = results.flatMap(r => r.models || [])
    console.log(`📦 Retrieved ${allModels.length} background models from MongoDB for query ${queryId}`)
    return { status: 'completed', models: allModels, jobId: job.job_id }
  }

  return { status: job.status, models: [], jobId: job.job_id }
}

/**
 * Determine model type based on classes and pipeline tag
 */
function determineModelType(model: any, classes?: string[]): {
  type: 'custom' | 'generative' | 'unspecified'
  tier: 1 | 2 | 3
  displayLabel: string
  description: string
  taskType: 'object-detection' | 'classification' | 'segmentation' | 'keypoint-detection' | 'captioning' | 'qa' | 'embedding' | 'general'
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
    let taskType: 'object-detection' | 'classification' | 'segmentation' | 'keypoint-detection' | 'captioning' | 'qa' | 'embedding' | 'general' = 'general'
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
    } else if (combinedText.includes('keypoint') ||
      combinedText.includes('key-point') ||
      combinedText.includes('pose') ||
      combinedText.includes('landmark') ||
      pipelineTag.includes('keypoint')) {
      taskType = 'keypoint-detection'
      displayFormat.type = 'bounding-boxes' // Keypoints are typically shown with bounding boxes
      displayFormat.visualization = 'overlay'
      displayFormat.outputType = 'structured'
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
    taskType: 'object-detection' | 'classification' | 'segmentation' | 'keypoint-detection' | 'captioning' | 'qa' | 'embedding' | 'general'
    displayFormat: {
      type: 'bounding-boxes' | 'labels' | 'masks' | 'text' | 'embeddings' | 'general'
      requiresImage: boolean
      requiresText: boolean
      outputType: 'structured' | 'text' | 'numerical'
      visualization: 'overlay' | 'sidebar' | 'modal' | 'inline'
    }
  }
}


import { getValidatedModels, searchValidatedModels, saveRoboflowModelToValidated } from '@/lib/mongodb/validatedModels';
import type { RoboflowModel } from '../../lib/roboflowScraper';

async function searchRoboflowModelsPython(keywords: string[], taskType: string): Promise<NormalizedModel[]> {
  try {
    console.log(`🐍 Starting Roboflow search (Node.js Scraper) for: ${keywords.join(', ')}`)

    // Import the Node.js scraper dynamically
    const { searchRoboflowModelsNode } = await import('../../lib/roboflowScraper');

    // Prepare keywords logic (same as before)
    const genericTerms = new Set(['segmentation', 'segformer', 'image-segmentation', 'detection', 'classification', 'object-detection', 'instance-segmentation'])
    const domainKeywords = keywords.filter(k => !genericTerms.has(k.toLowerCase()))
    const genericKeywords = keywords.filter(k => genericTerms.has(k.toLowerCase()))

    let prioritizedKeywords: string[] = []
    prioritizedKeywords.push(...domainKeywords.slice(0, 2))
    if (!prioritizedKeywords.some(k => k.toLowerCase() === 'model')) {
      prioritizedKeywords.push('model')
    }

    // Add task type keywords
    const keywordsLower = keywords.join(" ").toLowerCase();
    const taskTypeLower = taskType?.toLowerCase() || "";

    const isSegmentationRequest = keywordsLower.includes('segment') || taskTypeLower.includes('segment');
    const isDetectionRequest = (keywordsLower.includes('detect') || taskTypeLower.includes('detect')) && !isSegmentationRequest;
    const isClassificationRequest = (keywordsLower.includes('classif') || taskTypeLower.includes('classif')) && !isDetectionRequest && !isSegmentationRequest;

    if (isSegmentationRequest && !prioritizedKeywords.some(k => k.toLowerCase().includes('instance'))) {
      prioritizedKeywords.push('instance segmentation')
    } else if (isDetectionRequest && !prioritizedKeywords.some(k => k.toLowerCase().includes('object'))) {
      prioritizedKeywords.push('object detection')
    } else if (isClassificationRequest && !prioritizedKeywords.some(k => k.toLowerCase().includes('classification'))) {
      prioritizedKeywords.push('image classification')
    }

    const searchQuery = prioritizedKeywords.slice(0, 5).join(" ");

    // Call the Node.js scraper
    const rawModels = await searchRoboflowModelsNode(searchQuery, 6); // Max 6 models

    if (!rawModels || rawModels.length === 0) {
      console.log("❌ No models found via Node.js scraper");
      return [];
    }

    // Transform results to NormalizedModel format
    // Re-using the logic from the Python response parsing
    // Identify compound keywords (multi-word keywords like "blue bottle", "green bottle")
    const compoundKeywords = domainKeywords.filter(k => k.includes(' ') && k.split(' ').length >= 2)
    const simpleKeywords = domainKeywords.filter(k => !k.includes(' '))
    
    const modelsWithScores = rawModels.map((model: RoboflowModel, index: number) => {
      let relevanceScore = 0
      const modelText = `${model.project_title || ''} ${model.url || ''} ${(model.classes || []).join(' ')}`.toLowerCase()

      // PRIORITY 1: Compound keyword matching (highest priority for specificity)
      compoundKeywords.forEach(compoundKeyword => {
        const lowerCompound = compoundKeyword.toLowerCase()
        const compoundParts = lowerCompound.split(' ')
        
        // Check if model matches the entire compound keyword (exact phrase)
        const exactMatch = modelText.includes(lowerCompound)
        if (exactMatch) {
          // Project title match gets highest score
          if ((model.project_title || '').toLowerCase().includes(lowerCompound)) {
            relevanceScore += 5000 // Very high score for compound match in title
          }
          // URL match gets high score
          else if ((model.url || '').toLowerCase().includes(lowerCompound)) {
            relevanceScore += 4000
          }
          // Class match gets high score
          else if ((model.classes || []).some((c: string) => c.toLowerCase().includes(lowerCompound))) {
            relevanceScore += 4500
          }
          // Generic text match
          else {
            relevanceScore += 2000
          }
        }
        
        // Check if model matches all parts of compound keyword together (even if not exact phrase)
        const allPartsMatch = compoundParts.every(part => 
          modelText.includes(part) && part.length > 2 // Exclude very short words
        )
        if (allPartsMatch && !exactMatch) {
          // Bonus for matching all parts (but less than exact match)
          relevanceScore += 1500
        }
      })

      // PRIORITY 2: Simple domain keyword matches
      simpleKeywords.forEach(keyword => {
        if (modelText.includes(keyword.toLowerCase())) {
          relevanceScore += 100
        }
      })

      // Bonus for matching multiple compound keywords
      const compoundMatchCount = compoundKeywords.filter(compound =>
        modelText.includes(compound.toLowerCase())
      ).length
      relevanceScore += compoundMatchCount * 2000

      if (model.has_model) relevanceScore += 50
      if (model.mAP) relevanceScore += 30

      return { model, relevanceScore, index }
    });

    modelsWithScores.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

    const validModels = modelsWithScores.map(({ model, index }: { model: any, index: number }) => {
      let modelName = model.project_title || model.model_name || "Roboflow Model";
      if (modelName === "Models" || modelName === "N/A" || !modelName) {
        const url = model.url || model.model_url || "";
        const urlMatch = url.match(/\/universe\.roboflow\.com\/[^\/]+\/([^\/]+)\//);
        if (urlMatch && urlMatch[1]) {
          modelName = urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        }
      }

      // Extract model identifier for MongoDB
      const modelIdentifier = model.model_identifier || model.url?.split('/').slice(-2, -1)[0] || 'unknown'

      // Save to MongoDB in background (don't await - fire and forget)
      saveRoboflowModelToValidated(modelIdentifier, {
        name: modelName,
        author: model.author || "Roboflow Universe",
        task_type: taskType,
        api_endpoint: model.api_endpoint || model.model_url,
        classes: model.classes || [],
        tags: model.tags || keywords,
        mAP: model.mAP,
        training_images: model.training_images
      }).catch(err => {
        console.warn(`⚠️ Failed to save Roboflow model ${modelIdentifier} to MongoDB:`, err)
      })

      // Map Roboflow project type to our standardized task types
      let mappedTask = taskType;
      if (model.project_type) {
        const pt = model.project_type.toLowerCase();
        if (pt.includes('instance segmentation')) mappedTask = 'instance-segmentation';
        else if (pt.includes('object detection')) mappedTask = 'object-detection';
        else if (pt.includes('keypoint')) mappedTask = 'keypoint-detection';
        else if (pt.includes('classification')) mappedTask = 'classification';
      }

      return {
        id: `roboflow-${model.model_identifier || 'unknown'}-${Date.now()}-${index}`,
        name: modelName,
        source: "roboflow" as const,
        description: `Roboflow model for ${searchQuery}`,
        url: model.url,
        modelUrl: model.url,
        task: mappedTask,
        author: model.author || "Roboflow Universe",
        downloads: 0,
        tags: model.tags || keywords,
        classes: model.classes || [],
        frameworks: ["Roboflow"],
        platforms: ["web", "mobile"],
        supportsInference: true,
        inferenceEndpoint: model.api_endpoint,
        apiKey: process.env.ROBOFLOW_API_KEY,
        isKnownWorking: true,
        mAP: model.mAP,
        precision: model.precision,
        recall: model.recall,
        trainingImages: model.training_images,
      };
    });

    console.log(`✅ Processed ${validModels.length} Roboflow models from Node.js scraper`);
    return validModels;

  } catch (error) {
    console.error('❌ Error in searchRoboflowModelsNode:', error);
    return [];
  }
}

// ---------------- Helper function to normalize JSON ----------------
function parsePythonJson(jsonString: string, keywords: string[], searchQuery: string, taskType: string) {
  try {
    // First, try to parse as-is
    const modelData = JSON.parse(jsonString);

    // Separate domain-specific keywords from generic ones
    const genericTerms = new Set(['segmentation', 'segformer', 'image-segmentation', 'detection', 'classification', 'object-detection', 'instance-segmentation'])
    const domainKeywords = keywords.filter(k => !genericTerms.has(k.toLowerCase()))

    // Identify compound keywords (multi-word keywords like "blue bottle", "green bottle")
    const compoundKeywords = domainKeywords.filter(k => k.includes(' ') && k.split(' ').length >= 2)
    const simpleKeywords = domainKeywords.filter(k => !k.includes(' '))

    // Calculate relevance score for each model based on domain keyword matches
    interface ModelWithScore {
      model: any
      relevanceScore: number
      index: number
    }

    const modelsWithScores: ModelWithScore[] = modelData.map((model: any, index: number) => {
      let relevanceScore = 0
      const modelText = `${model.project_title || ''} ${model.url || ''} ${(model.classes || []).join(' ')}`.toLowerCase()

      // PRIORITY 1: Compound keyword matching (highest priority for specificity)
      compoundKeywords.forEach(compoundKeyword => {
        const lowerCompound = compoundKeyword.toLowerCase()
        const compoundParts = lowerCompound.split(' ')
        
        // Check if model matches the entire compound keyword (exact phrase)
        const exactMatch = modelText.includes(lowerCompound)
        if (exactMatch) {
          // Project title match gets highest score
          if ((model.project_title || '').toLowerCase().includes(lowerCompound)) {
            relevanceScore += 5000 // Very high score for compound match in title
          }
          // URL match gets high score
          else if ((model.url || '').toLowerCase().includes(lowerCompound)) {
            relevanceScore += 4000
          }
          // Class match gets high score
          else if ((model.classes || []).some((c: string) => c.toLowerCase().includes(lowerCompound))) {
            relevanceScore += 4500
          }
          // Generic text match
          else {
            relevanceScore += 2000
          }
        }
        
        // Check if model matches all parts of compound keyword together (even if not exact phrase)
        const allPartsMatch = compoundParts.every(part => 
          modelText.includes(part) && part.length > 2 // Exclude very short words
        )
        if (allPartsMatch && !exactMatch) {
          // Bonus for matching all parts (but less than exact match)
          relevanceScore += 1500
        }
      })

      // PRIORITY 2: Simple domain keyword matches
      simpleKeywords.forEach(keyword => {
        const lowerKeyword = keyword.toLowerCase()
        if (modelText.includes(lowerKeyword)) {
          // Project title match gets highest score
          if ((model.project_title || '').toLowerCase().includes(lowerKeyword)) {
            relevanceScore += 1000
          }
          // URL match gets high score
          else if ((model.url || '').toLowerCase().includes(lowerKeyword)) {
            relevanceScore += 800
          }
          // Class match gets high score
          else if ((model.classes || []).some((c: string) => c.toLowerCase().includes(lowerKeyword))) {
            relevanceScore += 900
          }
          // Generic text match
          else {
            relevanceScore += 200
          }
        }
      })

      // Bonus for matching multiple compound keywords
      const compoundMatchCount = compoundKeywords.filter(compound =>
        modelText.includes(compound.toLowerCase())
      ).length
      relevanceScore += compoundMatchCount * 2000

      return { model, relevanceScore, index }
    })

    // Sort by relevance score (highest first), then by original index
    modelsWithScores.sort((a: ModelWithScore, b: ModelWithScore) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore
      }
      return a.index - b.index
    })

    console.log(`🎯 Re-ranked models by domain keyword relevance. Top scores:`,
      modelsWithScores.slice(0, 3).map((m: ModelWithScore) => ({
        title: m.model.project_title,
        score: m.relevanceScore
      }))
    )

    return modelsWithScores.map((item: ModelWithScore, index: number) => {
      const model = item.model
      // Extract better name from URL if project_title is generic
      let modelName = model.project_title || model.model_name || "Roboflow Model";
      if (modelName === "Models" || modelName === "N/A" || !modelName) {
        const url = model.url || model.model_url || "";
        const urlMatch = url.match(/\/universe\.roboflow\.com\/[^\/]+\/([^\/]+)\//);
        if (urlMatch && urlMatch[1]) {
          modelName = urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        }
      }

      // Extract model identifier for MongoDB
      const modelIdentifier = model.model_identifier || model.url?.split('/').slice(-2, -1)[0] || 'unknown'

      // Save to MongoDB in background (don't await - fire and forget)
      saveRoboflowModelToValidated(modelIdentifier, {
        name: modelName,
        author: model.author || "Roboflow Universe",
        task_type: taskType,
        api_endpoint: model.api_endpoint || model.model_url,
        classes: model.classes || [],
        tags: model.tags || keywords,
        mAP: model.mAP,
        training_images: model.training_images
      }).catch(err => {
        console.warn(`⚠️ Failed to save Roboflow model ${modelIdentifier} to MongoDB:`, err)
      })

      return {
        id: `roboflow-${model.model_identifier || model.url || model.model_url || 'unknown'}-${Date.now()}-${index}`,
        name: modelName,
        source: "roboflow",
        description: model.description || `Roboflow model for ${searchQuery}`,
        url: model.url || model.model_url || "https://universe.roboflow.com",
        modelUrl: model.url || model.model_url || "https://universe.roboflow.com",
        task: taskType,
        author: model.author || "Roboflow Universe",
        downloads: 0,
        tags: model.tags || keywords,
        classes: model.classes || [],
        frameworks: ["Roboflow"],
        platforms: ["web", "mobile"],
        supportsInference: true,
        inferenceEndpoint: model.api_endpoint || model.model_url,
        apiKey: typeof process !== 'undefined' && process.env ? process.env.ROBOFLOW_API_KEY : undefined,
        isKnownWorking: true,
        mAP: model.mAP,
        precision: model.precision,
        recall: model.recall,
        trainingImages: model.training_images,
      };
    });
  } catch (e) {
    console.error("❌ Failed to parse Python JSON:", e);
    console.log("Raw JSON string preview:", jsonString.slice(0, 500));

    // Try to repair incomplete JSON by extracting complete objects 
    try {

      // Find all complete JSON objects in the string
      const objectMatches = jsonString.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
      if (objectMatches && objectMatches.length > 0) {
        const validModels = [];

        for (const objectStr of objectMatches) {
          try {
            const model = JSON.parse(objectStr);
            // Only include if it has required fields
            if (model.model_identifier || model.model_name) {
              validModels.push(model);
            }
          } catch (objError) {
            console.log("⚠️ Skipping invalid object:", objError);
          }
        }

        if (validModels.length > 0) {

          return validModels.map((model: any, index: number) => ({
            id: `roboflow-${model.model_identifier || model.url || model.model_url || 'unknown'}-${Date.now()}-${index}`,
            name: model.model_name || model.project_title || "Roboflow Model",
            source: "roboflow",
            description: model.description || `Roboflow model for ${searchQuery}`,
            url: model.model_url || model.url || "https://universe.roboflow.com",
            modelUrl: model.model_url || model.url || "https://universe.roboflow.com",
            task: taskType,
            author: model.author || "Roboflow Universe",
            downloads: 0,
            tags: model.tags || keywords,
            classes: model.classes || [],
            frameworks: ["Roboflow"],
            platforms: ["web", "mobile"],
            supportsInference: true,
            inferenceEndpoint: model.api_endpoint || model.model_url,
            apiKey: typeof process !== 'undefined' && process.env ? process.env.ROBOFLOW_API_KEY : undefined,
            isKnownWorking: true,
            mAP: model.mAP,
            precision: model.precision,
            recall: model.recall,
            trainingImages: model.training_images,
          }));
        }
      }

      console.log("❌ Could not repair JSON - no valid objects found");
      return [];

    } catch (repairError) {
      console.error("❌ JSON repair also failed:", repairError);
      return [];
    }
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

    // ✅ STRICT FILTERING: Only Facebook, Microsoft, NVIDIA + Live/Hosted models
    const strictTrustedOrgs = ['facebook/', 'microsoft/', 'nvidia/']

    const workingModels = await db.collection('validated_models')
      .find({
        validated: true,
        works: true,
        workingDate: { $gte: thirtyDaysAgo },
        // Only include HF models from trusted orgs that are live/hosted
        $or: [
          // Roboflow models (always include if validated)
          { model_id: { $regex: /^roboflow/i } },
          // HF models: must be from trusted org AND live/hosted
          {
            model_id: { $regex: new RegExp(`^(${strictTrustedOrgs.map(org => org.replace('/', '\\/')).join('|')})`, 'i') },
            $or: [
              { inferenceStatus: { $in: ['live', 'hosted', 'warm'] } },
              { hosted: true },
              { warm: true },
              { supportsInference: true }
            ]
          }
        ]
      })
      .project({ model_id: 1, workingDate: 1, inferenceStatus: 1, hosted: 1, warm: 1, supportsInference: 1 })
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

/**
 * Apply domain-specific model selection to avoid inappropriate model choices
 */
function applyDomainSpecificSelection(models: any[], keywords: string[], taskType?: string): any[] {
  // Define domain-specific model patterns to avoid
  const domainSpecificModels = {
    medical: ['optic', 'disc', 'cup', 'retina', 'eye', 'medical', 'clinical'],
    automotive: ['car', 'vehicle', 'traffic', 'road', 'street', 'driving'],
    general: ['general', 'generic', 'universal', 'multi', 'any']
  }

  // Determine the domain from keywords
  const keywordText = keywords.join(' ').toLowerCase()
  let detectedDomain = 'general'

  // Check for medical domain indicators
  const medicalIndicators = domainSpecificModels.medical.some(term => keywordText.includes(term))
  const automotiveIndicators = domainSpecificModels.automotive.some(term => keywordText.includes(term))

  if (medicalIndicators && !automotiveIndicators) {
    detectedDomain = 'medical'
  } else if (automotiveIndicators && !medicalIndicators) {
    detectedDomain = 'automotive'
  } else {
    detectedDomain = 'general'
  }

  // Filter out domain-specific models that don't match the detected domain
  return models.filter(model => {
    const modelId = model.id.toLowerCase()
    const modelDescription = (model.description || '').toLowerCase()
    const modelText = `${modelId} ${modelDescription}`

    // If we detected a specific domain, prioritize general models over domain-specific ones
    if (detectedDomain === 'automotive' && domainSpecificModels.medical.some(term => modelText.includes(term))) {
      return false // Exclude medical models for automotive queries
    }

    if (detectedDomain === 'medical' && domainSpecificModels.automotive.some(term => modelText.includes(term))) {
      return false // Exclude automotive models for medical queries
    }

    // For general queries, prefer general-purpose models over domain-specific ones
    if (detectedDomain === 'general') {
      const isMedicalSpecific = domainSpecificModels.medical.some(term => modelText.includes(term))
      const isAutomotiveSpecific = domainSpecificModels.automotive.some(term => modelText.includes(term))

      // Exclude highly specific medical models for general queries
      if (isMedicalSpecific && (modelText.includes('optic') || modelText.includes('disc') || modelText.includes('cup'))) {
        return false
      }

      // Exclude highly specific automotive models for general queries  
      if (isAutomotiveSpecific && (modelText.includes('traffic') || modelText.includes('vehicle'))) {
        return false
      }
    }

    return true
  })
}
async function searchHFModels(
  keywords: string[],
  taskType?: string,
  filterForInference: boolean = true
): Promise<NormalizedModel[]> {
  try {
    // Prioritize domain-specific keywords over generic ones
    // Generic terms that should be deprioritized
    const genericTerms = new Set(['segmentation', 'segformer', 'image-segmentation', 'detection', 'classification', 'object-detection'])

    // Separate domain-specific and generic keywords
    const domainKeywords = keywords.filter(k => !genericTerms.has(k.toLowerCase()))
    const genericKeywords = keywords.filter(k => genericTerms.has(k.toLowerCase()))

    // Prioritize domain-specific keywords (e.g., "soccer", "ball") over generic ones
    // Use up to 3 keywords: first domain-specific, then generic if needed
    const prioritizedKeywords = [
      ...domainKeywords.slice(0, 2), // Up to 2 domain-specific keywords
      ...genericKeywords.slice(0, 1)  // Up to 1 generic keyword
    ].slice(0, 3) // Total max 3 keywords

    // Fallback: if no domain keywords, use first 3 generic keywords
    const searchKeywords = prioritizedKeywords.length > 0
      ? prioritizedKeywords
      : keywords.slice(0, 3)

    const searchQuery = searchKeywords.join('+')

    // Use filter parameter for better API-level filtering
    let url = `https://huggingface.co/api/models?search=${encodeURIComponent(searchQuery)}&sort=downloads&limit=500`

    // Add pipeline_tag filter if we have a specific task type
    const cvPipelineTags = [
      'image-classification',
      'object-detection',
      'image-segmentation',
      'image-to-text',
      'zero-shot-image-classification',
      'zero-shot-object-detection',
      'depth-estimation',
      'image-feature-extraction',
      'mask-generation',
      'keypoint-detection',
      'video-classification'
    ]

    // Enhanced logging for debugging URL generation
    console.log(`🔍 HF Search Keywords:`, {
      original: keywords,
      domainKeywords,
      genericKeywords,
      prioritizedKeywords,
      searchQuery,
      taskType,
      url
    })
    console.log(`🔗 HF Expected URL: ${url}`)
    console.log(`🔍 URL encoding check: '+' replaced with '%2B' ✓`)

    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

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


    // Log sample for debugging
    const sampleModels = data.slice(0, 5).map(m => ({
      id: m.id,
      downloads: m.downloads,
      pipeline_tag: m.pipeline_tag,
      library_name: m.library_name
    }))

    // Known failed models to exclude
    const knownFailedModels = [
      'asadimtiazmalik/my_traffic_dataset_model',
      'rohansaraswat/TrafficSignsDetection',
      'taufeeq28/vehicles',
      'Charansaiponnada/blip-traffic-rr',
      'Charansaiponnada/blip-indian-traffic-captioning',
      'Charansaiponnada/vijayawada-traffic-accessibility-v2-fixed',
      'dima806/traffic_sign_detection',
      'josephlyr/detr-resnet-50_finetuned_road_traffic'
    ]

    // Critical models that should NEVER be filtered out
    const criticalModels = [
      'microsoft/resnet-50',
      'microsoft/resnet-18',
      'microsoft/resnet-152',
      'google/vit-base-patch16-224',
      'google/vit-large-patch16-224',
      'facebook/detr-resnet-50',
      'facebook/detr-resnet-101',
      'microsoft/beit-base-patch16-224',
      'microsoft/beit-large-patch16-224',
      'facebook/convnext-tiny-224',
      'facebook/convnext-base-224',
      'openai/clip-vit-base-patch32',
      'openai/clip-vit-large-patch14'
    ]


    const filteredData = data.filter((model: any) => {
      const modelId = model.id.toLowerCase()
      const modelName = (model.name || '').toLowerCase()
      const modelDescription = (model.description || '').toLowerCase()
      const pipelineTag = model.pipeline_tag
      const tagsArray = model.tags || []

      // ✅ STRICT HF FILTERING: Only Facebook, Microsoft, NVIDIA + Live/Hosted models
      // This prevents API key errors from trying to use non-hosted models
      const strictTrustedOrgs = ['facebook/', 'microsoft/', 'nvidia/']
      const isFromTrustedOrg = strictTrustedOrgs.some(org => modelId.startsWith(org))

      // Check if model is live/hosted (inference: true means it's hosted and ready)
      const isLive = model.inference === true ||
        model.inference === 'live' ||
        model.inferenceStatus === 'live' ||
        (model.model_index && model.model_index.inference === true)

      // For HF models, ONLY include if:
      // 1. From trusted org (Facebook, Microsoft, NVIDIA) AND
      // 2. Is live/hosted (inference: true)
      // This prevents trying to use models that aren't hosted, which causes API key errors
      if (!isFromTrustedOrg) {
        return false
      }

      if (!isLive) {
        return false
      }

      // ✅ KEYWORD RELEVANCE FILTERING - Prioritize models matching search query
      // Separate domain-specific keywords from generic ones
      const genericTerms = new Set(['segmentation', 'segformer', 'image-segmentation', 'detection', 'classification', 'object-detection', 'instance-segmentation', 'model', 'models'])
      const domainKeywords = keywords.filter(k => !genericTerms.has(k.toLowerCase()))
      const genericKeywords = keywords.filter(k => genericTerms.has(k.toLowerCase()))

      const searchKeywords = keywords.map(k => k.toLowerCase())

      // Check for domain keyword matches (most important)
      const hasDomainKeywordMatch = domainKeywords.length > 0 && domainKeywords.some(keyword => {
        const lowerKeyword = keyword.toLowerCase()
        return modelId.includes(lowerKeyword) ||
          modelName.includes(lowerKeyword) ||
          modelDescription.includes(lowerKeyword) ||
          tagsArray.some((tag: string) => tag.toLowerCase().includes(lowerKeyword))
      })

      // Check for any keyword match (including generic)
      const hasRelevantKeywords = searchKeywords.some(keyword =>
        modelId.includes(keyword) ||
        modelName.includes(keyword) ||
        modelDescription.includes(keyword) ||
        tagsArray.some((tag: string) => tag.toLowerCase().includes(keyword))
      )

      // If model doesn't match search keywords and is not critical/trusted, lower priority
      const trustedOrgs = ['microsoft/', 'facebook/', 'meta/', 'google/', 'openai/', 'nvidia/', 'huggingface/']
      const isRelevantToSearch = hasRelevantKeywords ||
        criticalModels.includes(model.id) ||
        trustedOrgs.some(org => model.id.toLowerCase().startsWith(org))

      // ✅ ALWAYS INCLUDE CRITICAL MODELS - NO MATTER WHAT
      if (criticalModels.includes(model.id)) {
        console.log(`✓ Keeping critical model: ${model.id}`)
        return true
      }

      // ✅ EXCLUDE KNOWN FAILED MODELS
      if (knownFailedModels.includes(model.id)) {
        return false
      }

      // ✅ EXCLUDE INAPPROPRIATE CONTENT
      const inappropriateTerms = ['nsfw', 'porn', 'adult', 'explicit', 'sexual', 'nude']
      if (inappropriateTerms.some(term => modelId.includes(term))) {
        return false
      }

      // ✅ TEXT AND SPEECH MODEL EXCLUSIONS - Only if explicitly text/speech
      const textSpeechPipelineTags = [
        'text-classification',
        'token-classification',
        'question-answering',
        'text-generation',
        'text2text-generation',
        'fill-mask',
        'summarization',
        'translation',
        'conversational',
        'text-to-speech',
        'automatic-speech-recognition',
        'audio-classification',
        'audio-to-audio',
        'voice-activity-detection'
      ]

      // Only exclude if pipeline tag is explicitly text/speech
      if (textSpeechPipelineTags.includes(pipelineTag)) {
        return false
      }

      // Text/speech patterns - but ONLY if NO vision indicators present
      const textSpeechPatterns = [
        'bert', 'gpt-2', 'gpt2', 't5-', 'roberta', 'distilbert', 'xlm-roberta',
        'deberta', 'bart-', 'pegasus', 'marian', 'mbart', 'blenderbot',
        'whisper', 'wav2vec', 'hubert', 'opt-', 'bloom-', 'llama'
      ]

      // Vision indicators that override text model exclusion
      const visionIndicators = [
        'vision', 'visual', 'image', 'vit', 'clip', 'resnet', 'detr',
        'swin', 'deit', 'beit', 'convnext', 'yolo', 'detection', 'segmentation'
      ]

      const hasVisionIndicator = visionIndicators.some(indicator =>
        modelId.includes(indicator) ||
        modelName.includes(indicator) ||
        modelDescription.includes(indicator) ||
        tagsArray.some((tag: string) => tag.toLowerCase().includes(indicator))
      )

      // Only exclude text/speech models if they DON'T have vision indicators
      if (!hasVisionIndicator) {
        const isTextSpeechByName = textSpeechPatterns.some(pattern =>
          modelId.includes(pattern)
        )

        if (isTextSpeechByName) {
          return false
        }
      }

      // ✅ COMPUTER VISION MODEL IDENTIFICATION - VERY RELAXED
      const cvPipelineTags = [
        'image-classification',
        'object-detection',
        'image-segmentation',
        'image-to-text',
        'zero-shot-image-classification',
        'zero-shot-object-detection',
        'depth-estimation',
        'image-feature-extraction',
        'mask-generation',
        'keypoint-detection',
        'video-classification',
        'unconditional-image-generation',
        'image-to-image',
        'unknown' // Include unknown pipeline tags - might be CV models
      ]

      const hasCVPipelineTag = cvPipelineTags.includes(pipelineTag)

      // CV architecture keywords - expanded list
      const cvArchitectures = [
        'resnet', 'vit', 'detr', 'yolo', 'efficientnet', 'mobilenet',
        'inception', 'densenet', 'swin', 'convnext', 'deit', 'beit',
        'segformer', 'maskformer', 'mask2former', 'clip', 'dino',
        'detectron', 'rcnn', 'retinanet', 'squeezenet', 'alexnet',
        'vgg', 'googlenet', 'shufflenet', 'nasnet', 'resnext',
        'efficientnetv2', 'regnet', 'tresnet', 'poolformer'
      ]

      // CV task keywords - expanded
      const cvTaskKeywords = [
        'detection', 'detect', 'classify', 'classification', 'segment', 'segmentation',
        'vision', 'visual', 'image', 'photo', 'picture', 'depth',
        'pose', 'keypoint', 'face', 'object', 'scene', 'recognition',
        'recognition', 'localization', 'tracking', 'counting', 'estimation'
      ]

      // Check tags for CV indicators
      const hasCVTag = tagsArray.some((tag: string) => {
        const tagLower = tag.toLowerCase()
        return cvArchitectures.some(arch => tagLower.includes(arch)) ||
          cvTaskKeywords.some(keyword => tagLower.includes(keyword)) ||
          tagLower.includes('image') ||
          tagLower.includes('vision') ||
          tagLower.includes('detection') ||
          tagLower.includes('classification')
      })

      const hasCVArchitecture = cvArchitectures.some(arch => modelId.includes(arch))
      const hasCVTaskKeyword = cvTaskKeywords.some(keyword =>
        modelId.includes(keyword) ||
        modelDescription.includes(keyword) ||
        modelName.includes(keyword)
      )

      // Check if model is computer vision related - VERY PERMISSIVE
      const isComputerVisionModel = hasCVPipelineTag ||
        hasCVArchitecture ||
        hasCVTaskKeyword ||
        hasCVTag ||
        hasVisionIndicator

      // If not CV and not from a trusted org, exclude
      const isTrustedOrg = trustedOrgs.some(org => model.id.toLowerCase().startsWith(org))

      if (!isComputerVisionModel && !isTrustedOrg) {
        return false
      }

      // ✅ STRICT DOMAIN KEYWORD FILTERING - If domain keywords exist (e.g., "soccer", "ball")
      // models MUST match at least one domain keyword to be included (unless trusted/critical)
      if (domainKeywords.length > 0 && !hasDomainKeywordMatch && !isTrustedOrg && !criticalModels.includes(model.id)) {
        // Filter out models that don't match domain keywords
        return false
      }

      // ✅ PRIORITIZE RELEVANT MODELS - If model doesn't match search keywords and is not critical/trusted, 
      // give it lower priority by filtering it out unless it's very high quality
      if (!isRelevantToSearch && !isTrustedOrg && !criticalModels.includes(model.id)) {
        // Only keep non-relevant models if they have very high downloads (popular) or are high quality
        const highDownloads = (model.downloads || 0) > 10000 // Increased threshold
        const highLikes = (model.likes || 0) > 10 // Increased threshold
        const hasInference = Boolean(model.inference || (model.pipeline_tag && model.pipeline_tag !== 'unknown'))

        if (!highDownloads && !highLikes && !hasInference) {
          return false
        }
      }

      // ✅ NO LIBRARY VALIDATION - Accept all libraries for CV models
      // This allows models with 'unknown' library_name to pass through

      // ✅ NO QUALITY FILTERS - Accept all models that made it this far
      // Let popularity/downloads determine ranking, not filtering

      return true
    })


    // Enhanced keyword-based relevance scoring with domain keyword prioritization and compound term matching
    const calculateRelevanceScore = (model: any, searchKeywords: string[]) => {
      let score = 0
      const modelText = `${model.id} ${model.name || ''} ${model.description || ''} ${(model.tags || []).join(' ')}`.toLowerCase()

      // Separate domain keywords from generic ones
      const genericTerms = new Set(['segmentation', 'segformer', 'image-segmentation', 'detection', 'classification', 'object-detection', 'instance-segmentation', 'model', 'models'])
      const domainKeywords = keywords.filter(k => !genericTerms.has(k.toLowerCase()))
      const genericKeywords = keywords.filter(k => genericTerms.has(k.toLowerCase()))

      // Identify compound keywords (multi-word keywords like "blue bottle", "green bottle")
      const compoundKeywords = domainKeywords.filter(k => k.includes(' ') && k.split(' ').length >= 2)
      const simpleKeywords = domainKeywords.filter(k => !k.includes(' '))

      // PRIORITY 1: Compound keyword matching (highest priority for specificity)
      compoundKeywords.forEach(compoundKeyword => {
        const lowerCompound = compoundKeyword.toLowerCase()
        const compoundParts = lowerCompound.split(' ')
        const compoundWeight = 5000 // Very high weight for compound matches
        
        // Check if model matches the entire compound keyword (exact phrase)
        const exactMatch = modelText.includes(lowerCompound)
        if (exactMatch) {
          // Model ID contains exact compound (highest priority)
          if (model.id.toLowerCase().includes(lowerCompound)) {
            score += compoundWeight * 3
          }
          // Model name contains exact compound
          else if ((model.name || '').toLowerCase().includes(lowerCompound)) {
            score += compoundWeight * 2.5
          }
          // Description contains exact compound
          else if ((model.description || '').toLowerCase().includes(lowerCompound)) {
            score += compoundWeight * 2
          }
          // Tags contain exact compound
          else if ((model.tags || []).some((tag: string) => tag.toLowerCase().includes(lowerCompound))) {
            score += compoundWeight * 1.8
          }
          // Generic text match
          else {
            score += compoundWeight
          }
        }
        
        // Check if model matches all parts of compound keyword together (even if not exact phrase)
        const allPartsMatch = compoundParts.every(part => 
          modelText.includes(part) && part.length > 2 // Exclude very short words
        )
        if (allPartsMatch && !exactMatch) {
          // Bonus for matching all parts (but less than exact match)
          score += compoundWeight * 0.8
        }
      })

      // PRIORITY 2: Simple domain keywords (e.g., "soccer", "ball")
      simpleKeywords.forEach(keyword => {
        const lowerKeyword = keyword.toLowerCase()
        const keywordWeight = 2000 // Much higher weight for domain keywords

        // Model ID contains domain keyword (highest priority)
        if (model.id.toLowerCase().includes(lowerKeyword)) {
          score += keywordWeight * 2
        }

        // Model name contains domain keyword
        if ((model.name || '').toLowerCase().includes(lowerKeyword)) {
          score += keywordWeight * 1.5
        }

        // Description contains domain keyword
        if ((model.description || '').toLowerCase().includes(lowerKeyword)) {
          score += keywordWeight
        }

        // Tags contain domain keyword
        if ((model.tags || []).some((tag: string) => tag.toLowerCase().includes(lowerKeyword))) {
          score += keywordWeight * 1.2
        }
      })

      // PRIORITY 3: Generic keywords get lower weight (e.g., "detection", "model")
      genericKeywords.forEach(keyword => {
        const lowerKeyword = keyword.toLowerCase()

        // Model ID contains keyword
        if (model.id.toLowerCase().includes(lowerKeyword)) {
          score += 500
        }

        // Model name contains keyword
        if ((model.name || '').toLowerCase().includes(lowerKeyword)) {
          score += 400
        }

        // Description contains keyword
        if ((model.description || '').toLowerCase().includes(lowerKeyword)) {
          score += 300
        }

        // Tags contain keyword
        if ((model.tags || []).some((tag: string) => tag.toLowerCase().includes(lowerKeyword))) {
          score += 350
        }

        // Pipeline tag relevance
        if (model.pipeline_tag && model.pipeline_tag.toLowerCase().includes(lowerKeyword)) {
          score += 250
        }

        // Word boundary matches (partial but meaningful)
        const regex = new RegExp(`\\b${lowerKeyword}`, 'i')
        if (regex.test(modelText)) {
          score += 100
        }
      })

      // Bonus for matching multiple compound keywords together
      const compoundMatchCount = compoundKeywords.filter(compound =>
        modelText.includes(compound.toLowerCase())
      ).length
      score += compoundMatchCount * 2000 // Very high bonus for multiple compound matches

      // Bonus for multiple domain keyword matches (much higher bonus)
      const domainKeywordMatchCount = domainKeywords.filter(keyword =>
        modelText.includes(keyword.toLowerCase())
      ).length
      score += domainKeywordMatchCount * 500 // High bonus for multiple domain keyword matches

      // Bonus for multiple generic keyword matches (lower bonus)
      const genericKeywordMatchCount = genericKeywords.filter(keyword =>
        modelText.includes(keyword.toLowerCase())
      ).length
      score += genericKeywordMatchCount * 50

      // Penalty for irrelevant terms
      const irrelevantTerms = ['nsfw', 'adult', 'explicit', 'inappropriate', 'offensive', 'hate', 'violence']
      const hasIrrelevant = irrelevantTerms.some(term =>
        modelText.includes(term) && !searchKeywords.some(k => k.toLowerCase().includes(term))
      )
      if (hasIrrelevant) {
        score -= 1000 // Heavy penalty for irrelevant content
      }

      return score
    }

    // Sort by enhanced relevance scoring
    const sortedData = filteredData.sort((a: any, b: any) => {
      const searchKeywords = keywords.map(k => k.toLowerCase())
      const trustedOrgs = ['microsoft/', 'facebook/', 'meta/', 'google/', 'huggingface/', 'openai/', 'nvidia/']

      // Priority 0: Critical models always come first
      const aIsCritical = criticalModels.includes(a.id)
      const bIsCritical = criticalModels.includes(b.id)

      if (aIsCritical && !bIsCritical) return -1
      if (!aIsCritical && bIsCritical) return 1

      // Priority 1: Enhanced relevance scoring
      const aRelevanceScore = calculateRelevanceScore(a, searchKeywords)
      const bRelevanceScore = calculateRelevanceScore(b, searchKeywords)

      if (aRelevanceScore !== bRelevanceScore) {
        return bRelevanceScore - aRelevanceScore
      }

      // Priority 2: Trusted organizations
      const aIsTrusted = trustedOrgs.some(org => a.id.toLowerCase().startsWith(org))
      const bIsTrusted = trustedOrgs.some(org => b.id.toLowerCase().startsWith(org))

      if (aIsTrusted && !bIsTrusted) return -1
      if (!aIsTrusted && bIsTrusted) return 1

      // Priority 3: Downloads (main sorting)
      const downloadDiff = (b.downloads || 0) - (a.downloads || 0)
      if (downloadDiff !== 0) return downloadDiff

      // Priority 4: Has inference endpoint or known pipeline tag
      const aHasInference = Boolean(a.inference || (a.pipeline_tag && a.pipeline_tag !== 'unknown'))
      const bHasInference = Boolean(b.inference || (b.pipeline_tag && b.pipeline_tag !== 'unknown'))

      if (aHasInference && !bHasInference) return -1
      if (!aHasInference && bHasInference) return 1

      // Priority 5: Likes
      return (b.likes || 0) - (a.likes || 0)
    })


    // Log top models
    const topModels = sortedData.slice(0, 10).map(m => ({
      id: m.id,
      downloads: m.downloads,
      pipeline_tag: m.pipeline_tag,
      library: m.library_name
    }))
    console.log(`🏆 Top 10 models:`, topModels)

    return sortedData.map((model: any) => {
      const modelName = model.id.split('/').pop() || model.id
      const author = model.id.split('/')[0] || 'Unknown'
      const pipelineTag = model.pipeline_tag || 'image-classification'

      let cleanDescription = model.description || modelName
      cleanDescription = cleanDescription.replace(/\s+/g, ' ').trim()

      // Check inference support - be more lenient
      const hasTransformersLib = model.library_name === 'transformers'
      const hasEndpointsCompatible = (model.tags || []).includes('endpoints_compatible')
      const hasKnownCVPipeline = ['image-classification', 'object-detection', 'image-segmentation',
        'image-to-text', 'zero-shot-image-classification',
        'zero-shot-object-detection'].includes(pipelineTag)

      // Support inference if it has transformers + known CV pipeline, OR if it's a critical model
      const supportsInference = criticalModels.includes(model.id) ||
        (hasTransformersLib && hasKnownCVPipeline) ||
        (hasTransformersLib && hasEndpointsCompatible) ||
        Boolean(model.inference)

      return {
        id: model.id,
        name: modelName,
        source: 'huggingface' as const,
        description: cleanDescription,
        url: `https://huggingface.co/${model.id}`,
        modelUrl: `https://huggingface.co/${model.id}`,
        thumbnail: `https://huggingface.co/${model.id}/resolve/main/thumbnail.jpg`,
        task: mapHFTaskToStandard(pipelineTag),
        author: author,
        downloads: model.downloads || 0,
        likes: model.likes || 0,
        tags: model.tags || [],
        frameworks: [model.library_name].filter(Boolean),
        platforms: [],
        supportsInference,
        inferenceEndpoint: supportsInference
          ? `https://router.huggingface.co/hf-inference/models/${model.id}`
          : undefined,
        pipelineTag: pipelineTag,
        libraryName: model.library_name
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



function mapHFTaskToStandard(pipelineTag: string): string {
  const taskMap: Record<string, string> = {
    'object-detection': 'detection',
    'image-classification': 'classification',
    'image-segmentation': 'segmentation',
    'zero-shot-image-classification': 'classification',
    'zero-shot-object-detection': 'detection',
    'keypoint-detection': 'keypoint-detection'
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
      const headResponse = await fetch(`https://router.huggingface.co/hf-inference/models/${modelId}`, {
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
      const response = await fetch(`https://router.huggingface.co/hf-inference/models/${modelId}`, {
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
    'keypoint-detection': {
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

    // Deduplicate models by id before saving
    const uniqueModels = new Map<string, NormalizedModel>()
    models.forEach(model => {
      if (model.id && !uniqueModels.has(model.id)) {
        uniqueModels.set(model.id, model)
      }
    })
    const deduplicatedModels = Array.from(uniqueModels.values())

    // Map models to match the existing structure expected by save-model-selection
    const modelsWithClasses = deduplicatedModels.map(model => ({
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

    // Check if recommendation already exists for this query_id
    const existingRecommendation = await db.collection('model_recommendations').findOne({
      query_id: queryId
    })

    if (existingRecommendation) {
      // Update existing recommendation, merging unique models
      const existingModelNames = new Set(existingRecommendation.models?.map((m: any) => m.name) || [])
      const newModels = modelsWithClasses.filter(m => !existingModelNames.has(m.name))

      if (newModels.length > 0) {
        await db.collection('model_recommendations').updateOne(
          { query_id: queryId },
          {
            $set: {
              models: [...(existingRecommendation.models || []), ...newModels],
              updated_at: new Date().toISOString()
            }
          }
        )
        console.log(`✅ Updated model recommendations: added ${newModels.length} new models (total: ${(existingRecommendation.models?.length || 0) + newModels.length})`)
      } else {
        console.log(`ℹ️  No new models to add to existing recommendations for query_id: ${queryId}`)
      }
    } else {
      // Create new recommendation record
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
    }

  } catch (error) {
    console.error('❌ Failed to save model recommendations:', error)
  }
}

/**
 * PHASE 1: Get curated models from validated_models collection
 * Returns proven, working models immediately for instant results
 */
async function getCuratedModels(keywords: string[], limit: number = 20, taskType?: string): Promise<any[]> {
  try {
    console.log(`📚 [getCuratedModels] Starting - keywords: ${keywords.join(' ')}, taskType: ${taskType}, limit: ${limit}`)

    // Priority working models that should always be included
    const priorityModelIds = [
      'facebook/detr-resnet-50',
      'facebook/detr-resnet-101',
      'Falconsai/nsfw_image_detection',
      'microsoft/resnet-50',
      'nvidia/mit-b3',
      'nvidia/segformer-b4-finetuned-cityscapes-1024-1024',
      'nvidia/segformer-b0-finetuned-ade-512-512', // High-quality image segmentation model (391k+ downloads)
      'facebook/mask2former-swin-large-cityscapes-semantic' // State-of-the-art semantic segmentation for cityscapes/traffic scenes
    ]

    console.log(`🔍 [getCuratedModels] Calling searchValidatedModels...`)
    // Get validated models with relevance scoring
    const validatedModels = await searchValidatedModels(keywords, taskType, limit)
    console.log(`📊 [getCuratedModels] searchValidatedModels returned ${validatedModels.length} models`)

    // 🆕 INJECT ALL GEMINI MODELS AS FEATURED MODELS
    const geminiModels = [
      {
        model_id: 'gemini-2.0-flash-exp',
        relevanceScore: 999999, // Highest score to appear first
        name: 'Gemini 2.0 Flash Exp',
        author: 'Google',
        task_type: taskType || 'object-detection',
        pipeline_tag: 'image-analysis',
        validated: true,
        classes: keywords,
        class_count: keywords.length,
        downloads: 1000000,
        likes: 10000,
        tags: ['vision', 'multimodal', 'google', 'gemini', 'detection', 'classification', 'segmentation', 'ultra-fast'],
        library_name: 'google-ai',
        inferenceEndpoint: '/api/gemini-inference',
        inference_endpoint: '/api/gemini-inference',
        supportsInference: true,
        works: true,
        hosted: true,
        inferenceStatus: 'hosted',
        workingDate: new Date()
      },
      {
        model_id: 'gemini-2.5-flash',
        relevanceScore: 999998,
        name: 'Gemini 2.5 Flash',
        author: 'Google',
        task_type: taskType || 'object-detection',
        pipeline_tag: 'image-analysis',
        validated: true,
        classes: keywords,
        class_count: keywords.length,
        downloads: 1000000,
        likes: 10000,
        tags: ['vision', 'multimodal', 'google', 'gemini', 'detection', 'classification', 'segmentation', 'fast'],
        library_name: 'google-ai',
        inferenceEndpoint: '/api/gemini-inference',
        inference_endpoint: '/api/gemini-inference',
        supportsInference: true,
        works: true,
        hosted: true,
        inferenceStatus: 'hosted',
        workingDate: new Date()
      },
      {
        model_id: 'gemini-2.5-flash-lite',
        relevanceScore: 999997,
        name: 'Gemini 2.5 Flash Lite',
        author: 'Google',
        task_type: taskType || 'object-detection',
        pipeline_tag: 'image-analysis',
        validated: true,
        classes: keywords,
        class_count: keywords.length,
        downloads: 1000000,
        likes: 10000,
        tags: ['vision', 'multimodal', 'google', 'gemini', 'detection', 'classification', 'segmentation', 'ultra-fast'],
        library_name: 'google-ai',
        inferenceEndpoint: '/api/gemini-inference',
        inference_endpoint: '/api/gemini-inference',
        supportsInference: true,
        works: true,
        hosted: true,
        inferenceStatus: 'hosted',
        workingDate: new Date()
      },
      {
        model_id: 'gemini-2.5-pro',
        relevanceScore: 999996,
        name: 'Gemini 2.5 Pro',
        author: 'Google',
        task_type: taskType || 'object-detection',
        pipeline_tag: 'image-analysis',
        validated: true,
        classes: keywords,
        class_count: keywords.length,
        downloads: 1000000,
        likes: 10000,
        tags: ['vision', 'multimodal', 'google', 'gemini', 'detection', 'classification', 'segmentation', 'accurate'],
        library_name: 'google-ai',
        inferenceEndpoint: '/api/gemini-inference',
        inference_endpoint: '/api/gemini-inference',
        supportsInference: true,
        works: true,
        hosted: true,
        inferenceStatus: 'hosted',
        workingDate: new Date()
      },
      {
        model_id: 'gemini-3-pro',
        relevanceScore: 999995,
        name: 'Gemini 3 Pro',
        author: 'Google',
        task_type: taskType || 'object-detection',
        pipeline_tag: 'image-analysis',
        validated: true,
        classes: keywords,
        class_count: keywords.length,
        downloads: 1000000,
        likes: 10000,
        tags: ['vision', 'multimodal', 'google', 'gemini', 'detection', 'classification', 'segmentation', 'most-accurate'],
        library_name: 'google-ai',
        inferenceEndpoint: '/api/gemini-inference',
        inference_endpoint: '/api/gemini-inference',
        supportsInference: true,
        works: true,
        hosted: true,
        inferenceStatus: 'hosted',
        workingDate: new Date()
      }
    ]

    // 🆕 INJECT DETR AS SECOND FEATURED MODEL
    const detrModel = {
      model_id: 'facebook/detr-resnet-101',
      relevanceScore: 999998, // Second highest score (appears after Gemini)
      name: 'DETR ResNet-101',
      author: 'Facebook',
      task_type: 'object-detection',
      pipeline_tag: 'object-detection',
      validated: true,
      classes: keywords,
      class_count: keywords.length,
      downloads: 500000,
      likes: 5000,
      tags: ['object-detection', 'transformers', 'facebook', 'detr', 'vision', 'coco'],
      library_name: 'transformers',
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/facebook/detr-resnet-101',
      inference_endpoint: 'https://router.huggingface.co/hf-inference/models/facebook/detr-resnet-101',
      supportsInference: true,
      works: true,
      hosted: true,
      inferenceStatus: 'hosted',
      workingDate: new Date()
    }

    // 🆕 INJECT RESNET-50 AS THIRD FEATURED MODEL (image classification)
    const resnetModel = {
      model_id: 'microsoft/resnet-50',
      relevanceScore: 999997, // Third highest score
      name: 'ResNet-50',
      author: 'Microsoft',
      task_type: 'image-classification',
      pipeline_tag: 'image-classification',
      validated: true,
      classes: keywords,
      class_count: keywords.length,
      downloads: 800000,
      likes: 2000,
      tags: ['image-classification', 'vision', 'microsoft', 'resnet', 'imagenet'],
      library_name: 'transformers',
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/microsoft/resnet-50',
      inference_endpoint: 'https://router.huggingface.co/hf-inference/models/microsoft/resnet-50',
      supportsInference: true,
      works: true,
      hosted: true,
      inferenceStatus: 'hosted',
      workingDate: new Date()
    }
    
    // Prepend all Gemini models, DETR, and ResNet-50 to the validated models list
    const allModels = [...geminiModels, detrModel, resnetModel, ...validatedModels]

    // Convert to the expected format
    const curatedModels = allModels.map(model => {
      // Detect if this is a Roboflow model (check multiple formats)
      const modelIdLower = (model.model_id || '').toLowerCase()
      const isRoboflowModel =
        modelIdLower.startsWith('roboflow/') ||
        modelIdLower.startsWith('roboflow-') ||
        model.library_name === 'roboflow' ||
        (model.inferenceEndpoint && (
          model.inferenceEndpoint.includes('serverless.roboflow.com') ||
          model.inferenceEndpoint.includes('detect.roboflow.com') ||
          model.inferenceEndpoint.includes('segment.roboflow.com')
        )) ||
        // Check if model_id contains roboflow indicators even if not normalized
        (modelIdLower.includes('roboflow') && (
          modelIdLower.includes('soccer') ||
          modelIdLower.includes('ball') ||
          modelIdLower.includes('basketball') ||
          model.inferenceEndpoint?.includes('roboflow.com')
        ));

      // Determine source
      const source = isRoboflowModel ? 'roboflow' : 'huggingface';

      // Handle inference endpoint based on source
      let inferenceEndpoint: string | undefined;
      if (isRoboflowModel) {
        // For Roboflow models, use the endpoint from database
        inferenceEndpoint = model.inferenceEndpoint || model.inference_endpoint;
      } else {
        // For Hugging Face models, use endpoint from database or generate default
        inferenceEndpoint = model.inferenceEndpoint || model.inference_endpoint ||
          (model.supportsInference || model.inferenceStatus === 'hosted' || model.inferenceStatus === 'warm'
            ? `https://router.huggingface.co/hf-inference/models/${model.model_id}`
            : undefined);
      }

      return {
        id: model.model_id,
        name: model.name || model.model_id.split('/').pop() || 'Unknown Model',
        author: model.author || model.model_id.split('/')[0] || 'Unknown',
        task: model.task_type || 'unknown',
        downloads: model.downloads || 0,
        likes: model.likes || 0,
        tags: model.tags || [],
        classes: model.classes || [], // Include classes for debugging and display
        pipeline_tag: model.pipeline_tag || 'unknown',
        library_name: model.library_name || 'unknown',
        inference: model.supportsInference || model.inferenceStatus === 'hosted' || model.inferenceStatus === 'warm',
        // Add required properties for useCVTask hook
        supportsInference: model.supportsInference || model.inferenceStatus === 'hosted' || model.inferenceStatus === 'warm',
        inferenceEndpoint: inferenceEndpoint,
        // Add API key for Roboflow models
        ...(isRoboflowModel && { apiKey: process.env.ROBOFLOW_API_KEY }),
        validated: model.validated || false,
        works: model.works || false,
        workingDate: model.workingDate,
        relevanceScore: model.relevanceScore || 0,
        source: source, // Correctly set source based on model type
        isCurated: true,
        isPriority: priorityModelIds.includes(model.model_id) // Mark priority models
      };
    })

    // Sort: Roboflow models FIRST (highest priority), then priority models, then by relevance score
    curatedModels.sort((a, b) => {
      const aIsRoboflow = a.source === 'roboflow'
      const bIsRoboflow = b.source === 'roboflow'
      const aIsPriority = priorityModelIds.includes(a.id)
      const bIsPriority = priorityModelIds.includes(b.id)

      // PRIORITY 1: Roboflow models always come first (even above priority HF models)
      if (aIsRoboflow && !bIsRoboflow) return -1
      if (!aIsRoboflow && bIsRoboflow) return 1

      // PRIORITY 2: Priority models come after Roboflow
      if (aIsPriority && !bIsPriority) return -1
      if (!aIsPriority && bIsPriority) return 1

      // PRIORITY 3: Sort by relevance score
      return b.relevanceScore - a.relevanceScore
    })


    console.log(`✅ [getCuratedModels] Returning ${curatedModels.length} curated models`)
    return curatedModels

  } catch (error) {
    console.error('🔴 [getCuratedModels] Error fetching curated models:', error)
    console.error('🔴 [getCuratedModels] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('🔴 [getCuratedModels] Returning empty array due to error')
    return []
  }
}

/**
 * Save all models to search_analytics without duplicates
 */
async function saveAllModelsToAnalytics(queryId: string, models: any[], keywords: string[], taskType?: string): Promise<void> {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()

    // Deduplicate models by id before processing
    const uniqueModelsMap = new Map<string, any>()
    models.forEach(model => {
      if (model.id && !uniqueModelsMap.has(model.id)) {
        uniqueModelsMap.set(model.id, model)
      }
    })
    const deduplicatedModels = Array.from(uniqueModelsMap.values())

    // Get existing models for this query to avoid duplicates
    const existingAnalytics = await db.collection('search_analytics').findOne({
      query_id: queryId
    })

    const existingModelIds = new Set()
    if (existingAnalytics && existingAnalytics.all_models) {
      existingAnalytics.all_models.forEach((model: any) => {
        if (model.id) {
          existingModelIds.add(model.id)
        }
      })
    }

    // Filter out duplicate models (those already in database)
    const newModels = deduplicatedModels.filter(model => model.id && !existingModelIds.has(model.id))

    // Merge with existing models if any
    const allModelsToSave = existingAnalytics && existingAnalytics.all_models
      ? [...existingAnalytics.all_models, ...newModels]
      : deduplicatedModels

    // Deduplicate the merged list as well
    const finalUniqueModelsMap = new Map<string, any>()
    allModelsToSave.forEach(model => {
      if (model.id && !finalUniqueModelsMap.has(model.id)) {
        finalUniqueModelsMap.set(model.id, model)
      }
    })
    const finalUniqueModels = Array.from(finalUniqueModelsMap.values())

    // Always save/update the analytics record, even if no new models
    const analyticsData = {
      query_id: queryId,
      query_text: keywords.join(' '),
      keywords: keywords,
      task_type: taskType || 'detection',
      total_models: finalUniqueModels.length,
      new_models: newModels.length,
      all_models: finalUniqueModels, // Save only unique models
      new_models_only: newModels, // Save only new models
      sources: {
        huggingface: finalUniqueModels.filter(m => m.source === 'huggingface' || m.source === 'background').length,
        roboflow: finalUniqueModels.filter(m => m.source === 'roboflow' || m.source === 'background').length,
        total: finalUniqueModels.length
      }
    }

    // Update or insert analytics record
    await db.collection('search_analytics').updateOne(
      { query_id: queryId },
      {
        $set: {
          ...analyticsData,
          updated_at: new Date().toISOString()
        },
        $setOnInsert: { created_at: new Date().toISOString() }
      },
      { upsert: true }
    )

    if (newModels.length > 0) {
      console.log(`✅ Saved ${newModels.length} new models to analytics (total unique: ${finalUniqueModels.length})`)
    }

  } catch (error) {
    console.error('❌ Failed to save models to analytics:', error)
  }
}

/**
 * PHASE 1: Start background search for additional models
 * Runs in parallel and saves results to MongoDB when complete
 */
async function startBackgroundSearch(keywords: string[], queryId: string, jobId: string, taskType?: string): Promise<void> {
  try {
    console.log(`🔄 Starting background search for job: ${jobId}`)

    // Update job status to running
    await updateJobStatus(jobId, 'running')

    const startTime = Date.now()

    // Search Hugging Face models
    const hfPromise = searchHFModels(keywords, taskType, false)
      .then(async (models) => {
        if (models.length > 0) {
          await saveBackgroundResults(jobId, queryId, models, 'huggingface')
          console.log(`✅ Saved ${models.length} HF models to MongoDB`)
        }
        return models
      })
      .catch(error => {
        console.error('❌ HF search failed:', error)
        return []
      })

    // Search Roboflow models
    const rfPromise = searchRoboflowModelsPython(keywords, taskType || 'object-detection')
      .then(async (models) => {
        if (models.length > 0) {
          await saveBackgroundResults(jobId, queryId, models, 'roboflow')
          console.log(`✅ Saved ${models.length} Roboflow models to MongoDB`)
        }
        return models
      })
      .catch(error => {
        console.error('❌ Roboflow search failed:', error)
        return []
      })

    // Wait for both searches to complete
    const [hfModels, rfModels] = await Promise.all([hfPromise, rfPromise])

    const totalModels = hfModels.length + rfModels.length
    const duration = Date.now() - startTime

    console.log(`✅ Background search completed in ${duration}ms: ${hfModels.length} HF + ${rfModels.length} RF models`)

    // Update job status to completed
    await updateJobStatus(jobId, 'completed', totalModels)

    // Save to analytics
    const allBackgroundModels = [...rfModels, ...hfModels].map(model => ({
      ...model,
      isCurated: false
    }))

    await saveAllModelsToAnalytics(queryId, allBackgroundModels, keywords, taskType)

  } catch (error) {
    console.error('❌ Background search failed:', error)
    await updateJobStatus(jobId, 'failed', 0, error instanceof Error ? error.message : 'Unknown error')
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

    // Create a cache key based on search parameters (no time window for simplicity)
    const cacheKey = `search-${keywords.join('-')}-${task_type}`

    console.log(`🔑 Cache key: ${cacheKey}`)

    let allModels: any[] = []

    // Check if we should search or use cached results
    const shouldSearch = page === 1 // Only search on first page
    const searchKeywords = keywords.join(' ')

    if (shouldSearch) {
      // STEP 1: Get curated models from database (if any)
      let curatedModels: any[] = []
      try {
        curatedModels = await getCuratedModels(keywords, 20, task_type)
      } catch (error) {
        console.error('Failed to load curated models:', error)
        curatedModels = []
      }

      // Start with curated models
      allModels = curatedModels

      // STEP 2: Search HuggingFace immediately
      try {
        const hfModels = await searchHFModels(keywords, task_type, false)
        
        // Merge with curated models, avoiding duplicates
        const existingIds = new Set(allModels.map(m => m.id))
        const newHfModels = hfModels.filter(m => m.id && !existingIds.has(m.id))
        allModels = [...allModels, ...newHfModels]
      } catch (error) {
        console.error('HuggingFace search failed:', error)
      }

      // STEP 3: Roboflow search disabled to prevent 504 timeout
      // DISABLED:       // STEP 3: Search Roboflow immediately
      // DISABLED:       try {
      // DISABLED:         const rfModels = await searchRoboflowModelsPython(keywords, task_type || 'object-detection')
      // DISABLED:         
      // DISABLED:         // Merge with existing models, avoiding duplicates
      // DISABLED:         const existingIds = new Set(allModels.map(m => m.id))
      // DISABLED:         const newRfModels = rfModels.filter(m => m.id && !existingIds.has(m.id))
      // DISABLED:         allModels = [...allModels, ...newRfModels]
      // DISABLED:       } catch (error) {
      // DISABLED:         console.error('Roboflow search failed:', error)
      // DISABLED:       }

      // Save all models to analytics
      if (allModels.length > 0) {
        await saveAllModelsToAnalytics(queryId, allModels, keywords, task_type)
      }
    }


    // Final deduplication pass before pagination
    const finalUniqueModelsMap = new Map<string, any>()
    allModels.forEach(model => {
      if (model.id && !finalUniqueModelsMap.has(model.id)) {
        finalUniqueModelsMap.set(model.id, model)
      }
    })
    allModels = Array.from(finalUniqueModelsMap.values())

    // Apply pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedModels = allModels.slice(startIndex, endIndex)
    console.log(`📄 Paginated models: ${paginatedModels.length} (start: ${startIndex}, end: ${endIndex})`)

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
        total_results: allModels.length,
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
        total: allModels.length,
        totalPages: Math.ceil(allModels.length / limit),
        hasNextPage: endIndex < allModels.length,
        hasPrevPage: page > 1
      },
      queryId,
      timestamp: new Date().toISOString(),
      sources: {
        curated: allModels.filter(m => m.isCurated).length,
        huggingface: allModels.filter(m => m.source === 'huggingface').length,
        roboflow: allModels.filter(m => m.source === 'roboflow').length,
        total: allModels.length
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('❌ Model search error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

