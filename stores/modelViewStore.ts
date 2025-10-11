import { makeAutoObservable } from 'mobx'
import { ModelMetadata } from '@/types/models'

/**
 * MobX Store for Model Discovery View State
 * Manages: query text, refined keywords, model list, selected model
 */
class ModelViewStore {
  // Query state
  queryText: string = ''
  queryId: string | null = null
  refinedKeywords: string[] = []
  taskType: string = ''
  useCase: string = ''

  // Model search state
  modelList: ModelMetadata[] = []
  isSearching: boolean = false
  searchError: string | null = null
  totalResults: number = 0

  // Selected model
  selectedModel: ModelMetadata | null = null

  // UI state
  showAllResults: boolean = false
  activeFilter: 'all' | 'detection' | 'classification' | 'segmentation' = 'all'

  constructor() {
    makeAutoObservable(this)
  }

  // Query actions
  setQueryText(text: string) {
    this.queryText = text
  }

  setRefinedData(data: {
    queryId: string
    keywords: string[]
    taskType: string
    useCase: string
  }) {
    this.queryId = data.queryId
    this.refinedKeywords = data.keywords
    this.taskType = data.taskType
    this.useCase = data.useCase
  }

  // Model search actions
  setModelList(models: ModelMetadata[]) {
    this.modelList = models
  }

  setIsSearching(isSearching: boolean) {
    this.isSearching = isSearching
  }

  setSearchError(error: string | null) {
    this.searchError = error
  }

  setTotalResults(total: number) {
    this.totalResults = total
  }

  // Selected model actions
  setSelectedModel(model: ModelMetadata | null) {
    this.selectedModel = model
  }

  // UI actions
  setShowAllResults(show: boolean) {
    this.showAllResults = show
  }

  setActiveFilter(filter: 'all' | 'detection' | 'classification' | 'segmentation') {
    this.activeFilter = filter
  }

  // Computed values
  get filteredModels() {
    if (this.activeFilter === 'all') {
      return this.modelList
    }
    return this.modelList.filter(model => 
      model.task.includes(this.activeFilter)
    )
  }

  get displayedModels() {
    const filtered = this.filteredModels
    return this.showAllResults ? filtered : filtered.slice(0, 3)
  }

  get hasMoreResults() {
    return this.filteredModels.length > 3 && !this.showAllResults
  }

  get remainingCount() {
    return Math.max(0, this.filteredModels.length - 3)
  }

  // Reset actions
  resetQuery() {
    this.queryText = ''
    this.queryId = null
    this.refinedKeywords = []
    this.taskType = ''
    this.useCase = ''
  }

  resetModels() {
    this.modelList = []
    this.totalResults = 0
    this.showAllResults = false
    this.activeFilter = 'all'
    this.searchError = null
  }

  resetSelection() {
    this.selectedModel = null
  }

  resetAll() {
    this.resetQuery()
    this.resetModels()
    this.resetSelection()
    this.isSearching = false
  }
}

// Create singleton instance
export const modelViewStore = new ModelViewStore()

