import { useMutation } from '@tanstack/react-query'
import { modelViewStore } from '@/stores/modelViewStore'

interface QueryRefineRequest {
  query: string
  userId?: string
}

interface QueryRefineResponse {
  use_case: string
  keywords: string[]
  task_type: string
  query_id: string
  refined_query: string
}

/**
 * React Query hook for query refinement
 * Calls /api/query-refine and updates MobX store
 */
export function useQueryRefine() {
  return useMutation({
    mutationFn: async (request: QueryRefineRequest) => {
      const response = await fetch('/api/query-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to refine query')
      }

      return response.json() as Promise<QueryRefineResponse>
    },
    onSuccess: (data) => {
      // Update MobX store with refined data
      modelViewStore.setRefinedData({
        queryId: data.query_id,
        keywords: data.keywords,
        taskType: data.task_type,
        useCase: data.use_case
      })
    },
    onError: (error: Error) => {
      console.error('Query refine error:', error)
      modelViewStore.setSearchError(error.message)
    }
  })
}

