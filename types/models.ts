export interface ModelMetadata {
  id: string
  name: string
  description: string
  task: string
  source: 'roboflow' | 'huggingface'
  author: string
  downloads: number
  likes: number
  updatedAt: string
  tags: string[]
  frameworks: string[]
  thumbnail?: string
  modelUrl: string
  platforms: string[]
  // Inference API support
  supportsInference?: boolean
  inferenceEndpoint?: string
  inferenceStatus?: 'ready' | 'loading' | 'error' | 'unavailable'
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

