import { ModelMetadata, DetectionConfig, DetectionResult } from './types';
/**
 * Hook for computer vision detection tasks
 * Provides detection processing functionality for BaaS integration
 */
export declare function useCVDetection(selectedModel?: ModelMetadata | null): {
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
export declare function useModelDetection(config: DetectionConfig): {
    processImage: import("@tanstack/react-query").UseMutateAsyncFunction<DetectionResult, Error, File, unknown>;
    isProcessing: boolean;
    error: Error | null;
};
//# sourceMappingURL=hooks.d.ts.map