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
  activeFilter: string = 'all'
  
  // Pagination state
  currentPage: number = 1
  totalPages: number = 1
  pageSize: number = 9  // 9 models per page (3x3 grid)

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

  addModels(models: ModelMetadata[]) {
    // Add new models to existing list, avoiding duplicates
    const existingIds = new Set(this.modelList.map(m => m.id))
    const newModels = models.filter(m => !existingIds.has(m.id))
    this.modelList = [...this.modelList, ...newModels]
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

  setActiveFilter(filter: string) {
    this.activeFilter = filter
  }
  
  // Pagination actions
  setCurrentPage(page: number) {
    this.currentPage = page
  }
  
  setTotalPages(totalPages: number) {
    this.totalPages = totalPages
  }
  
  goToNextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++
    }
  }
  
  goToPreviousPage() {
    if (this.currentPage > 1) {
      this.currentPage--
    }
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
    // Return all models from current page (backend handles pagination)
    return this.filteredModels
  }

  get hasMoreResults() {
    return this.currentPage < this.totalPages
  }

  get remainingCount() {
    return Math.max(0, this.totalResults - (this.currentPage * this.pageSize))
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
    this.currentPage = 1
    this.totalPages = 1
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

