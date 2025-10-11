import { useMutation } from '@tanstack/react-query'
import { modelViewStore } from '@/stores/modelViewStore'
import { ModelMetadata } from '@/types/models'

interface ModelSearchRequest {
  keywords: string[]
  task_type?: string
  limit?: number
}

interface ModelSearchResponse {
  models: ModelMetadata[]
  total: number
  sources: {
    roboflow: number
    huggingface: number
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

      console.log('🔍 Model search started', {
        requestId,
        keywords: request.keywords,
        taskType: request.task_type
      })

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
      console.log('✅ Model search success', {
        requestId,
        duration,
        modelCount: data.models.length
      })

      return data
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onSuccess: (data) => {
      // Update MobX store with search results
      modelViewStore.setModelList(data.models)
      modelViewStore.setTotalResults(data.total)
      modelViewStore.setIsSearching(false)
      modelViewStore.setSearchError(null)
    },
    onError: (error: Error) => {
      console.error('Model search error:', error)
      modelViewStore.setIsSearching(false)
      modelViewStore.setSearchError(error.message)
      modelViewStore.setModelList([])
    }
  })
}

