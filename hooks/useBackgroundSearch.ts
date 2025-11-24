import { useState, useEffect, useCallback, useRef } from 'react'

interface BackgroundSearchStatus {
  success: boolean
  status: 'running' | 'completed' | 'failed' | 'not_found'
  models: any[]
  count: number
  message: string
  jobId?: string
}

interface UseBackgroundSearchProps {
  queryId?: string  // Changed from keywords to queryId
  enabled: boolean
  onNewModelsFound?: (models: any[]) => void
}

export function useBackgroundSearch({
  queryId,
  enabled,
  onNewModelsFound
}: UseBackgroundSearchProps) {
  const [status, setStatus] = useState<BackgroundSearchStatus>({
    success: false,
    status: 'running',
    models: [],
    count: 0,
    message: 'Searching for additional models...'
  })

  const [isPolling, setIsPolling] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const hasNotifiedRef = useRef(false)
  const hasStartedPollingRef = useRef(false)

  const checkBackgroundSearch = useCallback(async () => {
    if (!enabled || !queryId) {
      return
    }

    try {
      const response = await fetch(`/api/background-search-status?queryId=${encodeURIComponent(queryId)}`)
      const data = await response.json()

      if (data.success || data.status === 'not_found') {
        // Reduced logging to prevent spam
        if (data.status === 'completed' || data.status === 'failed') {
          console.log(`🔍 Background search ${data.status}: ${data.count} models found`)
        }
        setStatus(data)

        // If search completed and we have new models, notify parent (only once)
        if (data.status === 'completed' && data.models.length > 0 && !hasNotifiedRef.current) {
          console.log(`🔍 DEBUG: Triggering onNewModelsFound with ${data.models.length} models`)
          hasNotifiedRef.current = true
          onNewModelsFound?.(data.models)
        }

        // Stop polling if completed, failed, or not found
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'not_found') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          setIsPolling(false)
          hasStartedPollingRef.current = false
        }
      }
    } catch (error) {
      console.error('Error checking background search status:', error)
      setStatus(prev => ({
        ...prev,
        status: 'failed',
        message: 'Failed to check search status'
      }))
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setIsPolling(false)
      hasStartedPollingRef.current = false
    }
  }, [enabled, queryId, onNewModelsFound])

  // Start polling when enabled - silent operation
  useEffect(() => {
    if (enabled && queryId && !isPolling && !hasStartedPollingRef.current) {
      hasStartedPollingRef.current = true
      setIsPolling(true)
      // Check immediately
      checkBackgroundSearch()

      // Then poll every 5 seconds (faster for better UX)
      intervalRef.current = setInterval(checkBackgroundSearch, 5000)
    }

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setIsPolling(false)
      hasStartedPollingRef.current = false
    }
  }, [enabled, queryId, checkBackgroundSearch])

  // Reset when queryId changes
  useEffect(() => {
    setStatus({
      success: false,
      status: 'running',
      models: [],
      count: 0,
      message: 'Searching for additional models...'
    })
    setIsPolling(false)
    hasNotifiedRef.current = false
    hasStartedPollingRef.current = false
  }, [queryId])

  return {
    status,
    isPolling,
    checkBackgroundSearch
  }
}
