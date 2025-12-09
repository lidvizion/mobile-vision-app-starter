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
  
  // Confidence threshold for filtering results (client-side only, doesn't affect API)
  confidenceThreshold: number = 0.0  // 0.0 to 1.0, filters UI display only
  
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

  setSelectedTaskType(taskType: string) {
    this.taskType = taskType
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
    // Deduplicate models by id before setting
    const uniqueModelsMap = new Map<string, ModelMetadata>()
    models.forEach(model => {
      if (model.id && !uniqueModelsMap.has(model.id)) {
        uniqueModelsMap.set(model.id, model)
      }
    })
    this.modelList = Array.from(uniqueModelsMap.values())
    
    // Reset filters to 'all' when new models are loaded
    this.activeFilters = ['all']
    this.currentPage = 1
    
    // Update pagination based on loaded models
    this.updatePaginationFromLoadedModels()
  }

  addModels(models: ModelMetadata[]) {
    // Add new models to existing list, avoiding duplicates
    const existingIds = new Set(this.modelList.map(m => m.id))
    const newModels = models.filter(m => !existingIds.has(m.id))
    const previousCount = this.modelList.length
    this.modelList = [...this.modelList, ...newModels]
    
    console.log(`🔍 DEBUG: addModels - Added ${newModels.length} new models (${previousCount} -> ${this.modelList.length})`)
    
    // Update pagination to reflect new total number of models
    this.updatePaginationFromLoadedModels()
    
    console.log(`🔍 DEBUG: Pagination updated - Total pages: ${this.totalPages}, Filtered models: ${this.filteredModels.length}`)
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
    // Ensure we have a valid filter
    if (!filter) return
    
    if (filter === 'all') {
      // When clicking 'all', always set it as the only filter
      if (this.activeFilters.includes('all') && this.activeFilters.length === 1) {
        // 'all' is already the only filter, do nothing
        return
      } else {
        // Set 'all' as the only filter
        this.activeFilters = ['all']
      }
    } else {
      // For other filters, toggle them and support multi-select
      if (this.activeFilters.includes(filter)) {
        // Remove filter if already selected
        const newFilters = this.activeFilters.filter(f => f !== filter)
        // If no filters left, default to 'all'
        this.activeFilters = newFilters.length > 0 ? newFilters : ['all']
      } else {
        // Add new filter (remove 'all' if it exists, keep other filters)
        const filtersWithoutAll = this.activeFilters.filter(f => f !== 'all')
        this.activeFilters = [...filtersWithoutAll, filter]
      }
    }
    
    // Reset to page 1 when filters change
    this.currentPage = 1
    // Update pagination based on new filtered results
    this.updatePaginationFromLoadedModels()
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

  // Helper function to normalize task names (matches GuidedModelFlow.tsx)
  private normalizeTaskName(task: string): string {
    const normalized = task.toLowerCase()
    
    // Consolidate detection variants
    if (normalized.includes('detection') || normalized === 'object-detection') {
      return 'detection'
    }
    
    // Consolidate classification variants
    if (normalized.includes('classification') || normalized === 'image-classification') {
      return 'classification'
    }
    
    // Consolidate segmentation variants
    if (normalized.includes('segmentation') || normalized === 'instance-segmentation') {
      return 'segmentation'
    }
    
    // Keep other task types as-is
    return normalized
  }

  // Computed values
  get filteredModels() {
    if (this.activeFilters.includes('all')) {
      return this.modelList
    }
    
    // Filter models that match any of the active filters
    return this.modelList.filter(model => {
      const normalizedModelTask = this.normalizeTaskName(model.task)
      
      return this.activeFilters.some(filter => {
        // Normalize filter name for comparison
        const normalizedFilter = this.normalizeTaskName(filter)
        
        // Check if normalized task matches normalized filter
        return normalizedModelTask === normalizedFilter || 
               normalizedModelTask.includes(normalizedFilter) || 
               normalizedFilter.includes(normalizedModelTask)
      })
    })
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

  // Confidence threshold actions
  setConfidenceThreshold(threshold: number) {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold)) // Clamp between 0 and 1
  }

  resetConfidenceThreshold() {
    this.confidenceThreshold = 0.0
  }
}

// Create singleton instance
export const modelViewStore = new ModelViewStore()

