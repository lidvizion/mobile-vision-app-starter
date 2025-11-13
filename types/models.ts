export interface ModelMetadata {
  id: string
  name: string
  description: string
  task: string
  source: 'roboflow' | 'huggingface' | 'curated' | 'background'
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
  // Phase 1: Curated vs Background models
  isCurated?: boolean
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
  apiKey?: string // API key for Roboflow models
  // Model classes/labels (e.g., ["cat", "dog", "bird"])
  classes?: string[]
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


