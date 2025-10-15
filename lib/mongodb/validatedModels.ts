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
export async function getValidatedModels(
  taskType?: string,
  keywords?: string[]
): Promise<ValidatedModel[]> {
  try {
    const db = await getDatabase()
    
    const query: any = { validated: true }
    
    // Filter by task type
    if (taskType) {
      query.task_type = taskType
    }
    
    // Build class-based keyword filter 
    if (keywords && keywords.length > 0) {
      // Find models where classes array contains any of the keywords 
      query.$or = keywords.map(keyword => ({
        classes: { $regex: keyword, $options: 'i' }
      }))
    }
    
    const models = await db.collection('validated_models')
      .find(query)
      .sort({ downloads: -1 })
      .limit(50)
      .toArray()
    
    return models as unknown as ValidatedModel[]
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
  
  // Keyword matching in model name, task, and tags
  const modelText = `${model.name} ${model.task_type} ${model.tags?.join(' ') || ''}`.toLowerCase()
  keywords.forEach(keyword => {
    if (modelText.includes(keyword.toLowerCase())) {
      score += 50
    }
  })
  
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
    
    // Exact class matches (very important!)
    const classMatches = keywords.filter(keyword =>
      model.classes?.some(cls => 
        cls.toLowerCase().includes(keyword.toLowerCase())
      )
    ).length
    score += classMatches * 150  // Big bonus for exact class matches
  }
  
  // Popularity bonus (but not too much)
  score += Math.log10(model.downloads + 1) * 10
  
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
  
  // Calculate relevance scores
  const scoredModels = models.map(model => ({
    ...model,
    relevanceScore: calculateValidatedModelRelevance(model, keywords)
  }))
  
  // Sort by relevance score
  scoredModels.sort((a, b) => b.relevanceScore - a.relevanceScore)
  
  return scoredModels.slice(0, limit)
}

/**
 * Mark a model as working (successful inference) with detailed status
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
    
    const updateData: Partial<ValidatedModel> = {
      model_id,
      task_type,
      validated: true,
      works: true,
      workingDate: new Date().toISOString(),
      checked_at: new Date().toISOString(),
      hosted: true,
      warm: inferenceStatus === 'warm' || inferenceStatus === 'hosted',
      inferenceStatus,
      ...(sample_output && { sample_output })
    }
    
    await collection.updateOne(
      { model_id },
      { $set: updateData },
      { upsert: true }
    )
    
    console.log(`✅ Marked ${model_id} as WORKING (${inferenceStatus})`)
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


