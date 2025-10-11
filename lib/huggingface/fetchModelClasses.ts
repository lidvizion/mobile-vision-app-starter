/**
 * Fetch model classes/labels from Hugging Face config.json
 * 
 * This extracts the expected output classes for a model
 * so we know what labels to expect from inference results.
 */

export interface ModelClassesResult {
  success: boolean
  classes?: string[]
  id2label?: Record<string, string>
  error?: string
}

/**
 * Fetch model classes from Hugging Face config.json
 * 
 * @param modelId - Full model ID (e.g., "Falconsai/nsfw_image_detection")
 * @returns ModelClassesResult with classes array
 * 
 * @example
 * const result = await fetchModelClasses("Falconsai/nsfw_image_detection")
 * // result.classes = ["normal", "nsfw"]
 */
export async function fetchModelClasses(modelId: string): Promise<ModelClassesResult> {
  try {
    console.log(`🏷️  Fetching classes for model: ${modelId}`)
    
    // Try to fetch config.json from Hugging Face
    const configUrl = `https://huggingface.co/${modelId}/raw/main/config.json`
    const response = await fetch(configUrl)
    
    if (!response.ok) {
      console.warn(`⚠️  Could not fetch config.json for ${modelId}: ${response.status}`)
      return {
        success: false,
        error: `HTTP ${response.status}: Could not fetch model config`
      }
    }
    
    const config = await response.json()
    
    // Extract id2label mapping
    const id2label = config.id2label as Record<string, string> | undefined
    
    if (!id2label) {
      console.warn(`⚠️  No id2label found in config for ${modelId}`)
      return {
        success: false,
        error: 'No id2label mapping found in model config'
      }
    }
    
    // Convert id2label to sorted array of class names
    const classes = Object.entries(id2label)
      .sort(([idA], [idB]) => parseInt(idA) - parseInt(idB))
      .map(([_, label]) => label)
    
    console.log(`✅ Found ${classes.length} classes for ${modelId}:`, classes)
    
    return {
      success: true,
      classes,
      id2label
    }
    
  } catch (error) {
    console.error(`❌ Error fetching classes for ${modelId}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Fetch classes for multiple models in parallel
 * 
 * @param modelIds - Array of model IDs
 * @returns Promise of record mapping model IDs to their classes
 * 
 * @example
 * const results = await fetchMultipleModelClasses([
 *   "Falconsai/nsfw_image_detection",
 *   "google/vit-base-patch16-224"
 * ])
 * // results["Falconsai/nsfw_image_detection"].classes = ["normal", "nsfw"]
 */
export async function fetchMultipleModelClasses(
  modelIds: string[]
): Promise<Record<string, ModelClassesResult>> {
  const results = await Promise.all(
    modelIds.map(async (modelId) => ({
      modelId,
      result: await fetchModelClasses(modelId)
    }))
  )
  
  return results.reduce((acc, { modelId, result }) => {
    acc[modelId] = result
    return acc
  }, {} as Record<string, ModelClassesResult>)
}

