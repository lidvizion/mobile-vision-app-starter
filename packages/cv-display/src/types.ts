// Re-export types from validation package
export type { 
  CVResponse, 
  CVResults, 
  Detection, 
  Classification, 
  SegmentationRegion,
  ImageMetadata,
  BoundingBox 
} from '@lidvizion/cv-validation';

// Import for internal use
import type { CVResponse, Detection, SegmentationRegion } from '@lidvizion/cv-validation';

// Display-specific types
export interface OverlayRendererProps {
  detections?: Detection[];
  segmentation?: SegmentationRegion[];
  imageWidth: number;
  imageHeight: number;
  task: string;
}

export interface ResultsDisplayProps {
  response: CVResponse | null;
  selectedImage: string | null;
  className?: string;
}

export interface BoundingBoxProps {
  detection: Detection;
  imageWidth: number;
  imageHeight: number;
  color?: string;
  showLabel?: boolean;
  showConfidence?: boolean;
}

export interface SegmentationOverlayProps {
  regions: SegmentationRegion[];
  imageWidth: number;
  imageHeight: number;
}
