import { useState, useEffect, useCallback, useRef } from 'react'

interface BackgroundSearchStatus {
  success: boolean
  status: 'running' | 'completed' | 'error'
  models: any[]
  count: number
  message: string
}

interface UseBackgroundSearchProps {
  keywords: string[]
  taskType?: string
  enabled: boolean
  onNewModelsFound?: (models: any[]) => void
}

export function useBackgroundSearch({ 
  keywords, 
  taskType, 
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
    if (!enabled || !keywords.length) {
      return
    }

    try {
      const params = new URLSearchParams({
        keywords: keywords.join(','),
        ...(taskType && { task_type: taskType })
      })

      const response = await fetch(`/api/background-search-status?${params}`)
      const data = await response.json()

      if (data.success) {
        // Reduced logging to prevent spam
        if (data.status === 'completed' || data.status === 'error') {
          console.log(`🔍 Background search ${data.status}: ${data.count} models found`)
        }
        setStatus(data)
        
        // If search completed and we have new models, notify parent (only once)
        if (data.status === 'completed' && data.models.length > 0 && !hasNotifiedRef.current) {
          console.log(`🔍 DEBUG: Triggering onNewModelsFound with ${data.models.length} models`)
          hasNotifiedRef.current = true
          onNewModelsFound?.(data.models)
        }
        
        // Stop polling if completed or error
        if (data.status === 'completed' || data.status === 'error') {
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
        status: 'error',
        message: 'Failed to check search status'
      }))
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setIsPolling(false)
      hasStartedPollingRef.current = false
    }
  }, [enabled, keywords.join(','), taskType, onNewModelsFound])

  // Start polling when enabled - silent operation
  useEffect(() => {
    if (enabled && !isPolling && !hasStartedPollingRef.current) {
      hasStartedPollingRef.current = true
      setIsPolling(true)
      // Check immediately
      checkBackgroundSearch()
      
      // Then poll every 10 seconds (much less frequent to reduce lag)
      intervalRef.current = setInterval(checkBackgroundSearch, 10000)
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
  }, [enabled, keywords.join(','), taskType])

  // Reset when keywords change
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
  }, [keywords.join(','), taskType])

  return {
    status,
    isPolling,
    checkBackgroundSearch
  }
}
