export type { CVResponse, CVResults, Detection, Classification, SegmentationRegion, ImageMetadata, BoundingBox } from '@lidvizion/cv-validation';
import type { CVResponse } from '@lidvizion/cv-validation';
export interface ModelMetadata {
    id: string;
    name: string;
    description?: string;
    task: string;
    modelUrl: string;
    platforms: string[];
    downloads?: number;
    library_name?: string;
    pipeline_tag?: string;
    supportsInference?: boolean;
    inferenceEndpoint?: string;
    inferenceStatus?: 'live' | 'loading' | 'error' | 'unavailable';
}
export type CVTask = 'detection' | 'classification' | 'segmentation' | 'multi-type';
export interface DetectionConfig {
    modelId: string;
    threshold?: number;
    topK?: number;
    parameters?: Record<string, any>;
}
export interface DetectionResult {
    success: boolean;
    data?: CVResponse;
    error?: string;
    processingTime?: number;
}
//# sourceMappingURL=types.d.ts.map