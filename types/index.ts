/**
 * Type Exports for NPM Package
 */

// CV Types from validation
export type {
  CVResponse,
  CVResults,
  Detection,
  Classification,
  SegmentationRegion,
  ImageMetadata
} from '../lib/validation'

// Model Discovery Types
export type {
  ModelMetadata,
  SearchFilters,
  ModelSearchResult,
  ExtractedKeywords
} from './models'

// Additional types defined locally
export type CVTask = 'detection' | 'classification' | 'segmentation' | 'multi-type'

export interface ResultHistoryItem {
  image_url: string
  task: string
  response: any
  timestamp?: string
}
