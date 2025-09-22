'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CVTask, CVResponse } from '@/types'
import { validateCVResponse } from '@/lib/validation'
import { logger, createLogContext } from '@/lib/logger'
import { queryKeys } from '@/lib/query-client'

export function useCVTask() {
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
        fileType: imageFile.type
      })
      
      try {
        // Simulate API call with mock data
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
        
        logger.info('Image processing completed successfully', context, {
          processingTime: validation.data?.processing_time,
          modelVersion: validation.data?.model_version
        })
        
        return validation.data!
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