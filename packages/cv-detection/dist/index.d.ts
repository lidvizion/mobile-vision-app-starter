import * as _tanstack_react_query from '@tanstack/react-query';
import { CVResponse } from '@lidvizion/cv-validation';
export { BoundingBox, CVResponse, CVResults, Classification, Detection, ImageMetadata, SegmentationRegion } from '@lidvizion/cv-validation';

interface ModelMetadata {
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
type CVTask = 'detection' | 'classification' | 'segmentation' | 'multi-type';
interface DetectionConfig {
    modelId: string;
    threshold?: number;
    topK?: number;
    parameters?: Record<string, any>;
}
interface DetectionResult {
    success: boolean;
    data?: CVResponse;
    error?: string;
    processingTime?: number;
}

/**
 * Hook for computer vision detection tasks
 * Provides detection processing functionality for BaaS integration
 */
declare function useCVDetection(selectedModel?: ModelMetadata | null): {
    currentTask: "detection" | "classification" | "segmentation" | "multi-type";
    switchTask: (task: "detection" | "classification" | "segmentation" | "multi-type") => void;
    processImage: (imageFile: File) => Promise<DetectionResult>;
    isProcessing: boolean;
    error: Error | null;
};
/**
 * Hook for processing images with a specific model configuration
 * Useful for BaaS integration where you know the exact model to use
 */
declare function useModelDetection(config: DetectionConfig): {
    processImage: _tanstack_react_query.UseMutateAsyncFunction<DetectionResult, Error, File, unknown>;
    isProcessing: boolean;
    error: Error | null;
};

/**
 * Get image dimensions from a File object
 * Only works in browser environment
 */
declare function getImageDimensions(file: File): Promise<{
    width: number;
    height: number;
}>;
/**
 * Transform Hugging Face Inference API response to CVResponse format
 */
declare function transformHFToCVResponse(inferenceData: any, model: {
    name: string;
    task?: string;
}, imageDimensions?: {
    width: number;
    height: number;
}): CVResponse;

export { getImageDimensions, transformHFToCVResponse, useCVDetection, useModelDetection };
export type { CVTask, DetectionConfig, DetectionResult, ModelMetadata };
