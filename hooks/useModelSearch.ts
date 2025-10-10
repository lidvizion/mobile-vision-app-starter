import { useState, useCallback } from 'react'
import { ModelMetadata, SearchFilters, SearchResult } from '@/types/models'
import { searchRoboflowModels } from '@/lib/api/roboflow'
import { searchHuggingFaceModels } from '@/lib/api/huggingface'
import { enhanceSearchQuery } from '@/lib/api/openai-search'

export function useModelSearch() {
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (query: string, filters?: SearchFilters) => {
    if (!query.trim()) {
      setSearchResults(null)
      return
    }

    setIsSearching(true)
    setError(null)

    try {
      // Enhance query with OpenAI
      const enhancedQuery = await enhanceSearchQuery(query)

      // Search both sources in parallel
      const sources = filters?.source || ['roboflow', 'huggingface']
      const searchPromises: Promise<ModelMetadata[]>[] = []

      if (sources.includes('roboflow')) {
        searchPromises.push(searchRoboflowModels(enhancedQuery))
      }

      if (sources.includes('huggingface')) {
        const hfTask = filters?.task?.[0]
        searchPromises.push(searchHuggingFaceModels(enhancedQuery, hfTask))
      }

      const results = await Promise.all(searchPromises)
      let allModels = results.flat()

      // Apply filters
      if (filters) {
        allModels = applyFilters(allModels, filters)
      }

      // Sort results
      allModels = sortModels(allModels, filters?.sortBy || 'relevance')

      setSearchResults({
        models: allModels,
        totalCount: allModels.length,
        query,
        enhancedQuery,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed'
      setError(errorMessage)
      console.error('Model search error:', err)
    } finally {
      setIsSearching(false)
    }
  }, [])

  const clearSearch = useCallback(() => {
    setSearchResults(null)
    setError(null)
  }, [])

  return {
    search,
    clearSearch,
    isSearching,
    searchResults,
    error,
  }
}

function applyFilters(models: ModelMetadata[], filters: SearchFilters): ModelMetadata[] {
  let filtered = [...models]

  if (filters.task && filters.task.length > 0) {
    filtered = filtered.filter(model => filters.task!.includes(model.task))
  }

  if (filters.framework && filters.framework.length > 0) {
    filtered = filtered.filter(model => 
      model.framework && filters.framework!.includes(model.framework)
    )
  }

  if (filters.minAccuracy !== undefined) {
    filtered = filtered.filter(model => 
      model.accuracy !== undefined && model.accuracy >= filters.minAccuracy!
    )
  }

  return filtered
}

function sortModels(models: ModelMetadata[], sortBy: string): ModelMetadata[] {
  const sorted = [...models]

  switch (sortBy) {
    case 'downloads':
      sorted.sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
      break
    case 'date':
      sorted.sort((a, b) => {
        const dateA = new Date(a.updated || a.created || 0).getTime()
        const dateB = new Date(b.updated || b.created || 0).getTime()
        return dateB - dateA
      })
      break
    case 'accuracy':
      sorted.sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0))
      break
    case 'relevance':
    default:
      // Already sorted by relevance from APIs
      break
  }

  return sorted
}

