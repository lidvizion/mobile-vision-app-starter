import { useMutation } from '@tanstack/react-query'
import { modelViewStore } from '@/stores/modelViewStore'

interface SaveModelSelectionRequest {
  user_id?: string
  query_id: string
  model: {
    name: string
    source: string
    url: string
    task?: string
    description?: string
  }
  session_id?: string
}

interface SaveModelSelectionResponse {
  status: 'success' | 'error'
  selection_id?: string
  redirect?: string
  message?: string
}

/**
 * React Query hook for saving model selection
 * Calls /api/save-model-selection and updates MobX store
 */
export function useSaveModelSelection() {
  return useMutation({
    mutationFn: async (request: SaveModelSelectionRequest) => {
      const response = await fetch('/api/save-model-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to save selection')
      }

      return response.json() as Promise<SaveModelSelectionResponse>
    },
    onSuccess: (data, variables) => {
      console.log('Model selection saved:', data)
      
      if (data.redirect) {
        console.log('Redirect to:', data.redirect)
      }
    },
    onError: (error: Error) => {
      console.error('Save selection error:', error)
      modelViewStore.setSearchError(error.message)
    }
  })
}

