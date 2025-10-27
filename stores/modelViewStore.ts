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
  activeFilters: string[] = ['all']
  
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
    if (filter === 'all') {
      // Toggle 'all' filter
      if (this.activeFilters.includes('all')) {
        // If 'all' is selected, remove it and keep other filters
        this.activeFilters = this.activeFilters.filter(f => f !== 'all')
        // If no other filters, add 'all' back
        if (this.activeFilters.length === 0) {
          this.activeFilters = ['all']
        }
      } else {
        // If 'all' is not selected, add it
        this.activeFilters = [...this.activeFilters, 'all']
      }
    } else {
      // For other filters, toggle them normally
      if (this.activeFilters.includes(filter)) {
        // Remove filter if already selected
        this.activeFilters = this.activeFilters.filter(f => f !== filter)
        // If no filters left, default to 'all'
        if (this.activeFilters.length === 0) {
          this.activeFilters = ['all']
        }
      } else {
        // Add new filter (remove 'all' if it exists)
        const newFilters = this.activeFilters.filter(f => f !== 'all')
        this.activeFilters = [...newFilters, filter]
      }
    }
  }

  isFilterActive(filter: string) {
    return this.activeFilters.includes(filter)
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
    if (this.activeFilters.includes('all')) {
      return this.modelList
    }
    return this.modelList.filter(model => 
      this.activeFilters.some(filter => {
        // Normalize task names for comparison
        const normalizedTask = model.task === 'object-detection' ? 'detection' : model.task
        return normalizedTask.includes(filter) || model.task.includes(filter)
      })
    )
  }

  get displayedModels() {
    // Client-side pagination: slice the filtered models based on current page
    const startIndex = (this.currentPage - 1) * this.pageSize
    const endIndex = startIndex + this.pageSize
    return this.filteredModels.slice(startIndex, endIndex)
  }

  get hasMoreResults() {
    return this.currentPage < this.totalPages
  }

  get remainingCount() {
    return Math.max(0, this.totalResults - (this.currentPage * this.pageSize))
  }
  
  // Update total pages based on loaded models for client-side pagination
  updatePaginationFromLoadedModels() {
    const totalLoadedModels = this.filteredModels.length
    this.totalPages = Math.ceil(totalLoadedModels / this.pageSize)
    this.totalResults = totalLoadedModels
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
    this.activeFilters = ['all']
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

