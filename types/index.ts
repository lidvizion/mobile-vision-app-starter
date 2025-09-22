export type CVTask = 'detection' | 'classification' | 'segmentation' | 'multi-type'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface Detection {
  class: string
  confidence: number
  bbox: BoundingBox
}

export interface Label {
  class: string
  score: number
  confidence: 'high' | 'medium' | 'low' | 'very_low'
}

export interface SegmentationRegion {
  class: string
  area: number
  color: string
  polygon?: Array<{ x: number; y: number }>
}

export interface SegmentationResult {
  mask_url?: string
  regions: SegmentationRegion[]
}

export interface CVResponse {
  task: CVTask
  timestamp: string
  model_version: string
  results: {
    labels?: Label[]
    detections?: Detection[]
    segmentation?: SegmentationResult
  }
  processing_time: number
  image_metadata: {
    width: number
    height: number
    format: string
  }
}

export interface ResultHistoryItem {
  id: string
  image_url: string
  task: CVTask
  response: CVResponse
  created_at: string
}

export interface AppConfig {
  apiUrl: string
  apiKey: string
  modelSlug: string
  storageBucket: string
  defaultTask: CVTask
}
