import { HuggingFaceModel, ModelMetadata } from '@/types/models'

const HF_API_KEY = process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY

export async function searchHuggingFaceModels(query: string, task?: string): Promise<ModelMetadata[]> {
  try {
    // Build search URL with filters
    const params = new URLSearchParams({
      search: query,
      limit: '20',
      full: 'true',
    })

    if (task) {
      params.append('filter', task)
    }

    const url = `https://huggingface.co/api/models?${params.toString()}`
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (HF_API_KEY) {
      headers['Authorization'] = `Bearer ${HF_API_KEY}`
    }

    const response = await fetch(url, { headers })
    
    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.statusText}`)
    }

    const models: HuggingFaceModel[] = await response.json()

    // Filter for computer vision models
    const cvModels = models.filter(model => 
      model.pipeline_tag &&
      ['image-classification', 'object-detection', 'image-segmentation', 'image-to-image'].includes(model.pipeline_tag)
    )

    // Convert to ModelMetadata format
    return cvModels.map(model => ({
      id: model.id,
      name: model.modelId,
      description: `${model.pipeline_tag} model by ${model.author}`,
      source: 'huggingface' as const,
      task: mapHFPipelineToTask(model.pipeline_tag),
      imageUrl: `https://huggingface.co/${model.id}/resolve/main/model_card.png`,
      modelUrl: `https://huggingface.co/${model.id}`,
      downloadUrl: `https://huggingface.co/${model.id}/tree/main`,
      framework: model.library_name,
      tags: model.tags,
      updated: model.lastModified,
      author: model.author,
      downloads: model.downloads,
      license: model.tags.find(tag => tag.includes('license:'))?.replace('license:', ''),
    }))
  } catch (error) {
    console.error('Error fetching Hugging Face models:', error)
    return []
  }
}

export async function getHuggingFaceModelDetails(modelId: string): Promise<HuggingFaceModel | null> {
  try {
    const url = `https://huggingface.co/api/models/${modelId}`
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (HF_API_KEY) {
      headers['Authorization'] = `Bearer ${HF_API_KEY}`
    }

    const response = await fetch(url, { headers })
    
    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching Hugging Face model details:', error)
    return null
  }
}

function mapHFPipelineToTask(pipeline?: string): ModelMetadata['task'] {
  if (!pipeline) return 'other'
  
  if (pipeline.includes('classification')) return 'classification'
  if (pipeline.includes('detection')) return 'detection'
  if (pipeline.includes('segmentation')) return 'segmentation'
  return 'other'
}

