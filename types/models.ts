export interface ModelMetadata {
  id: string
  name: string
  description: string
  task: string
  source: 'roboflow' | 'huggingface'
  author: string
  downloads: number
  likes?: number
  views?: number
  stars?: number
  updatedAt?: string
  lastUpdated?: string
  tags: string[]
  frameworks: string[]
  thumbnail?: string
  image?: string
  modelUrl: string
  platforms: string[]
  // Model metrics
  metrics?: {
    mAP?: number
    accuracy?: number
    precision?: number
    recall?: number
    FPS?: number
    modelSize?: string
  }
  // Training data info
  trainingImages?: number
  modelId?: string // Roboflow model ID format (e.g., "basketball-sx8hz/1")
  // Live Inference API support (hosted/warm models)
  supportsInference?: boolean // True if model can run live via Inference API
  inferenceEndpoint?: string
  inferenceStatus?: 'live' | 'loading' | 'error' | 'unavailable'
  // Model classes/labels (e.g., ["cat", "dog", "bird"])
  classes?: string[]
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

export interface SearchFilters {
  task?: string
  source?: 'roboflow' | 'huggingface' | 'all'
  framework?: string
  sortBy?: 'relevance' | 'downloads' | 'recent'
}

export interface ModelSearchResult {
  models: ModelMetadata[]
  total: number
  query: string
  keywords: string[]
}

export interface ExtractedKeywords {
  objects: string[]
  actions: string[]
  tasks: string[]
  domain: string | null
  allKeywords: string[]
}

