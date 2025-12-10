'use client'

import { useState, useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import Image from 'next/image'
import {
  ArrowRight, ArrowRightLeft, Box, Lightbulb, Download, ExternalLink,
  Smartphone, ChevronDown, ChevronUp, Filter, Grid, Grid3X3, Image as ImageIcon, Layers,
  Layers3, MapPin, Square, Tag, Target, Type, Video, VideoIcon, AlertCircle,
  CheckCircle, FileText, FileVideo, Zap, Eye, Scan, Focus, Camera,
  ScanLine, ScanFace, ScanBarcode, ScanEye, ScanSearch, ScanText, Globe,
  Loader2
} from 'lucide-react'
import { EXAMPLE_QUERIES, EXAMPLE_QUERIES_BY_TASK } from '@/lib/keywordExtraction'
import { ModelMetadata } from '@/types/models'
import { modelViewStore } from '@/stores/modelViewStore'
import { useQueryRefine } from '@/hooks/useQueryRefine'
import { useModelSearch } from '@/hooks/useModelSearch'
import { useSaveModelSelection } from '@/hooks/useSaveModelSelection'
import { useBackgroundSearch } from '@/hooks/useBackgroundSearch'
import ModelSearchSkeleton from './ModelSearchSkeleton'
import TaskTypeSelectDropdown from './TaskTypeSelectDropdown'

interface GuidedModelFlowProps {
  onModelSelect: (model: ModelMetadata) => void
}

const GuidedModelFlow = observer(({ onModelSelect }: GuidedModelFlowProps) => {
  const [showSearchBar, setShowSearchBar] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}`)
  const [showBackgroundSearchIndicator, setShowBackgroundSearchIndicator] = useState(false)
  const [hasBackgroundSearchCompleted, setHasBackgroundSearchCompleted] = useState(false)
  const [currentQueryId, setCurrentQueryId] = useState<string | undefined>(undefined)
  const [selectedTaskType, setSelectedTaskType] = useState<'detection' | 'classification' | 'segmentation'>('detection')
  // Initialize hasAutoRedirected from sessionStorage to persist across navigation
  const [hasAutoRedirected, setHasAutoRedirected] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('gemini-auto-redirect-done') === 'true'
    }
    return false
  })
  const [showGeminiReady, setShowGeminiReady] = useState(false)
  const geminiButtonRef = useRef<HTMLButtonElement | null>(null)

  // React Query hooks
  const queryRefineMutation = useQueryRefine()
  const searchModels = useModelSearch()  // Renamed for clarity
  const saveSelectionMutation = useSaveModelSelection()

  // Auto-redirect to Gemini when it's the first model
  // Only runs on first search, not when returning via "Change Model"
  useEffect(() => {
    const modelList = modelViewStore.modelList
    
    // Check if this is a return visit (models already loaded from previous search)
    const isReturnVisit = typeof window !== 'undefined' && 
      sessionStorage.getItem('gemini-auto-redirect-done') === 'true'
    
    console.log('🔍 Auto-redirect useEffect running:', {
      modelListLength: modelList.length,
      firstModelId: modelList.length > 0 ? modelList[0].id : 'none',
      hasAutoRedirected,
      isReturnVisit,
      showGeminiReady
    })

    // Skip auto-redirect if:
    // 1. Already redirected in this session
    // 2. This is a return visit (user clicked "Change Model")
    // 3. Models aren't loaded yet
    // 4. First model isn't Gemini
    if (
      modelList.length > 0 && 
      modelList[0].id?.toLowerCase().includes('gemini') && 
      !hasAutoRedirected && 
      !isReturnVisit
    ) {
      console.log('✅ Gemini detected as first model, setting up auto-redirect')
      setShowGeminiReady(true)
      
      const timer = setTimeout(() => {
        console.log('⏰ Auto-redirect timer fired, attempting to click button')
        
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          // Try ref first (more reliable)
          if (geminiButtonRef.current) {
            console.log('✅ Found button via ref, clicking...')
            geminiButtonRef.current.click()
            setHasAutoRedirected(true)
            // Persist flag to sessionStorage
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('gemini-auto-redirect-done', 'true')
            }
            return
          }
          
          // Fallback to querySelector with corrected selector
          // The data-model-id is ON the button, not on a parent element
          // Use the first Gemini model's ID dynamically
          const firstGeminiModelId = modelList[0]?.id
          const button = firstGeminiModelId 
            ? document.querySelector(`button[data-model-id="${firstGeminiModelId}"]`) as HTMLButtonElement
            : null
          if (button) {
            console.log('✅ Found button via querySelector, clicking...')
            button.click()
            setHasAutoRedirected(true)
            // Persist flag to sessionStorage
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('gemini-auto-redirect-done', 'true')
            }
          } else {
            console.error(`❌ Button not found! Selector: button[data-model-id="${firstGeminiModelId}"]`)
            console.log('Available buttons with data-model-id:', Array.from(document.querySelectorAll('button[data-model-id]')).map(btn => ({
              id: btn.getAttribute('data-model-id'),
              text: btn.textContent?.trim()
            })))
            console.log('All buttons in model cards:', document.querySelectorAll('.card-floating button'))
          }
        })
      }, 1500)
      
      return () => {
        console.log('🧹 Cleaning up auto-redirect timer')
        clearTimeout(timer)
      }
    }
  }, [modelViewStore.modelList.length, hasAutoRedirected])

  // Reset background search indicator when component mounts or query changes significantly
  useEffect(() => {
    setShowBackgroundSearchIndicator(false)
  }, []) // Remove dependency to avoid ESLint warning

  // Background search hook - only enable after initial search is complete
  const { status: backgroundStatus, isPolling } = useBackgroundSearch({
    queryId: currentQueryId,  // Use queryId from API response
    enabled: !modelViewStore.isSearching && modelViewStore.modelList.length > 0 && !hasBackgroundSearchCompleted && !!currentQueryId, // Only run once per search
    onNewModelsFound: (newModels) => {
      console.log(`🔍 Found ${newModels.length} new models`)

      // Hide background search indicator
      setShowBackgroundSearchIndicator(false)

      // Add new models to the existing list silently (no notification)
      modelViewStore.addModels(newModels)

      // Mark background search as completed to prevent restart
      setHasBackgroundSearchCompleted(true)
    }
  })

  // Show background search indicator when polling starts, hide when completed
  useEffect(() => {
    if (isPolling) {
      setShowBackgroundSearchIndicator(true)
    } else if (backgroundStatus.status === 'completed') {
      setShowBackgroundSearchIndicator(false)
    }
  }, [isPolling, backgroundStatus.status])

  // Auto-hide indicator after 2 minutes as fallback
  useEffect(() => {
    if (showBackgroundSearchIndicator) {
      const timeout = setTimeout(() => {
        console.log('🕐 Auto-hiding background search indicator after 2 minutes')
        setShowBackgroundSearchIndicator(false)
      }, 2 * 60 * 1000) // 2 minutes

      return () => clearTimeout(timeout)
    }
  }, [showBackgroundSearchIndicator])

  const taskIcons = {
    'detection': ScanEye, // Object Detection - eye scanning for detection
    'classification': Tag, // Image Classification - tagging/labeling
    'segmentation': ScanLine, // Image Segmentation - scanning lines for segmentation
    'instance-segmentation': ScanFace, // Instance Segmentation - face scanning for individual instances
    'image-to-image': ArrowRightLeft, // Image to Image
    'text-to-image': FileText, // Text to Image
    'image-to-text': ScanText, // Image to Text - scanning text
    'depth-estimation': Layers3, // Depth Estimation
    'image-to-video': Video, // Image to Video
    'zero-shot-classification': Target, // Zero-Shot Image Classification
    'mask-generation': ScanFace, // Mask Generation - face scanning
    'zero-shot-detection': Grid3X3, // Zero-Shot Object Detection
    'feature-extraction': Zap, // Image Feature Extraction
    'keypoint-detection': MapPin, // Keypoint Detection
    'video-classification': VideoIcon, // Video Classification
    'text-to-video': FileVideo, // Text to Video
    'image-to-3d': Box, // Image to 3D
    'text-to-3d': Type, // Text to 3D
    'live': Globe, // Live/Real-time processing
    // Legacy mappings for backward compatibility
    'Object Detection': ScanEye,
    'Image Classification': Tag,
    'Image Segmentation': ScanLine,
    'Instance Segmentation': ScanFace,
    'Image to Image': ArrowRightLeft,
    'Text to Image': FileText,
    'Image to Text': ScanText,
    'Depth Estimation': Layers3,
    'Image to Video': Video,
    'Zero-Shot Image Classification': Target,
    'Mask Generation': ScanFace,
    'Zero-Shot Object Detection': Grid3X3,
    'Image Feature Extraction': Zap,
    'Keypoint Detection': MapPin,
    'Video Classification': VideoIcon,
    'Text to Video': FileVideo,
    'Image to 3D': Box,
    'Text to 3D': Type
  }

  // Normalize task names - consolidate similar task types
  const normalizeTaskName = (task: string) => {
    const normalized = task.toLowerCase()

    // Consolidate classification variants
    if (normalized.includes('classification') || normalized === 'image-classification') {
      return 'classification'
    }

    // Consolidate segmentation variants
    if (normalized.includes('segmentation') || normalized === 'instance-segmentation') {
      return 'segmentation'
    }

    // Map object-detection to detection
    if (normalized === 'object-detection') {
      return 'detection'
    }

    return normalized
  }



  const handleSearch = async () => {
    if (modelViewStore.queryText.length < 10) return

    // Reset notification state for new search
    // Reset background search indicator when query changes
    setHasBackgroundSearchCompleted(false)
    
    // Clear auto-redirect flag for new search (allow auto-redirect on fresh searches)
    // This ensures auto-redirect works for new searches but not when returning via "Change Model"
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('gemini-auto-redirect-done')
      setHasAutoRedirected(false)
    }

    try {
      // Step 1: Refine query
      // Store selected task type in store for later use
      modelViewStore.setSelectedTaskType(selectedTaskType)
      
      const refineResult = await queryRefineMutation.mutateAsync({
        query: modelViewStore.queryText,
        userId: 'anonymous',
        taskType: selectedTaskType // Pass selected task type to API
      })

      // Store query_id globally for inference result saving 
      if (typeof window !== 'undefined') {
        (window as any).__queryId = refineResult.query_id
      }

      // Step 2: Search models using unified API (load more models for client-side pagination)
      console.log('🔍 Starting unified search for:', refineResult.keywords)

      const searchResult = await searchModels.mutateAsync({
        keywords: refineResult.keywords,
        task_type: refineResult.task_type,
        limit: 50, // Load 50 models for client-side pagination
        page: 1
      })

      // Extract queryId from the search response for background polling
      if (searchResult.queryId) {
        setCurrentQueryId(searchResult.queryId)
        console.log(`📋 Set queryId for background search: ${searchResult.queryId}`)
      }

      // The useModelSearch hook will automatically update the store
      // No need to manually update the store here
      console.log('📊 Unified search completed - store will be updated by useModelSearch hook')

      // Step 3: Recommendations are now saved automatically by the backend
      // No need to call save-recommendations from frontend anymore
    } catch (error) {
      console.error('Search error:', error)
    }
  }


  const handleSelectModel = async (model: ModelMetadata) => {
    // Set selected model in store
    modelViewStore.setSelectedModel(model)

    // Save selection via API
    if (modelViewStore.queryId) {
      try {
        await saveSelectionMutation.mutateAsync({
          query_id: modelViewStore.queryId,
          model: {
            name: model.name,
            source: model.source,
            url: model.modelUrl,
            task: model.task,
            description: model.description,
            classes: model.classes // Add classes field
          },
          session_id: sessionId
        })
      } catch (error) {
        console.error('❌ Error saving model selection:', error)
        // Continue anyway - don't let API errors prevent model selection 
      }
    }

    // Notify parent component
    onModelSelect(model)
  }

  // Show skeleton loader while searching
  if (modelViewStore.isSearching) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-wells-warm-grey/10 rounded-full mb-4">
            <div className="w-4 h-4 border-2 border-wells-dark-grey/30 border-t-wells-dark-grey rounded-full animate-spin" />
            <span className="text-sm font-medium text-wells-dark-grey">Analyzing your use case...</span>
          </div>
          <h2 className="text-2xl font-serif font-bold text-wells-dark-grey mb-2">
            Searching for the perfect models
          </h2>
          <p className="text-wells-warm-grey">
            Searching for the perfect models...
          </p>
        </div>
        <ModelSearchSkeleton count={3} />
      </div>
    )
  }

  // Show results if we have models
  if (modelViewStore.modelList.length > 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Collapsible Search Again Bar */}
        <div className="card-floating overflow-hidden">
          <button
            onClick={() => setShowSearchBar(!showSearchBar)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-wells-warm-grey/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-wells-dark-grey" />
              <span className="text-sm font-medium text-wells-dark-grey">Search Again</span>
            </div>
            {showSearchBar ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showSearchBar && (
            <div className="px-4 pb-4 border-t border-wells-warm-grey/20">
              <div className="mt-4">
                <input
                  type="text"
                  value={modelViewStore.queryText}
                  onChange={(e) => modelViewStore.setQueryText(e.target.value)}
                  placeholder="Refine your search..."
                  className="w-full px-4 py-2 border border-wells-warm-grey/30 rounded-lg focus:border-wells-dark-grey focus:outline-none text-sm"
                />
                <button
                  onClick={handleSearch}
                  disabled={modelViewStore.queryText.length < 10 || modelViewStore.isSearching}
                  className="mt-2 w-full px-4 py-2 bg-wells-dark-grey text-white rounded-lg hover:bg-wells-warm-grey transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {modelViewStore.isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-wells-warm-grey/10 rounded-full mb-4">
            <Zap className="w-4 h-4 text-wells-dark-grey" />
            <span className="text-sm font-medium text-wells-dark-grey">Step 3</span>
          </div>
          <h2 className="text-2xl font-serif font-bold text-wells-dark-grey mb-2">
            Upload your image or video
          </h2>
          <p className="text-wells-warm-grey mb-4">
            Choose a model and upload your media to get started
          </p>
          <p className="text-sm text-wells-warm-grey">
            Based on: "<strong className="text-wells-dark-grey">{modelViewStore.queryText}</strong>"
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {modelViewStore.refinedKeywords.map((keyword, i) => (
              <span key={i} className="px-3 py-1 bg-wells-warm-grey/10 text-wells-dark-grey text-xs rounded-lg">
                {keyword}
              </span>
            ))}
          </div>
        </div>

        {/* Task Type Filters */}
        <div className="flex items-center gap-2 justify-center flex-wrap">
          <Filter className="w-4 h-4 text-wells-warm-grey" />
          <span className="text-sm text-wells-warm-grey mr-2">Filter by task:</span>
          <div className="flex gap-2 flex-wrap">
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer hover:bg-wells-warm-grey/10">
              <input
                type="checkbox"
                checked={modelViewStore.isFilterActive('all')}
                onChange={() => modelViewStore.setActiveFilter('all')}
                className="w-4 h-4 text-purple-600 bg-white border-wells-warm-grey rounded focus:ring-purple-500 focus:ring-2 checked:bg-purple-600 checked:border-purple-600"
              />
              <span className="text-wells-dark-grey">All</span>
            </label>
            {(() => {
              // Get unique task types from all models (not just displayed) and normalize them
              const uniqueTasks = Array.from(new Set(modelViewStore.modelList.map(model => normalizeTaskName(model.task))))

              // Define common CV task filters to always show (using same icons as TaskTypeSelectDropdown)
              const commonTasks = ['detection', 'classification', 'segmentation', 'live']

              // Combine all tasks and remove duplicates
              const allTasks = Array.from(new Set([...uniqueTasks, ...commonTasks]))

              return allTasks.map((task) => {
                // Use same icons as TaskTypeSelectDropdown for consistency
                let Icon: any = Grid
                if (task === 'detection') {
                  Icon = ScanEye
                } else if (task === 'classification') {
                  Icon = Tag
                } else if (task === 'segmentation') {
                  Icon = ScanLine
                } else {
                  Icon = taskIcons[task as keyof typeof taskIcons] || Grid
                }

                // Check if this task has models (including normalized variants)
                // Use filteredModels to check what models would actually be shown with this filter
                const checkHasModels = () => {
                  if (modelViewStore.modelList.length === 0) return false

                  // Check if any model matches this task filter
                  const testFilters = [task]
                  return modelViewStore.modelList.some(model => {
                    const normalizedModelTask = normalizeTaskName(model.task)
                    return testFilters.some(filter => {
                      const normalizedFilter = normalizeTaskName(filter)
                      return normalizedModelTask === normalizedFilter ||
                        normalizedModelTask.includes(normalizedFilter) ||
                        normalizedFilter.includes(normalizedModelTask)
                    })
                  })
                }

                const hasModels = checkHasModels()
                const isActive = modelViewStore.isFilterActive(task)

                return (
                  <label
                    key={task}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${hasModels
                      ? 'cursor-pointer hover:bg-wells-warm-grey/10'
                      : 'cursor-not-allowed opacity-60'
                      }`}
                    title={!hasModels ? `No ${task} models found in current search` : `Filter by ${task}`}
                    onClick={(e) => {
                      e.preventDefault()
                      if (hasModels) {
                        modelViewStore.setActiveFilter(task)
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => { }} // Handled by label onClick
                      disabled={!hasModels}
                      className={`w-4 h-4 bg-white border-wells-warm-grey rounded focus:ring-purple-500 focus:ring-2 disabled:opacity-50 ${
                        isActive 
                          ? 'text-purple-600 checked:bg-purple-600 checked:border-purple-600' 
                          : 'text-wells-dark-grey'
                      }`}
                    />
                    <Icon className={`w-5 h-5 ${hasModels ? 'text-wells-dark-grey' : 'text-wells-warm-grey'}`} />
                    <span className={`capitalize ${hasModels ? 'text-wells-dark-grey' : 'text-wells-warm-grey'}`}>
                      {task.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </label>
                )
              })
            })()}
          </div>
        </div>

        {/* Background Search Indicator */}
        {showBackgroundSearchIndicator && (
          <div className="mb-6 animate-fade-in">
            <div className="card-floating p-4 border border-wells-warm-grey/20 bg-wells-light-beige/50">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gradient-to-br from-wells-dark-grey to-wells-warm-grey rounded-full flex items-center justify-center shadow-md">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-wells-dark-grey mb-1">
                    Searching for more models...
                  </h4>
                  <p className="text-xs text-wells-warm-grey">
                    We're finding additional models that match your search. This won't interrupt your browsing.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-wells-dark-grey/30 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-wells-dark-grey/30 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-wells-dark-grey/30 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gemini 3 Pro Ready Message */}
        {showGeminiReady && (
          <div className="text-center mb-4 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-full text-sm font-medium text-wells-dark-grey">
              <Zap className="w-4 h-4 text-blue-600" />
              <span>Gemini 3 Pro Ready!</span>
            </div>
          </div>
        )}

        {/* Model Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {modelViewStore.displayedModels.map((model, index) => {
            const TaskIcon = taskIcons[model.task as keyof typeof taskIcons] || Grid
            const isTopThree = modelViewStore.currentPage === 1 && index < 3
            const topRank = index + 1 // Only for first 3 models on page 1 

            return (
              <div
                key={model.id}
                data-model-source={model.source}
                className={`card-floating p-3 hover:shadow-xl transition-all cursor-pointer group flex flex-col h-[350px] ${isTopThree ? 'border-2 border-wells-dark-grey/10' : ''
                  }`}
              >
                {/* Rank Badge - Only for first 3 models on page 1 */}
                {isTopThree && (
                  <div className="flex items-center justify-between mb-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${topRank === 1 ? 'bg-yellow-100 text-yellow-800' :
                      topRank === 2 ? 'bg-gray-100 text-gray-700' :
                        topRank === 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                      }`}>
                      Top {topRank}
                    </div>
                  </div>
                )}

                {/* Model Type Icon */}
                <div className="flex items-center justify-center mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-wells-dark-grey/5 to-wells-dark-grey/10 rounded-xl flex items-center justify-center border border-wells-warm-grey/20">
                    {model.id?.toLowerCase().includes('gemini') ? (
                      <Image src="/icons/gemini-icon.svg" alt="Gemini" width={40} height={40} />
                    ) : (
                      <TaskIcon className="w-6 h-6 text-wells-dark-grey" />
                    )}
                  </div>
                </div>

                {/* Model Info */}
                <div className="mb-1">
                  <div className="flex items-center gap-2 mb-2">
                    {/* Source badge - hidden for now */}
                    {false && (
                      <span className={`text-xs px-2 py-1 rounded font-medium ${model.source === 'roboflow'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-orange-50 text-orange-700'
                        }`}>
                        {model.source}
                      </span>
                    )}
                    {/* Model Type Badge - hidden for now */}
                    {false && model.modelTypeInfo && (
                      <span className={`text-xs px-2 py-1 rounded font-medium ${model.modelTypeInfo?.type === 'custom'
                        ? 'bg-green-50 text-green-700'
                        : model.modelTypeInfo?.type === 'generative'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-50 text-gray-700'
                        }`}>
                        {model.modelTypeInfo?.displayLabel}
                      </span>
                    )}
                    {/* Fallback to task if no modelTypeInfo - hidden for now */}
                    {false && !model.modelTypeInfo && (
                      <span className="text-xs px-2 py-1 bg-wells-warm-grey/10 text-wells-dark-grey rounded font-medium capitalize">
                        {model.task}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-lg text-wells-dark-grey line-clamp-1 mb-1 group-hover:text-wells-warm-grey transition-colors">
                    {model.name}
                  </h3>
                  <p className="text-sm text-wells-warm-grey">by {model.author}</p>
                </div>

                {/* Description - hidden for now */}
                {false && (
                  <p className="text-sm text-wells-warm-grey line-clamp-3 mb-4 flex-grow min-h-[80px]">
                    {model.modelTypeInfo?.description || model.description || 'No description available'}
                  </p>
                )}

                {/* Metrics */}
                <div className="flex flex-wrap gap-2 mb-2 flex-shrink-0">
                  {/* Show different metrics based on model source */}
                  {model.source === 'huggingface' && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-wells-warm-grey/5 rounded text-xs">
                      <Download className="w-3 h-3 text-wells-warm-grey" />
                      <span className="font-medium">{formatNumber(model.downloads)}</span>
                    </div>
                  )}
                  {model.supportsInference ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium">
                      <CheckCircle className="w-3 h-3" />
                      <span>✓ Works</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-medium" title="No Inference API support">
                      <AlertCircle className="w-3 h-3" />
                      <span>⚠️ No Inference</span>
                    </div>
                  )}
                  {/* Warning for models without predefined classes - hidden for now */}
                  {false && model.modelTypeInfo?.type === 'unspecified' && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs font-medium" title="No predefined labels — responses vary by prompt">
                      <AlertCircle className="w-3 h-3" />
                      <span>⚠️ Variable Output</span>
                    </div>
                  )}
                  {model.platforms?.includes('mobile') && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium">
                      <Smartphone className="w-3 h-3" />
                      <span>Mobile</span>
                    </div>
                  )}
                  {model.frameworks?.slice(0, 2).map((fw) => (
                    <div key={fw} className="px-2 py-1 bg-wells-warm-grey/5 rounded text-xs text-wells-dark-grey">
                      {fw}
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-auto flex-shrink-0">
                  <button
                    ref={model.id?.toLowerCase().includes('gemini') && modelList[0]?.id === model.id ? geminiButtonRef : null}
                    data-model-id={model.id}
                    onClick={() => {
                      console.log('🔘 Use Model button clicked for:', model.id, model.name)
                      handleSelectModel(model)
                    }}
                    className="flex-1 px-4 py-3 bg-wells-dark-grey text-white rounded-lg hover:bg-wells-warm-grey transition-colors font-semibold text-sm flex items-center justify-center gap-2 group-hover:scale-[1.02] transition-transform"
                  >
                    Use Model
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <a
                    href={model.modelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 border-2 border-wells-warm-grey/30 rounded-lg hover:border-wells-dark-grey/50 hover:bg-wells-warm-grey/5 transition-all"
                    title="View Details"
                  >
                    <ExternalLink className="w-4 h-4 text-wells-dark-grey" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        {/* Improved Pagination */}
        {modelViewStore.totalPages > 1 && (
          <div className="flex flex-col items-center gap-6 mt-8">
            {/* Page Numbers with Smart Display */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {/* Previous Button */}
              {modelViewStore.currentPage > 1 && (
                <button
                  onClick={() => {
                    modelViewStore.goToPreviousPage()
                    // No API call needed - client-side pagination
                  }}
                  className="px-5 py-2.5 bg-wells-dark-grey/10 hover:bg-wells-dark-grey/20 text-wells-dark-grey rounded-xl transition-all font-semibold flex items-center gap-2 shadow-sm hover:shadow-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
              )}

              {/* Smart Page Number Display */}
              {(() => {
                const current = modelViewStore.currentPage
                const total = modelViewStore.totalPages
                const pages: (number | string)[] = []

                // Always show first page
                pages.push(1)

                // Show pages around current page
                if (current > 3) pages.push('...')

                for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
                  pages.push(i)
                }

                // Show last page
                if (current < total - 2) pages.push('...')
                if (total > 1) pages.push(total)

                return pages.map((pageNum, idx) => {
                  if (pageNum === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-2 text-wells-warm-grey">
                        •••
                      </span>
                    )
                  }

                  const isCurrentPage = pageNum === current

                  return (
                    <button
                      key={pageNum}
                      onClick={() => {
                        if (pageNum !== current) {
                          modelViewStore.setCurrentPage(pageNum as number)
                          // No API call needed - client-side pagination
                        }
                      }}
                      style={{
                        cursor: pageNum === current ? 'default' : 'pointer',
                        pointerEvents: pageNum === current ? 'none' : 'auto'
                      }}
                      className={`
                        min-w-[44px] h-11 px-4 rounded-xl font-bold transition-all duration-200
                        ${isCurrentPage
                          ? 'bg-wells-dark-grey text-white shadow-wells-lg scale-110'
                          : 'bg-wells-warm-grey/10 hover:bg-wells-warm-grey/20 text-wells-dark-grey hover:scale-105 shadow-sm'
                        }
                      `}
                    >
                      {pageNum}
                    </button>
                  )
                })
              })()}

              {/* Next Button */}
              {modelViewStore.currentPage < modelViewStore.totalPages && (
                <button
                  onClick={() => {
                    modelViewStore.goToNextPage()
                    // No API call needed - client-side pagination
                  }}
                  className="px-5 py-2.5 bg-wells-dark-grey/10 hover:bg-wells-dark-grey/20 text-wells-dark-grey rounded-xl transition-all font-semibold flex items-center gap-2 shadow-sm hover:shadow-md"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>

            {/* Results Count with Better Styling */}
            <div className="flex items-center gap-3 px-6 py-3 bg-wells-warm-grey/10 rounded-full">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-wells-dark-grey rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-wells-dark-grey">
                  Page {modelViewStore.currentPage} of {modelViewStore.totalPages}
                </span>
              </div>
              <div className="w-px h-4 bg-wells-warm-grey/30"></div>
              <span className="text-sm text-wells-warm-grey">
                Showing {modelViewStore.displayedModels.length} models
              </span>
            </div>
          </div>
        )}

      </div>
    )
  }

  // Get dynamic heading and examples based on task type
  const getHeading = () => {
    switch (selectedTaskType) {
      case 'detection':
        return 'What are you trying to detect?'
      case 'classification':
        return 'What are you trying to classify?'
      case 'segmentation':
        return 'What are you trying to segment?'
      default:
        return 'What are you trying to detect?'
    }
  }

  const getExamples = () => {
    return EXAMPLE_QUERIES_BY_TASK[selectedTaskType] || EXAMPLE_QUERIES
  }

  // Show input form (Step 1)
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Task Type Selector */}
      <div className="mb-8">
        <div className="flex items-center justify-center mb-4">
          <label className="text-sm font-medium text-wells-dark-grey mr-3">
            Task Type:
          </label>
          <TaskTypeSelectDropdown
            selectedTaskType={selectedTaskType}
            onTaskTypeChange={(newTaskType) => {
              setSelectedTaskType(newTaskType)
              // Clear query text when task type changes
              modelViewStore.setQueryText('')
            }}
          />
        </div>
      </div>

      {/* Step 1: Define Your Use Case */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-wells-warm-grey/10 rounded-full mb-4">
          <Zap className="w-4 h-4 text-wells-dark-grey" />
          <span className="text-sm font-medium text-wells-dark-grey">Step 1</span>
        </div>
        <h2 className="text-3xl font-serif font-bold text-wells-dark-grey mb-3">
          {getHeading()}
        </h2>
        <p className="text-wells-warm-grey">
          {selectedTaskType === 'detection' && 'Example: Detect objects in images, identify items, or locate elements'}
          {selectedTaskType === 'classification' && 'Example: Classify images, categorize content, or identify types'}
          {selectedTaskType === 'segmentation' && 'Example: Segment regions, separate objects, or identify boundaries'}
        </p>
      </div>

      {/* Input Form */}
      <div className="card-floating p-6 mb-6">
        <label className="block text-sm font-medium text-wells-dark-grey mb-2">
          Your Use Case
        </label>
        <textarea
          value={modelViewStore.queryText}
          onChange={(e) => modelViewStore.setQueryText(e.target.value)}
          placeholder={
            selectedTaskType === 'detection' 
              ? "I want to detect trash in images from beach cleanups..."
              : selectedTaskType === 'classification'
              ? "I want to classify product quality as pass or fail..."
              : "I want to segment building components in architectural images..."
          }
          className="w-full px-4 py-3 text-base border-2 border-wells-warm-grey/30 rounded-xl focus:border-wells-dark-grey focus:outline-none resize-none transition-colors"
          rows={4}
          maxLength={500}
          disabled={modelViewStore.isSearching}
        />

        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-wells-warm-grey">
            {modelViewStore.queryText.length} / 500
            {modelViewStore.queryText.length < 10 && ` (${10 - modelViewStore.queryText.length} more needed)`}
          </span>

          <div className="flex justify-center">
            <button
              onClick={handleSearch}
              disabled={modelViewStore.queryText.length < 10 || modelViewStore.isSearching}
              className={`px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${modelViewStore.queryText.length >= 10 && !modelViewStore.isSearching
                ? 'bg-wells-dark-grey text-white hover:bg-wells-warm-grey shadow-lg hover:shadow-xl'
                : 'bg-wells-warm-grey/20 text-wells-warm-grey cursor-not-allowed'
                }`}
            >
              {modelViewStore.isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Searching models...
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Example Queries */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 justify-center text-sm text-wells-warm-grey">
          <Lightbulb className="w-4 h-4" />
          <span>Try these examples:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {getExamples().map((example, index) => (
            <button
              key={index}
              onClick={() => modelViewStore.setQueryText(example)}
              className="p-3 text-left bg-white border border-wells-warm-grey/20 rounded-lg hover:border-wells-dark-grey/30 hover:shadow-md transition-all text-sm text-wells-dark-grey"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

    </div>
  )
})

// Helper function to format large numbers
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

export default GuidedModelFlow
