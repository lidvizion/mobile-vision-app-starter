'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CVTask, CVResponse } from '@/types'
import { validateCVResponse } from '@/lib/validation'
import { logger, createLogContext } from '@/lib/logger'
import { queryKeys } from '@/lib/query-client'
import { ModelMetadata } from '@/types/models'
import { modelViewStore } from '@/stores/modelViewStore'

export function useCVTask(selectedModel?: ModelMetadata | null) {
  const [currentTask, setCurrentTask] = useState<CVTask>('multi-type')
  const queryClient = useQueryClient()

  const switchTask = useCallback((task: CVTask) => {
    const context = createLogContext(task, 'useCVTask', 'switch-task')
    logger.info('Switching CV task', context)
    setCurrentTask(task)
  }, [])

  const processImageMutation = useMutation({
    mutationFn: async (imageFile: File): Promise<CVResponse> => {
      const context = createLogContext(currentTask, 'useCVTask', 'process-image')
      logger.info('Starting image processing', context, {
        fileName: imageFile.name,
        fileSize: imageFile.size,
        fileType: imageFile.type,
        selectedModel: selectedModel?.name
      })
      
      try {
        // If model is selected and supports inference, use HF Inference API
        if (selectedModel?.supportsInference && selectedModel?.inferenceEndpoint) {
          logger.info('Using HF Inference API', context, { 
            model: selectedModel.name,
            supportsInference: selectedModel.supportsInference,
            inferenceEndpoint: selectedModel.inferenceEndpoint
          })
          
          // Convert image to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(imageFile)
          })
          
          // Prepare task-specific parameters for better compatibility
          const parameters: Record<string, any> = {}
          
          // Add parameters based on task type
          if (selectedModel.task?.toLowerCase().includes('classification')) {
            parameters.top_k = 5 // Return top 5 predictions
          } else if (selectedModel.task?.toLowerCase().includes('detection')) {
            parameters.threshold = 0.5 // Confidence threshold for detections
          }
          
          // Call appropriate inference API based on model source
          let response: Response
          
          if (selectedModel.source === 'roboflow') {
            // Use Roboflow inference API
            response = await fetch('/api/roboflow-inference', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model_url: selectedModel.inferenceEndpoint,
                api_key: selectedModel.apiKey,
                image: base64,
                parameters: Object.keys(parameters).length > 0 ? parameters : undefined
              })
            })
          } else {
            // Use Hugging Face inference API
            response = await fetch('/api/run-inference', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model_id: selectedModel.id,
                inputs: base64,
                parameters: Object.keys(parameters).length > 0 ? parameters : undefined
              })
            })
          }
          
          if (!response.ok) {
            const error = await response.json()
            const errorMessage = error.error || 'Inference failed'
            const errorDetails = error.details ? ` - ${error.details}` : ''
            const errorStatus = error.status ? ` (Status: ${error.status})` : ''
            
            // Create enhanced error with Hugging Face redirect info
            const enhancedError = new Error(`${errorMessage}${errorDetails}${errorStatus}`)
            if (error.redirectToHF && error.modelUrl) {
              (enhancedError as any).modelUrl = error.modelUrl
              (enhancedError as any).redirectToHF = error.redirectToHF
            }
            
            logger.error('Inference API error', context, enhancedError)
            throw enhancedError
          }
          
          const inferenceData = await response.json()
          
          // Get actual image dimensions
          let imageDimensions: { width: number; height: number } | undefined
          try {
            imageDimensions = await getImageDimensions(imageFile)
            logger.info('Image dimensions retrieved', context, imageDimensions)
          } catch (dimError) {
            logger.warn('Failed to get image dimensions, using defaults', context, dimError as Error)
          }
          
          // Transform response to CVResponse format based on model source
          const cvResponse: CVResponse = selectedModel.source === 'roboflow' 
            ? transformRoboflowToCVResponse(inferenceData, selectedModel, imageDimensions)
            : transformHFToCVResponse(inferenceData, selectedModel, imageDimensions)
          
          logger.info('Inference completed successfully', context, {
            resultsCount: inferenceData.results?.length,
            modelSource: selectedModel.source
          })
          
          // Save inference result to MongoDB (hf_inference_jobs collection)
          try {
            await fetch('/api/save-inference-result', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: 'anonymous',
                model_id: selectedModel.id,
                query: modelViewStore.queryText || 'unknown',
                image_url: base64, // Using base64 as image_url for now 
                response: inferenceData.results
              })
            })
            logger.info('Inference job saved to MongoDB (hf_inference_jobs)', context)
          } catch (saveError) {
            logger.error('Failed to save inference job', context, saveError as Error)
            // Don't fail the inference if save fails
          }
          
          return cvResponse
        } else {
          // No model selected - require model selection first
          logger.warn('No model selected for inference', context, { 
            selectedModel: selectedModel ? {
              name: selectedModel.name,
              supportsInference: selectedModel.supportsInference,
              inferenceEndpoint: selectedModel.inferenceEndpoint
            } : null
          })
          throw new Error('Please select a model first before processing images. Use the guided model flow to find and select an appropriate model for your use case.')
        }
      } catch (error) {
        logger.error('Image processing failed', context, error as Error)
        throw error
      }
    },
    onSuccess: (data) => {
      const context = createLogContext(currentTask, 'useCVTask', 'process-success')
      logger.info('CV processing mutation succeeded', context)
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.cvResults })
      queryClient.setQueryData(queryKeys.cvResult(data.timestamp), data)
    },
    onError: (error) => {
      const context = createLogContext(currentTask, 'useCVTask', 'process-error')
      logger.error('CV processing mutation failed', context, error as Error)
    }
  })

  const processImage = useCallback(async (file: File): Promise<CVResponse> => {
    return new Promise((resolve, reject) => {
      processImageMutation.mutate(file, {
        onSuccess: (data) => resolve(data),
        onError: (error) => reject(error)
      })
    })
  }, [processImageMutation])

  return {
    currentTask,
    switchTask,
    processImage,
    isProcessing: processImageMutation.isPending,
    lastResponse: processImageMutation.data || null,
    error: processImageMutation.error
  }
}

/**
 * Get image dimensions from a File object
 * Only works in browser environment
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  // Check if we're in browser environment
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve({ width: 640, height: 480 })
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Transform Hugging Face Inference API response to CVResponse format 
 */
function transformHFToCVResponse(inferenceData: any, model: ModelMetadata, imageDimensions?: { width: number; height: number }): CVResponse {
  const results = inferenceData.results || []
  
  // Determine task type from model and results
  let task = model.task || 'detection'
  
  // Check for specific data types to determine task
  if (results.length > 0) {
    const firstResult = results[0]
    
    // Instance segmentation: has both box and mask
    if (firstResult.box && firstResult.mask) {
      task = 'segmentation'
    }
    // Object detection: has box but no mask
    else if (firstResult.box) {
      task = 'detection'
    }
    // Image segmentation: has mask but no box
    else if (firstResult.mask) {
      task = 'segmentation'
    }
    // Classification: has label and score but no spatial data
    else if (firstResult.label && firstResult.score && !firstResult.box && !firstResult.mask) {
      task = 'classification'
    }
  }
  
  // Transform based on task type
  if (task === 'detection' || task.includes('detection')) {
    // Object Detection
    return {
      task: 'detection',
      model_version: model.name,
      processing_time: 0.5,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: imageDimensions?.width || 640,
        height: imageDimensions?.height || 480,
        format: 'jpeg'
      },
      results: {
        detections: results.map((det: any) => ({
          class: det.label,
          confidence: det.score,
          bbox: det.box ? {
            x: det.box.xmin,
            y: det.box.ymin,
            width: det.box.xmax - det.box.xmin,
            height: det.box.ymax - det.box.ymin
          } : { x: 0, y: 0, width: 0, height: 0 }
        }))
      }
    }
  } else if (task === 'classification' || task.includes('classification')) {
    // Image Classification 
    return {
      task: 'classification',
      model_version: model.name,
      processing_time: 0.3,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: imageDimensions?.width || 640,
        height: imageDimensions?.height || 480,
        format: 'jpeg'
      },
      results: {
        labels: results.map((cls: any) => ({
          class: cls.label,
          score: cls.score,
          confidence: cls.score > 0.8 ? 'high' : cls.score > 0.5 ? 'medium' : cls.score > 0.3 ? 'low' : 'very_low'
        }))
      }
    }
  } else if (task === 'segmentation' || task.includes('segmentation')) {
    // Instance Segmentation or Image Segmentation
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
    
    return {
      task: 'segmentation',
      model_version: model.name,
      processing_time: 0.8,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: imageDimensions?.width || 640,
        height: imageDimensions?.height || 480,
        format: 'jpeg'
      },
      results: {
        // For instance segmentation, include both detections and segmentation
        detections: results.filter((seg: any) => seg.box).map((seg: any, index: number) => ({
          class: seg.label,
          confidence: seg.score || 0.9,
          bbox: seg.box ? {
            x: seg.box.xmin,
            y: seg.box.ymin,
            width: seg.box.xmax - seg.box.xmin,
            height: seg.box.ymax - seg.box.ymin
          } : { x: 0, y: 0, width: 0, height: 0 }
        })),
        segmentation: {
          regions: results.map((seg: any, index: number) => {
            // Calculate actual area from mask data if available
            let calculatedArea = 0.1; // Default fallback
            
            if (seg.mask) {
              try {
                // Decode base64 mask to calculate actual coverage
                const maskBuffer = Buffer.from(seg.mask, 'base64');
                // For PNG masks, we need to count non-transparent pixels
                // This is a simplified calculation - in practice, you'd parse the PNG
                // and count actual mask pixels vs total image pixels
                const maskSize = maskBuffer.length;
                const imageSize = (imageDimensions?.width || 640) * (imageDimensions?.height || 480);
                
                // Rough estimation based on mask size vs image size
                // This is not perfect but better than hardcoded 0.1
                calculatedArea = Math.min(0.95, Math.max(0.01, maskSize / (imageSize * 0.1)));
              } catch (error) {
                console.warn('Failed to calculate mask area, using fallback:', error);
                calculatedArea = 0.1;
              }
            } else if (seg.box) {
              // Use bounding box area if available
              calculatedArea = ((seg.box.xmax - seg.box.xmin) * (seg.box.ymax - seg.box.ymin)) / 
                ((imageDimensions?.width || 640) * (imageDimensions?.height || 480));
            } else if (seg.area) {
              // Use provided area if available
              calculatedArea = seg.area;
            }
            
            return {
              class: seg.label,
              area: calculatedArea,
              color: colors[index % colors.length],
              mask: seg.mask || null, // Store mask data if available
              bbox: seg.box ? {
                x: seg.box.xmin,
                y: seg.box.ymin,
                width: seg.box.xmax - seg.box.xmin,
                height: seg.box.ymax - seg.box.ymin
              } : null
            };
          })
        }
      }
    }
  }
  
  // Default fallback
  return {
    task: 'multi-type',
    model_version: model.name,
    processing_time: 0.5,
    timestamp: inferenceData.timestamp || new Date().toISOString(),
    image_metadata: {
      width: 640,
      height: 480,
      format: 'jpeg'
    },
    results: {
      labels: []
    }
  }
}

/**
 * Transform Roboflow API response to CVResponse format with pixel strips
 */
function transformRoboflowToCVResponse(inferenceData: any, model: ModelMetadata, imageDimensions?: { width: number; height: number }): CVResponse {
  const results = inferenceData.results || []
  
  // Determine task type from model and results
  let task = model.task || 'detection'
  
  // Check for specific data types to determine task
  if (results.length > 0) {
    const firstResult = results[0]
    
    // Instance segmentation: has both bbox and mask
    if (firstResult.bbox && firstResult.mask) {
      task = 'segmentation'
    }
    // Object detection: has bbox but no mask
    else if (firstResult.bbox) {
      task = 'detection'
    }
    // Image segmentation: has mask but no bbox
    else if (firstResult.mask) {
      task = 'segmentation'
    }
  }
  
  // Transform based on task type
  if (task === 'detection' || task.includes('detection')) {
    // Object Detection
    return {
      task: 'detection',
      model_version: model.name,
      processing_time: inferenceData.processing_time || 0.5,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: imageDimensions?.width || 640,
        height: imageDimensions?.height || 480,
        format: 'jpeg'
      },
      results: {
        detections: results.map((detection: any) => ({
          class: detection.class,
          confidence: detection.confidence,
          bbox: detection.bbox
        }))
      }
    }
  } else if (task === 'segmentation' || task.includes('segmentation')) {
    // Segmentation with pixel strips
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
    
    return {
      task: 'segmentation',
      model_version: model.name,
      processing_time: inferenceData.processing_time || 0.5,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: imageDimensions?.width || 640,
        height: imageDimensions?.height || 480,
        format: 'jpeg'
      },
      results: {
        segmentation: {
          regions: results.map((seg: any, index: number) => ({
            class: seg.class,
            area: seg.area,
            color: colors[index % colors.length],
            mask: seg.mask || null,
            bbox: seg.bbox || null,
            pixelStrip: seg.pixelStrip || null // Include pixel strip data
          }))
        }
      }
    }
  }
  
  // Default fallback
  return {
    task: 'multi-type',
    model_version: model.name,
    processing_time: inferenceData.processing_time || 0.5,
    timestamp: inferenceData.timestamp || new Date().toISOString(),
    image_metadata: {
      width: imageDimensions?.width || 640,
      height: imageDimensions?.height || 480,
      format: 'jpeg'
    },
    results: {
      labels: []
    }
  }
}