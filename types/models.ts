export type ModelSource = 'roboflow' | 'huggingface'

export interface ModelMetadata {
  id: string
  name: string
  description: string
  source: ModelSource
  task: 'detection' | 'classification' | 'segmentation' | 'other'
  version?: string
  accuracy?: number
  imageUrl?: string
  modelUrl?: string
  downloadUrl?: string
  framework?: string
  tags?: string[]
  created?: string
  updated?: string
  license?: string
  author?: string
  downloads?: number
}

export interface RoboflowProject {
  id: string
  name: string
  type: string
  created: number
  updated: number
  images: number
  unannotated: number
  annotation: string
  classes: string[]
  public: boolean
}

export interface RoboflowModel {
  id: string
  name: string
  version: string
  type: string
  fromPretrainedModel: string
  map: number
  precision: number
  recall: number
}

export interface HuggingFaceModel {
  id: string
  modelId: string
  author: string
  sha: string
  lastModified: string
  private: boolean
  disabled: boolean
  gated: boolean
  pipeline_tag?: string
  tags: string[]
  downloads: number
  library_name?: string
  likes: number
  modelCard?: string
}

export interface SearchFilters {
  source?: ModelSource[]
  task?: string[]
  framework?: string[]
  minAccuracy?: number
  sortBy?: 'relevance' | 'downloads' | 'date' | 'accuracy'
}

export interface SearchResult {
  models: ModelMetadata[]
  totalCount: number
  query: string
  enhancedQuery?: string
}

