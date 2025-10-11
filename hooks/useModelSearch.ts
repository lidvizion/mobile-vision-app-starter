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
    mutationFn: async (request: ModelSearchRequest) => {
      modelViewStore.setIsSearching(true)

      const response = await fetch('/api/model-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to search models')
      }

      return response.json() as Promise<ModelSearchResponse>
    },
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

