'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ResultHistoryItem, CVResponse } from '@/types'
import { logger, createLogContext } from '@/lib/logger'
import { queryKeys } from '@/lib/query-client'

// Local storage key
const STORAGE_KEY = 'cv-result-history'

// Load history from localStorage
const loadHistoryFromStorage = (): ResultHistoryItem[] => {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    const context = createLogContext(undefined, 'useResultHistory', 'load-storage')
    logger.error('Failed to load history from localStorage', context, error as Error)
    return []
  }
}

// Save history to localStorage
const saveHistoryToStorage = (history: ResultHistoryItem[]): void => {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch (error) {
    const context = createLogContext(undefined, 'useResultHistory', 'save-storage')
    logger.error('Failed to save history to localStorage', context, error as Error)
  }
}

export function useResultHistory() {
  const queryClient = useQueryClient()

  // Query for result history
  const { data: history = [], isLoading } = useQuery({
    queryKey: queryKeys.resultHistory,
    queryFn: () => {
      const context = createLogContext(undefined, 'useResultHistory', 'load-history')
      logger.info('Loading result history', context)
      return loadHistoryFromStorage()
    },
    staleTime: 0, // Always refetch from storage
    gcTime: 0 // Don't cache in memory
  })

  // Mutation to add a new result
  const addResultMutation = useMutation({
    mutationFn: async (newResult: Omit<ResultHistoryItem, 'id' | 'created_at'>): Promise<ResultHistoryItem> => {
      const context = createLogContext(newResult.task, 'useResultHistory', 'add-result')
      logger.info('Adding new result to history', context, {
        task: newResult.task,
        hasResponse: !!newResult.response
      })
      
      const result: ResultHistoryItem = {
        ...newResult,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString()
      }
      
      const updatedHistory = [result, ...history]
      saveHistoryToStorage(updatedHistory)
      
      return result
    },
    onSuccess: (newResult) => {
      const context = createLogContext(newResult.task, 'useResultHistory', 'add-success')
      logger.info('Successfully added result to history', context)
      
      // Update the query cache
      queryClient.setQueryData(queryKeys.resultHistory, (old: ResultHistoryItem[] = []) => {
        return [newResult, ...old]
      })
    },
    onError: (error) => {
      const context = createLogContext(undefined, 'useResultHistory', 'add-error')
      logger.error('Failed to add result to history', context, error as Error)
    }
  })

  // Mutation to clear all history
  const clearHistoryMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const context = createLogContext(undefined, 'useResultHistory', 'clear-history')
      logger.info('Clearing result history', context, { historyCount: history.length })
      
      saveHistoryToStorage([])
    },
    onSuccess: () => {
      const context = createLogContext(undefined, 'useResultHistory', 'clear-success')
      logger.info('Successfully cleared result history', context)
      
      // Update the query cache
      queryClient.setQueryData(queryKeys.resultHistory, [])
    },
    onError: (error) => {
      const context = createLogContext(undefined, 'useResultHistory', 'clear-error')
      logger.error('Failed to clear result history', context, error as Error)
    }
  })

  return {
    history,
    isLoading,
    addResult: addResultMutation.mutate,
    clearHistory: clearHistoryMutation.mutate,
    isAddingResult: addResultMutation.isPending,
    isClearingHistory: clearHistoryMutation.isPending
  }
}