// Import types from validation schemas
import type {
  CVResponse,
  CVResults,
  Detection,
  Classification,
  SegmentationRegion,
  ImageMetadata
} from '@/lib/validation';

// Re-export types from validation schemas
export type {
  CVResponse,
  CVResults,
  Detection,
  Classification,
  SegmentationRegion,
  ImageMetadata
};

// Additional types for the application
export type CVTask = 'detection' | 'classification' | 'segmentation' | 'multi-type';

export interface ResultHistoryItem {
  id: string;
  image_url: string;
  task: CVTask;
  response: CVResponse;
  created_at: string;
}

export interface CameraPreviewProps {
  currentTask: CVTask;
  onImageProcessed: (response: CVResponse) => void;
  isProcessing: boolean;
  processImage: (file: File) => Promise<CVResponse>;
  selectedImage: string | null;
  setSelectedImage: (image: string | null) => void;
}

export interface TaskSelectorProps {
  currentTask: CVTask;
  onTaskChange: (task: CVTask) => void;
}

export interface ResultsDisplayProps {
  response: CVResponse | null;
  selectedImage: string | null;
}

export interface ResultHistoryProps {
  history: ResultHistoryItem[];
  onClearHistory: () => void;
  onViewResult: (item: ResultHistoryItem) => void;
}

export interface OverlayRendererProps {
  detections?: Detection[];
  segmentation?: SegmentationRegion[];
  imageWidth: number;
  imageHeight: number;
  task: CVTask;
}