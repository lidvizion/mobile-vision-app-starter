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
          logger.info('Using HF Inference API', context, { model: selectedModel.name })
          
          // Convert image to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(imageFile)
          })
          
          // Call HF Inference API through our backend
          const response = await fetch('/api/run-inference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model_id: selectedModel.id,
              inputs: base64
            })
          })
          
          if (!response.ok) {
            const error = await response.json()
            const errorMessage = error.error || 'Inference failed'
            const errorDetails = error.details ? ` - ${error.details}` : ''
            const errorStatus = error.status ? ` (Status: ${error.status})` : ''
            
            // Create enhanced error with Hugging Face redirect info
            const enhancedError = new Error(`${errorMessage}${errorDetails}${errorStatus}`)
            if (error.redirectToHF && error.modelUrl) {
              (enhancedError as any).modelUrl = error.modelUrl
              (enhancedError as any).redirectToHF = true
            }
            
            logger.error('HF Inference API error', context, enhancedError)
            throw enhancedError
          }
          
          const inferenceData = await response.json()
          
          // Transform HF response to CVResponse format
          const cvResponse: CVResponse = transformHFToCVResponse(inferenceData, selectedModel)
          
          logger.info('HF Inference completed successfully', context, {
            resultsCount: inferenceData.results?.length
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
          // Fallback to mock data for testing
          logger.info('Using mock data (no model selected or inference not supported)', context)
          
          const mockResponses = {
            detection: '/mock/detection-response.json',
            classification: '/mock/response.json',
            segmentation: '/mock/segmentation-response.json',
            'multi-type': '/mock/response.json'
          }
          
          const responseUrl = mockResponses[currentTask]
          const response = await fetch(responseUrl)
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          
          const data = await response.json()
          
          // Validate the response
          const validation = validateCVResponse(data)
          if (!validation.isValid) {
            throw new Error(validation.error || 'Invalid response format')
          }
          
          logger.info('Mock data processed successfully', context)
          
          return validation.data!
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
 * Transform Hugging Face Inference API response to CVResponse format
 */
function transformHFToCVResponse(inferenceData: any, model: ModelMetadata): CVResponse {
  const results = inferenceData.results || []
  
  // Determine task type from model
  const task = model.task || 'detection'
  
  // Transform based on task type
  if (task === 'detection' || task.includes('detection')) {
    // Object Detection
    return {
      task: 'detection',
      model_version: model.name,
      processing_time: 0.5,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: 640,
        height: 480,
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
        width: 640,
        height: 480,
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
    // Segmentation
    return {
      task: 'segmentation',
      model_version: model.name,
      processing_time: 0.8,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: 640,
        height: 480,
        format: 'jpeg'
      },
      results: {
        segmentation: {
          regions: results.map((seg: any) => ({
            class: seg.label,
            area: 0.1,
            color: '#FF0000'
          }))
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