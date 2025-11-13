/**
 * Type Exports for NPM Package
 */

// CV Types from validation
export type {
  CVResponse,
  CVResults,
  Detection,
  KeypointDetection,
  Keypoint,
  Classification,
  SegmentationRegion,
  ImageMetadata
} from '../lib/validation'

// Model Discovery Types
export type {
  ModelMetadata
} from './models'

// Additional types defined locally
export type CVTask = 'detection' | 'classification' | 'segmentation' | 'instance-segmentation' | 'multi-type'

export interface ResultHistoryItem {
  image_url: string
  task: string
  response: any
  timestamp?: string
}
