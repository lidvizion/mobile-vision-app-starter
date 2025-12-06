import { getDatabase } from './connection'

/**
 * Interface for validated models stored in MongoDB.
 * These are models that have been tested and confirmed to work with the HF Inference API 
 */
export interface ValidatedModel {
  model_id: string
  name: string
  author: string
  task_type: string
  pipeline_tag?: string
  validated: boolean
  classes?: string[]
  class_count: number
  downloads: number
  likes: number
  tags?: string[]
  library_name?: string
  inference_endpoint?: string
  inferenceEndpoint?: string  // Alternative naming convention
  supportsInference?: boolean  // Whether model supports inference
  sample_output?: any[]
  checked_at: string
  last_modified?: string
  works_with_dataurl?: boolean
  error?: string
  // 🆕 NEW FIELDS for better filtering
  works?: boolean  // Alias for validated (for easier querying)
  workingDate?: string  // When it was last confirmed working
  hosted?: boolean  // Whether model is hosted on HF
  warm?: boolean    // Whether model is warm on HF
  inferenceStatus?: 'hosted' | 'warm' | 'cold' | 'unavailable'  // HF inference status
}

/**
 * Get validated working models from MongoDB
 * 
 * @param taskType - Optional task type filter (e.g., 'image-classification')
 * @param keywords - Optional keywords to match against model classes 
 * @returns Array of validated models sorted by downloads
 */
/**
 * Ensure unique index on model_id to prevent duplicates
 * Called once at startup/initialization
 */
export async function ensureUniqueIndex(): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection('validated_models')
    
    // Create unique index on model_id if it doesn't exist
    await collection.createIndex({ model_id: 1 }, { unique: true, sparse: true })
    console.log('✅ Unique index ensured on validated_models.model_id')
  } catch (error: any) {
    // Index might already exist, which is fine
    if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
      console.log('ℹ️  Unique index on model_id already exists')
    } else {
      console.error('⚠️  Error creating unique index:', error)
    }
  }
}

export async function getValidatedModels(
  taskType?: string,
  keywords?: string[]
): Promise<ValidatedModel[]> {
  try {
    const db = await getDatabase()
    
    // Ensure unique index exists (idempotent - safe to call multiple times)
    await ensureUniqueIndex()
    
    // Priority models that should ALWAYS be included (regardless of keyword matching)
    const priorityModelIds = [
      'facebook/detr-resnet-50',
      'facebook/detr-resnet-101',
      'microsoft/resnet-50'
    ]
    
    // ✅ STRICT FILTERING: For HF models, only include Facebook, Microsoft, NVIDIA + Live/Hosted
    // Roboflow models are always included
    const strictTrustedOrgs = ['facebook/', 'microsoft/', 'nvidia/']
    
    const query: any = { 
      validated: true,
      // Exclude text classification models
      $and: [
        { pipeline_tag: { $ne: 'text-classification' } },
        { task_type: { $ne: 'Text Classification' } },
        { 'tags': { $not: { $regex: 'text-classification', $options: 'i' } } },
        { 'tags': { $not: { $regex: 'sentiment', $options: 'i' } } },
        { 'tags': { $not: { $regex: 'emotion', $options: 'i' } } },
        { 'tags': { $not: { $regex: 'language-detection', $options: 'i' } } },
        { 'tags': { $not: { $regex: 'spam', $options: 'i' } } },
        { 'tags': { $not: { $regex: 'phishing', $options: 'i' } } },
        { 'tags': { $not: { $regex: 'offensive', $options: 'i' } } },
        { 'tags': { $not: { $regex: 'question-detection', $options: 'i' } } },
        { 'tags': { $not: { $regex: 'ai-text-detection', $options: 'i' } } },
        { 'tags': { $not: { $regex: 'document-analysis', $options: 'i' } } },
        // ✅ STRICT HF FILTERING: Only Facebook, Microsoft, NVIDIA + Live/Hosted
        // Include Roboflow models OR HF models from trusted orgs that are live/hosted
        {
          $or: [
            // Roboflow models (always include)
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
        }
      ]
    }
    
    // List of generic task-related keywords to ignore when filtering
    const genericTaskKeywords = [
      'detection', 'object', 'segmentation', 'classification', 'classify',
      'keypoint', 'key-point', 'keypoint detection', 'key point detection',
      'pose', 'pose detection', 'pose-detection',
      'instance', 'instance segmentation', 'instance-segmentation',
      'semantic', 'semantic segmentation', 'semantic-segmentation',
      'object detection', 'object-detection',
      'image classification', 'image-classification',
      'model', 'models' // Also ignore generic "model" keyword
    ]
    
    // Filter out generic task keywords - only keep domain-specific keywords
    const domainKeywords = keywords && keywords.length > 0 ? keywords.filter(keyword => {
      const lowerKeyword = keyword.toLowerCase().trim()
      // Check if keyword is NOT a generic task keyword
      return !genericTaskKeywords.some(generic => 
        lowerKeyword === generic || 
        lowerKeyword.includes(generic) || 
        generic.includes(lowerKeyword)
      )
    }) : []
    
    // SIMPLIFIED KEYWORD FILTERING FOR CURATED MODELS: Only check if model matches keywords
    // No need to check downloads, likes, or other metrics
    // EXCLUDE generic task-related keywords (detection, object, segmentation, classification, keypoint detection, etc.)
    if (keywords && keywords.length > 0) {
      // Only apply keyword filtering if we have domain-specific keywords
      // If all keywords are generic, don't filter (show all models matching task type)
      if (domainKeywords.length > 0) {
        // Build keyword queries (search in classes, model_id, name, and tags)
        const keywordQueries: any[] = []
        domainKeywords.forEach(keyword => {
          keywordQueries.push(
            { classes: { $regex: keyword, $options: 'i' } },
            { model_id: { $regex: keyword, $options: 'i' } },
            { name: { $regex: keyword, $options: 'i' } },
            { tags: { $regex: keyword, $options: 'i' } }
          )
        })
        
        // Models must match at least one domain-specific keyword
        query.$and = query.$and || []
        query.$and.push({ $or: keywordQueries })
        
        console.log(`🔍 Curated Models Query - Filtering by domain keywords: [${domainKeywords.join(', ')}] (ignored generic: [${keywords.filter(k => !domainKeywords.includes(k)).join(', ')}])`)
      } else {
        console.log(`🔍 Curated Models Query - All keywords are generic task keywords, showing all models matching task type`)
      }
    }
    
    // Filter by task type (handle both formats)
    // IMPORTANT: If domain keywords match, don't strictly filter by task type - include models matching domain keywords even if task type differs
    // Task type filter is only strictly applied when there are no domain keywords (or all keywords are generic)
    if (taskType && domainKeywords.length === 0) {
      // Only apply strict task type filter when no domain keywords exist
      // Convert various formats to regex match (case-insensitive)
      // e.g., "segmentation" matches "Instance Segmentation", "Image Segmentation", etc.
      let normalizedTaskType = taskType
      if (taskType === 'object-detection') {
        normalizedTaskType = 'Object Detection'
      } else if (taskType === 'keypoint-detection') {
        normalizedTaskType = 'Keypoint Detection'
      } else {
        normalizedTaskType = taskType
      }
      // Use regex to match any task type containing the search term
      query.task_type = { $regex: normalizedTaskType.replace(/-/g, ' '), $options: 'i' }
      console.log(`🔍 Curated Models Query - Applying strict task type filter: ${normalizedTaskType}`)
    } else if (taskType && domainKeywords.length > 0) {
      // When domain keywords exist, task type is used for scoring/priority but not filtering
      // This allows models matching domain keywords (like "basketball") to appear even if task type differs
      console.log(`🔍 Curated Models Query - Domain keywords present, task type (${taskType}) will be used for relevance scoring only, not filtering`)
    }
    
    // Fetch priority models separately (always include them, regardless of keywords)
    // But still apply strict filtering: only trusted orgs + live/hosted for HF models
    const priorityQuery: any = {
      model_id: { $in: priorityModelIds },
      validated: true,
      // Apply same strict filtering for priority models
      $or: [
        // Roboflow models (always include)
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
    }
    
    // Get both priority models and keyword-matched models
    const [priorityModels, keywordMatchedModels] = await Promise.all([
      db.collection('validated_models').find(priorityQuery).toArray(),
      db.collection('validated_models').find(query).toArray()
    ])
    
    console.log(`📊 MongoDB Query Results - Priority: ${priorityModels.length}, Keyword-matched: ${keywordMatchedModels.length}`)
    if (priorityModels.length > 0) {
      console.log(`📊 Priority models: ${priorityModels.map(m => m.model_id).join(', ')}`)
    }
    if (keywordMatchedModels.length > 0) {
      console.log(`📊 Keyword-matched models (first 10): ${keywordMatchedModels.slice(0, 10).map(m => m.model_id).join(', ')}`)
    }
    
    // Combine and deduplicate (priority models first, but Roboflow will override in sorting)
    const allModels = [...priorityModels, ...keywordMatchedModels]
    const uniqueModels = allModels.filter((model, index, self) => 
      index === self.findIndex(m => m.model_id === model.model_id)
    )
    
    // Sort: Roboflow models FIRST (highest priority), then priority models, then others
    uniqueModels.sort((a, b) => {
      const aIsRoboflow = (a.model_id || '').toLowerCase().startsWith('roboflow/') ||
                         (a.model_id || '').toLowerCase().includes('roboflow') ||
                         (a.inferenceEndpoint && (
                           a.inferenceEndpoint.includes('roboflow.com') ||
                           a.inferenceEndpoint.includes('serverless.roboflow.com') ||
                           a.inferenceEndpoint.includes('detect.roboflow.com') ||
                           a.inferenceEndpoint.includes('segment.roboflow.com')
                         ))
      const bIsRoboflow = (b.model_id || '').toLowerCase().startsWith('roboflow/') ||
                         (b.model_id || '').toLowerCase().includes('roboflow') ||
                         (b.inferenceEndpoint && (
                           b.inferenceEndpoint.includes('roboflow.com') ||
                           b.inferenceEndpoint.includes('serverless.roboflow.com') ||
                           b.inferenceEndpoint.includes('detect.roboflow.com') ||
                           b.inferenceEndpoint.includes('segment.roboflow.com')
                         ))
      
      const aIsPriority = priorityModelIds.includes(a.model_id)
      const bIsPriority = priorityModelIds.includes(b.model_id)
      
      // PRIORITY 1: Roboflow models always come first
      if (aIsRoboflow && !bIsRoboflow) return -1
      if (!aIsRoboflow && bIsRoboflow) return 1
      
      // PRIORITY 2: Priority models come after Roboflow
      if (aIsPriority && !bIsPriority) return -1
      if (!aIsPriority && bIsPriority) return 1
      
      // PRIORITY 3: Maintain original order for others (relevance scoring handled in searchValidatedModels)
      return 0
    })
    
    return uniqueModels.slice(0, 50) as unknown as ValidatedModel[]
  } catch (error) {
    console.error('Error fetching validated models:', error)
    return []
  }
}

/**
 * Get a specific validated model by ID 
 * 
 * @param modelId - Full model ID (e.g., 'microsoft/resnet-50')
 * @returns Validated model or null if not found/validated
 */
export async function getValidatedModelById(
  modelId: string
): Promise<ValidatedModel | null> {
  try {
    const db = await getDatabase()
    
    const model = await db.collection('validated_models')
      .findOne({ model_id: modelId, validated: true })
    
    return model as unknown as ValidatedModel | null
  } catch (error) {
    console.error('Error fetching validated model:', error)
    return null
  }
}

/**
 * Mark a model as validated (or invalid) after testing
 * This is called automatically when a model is successfully (or unsuccessfully) used 
 * 
 * @param modelId - Full model ID
 * @param isValid - Whether the model passed validation
 * @param sampleOutput - Optional sample output from successful inference
 * @param metadata - Optional additional metadata (task, classes, etc.)
 */
export async function markModelAsValidated(
  modelId: string,
  isValid: boolean,
  sampleOutput?: any,
  metadata?: {
    task_type?: string
    classes?: string[]
    downloads?: number
    likes?: number
    tags?: string[]
    hosted?: boolean
    warm?: boolean
    inferenceStatus?: 'hosted' | 'warm' | 'cold' | 'unavailable'
  }
) {
  try {
    const db = await getDatabase()
    
    const updateDoc: any = {
      validated: isValid,
      works: isValid,  // 🆕 Alias for easier querying
      checked_at: new Date().toISOString()
    }
    
    // 🆕 Set workingDate when model is confirmed working
    if (isValid) {
      updateDoc.workingDate = new Date().toISOString()
    }
    
    if (sampleOutput) {
      updateDoc.sample_output = Array.isArray(sampleOutput) 
        ? sampleOutput.slice(0, 3)  // Store top 3 results
        : sampleOutput
    }
    
    if (metadata) {
      Object.assign(updateDoc, metadata)
    }
    
    await db.collection('validated_models').updateOne(
      { model_id: modelId },
      { $set: updateDoc },
      { upsert: true }
    )
    
    console.log(`✅ Marked ${modelId} as ${isValid ? 'validated' : 'invalid'}`)
  } catch (error) {
    console.error('Error marking model as validated:', error)
  }
}

/**
 * Get models that have worked in the past (with workingDate)
 * 
 * @param taskType - Optional task type filter
 * @param sinceDate - Optional date filter (ISO string)
 * @returns Array of models that have been confirmed working
 */
export async function getWorkingModels(
  taskType?: string,
  sinceDate?: string
): Promise<ValidatedModel[]> {
  try {
    const db = await getDatabase()
    
    const query: any = {
      works: true,  // 🆕 Use new 'works' field
      workingDate: { $exists: true }  // Must have workingDate
    }
    
    if (taskType) {
      query.task_type = taskType
    }
    
    if (sinceDate) {
      query.workingDate = { $gte: sinceDate }
    }
    
    const models = await db.collection('validated_models')
      .find(query)
      .sort({ workingDate: -1, downloads: -1 })  // Most recent working first 
      .toArray()
    
    return models as unknown as ValidatedModel[]
  } catch (error) {
    console.error('Error getting working models:', error)
    return []
  }
}

/**
 * Get validation statistics 
 * 
 * @returns Object with validation stats
 */
export async function getValidationStats() {
  try {
    const db = await getDatabase()
    
    const stats = await db.collection('validated_models').aggregate([
      {
        $group: {
          _id: '$validated',
          count: { $sum: 1 },
          tasks: { $addToSet: '$task_type' }
        }
      }
    ]).toArray()
    
    const validCount = stats.find(s => s._id === true)?.count || 0
    const invalidCount = stats.find(s => s._id === false)?.count || 0
    const totalCount = validCount + invalidCount
    const workingCount = await db.collection('validated_models').countDocuments({ works: true })
    
    return {
      total: totalCount,
      valid: validCount,
      invalid: invalidCount,
      successRate: totalCount > 0 ? (validCount / totalCount) * 100 : 0,
      tasks: stats.flatMap(s => s.tasks)
    }
  } catch (error) {
    console.error('Error getting validation stats:', error)
    return {
      total: 0,
      valid: 0,
      invalid: 0,
      successRate: 0,
      tasks: []
    }
  }
}

/**
 * Calculate relevance score for a validated model based on keywords
 * 
 * @param model - Validated model
 * @param keywords - Search keywords
 * @returns Relevance score (higher is better)
 */
export function calculateValidatedModelRelevance(
  model: ValidatedModel,
  keywords: string[]
): number {
  let score = 0
  
  // Base score for being validated 
  score += 1000
  
  // Enhanced keyword matching with weighted scoring
  const modelText = `${model.model_id} ${model.name || ''} ${model.task_type} ${model.tags?.join(' ') || ''}`.toLowerCase()
  
  // Separate domain-specific keywords from generic ones
  const genericTerms = new Set(['segmentation', 'segformer', 'image-segmentation', 'detection', 'classification', 'object-detection', 'instance-segmentation'])
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
      if (model.model_id.toLowerCase().includes(lowerCompound)) {
        score += compoundWeight * 3
      }
      // Model name contains exact compound
      else if ((model.name || '').toLowerCase().includes(lowerCompound)) {
        score += compoundWeight * 2.5
      }
      // Task type contains exact compound
      else if (model.task_type.toLowerCase().includes(lowerCompound)) {
        score += compoundWeight * 2
      }
      // Tags contain exact compound
      else if ((model.tags || []).some(tag => tag.toLowerCase().includes(lowerCompound))) {
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
    const keywordWeight = 1500 // Higher weight for domain keywords
    
    // Model ID contains keyword (highest priority)
    if (model.model_id.toLowerCase().includes(lowerKeyword)) {
      score += Math.round(1000 * 1.5) // 1500
    }
    
    // Model name contains keyword
    if ((model.name || '').toLowerCase().includes(lowerKeyword)) {
      score += Math.round(800 * 1.5) // 1200
    }
    
    // Task type contains keyword
    if (model.task_type.toLowerCase().includes(lowerKeyword)) {
      score += Math.round(600 * 1.5) // 900
    }
    
    // Tags contain keyword
    if ((model.tags || []).some(tag => tag.toLowerCase().includes(lowerKeyword))) {
      score += Math.round(700 * 1.5) // 1050
    }
    
    // Word boundary matches
    const regex = new RegExp(`\\b${lowerKeyword}`, 'i')
    if (regex.test(modelText)) {
      score += Math.round(200 * 1.5) // 300
    }
  })
  
  // PRIORITY 3: Generic keywords
  genericKeywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase()
    
    // Model ID contains keyword
    if (model.model_id.toLowerCase().includes(lowerKeyword)) {
      score += 500
    }
    
    // Model name contains keyword
    if ((model.name || '').toLowerCase().includes(lowerKeyword)) {
      score += 400
    }
    
    // Task type contains keyword
    if (model.task_type.toLowerCase().includes(lowerKeyword)) {
      score += 300
    }
    
    // Tags contain keyword
    if ((model.tags || []).some(tag => tag.toLowerCase().includes(lowerKeyword))) {
      score += 350
    }
    
    // Word boundary matches
    const regex = new RegExp(`\\b${lowerKeyword}`, 'i')
    if (regex.test(modelText)) {
      score += 100
    }
  })
  
  // Bonus for matching multiple compound keywords
  const compoundMatchCount = compoundKeywords.filter(compound =>
    modelText.includes(compound.toLowerCase())
  ).length
  score += compoundMatchCount * 2000 // Very high bonus for multiple compound matches
  
  // Bonus for multiple keyword matches
  const keywordMatchCount = keywords.filter(keyword => 
    modelText.includes(keyword.toLowerCase())
  ).length
  score += keywordMatchCount * 100
  
  // Penalty for irrelevant terms
  const irrelevantTerms = ['nsfw', 'adult', 'explicit', 'inappropriate', 'offensive', 'hate', 'violence']
  const hasIrrelevant = irrelevantTerms.some(term => 
    modelText.includes(term) && !keywords.some(k => k.toLowerCase().includes(term))
  )
  if (hasIrrelevant) {
    score -= 1000 // Heavy penalty for irrelevant content
  }
  
  // Class specificity scoring
  if (model.classes && model.class_count) {
    // Penalize very generic models (1000 classes = ImageNet)
    if (model.class_count === 1000) {
      score -= 200  // Generic ImageNet model
    } else if (model.class_count < 100) {
      score += 100  // Specialized model
    } else if (model.class_count < 20) {
      score += 200  // Highly specialized model
    }
    
    // Exact class matches (very important!) - prioritize compound keywords and domain keywords
    const domainKeywordsForClasses = keywords.filter(k => !['segmentation', 'segformer', 'image-segmentation', 'detection', 'classification'].includes(k.toLowerCase()))
    const compoundKeywordsForClasses = domainKeywordsForClasses.filter(k => k.includes(' ') && k.split(' ').length >= 2)
    const simpleKeywordsForClasses = domainKeywordsForClasses.filter(k => !k.includes(' '))
    
    // PRIORITY 1: Compound keyword class matches (highest priority)
    compoundKeywordsForClasses.forEach(compoundKeyword => {
      const lowerCompound = compoundKeyword.toLowerCase()
      const compoundParts = lowerCompound.split(' ')
      
      // Check if any class matches the entire compound keyword
      const exactClassMatch = model.classes?.some(cls => 
        cls.toLowerCase().includes(lowerCompound)
      )
      if (exactClassMatch) {
        score += 2000 // Very high bonus for compound keyword class match
      }
      
      // Check if all parts of compound match classes
      const allPartsMatch = compoundParts.every(part => 
        model.classes?.some(cls => cls.toLowerCase().includes(part)) && part.length > 2
      )
      if (allPartsMatch && !exactClassMatch) {
        score += 1500 // High bonus for matching all parts
      }
    })
    
    // PRIORITY 2: Simple domain keyword class matches
    const classMatches = simpleKeywordsForClasses.filter(keyword => {
      return model.classes?.some(cls => 
        cls.toLowerCase().includes(keyword.toLowerCase())
      )
    })
    
    // Higher weight for domain keyword class matches
    classMatches.forEach(keyword => {
      score += 300 // Double bonus for domain keyword class matches
    })
  }
  
  // Popularity bonus (but not too much)
  // Handle undefined/null downloads (common for Roboflow models)
  const downloads = model.downloads ?? 0
  score += Math.log10(downloads + 1) * 10
  
  // Known working model bonus
  if (model.works_with_dataurl) {
    score += 50
  }
  
  return score
}

/**
 * Search validated models with relevance scoring
 * 
 * @param keywords - Search keywords
 * @param taskType - Optional task type filter
 * @param limit - Maximum number of results
 * @returns Scored and sorted validated models
 */
export async function searchValidatedModels(
  keywords: string[],
  taskType?: string,
  limit: number = 20
): Promise<Array<ValidatedModel & { relevanceScore: number }>> {
  const models = await getValidatedModels(taskType, keywords)
  
  // Priority models that should always be included
  const priorityModelIds = [
    'facebook/detr-resnet-50',
    'facebook/detr-resnet-101',
    'microsoft/resnet-50'
  ]
  
  // Calculate relevance scores - SIMPLIFIED: Only keyword matching, no downloads/likes
  const scoredModels = models.map(model => {
    let relevanceScore = 0
    
    // Check if model is Roboflow (prioritize these)
    const isRoboflow = (model.model_id || '').toLowerCase().startsWith('roboflow/') ||
                      (model.model_id || '').toLowerCase().includes('roboflow') ||
                      (model.inferenceEndpoint && (
                        model.inferenceEndpoint.includes('roboflow.com') ||
                        model.inferenceEndpoint.includes('serverless.roboflow.com') ||
                        model.inferenceEndpoint.includes('detect.roboflow.com') ||
                        model.inferenceEndpoint.includes('segment.roboflow.com')
                      ))
    
    // Check if model is a priority model
    const isPriority = priorityModelIds.includes(model.model_id)
    
    // Build model text for keyword matching
    const modelText = `${model.model_id} ${model.name || ''} ${model.task_type} ${model.tags?.join(' ') || ''}`.toLowerCase()
    
    // Keyword matching (simplified - no downloads/likes weighting)
    keywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase()
      
      // Model ID contains keyword (highest priority)
      if (model.model_id.toLowerCase().includes(lowerKeyword)) {
        relevanceScore += 1000
      }
      
      // Model name contains keyword
      if ((model.name || '').toLowerCase().includes(lowerKeyword)) {
        relevanceScore += 800
      }
      
      // Classes contain keyword
      if (model.classes?.some((c: string) => c.toLowerCase().includes(lowerKeyword))) {
        relevanceScore += 900
      }
      
      // Tags contain keyword
      if ((model.tags || []).some(tag => tag.toLowerCase().includes(lowerKeyword))) {
        relevanceScore += 700
      }
      
      // Task type contains keyword
      if (model.task_type.toLowerCase().includes(lowerKeyword)) {
        relevanceScore += 600
      }
    })
    
    // PRIORITY 1: Roboflow models get massive boost (always prioritize Roboflow)
    if (isRoboflow) {
      relevanceScore += 100000 // Very high boost for all Roboflow models
    }
    
    // PRIORITY 2: Priority models get boost (but less than Roboflow)
    if (isPriority && !isRoboflow) {
      relevanceScore += 50000 // High boost for priority models (after Roboflow)
    }
    
    return {
      ...model,
      relevanceScore
    }
  })
  
  // Sort by relevance score: Roboflow models first, then by keyword matches
  scoredModels.sort((a, b) => {
    // Roboflow models always come first
    const aIsRoboflow = (a.model_id || '').toLowerCase().startsWith('roboflow/') ||
                       (a.model_id || '').toLowerCase().includes('roboflow') ||
                       (a.inferenceEndpoint && a.inferenceEndpoint.includes('roboflow.com'))
    const bIsRoboflow = (b.model_id || '').toLowerCase().startsWith('roboflow/') ||
                       (b.model_id || '').toLowerCase().includes('roboflow') ||
                       (b.inferenceEndpoint && b.inferenceEndpoint.includes('roboflow.com'))
    
    if (aIsRoboflow && !bIsRoboflow) return -1
    if (!aIsRoboflow && bIsRoboflow) return 1
    
    // Otherwise sort by relevance score
    return b.relevanceScore - a.relevanceScore
  })
  
  return scoredModels.slice(0, limit)
}

/**
 * Mark a model as working (successful inference) with detailed status
 * Only updates if model doesn't exist or hasn't been marked as working recently (within last hour)
 */
export async function markModelAsWorking(
  model_id: string,
  task_type: string,
  sample_output?: any,
  inferenceStatus: 'hosted' | 'warm' | 'cold' | 'unavailable' = 'hosted'
): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection('validated_models')
    
    // Check if model already exists and was recently marked as working (within last hour)
    // Use atomic update to prevent race conditions when multiple calls happen simultaneously
    const now = new Date().toISOString()
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    const existingModel = await collection.findOne({ model_id })
    if (existingModel?.works && existingModel?.workingDate) {
      const lastWorkingDate = new Date(existingModel.workingDate)
      
      // If model was marked as working within the last hour, skip update and logging
      if (lastWorkingDate > oneHourAgo) {
        // Only update checked_at timestamp atomically, don't update workingDate or other fields
        await collection.updateOne(
          { model_id },
          { $set: { checked_at: now } }
        )
        return // Skip the full update and logging
      }
    }
    
    const updateData: Partial<ValidatedModel> = {
      model_id,
      task_type,
      validated: true,
      works: true,
      workingDate: now,
      checked_at: now,
      hosted: true,
      warm: inferenceStatus === 'warm' || inferenceStatus === 'hosted',
      inferenceStatus,
      ...(sample_output && { sample_output })
    }
    
    // Use atomic update with upsert to prevent duplicate writes
    const updateResult = await collection.updateOne(
      { model_id },
      { 
        $set: updateData,
        $setOnInsert: { created_at: now } // Only set on insert, not update
      },
      { upsert: true }
    )
    
    // Only log if this was actually a new write or significant update
    // Check if we just inserted a new document or updated an existing one
    if (updateResult.upsertedCount > 0 || !existingModel || !existingModel.works) {
    console.log(`✅ Marked ${model_id} as WORKING (${inferenceStatus})`)
    }
  } catch (error) {
    console.error(`❌ Error marking model as working: ${error}`)
    throw error
  }
}

/**
 * Mark a model as failed with error details
 */
export async function markModelAsFailed(
  model_id: string,
  task_type: string,
  error: string,
  errorType: 'api_unavailable' | 'input_format' | 'loading_state' | 'unknown' = 'unknown'
): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection('validated_models')
    
    const updateData: Partial<ValidatedModel> = {
      model_id,
      task_type,
      validated: false,
      works: false,
      workingDate: undefined,
      checked_at: new Date().toISOString(),
      hosted: errorType !== 'api_unavailable',
      warm: false,
      inferenceStatus: errorType === 'api_unavailable' ? 'unavailable' : 'cold',
      error: `${errorType}: ${error}`
    }
    
    await collection.updateOne(
      { model_id },
      { $set: updateData },
      { upsert: true }
    )
    
    console.log(`❌ Marked ${model_id} as FAILED (${errorType})`)
  } catch (error) {
    console.error(`❌ Error marking model as failed: ${error}`)
    throw error
  }
}

/**
 * Save Roboflow model to MongoDB when found in search results
 * This ensures Roboflow models are available in getValidatedModels queries
 */
export async function saveRoboflowModelToValidated(
  modelIdentifier: string,
  modelData: {
    name: string
    author: string
    task_type: string
    api_endpoint?: string
    classes?: string[]
    tags?: string[]
    mAP?: string
    training_images?: string
  }
): Promise<void> {
  try {
    const db = await getDatabase()
    const collection = db.collection('validated_models')
    
    // Ensure model_id has roboflow/ prefix
    const modelId = modelIdentifier.startsWith('roboflow/') 
      ? modelIdentifier 
      : `roboflow/${modelIdentifier}`
    
    const updateData: Partial<ValidatedModel> = {
      model_id: modelId,
      name: modelData.name,
      author: modelData.author || 'Roboflow Universe',
      task_type: modelData.task_type,
      validated: true, // Assume Roboflow models work (they have API endpoints)
      works: true,
      classes: modelData.classes || [],
      class_count: modelData.classes?.length || 0,
      downloads: 0, // Roboflow models don't have downloads
      likes: 0,
      tags: modelData.tags || [],
      inferenceEndpoint: modelData.api_endpoint,
      inference_endpoint: modelData.api_endpoint,
      supportsInference: true,
      checked_at: new Date().toISOString(),
      hosted: true,
      warm: false,
      inferenceStatus: 'hosted' as const
    }
    
    // Check if model already exists to avoid duplicate saves
    const existingModel = await collection.findOne({ model_id: modelId })
    
    if (existingModel) {
      // Model exists - update only if new data is provided (don't overwrite with empty/null values)
      const updateFields: any = {
        checked_at: new Date().toISOString() // Always update checked_at
      }
      
      // Only update fields that have new data
      if (modelData.name && modelData.name !== existingModel.name) {
        updateFields.name = modelData.name
      }
      if (modelData.api_endpoint && modelData.api_endpoint !== existingModel.inferenceEndpoint) {
        updateFields.inferenceEndpoint = modelData.api_endpoint
        updateFields.inference_endpoint = modelData.api_endpoint
      }
      if (modelData.classes && modelData.classes.length > 0) {
        updateFields.classes = modelData.classes
        updateFields.class_count = modelData.classes.length
      }
      if (modelData.tags && modelData.tags.length > 0) {
        updateFields.tags = modelData.tags
      }
      
      if (Object.keys(updateFields).length > 1) { // More than just checked_at
        await collection.updateOne(
          { model_id: modelId },
          { $set: updateFields }
        )
        console.log(`✅ Updated existing Roboflow model in MongoDB: ${modelId}`)
      } else {
        console.log(`ℹ️  Roboflow model already exists in MongoDB: ${modelId} (no updates needed)`)
      }
    } else {
      // New model - insert
      await collection.updateOne(
        { model_id: modelId },
        { $set: updateData },
        { upsert: true }
      )
      console.log(`✅ Saved new Roboflow model to MongoDB: ${modelId}`)
    }
  } catch (error) {
    console.error(`❌ Error saving Roboflow model to MongoDB: ${error}`)
    // Don't throw - this is a background operation
  }
}


