import { CVResponse } from './types';
/**
 * Get image dimensions from a File object
 * Only works in browser environment
 */
export declare function getImageDimensions(file: File): Promise<{
    width: number;
    height: number;
}>;
/**
 * Transform Hugging Face Inference API response to CVResponse format
 */
export declare function transformHFToCVResponse(inferenceData: any, model: {
    name: string;
    task?: string;
}, imageDimensions?: {
    width: number;
    height: number;
}): CVResponse;
//# sourceMappingURL=utils.d.ts.map