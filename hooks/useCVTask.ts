'use client'

import { useState, useCallback } from 'react'
import { CVTask, CVResponse } from '@/types'

export function useCVTask() {
  const [currentTask, setCurrentTask] = useState<CVTask>('multi-type')
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastResponse, setLastResponse] = useState<CVResponse | null>(null)

  const switchTask = useCallback((task: CVTask) => {
    setCurrentTask(task)
  }, [])

  const processImage = useCallback(async (imageFile: File): Promise<CVResponse> => {
    setIsProcessing(true)
    
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
      const data: CVResponse = await response.json()
      
      setLastResponse(data)
      return data
    } catch (error) {
      console.error('Error processing image:', error)
      throw error
    } finally {
      setIsProcessing(false)
    }
  }, [currentTask])

  return {
    currentTask,
    switchTask,
    processImage,
    isProcessing,
    lastResponse
  }
}
