'use client'

import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { 
  Sparkles, ArrowRight, ArrowRightLeft, Box, Lightbulb, Download, ExternalLink, 
  Smartphone, ChevronDown, ChevronUp, Filter, Grid, Grid3X3, Image, Layers, 
  Layers3, MapPin, Square, Tag, Target, Type, Video, VideoIcon, AlertCircle, 
  CheckCircle, FileText, FileVideo, Zap, Eye, Scan, Focus, Camera, 
  ScanLine, ScanFace, ScanBarcode, ScanEye, ScanSearch, ScanText, Globe
} from 'lucide-react'
import { EXAMPLE_QUERIES } from '@/lib/keywordExtraction'
import { ModelMetadata } from '@/types/models'
import { modelViewStore } from '@/stores/modelViewStore'
import { useQueryRefine } from '@/hooks/useQueryRefine'
import { useModelSearch } from '@/hooks/useModelSearch'
import { useSaveModelSelection } from '@/hooks/useSaveModelSelection'
import ModelSearchSkeleton from './ModelSearchSkeleton'
import RoboflowSearchModal from './RoboflowSearchModal'

interface GuidedModelFlowProps {
  onModelSelect: (model: ModelMetadata) => void
}

const GuidedModelFlow = observer(({ onModelSelect }: GuidedModelFlowProps) => {
  const [showSearchBar, setShowSearchBar] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}`)
  const [isRoboflowSearchModalOpen, setIsRoboflowSearchModalOpen] = useState(false)

  // React Query hooks
  const queryRefineMutation = useQueryRefine()
  const searchModels = useModelSearch()  // Renamed for clarity
  const saveSelectionMutation = useSaveModelSelection()

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


  const handleRoboflowModelsFound = (models: ModelMetadata[]) => {
    // Add Roboflow models to the current model list
    modelViewStore.addModels(models)
    setIsRoboflowSearchModalOpen(false)
  }

  const handleSearch = async () => {
    if (modelViewStore.queryText.length < 10) return

    try {
      // Step 1: Refine query
      const refineResult = await queryRefineMutation.mutateAsync({
        query: modelViewStore.queryText,
        userId: 'anonymous'
      })

      // Store query_id globally for inference result saving 
      if (typeof window !== 'undefined') {
        (window as any).__queryId = refineResult.query_id
      }

      // Step 2: Search for models using the unified endpoint (includes both HF and Roboflow)
      const searchResult = await searchModels.mutateAsync({
        keywords: refineResult.keywords,
        task_type: refineResult.task_type,
        limit: 20,
        page: 1
      })

      // The unified search already returns both Hugging Face and Roboflow models
      const combinedModels = searchResult?.models || []

      // Update store with combined results
      modelViewStore.setModelList(combinedModels)
      modelViewStore.setCurrentPage(1)
      modelViewStore.setTotalPages(Math.ceil(combinedModels.length / 6)) // 6 models per page

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
              <Sparkles className="w-4 h-4 text-wells-dark-grey" />
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
            <Sparkles className="w-4 h-4 text-wells-dark-grey" />
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
            <button
              onClick={() => modelViewStore.setActiveFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                modelViewStore.activeFilter === 'all'
                  ? 'bg-wells-dark-grey text-white'
                  : 'bg-wells-warm-grey/10 text-wells-dark-grey hover:bg-wells-warm-grey/20'
              }`}
            >
              All
            </button>
            {(() => {
              // Get unique task types from current models
              const uniqueTasks = Array.from(new Set(modelViewStore.displayedModels.map(model => model.task)))
              
              // Define common CV task filters to always show
              const commonTasks = ['detection', 'classification', 'segmentation']
              
              // Combine all tasks
              const allTasks = Array.from(new Set([...uniqueTasks, ...commonTasks]))
              
              return allTasks.map((task) => {
                const Icon = taskIcons[task as keyof typeof taskIcons] || Grid
                const hasModels = uniqueTasks.includes(task) || (task === 'segmentation' && (uniqueTasks.includes('segmentation') || uniqueTasks.includes('instance-segmentation')))
                
                return (
                  <button
                    key={task}
                    onClick={() => modelViewStore.setActiveFilter(task)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      modelViewStore.activeFilter === task
                        ? 'bg-wells-dark-grey text-white shadow-md'
                        : hasModels 
                          ? 'bg-wells-warm-grey/10 text-wells-dark-grey hover:bg-wells-warm-grey/20 hover:shadow-sm'
                          : 'bg-wells-warm-grey/5 text-wells-warm-grey/70 cursor-not-allowed opacity-60'
                    }`}
                    disabled={!hasModels}
                    title={!hasModels ? `No ${task} models found in current search` : `Filter by ${task}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="capitalize">{task.replace(/([A-Z])/g, ' $1').trim()}</span>
                    {!hasModels && <span className="text-xs opacity-50">(0)</span>}
                  </button>
                )
              })
            })()}
          </div>
        </div>

        {/* Model Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {modelViewStore.displayedModels.map((model, index) => {
            const TaskIcon = taskIcons[model.task as keyof typeof taskIcons] || Grid
            const isTopThree = modelViewStore.currentPage === 1 && index < 3
            
            return (
              <div 
                key={model.id} 
                className={`card-floating p-3 hover:shadow-xl transition-all cursor-pointer group flex flex-col h-[350px] ${
                  isTopThree ? 'border-2 border-wells-dark-grey/10' : ''
                }`}
              >
                {/* Rank Badge */}
                {isTopThree && (
                  <div className="flex items-center justify-between mb-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-800' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      #{index + 1} Top Match
                    </div>
                  </div>
                )}
                
                {/* Model Type Icon */}
                <div className="flex items-center justify-center mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-wells-dark-grey/5 to-wells-dark-grey/10 rounded-xl flex items-center justify-center border border-wells-warm-grey/20">
                    <TaskIcon className="w-6 h-6 text-wells-dark-grey" />
                  </div>
                </div>

                {/* Model Info */}
                <div className="mb-1">
                  <div className="flex items-center gap-2 mb-2">
                    {/* Source badge - hidden for now */}
                    {false && (
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      model.source === 'roboflow' 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'bg-orange-50 text-orange-700'
                    }`}>
                      {model.source}
                    </span>
                    )}
                    {/* Model Type Badge - hidden for now */}
                    {false && model.modelTypeInfo && (
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        model.modelTypeInfo?.type === 'custom' 
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
                  {model.source === 'roboflow' ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-wells-warm-grey/5 rounded text-xs">
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <Image className="w-3 h-3 text-wells-warm-grey" />
                      <span className="font-medium">{formatNumber(model.trainingImages || model.downloads)} training images</span>
                    </div>
                  ) : (
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
                  {model.platforms.includes('mobile') && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium">
                      <Smartphone className="w-3 h-3" />
                      <span>Mobile</span>
                    </div>
                  )}
                  {model.frameworks.slice(0, 2).map((fw) => (
                    <div key={fw} className="px-2 py-1 bg-wells-warm-grey/5 rounded text-xs text-wells-dark-grey">
                      {fw}
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-auto flex-shrink-0">
                  <button
                    onClick={() => handleSelectModel(model)}
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
                    searchModels.mutate({
                      keywords: modelViewStore.refinedKeywords,
                      task_type: modelViewStore.taskType,
                      page: modelViewStore.currentPage - 1
                    })
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
                          searchModels.mutate({
                            keywords: modelViewStore.refinedKeywords,
                            task_type: modelViewStore.taskType,
                            page: pageNum as number
                          })
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
                    searchModels.mutate({
                      keywords: modelViewStore.refinedKeywords,
                      task_type: modelViewStore.taskType,
                      page: modelViewStore.currentPage + 1
                    })
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

  // Show input form (Step 1)
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Step 1: Define Your Use Case */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-wells-warm-grey/10 rounded-full mb-4">
          <Sparkles className="w-4 h-4 text-wells-dark-grey" />
          <span className="text-sm font-medium text-wells-dark-grey">Step 1</span>
        </div>
        <h2 className="text-3xl font-serif font-bold text-wells-dark-grey mb-3">
          What are you trying to detect?
        </h2>
        <p className="text-wells-warm-grey">
          Example: Detect objects in images, classify scenes, or analyze visual content
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
          placeholder="I want to detect trash in images from beach cleanups..."
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
          
          <div className="flex gap-3">
            <button
              onClick={handleSearch}
              disabled={modelViewStore.queryText.length < 10 || modelViewStore.isSearching}
              className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                modelViewStore.queryText.length >= 10 && !modelViewStore.isSearching
                  ? 'bg-wells-dark-grey text-white hover:bg-wells-warm-grey shadow-lg hover:shadow-xl'
                  : 'bg-wells-warm-grey/20 text-wells-warm-grey cursor-not-allowed'
              }`}
            >
              {modelViewStore.isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing your use case...
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            
            <button
              onClick={() => setIsRoboflowSearchModalOpen(true)}
              disabled={modelViewStore.queryText.length < 10 || modelViewStore.isSearching}
              className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                modelViewStore.queryText.length >= 10 && !modelViewStore.isSearching
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                  : 'bg-wells-warm-grey/20 text-wells-warm-grey cursor-not-allowed'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Search Roboflow</span>
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
          {EXAMPLE_QUERIES.map((example, index) => (
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
      
      {/* Roboflow Search Modal */}
      <RoboflowSearchModal
        isOpen={isRoboflowSearchModalOpen}
        onClose={() => setIsRoboflowSearchModalOpen(false)}
        onModelsFound={handleRoboflowModelsFound}
        initialKeywords={modelViewStore.refinedKeywords}
      />
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
