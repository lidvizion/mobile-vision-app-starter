'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { logger, createLogContext } from '@/lib/logger'
import { queryKeys } from '@/lib/query-client'

export interface RoboflowModel {
  id: string
  name: string
  description: string
  endpoint: string
  api_key: string
  task_type: string
  confidence: number
  tags: string[]
  downloads: number
  created: string
  author: string
}

export interface RoboflowSearchRequest {
  query: string
  taskType?: string
  userId?: string
}

export interface RoboflowSearchResponse {
  success: boolean
  models: RoboflowModel[]
  search_query: string
  total_found: number
  search_id: string
}

export function useRoboflowSearch() {
  const [isSearching, setIsSearching] = useState(false)
  const queryClient = useQueryClient()

  const searchRoboflowMutation = useMutation({
    mutationFn: async (request: RoboflowSearchRequest): Promise<RoboflowSearchResponse> => {
      const context = createLogContext('roboflow-search', 'useRoboflowSearch', 'search-models')
      logger.info('Starting Roboflow Universe search', context, {
        query: request.query,
        taskType: request.taskType
      })
      
      setIsSearching(true)
      
      try {
        const response = await fetch('/api/roboflow-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Roboflow search failed')
        }
        
        const result = await response.json()
        
        logger.info('Roboflow search completed successfully', context, {
          modelsFound: result.models.length,
          searchId: result.search_id
        })
        
        return result
      } catch (error) {
        logger.error('Roboflow search failed', context, error as Error)
        throw error
      } finally {
        setIsSearching(false)
      }
    },
    onSuccess: (data) => {
      const context = createLogContext('roboflow-search', 'useRoboflowSearch', 'search-success')
      logger.info('Roboflow search mutation succeeded', context, {
        modelsFound: data.models.length,
        searchId: data.search_id
      })
      
      // Cache the results
      queryClient.setQueryData(queryKeys.roboflowSearch(data.search_id), data)
    },
    onError: (error) => {
      const context = createLogContext('roboflow-search', 'useRoboflowSearch', 'search-error')
      logger.error('Roboflow search mutation failed', context, error as Error)
    }
  })

  const searchRoboflow = useCallback((request: RoboflowSearchRequest) => {
    return searchRoboflowMutation.mutateAsync(request)
  }, [searchRoboflowMutation])

  return {
    searchRoboflow,
    isSearching: isSearching || searchRoboflowMutation.isPending,
    error: searchRoboflowMutation.error,
    data: searchRoboflowMutation.data,
    isSuccess: searchRoboflowMutation.isSuccess,
    isError: searchRoboflowMutation.isError
  }
}
