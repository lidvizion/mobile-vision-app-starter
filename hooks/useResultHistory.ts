'use client'

import { useState, useCallback } from 'react'
import { ResultHistoryItem, CVResponse } from '@/types'

const MOCK_HISTORY: ResultHistoryItem[] = [
  {
    id: '1',
    image_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM2NjdlZWEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM3NjRiYTIiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2cpIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5TYW1wbGUgSW1hZ2U8L3RleHQ+PHRleHQgeD0iNTAlIiB5PSI2MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj40MDAg4oaUIDMwMDwvdGV4dD48L3N2Zz4=',
    task: 'classification',
    response: {
      task: 'classification',
      timestamp: '2024-01-15T09:15:00Z',
      model_version: 'v1.2.0',
      results: {
        labels: [
          { class: 'healthy_skin', score: 0.82, confidence: 'high' },
          { class: 'mole', score: 0.15, confidence: 'low' }
        ]
      },
      processing_time: 1.2,
      image_metadata: { width: 640, height: 480, format: 'jpeg' }
    },
    created_at: '2024-01-15T09:15:00Z'
  },
  {
    id: '2', 
    image_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM2NjdlZWEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM3NjRiYTIiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2cpIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5TYW1wbGUgSW1hZ2U8L3RleHQ+PHRleHQgeD0iNTAlIiB5PSI2MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj40MDAg4oaUIDMwMDwvdGV4dD48L3N2Zz4=',
    task: 'detection',
    response: {
      task: 'detection',
      timestamp: '2024-01-15T09:20:00Z',
      model_version: 'v1.2.0',
      results: {
        detections: [
          { class: 'face', confidence: 0.95, bbox: { x: 120, y: 80, width: 200, height: 250 } }
        ]
      },
      processing_time: 0.8,
      image_metadata: { width: 640, height: 480, format: 'jpeg' }
    },
    created_at: '2024-01-15T09:20:00Z'
  }
]

export function useResultHistory() {
  const [history, setHistory] = useState<ResultHistoryItem[]>(MOCK_HISTORY)

  const addResult = useCallback((item: Omit<ResultHistoryItem, 'id' | 'created_at'>) => {
    const newItem: ResultHistoryItem = {
      ...item,
      id: Date.now().toString(),
      created_at: new Date().toISOString()
    }
    setHistory(prev => [newItem, ...prev])
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  return {
    history,
    addResult,
    clearHistory
  }
}
