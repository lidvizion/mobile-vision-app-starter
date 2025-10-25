import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CVResponse, ModelMetadata, DetectionConfig, DetectionResult } from './types';
import { getImageDimensions, transformHFToCVResponse } from './utils';
import { validateCVResponse } from '@lidvizion/cv-validation';

/**
 * Hook for computer vision detection tasks
 * Provides detection processing functionality for BaaS integration
 */
export function useCVDetection(selectedModel?: ModelMetadata | null) {
  const [currentTask, setCurrentTask] = useState<'detection' | 'classification' | 'segmentation' | 'multi-type'>('multi-type');

  const switchTask = useCallback((task: 'detection' | 'classification' | 'segmentation' | 'multi-type') => {
    setCurrentTask(task);
  }, []);

  const processImageMutation = useMutation({
    mutationFn: async (imageFile: File): Promise<CVResponse> => {
      if (!selectedModel?.supportsInference || !selectedModel?.inferenceEndpoint) {
        throw new Error('No model selected or model does not support inference');
      }

      // Get image dimensions
      const imageDimensions = await getImageDimensions(imageFile);

      // Convert image to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      // Prepare task-specific parameters
      const parameters: Record<string, any> = {};
      if (currentTask === 'detection') {
        parameters.threshold = 0.5;
      } else if (currentTask === 'classification') {
        parameters.top_k = 5;
      }

      // Call Hugging Face Inference API
      const response = await fetch(selectedModel.inferenceEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_HF_TOKEN || ''}`,
        },
        body: JSON.stringify({
          inputs: base64,
          parameters,
        }),
      });

      if (!response.ok) {
        throw new Error(`Inference failed: ${response.status} ${response.statusText}`);
      }

      const inferenceData = await response.json();

      // Transform to CVResponse format
      const cvResponse = transformHFToCVResponse(inferenceData, selectedModel, imageDimensions);

      // Validate the response
      const validation = validateCVResponse(cvResponse);
      if (!validation.isValid) {
        throw new Error(`Invalid response format: ${validation.error}`);
      }

      return validation.data;
    },
  });

  const processImage = useCallback(async (imageFile: File): Promise<DetectionResult> => {
    try {
      const result = await processImageMutation.mutateAsync(imageFile);
      return {
        success: true,
        data: result,
        processingTime: result.processing_time,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [processImageMutation]);

  return {
    currentTask,
    switchTask,
    processImage,
    isProcessing: processImageMutation.isPending,
    error: processImageMutation.error,
  };
}

/**
 * Hook for processing images with a specific model configuration
 * Useful for BaaS integration where you know the exact model to use
 */
export function useModelDetection(config: DetectionConfig) {
  const processWithModel = useMutation({
    mutationFn: async (imageFile: File): Promise<DetectionResult> => {
      try {
        // Get image dimensions
        const imageDimensions = await getImageDimensions(imageFile);

        // Convert image to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });

        // Build inference endpoint
        const inferenceEndpoint = `https://router.huggingface.co/hf-inference/models/${config.modelId}`;

        // Call Hugging Face Inference API
        const response = await fetch(inferenceEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_HF_TOKEN || ''}`,
          },
          body: JSON.stringify({
            inputs: base64,
            parameters: config.parameters || {},
          }),
        });

        if (!response.ok) {
          throw new Error(`Inference failed: ${response.status} ${response.statusText}`);
        }

        const inferenceData = await response.json();

        // Transform to CVResponse format
        const cvResponse = transformHFToCVResponse(
          inferenceData, 
          { name: config.modelId, task: 'detection' }, 
          imageDimensions
        );

        // Validate the response
        const validation = validateCVResponse(cvResponse);
        if (!validation.isValid) {
          throw new Error(`Invalid response format: ${validation.error}`);
        }

        return {
          success: true,
          data: validation.data,
          processingTime: validation.data.processing_time,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  });

  return {
    processImage: processWithModel.mutateAsync,
    isProcessing: processWithModel.isPending,
    error: processWithModel.error,
  };
}
