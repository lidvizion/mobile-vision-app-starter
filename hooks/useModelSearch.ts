import { useMutation } from '@tanstack/react-query'
import { modelViewStore } from '@/stores/modelViewStore'
import { ModelMetadata } from '@/types/models'

interface ModelSearchRequest {
  keywords: string[]
  task_type?: string
  limit?: number
  page?: number
}

interface ModelSearchResponse {
  success: boolean
  models: ModelMetadata[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  queryId: string
  timestamp: string
  sources: {
    curated: number
    background: number
    total: number
  }
  backgroundSearch: {
    status: 'running' | 'completed' | 'error'
    message: string
  }
}

/**
 * React Query hook for model search
 * Calls /api/model-search and updates MobX store
 */
export function useModelSearch() {
  return useMutation({
    mutationKey: ['model-search'],
    mutationFn: async (request: ModelSearchRequest) => {
      modelViewStore.setIsSearching(true)

      // Browser-compatible UUID generation
      const requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const startTime = Date.now()

      // Reduced logging for performance
      console.log('🔍 Model search started')

      const response = await fetch('/api/model-search', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-request-id': requestId
        },
        body: JSON.stringify(request)
      })

      const duration = Date.now() - startTime

      if (!response.ok) {
        const error = await response.json()
        console.error('❌ Model search failed', {
          requestId,
          status: response.status,
          duration,
          error: error.error
        })
        throw new Error(error.error || 'Failed to search models')
      }

      const data = await response.json() as ModelSearchResponse
      console.log('✅ Model search success')

      return data
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onSuccess: (data) => {
      // Update MobX store with search results
      modelViewStore.setModelList(data.models)
      modelViewStore.setCurrentPage(1) // Always start at page 1 for new search
      modelViewStore.setIsSearching(false)
      modelViewStore.setSearchError(null)
      
      // Update pagination based on loaded models for client-side pagination
      modelViewStore.updatePaginationFromLoadedModels()
      
      // Reduced logging for performance
      console.log('⚡ Phase 1 completed')
    },
    onError: (error: Error) => {
      console.error('Model search error:', error)
      modelViewStore.setIsSearching(false)
      modelViewStore.setSearchError(error.message)
      modelViewStore.setModelList([])
    }
  })
}

