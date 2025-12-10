'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { CVResponse } from '@/types'
import { Clock, ChevronDown, ChevronUp, Download, Eye, EyeOff, Copy } from 'lucide-react'
import OverlayRenderer from './OverlayRenderer'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { modelViewStore } from '@/stores/modelViewStore'
import { useNotification } from '@/contexts/NotificationContext'

interface ResultsDisplayProps {
  response: CVResponse | null
  selectedImage: string | null
}

type LabelDisplayMode = 'confidence' | 'label'

const ResultsDisplay = observer(function ResultsDisplay({ response, selectedImage }: ResultsDisplayProps) {
  const [labelDisplay, setLabelDisplay] = useState<LabelDisplayMode>('confidence')
  const [showDetectionList, setShowDetectionList] = useState(true)
  const [showOverlays, setShowOverlays] = useState(true)
  const [showRawJSON, setShowRawJSON] = useState(false)
  const { showNotification } = useNotification()
  
  // Determine task type
  const currentTask = response?.task || 'object-detection'
  const previousTaskRef = useRef<string | null>(null)
  
  // Get confidence threshold from MobX store
  const confidenceThreshold = modelViewStore.confidenceThreshold
  const [sliderValue, setSliderValue] = useState<number>(0)
  
  // Set task-specific default confidence threshold when task changes
  useEffect(() => {
    if (currentTask && currentTask !== previousTaskRef.current) {
      // Task has changed, set the default threshold for the new task
      modelViewStore.setConfidenceThresholdForTask(currentTask)
      previousTaskRef.current = currentTask
    } else if (!previousTaskRef.current && currentTask) {
      // First time setting task
      modelViewStore.setConfidenceThresholdForTask(currentTask)
      previousTaskRef.current = currentTask
    }
  }, [currentTask])
  
  // Sync local slider state with MobX store
  useEffect(() => {
    setSliderValue(Math.floor(confidenceThreshold * 100))
  }, [confidenceThreshold])

  // Filter results based on confidence
  const filteredDetections = useMemo(
    () => response?.results.detections?.filter(d => d.confidence >= confidenceThreshold) || [],
    [response?.results.detections, confidenceThreshold]
  )
  
  const filteredLabels = useMemo(
    () => response?.results.labels?.filter(l => l.score >= confidenceThreshold) || [],
    [response?.results.labels, confidenceThreshold]
  )
  
  const filteredKeypointDetections = useMemo(
    () => response?.results.keypoint_detections?.map(detection => ({
      ...detection,
      keypoints: detection.keypoints?.filter(kp => kp.confidence >= confidenceThreshold) || []
    })).filter(d => d.confidence >= confidenceThreshold) || [],
    [response?.results.keypoint_detections, confidenceThreshold]
  )
  
  const filteredSegmentationRegions = useMemo(
    () => response?.results.segmentation?.regions?.filter(r => {
      if ((r as any).confidence !== undefined && typeof (r as any).confidence === 'number') {
        return (r as any).confidence >= confidenceThreshold
      }
      return r.area >= confidenceThreshold
    }) || [],
    [response?.results.segmentation?.regions, confidenceThreshold]
  )

  const isProcessing = false // This would come from props if needed
  
  const getResultCount = () => {
    if (currentTask === 'detection' || currentTask.includes('detection')) {
      return `${filteredDetections.length} / ${response?.results.detections?.length || 0}`
    } else if (currentTask === 'classification' || currentTask.includes('classification')) {
      return filteredLabels.length
    } else if (currentTask === 'segmentation' || currentTask.includes('segmentation')) {
      return `${filteredSegmentationRegions.length} / ${response?.results.segmentation?.regions?.length || 0}`
    } else if (currentTask === 'keypoint-detection') {
      return `${filteredKeypointDetections.length} / ${response?.results.keypoint_detections?.length || 0}`
    }
    return 0
  }

  const getTaskBadge = () => {
    const badges: Record<string, { label: string; color: string }> = {
      'detection': { label: 'Detection', color: 'bg-red-50 text-red-600 border-red-100' },
      'object-detection': { label: 'Detection', color: 'bg-red-50 text-red-600 border-red-100' },
      'classification': { label: 'Classification', color: 'bg-blue-50 text-blue-600 border-blue-100' },
      'image-classification': { label: 'Classification', color: 'bg-blue-50 text-blue-600 border-blue-100' },
      'segmentation': { label: 'Segmentation', color: 'bg-green-50 text-green-600 border-green-100' },
      'multimodal': { label: 'Multimodal', color: 'bg-purple-50 text-purple-600 border-purple-100' },
      'keypoint-detection': { label: 'Keypoints', color: 'bg-purple-50 text-purple-600 border-purple-100' }
    }
    
    const badge = badges[currentTask] || badges['detection']
    
    return (
      <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium border', badge.color)}>
        {badge.label}
      </span>
    )
  }

  const formatProcessingTime = (time: number | string | undefined) => {
    if (!time) return 'N/A'
    const seconds = typeof time === 'string' ? parseFloat(time) : time
    return seconds < 1 ? `${Math.round(seconds * 1000)}ms` : `${seconds.toFixed(2)}s`
  }

  // Get results for display in list
  const getResultsForList = () => {
    if (currentTask === 'detection' || currentTask.includes('detection')) {
      return filteredDetections.map((det, index) => ({
        label: det.class,
        score: det.confidence,
        color: getColorForIndex(index)
      }))
    } else if (currentTask === 'classification' || currentTask.includes('classification')) {
      return filteredLabels.map((label, index) => ({
        label: label.class,
        score: label.score,
        color: getColorForIndex(index)
      }))
    } else if (currentTask === 'keypoint-detection') {
      return filteredKeypointDetections.map((det, index) => ({
        label: det.class,
        score: det.confidence,
        color: getColorForIndex(index)
      }))
    } else if (currentTask === 'segmentation' || currentTask.includes('segmentation')) {
      return filteredSegmentationRegions.map((region, index) => ({
        label: region.class,
        score: region.area,
        color: region.color || getColorForIndex(index)
      }))
    }
    return []
  }

  const getColorForIndex = (index: number) => {
    const colors = [
      '#ef4444', // red
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // yellow
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#84cc16', // lime
    ]
    return colors[index % colors.length]
  }

  const resultsForList = getResultsForList()
  const imageWidth = response?.image_metadata?.width || 640
  const imageHeight = response?.image_metadata?.height || 480

  // Handle JSON download
  const handleDownloadJSON = () => {
    const data = JSON.stringify(response, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `results-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Handle JSON copy to clipboard
  const handleCopyJSON = async () => {
    try {
      const data = JSON.stringify(response, null, 2)
      await navigator.clipboard.writeText(data)
      showNotification('JSON copied to clipboard', 'success')
    } catch (error) {
      console.error('Failed to copy JSON:', error)
      showNotification('Failed to copy JSON', 'error')
    }
  }

  if (!response || !selectedImage) {
    return (
      <div className="text-center py-12 text-wells-warm-grey">
        <p className="text-sm">No results to display</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with Status and Processing Time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-2 h-2 rounded-full',
            isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'
          )} />
          <span className="text-xs font-medium text-wells-dark-grey">
            {isProcessing ? 'Processing' : 'Complete'}
          </span>
          {getTaskBadge()}
        </div>
        
        {/* Processing Time - Small icon in top right */}
        {response.processing_time !== undefined && (
          <div className="flex items-center gap-1 text-xs text-wells-warm-grey">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">{formatProcessingTime(response.processing_time)}</span>
          </div>
        )}
      </div>

      {/* Processed Image with Overlays */}
      {selectedImage && (
        <div className="space-y-2">
          {/* Image Label and Prominent Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-wells-warm-grey uppercase tracking-wide">
              {showOverlays ? 'Processed Image' : 'Original Image'}
            </span>
            <button
              onClick={() => setShowOverlays(!showOverlays)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-wells-dark-grey bg-white border border-wells-warm-grey/20 hover:bg-gray-50 hover:border-wells-dark-grey/30 transition-colors shadow-sm"
            >
              {showOverlays ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  Hide Labels
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  Show Labels
                </>
              )}
            </button>
          </div>
          
          {/* Image with Optional Overlays */}
          <div className="relative rounded-lg overflow-hidden border border-wells-warm-grey/10 bg-gray-50">
            <Image
              src={selectedImage}
              alt={showOverlays ? "Image with detections" : "Original image"}
              width={imageWidth}
              height={imageHeight}
              className="w-full h-auto object-contain"
            />
            {/* Render overlays only if toggle is on */}
            {showOverlays && (
              <OverlayRenderer
                detections={filteredDetections}
                segmentation={filteredSegmentationRegions}
                keypointDetections={filteredKeypointDetections}
                imageWidth={imageWidth}
                imageHeight={imageHeight}
                task={currentTask}
                confidenceThreshold={confidenceThreshold}
                labelDisplayMode={labelDisplay === 'confidence' ? 'confidence' : 'labels'}
              />
            )}
          </div>
        </div>
      )}

      {/* Controls Bar - Compact */}
      <div className="flex items-center justify-between py-2 px-3 bg-gray-50/50 rounded-lg border border-wells-warm-grey/10 flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Confidence Slider */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-wells-warm-grey whitespace-nowrap">Confidence</span>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderValue}
              onChange={(e) => {
                const newValue = parseInt(e.target.value, 10)
                if (!isNaN(newValue) && newValue >= 0 && newValue <= 100) {
                  setSliderValue(newValue)
                  modelViewStore.setConfidenceThreshold(newValue / 100)
                }
              }}
              className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-wells-dark-grey"
            />
            <span className="text-xs font-semibold text-wells-dark-grey min-w-[32px]">
              {Math.round(confidenceThreshold * 100)}%
            </span>
          </div>

          {/* Label Display Toggle */}
          {((currentTask === 'detection' || currentTask.includes('detection')) || 
            (currentTask === 'keypoint-detection')) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-wells-warm-grey whitespace-nowrap">Label</span>
              <select
                value={labelDisplay}
                onChange={(e) => setLabelDisplay(e.target.value as LabelDisplayMode)}
                className="text-xs px-3 py-1 rounded-md border border-wells-warm-grey/20 bg-white text-wells-dark-grey focus:outline-none focus:border-wells-dark-grey hover:border-wells-dark-grey/40 transition-colors min-w-[140px]"
              >
                <option value="confidence">Show Confidence</option>
                <option value="label">Labels Only</option>
              </select>
            </div>
          )}
        </div>

        {/* Export Button - Only show when NOT in raw JSON view, icon-only */}
        {!showRawJSON && (
          <button
            onClick={handleDownloadJSON}
            className="p-2 rounded-md text-wells-warm-grey hover:text-wells-dark-grey hover:bg-gray-50 transition-colors flex-shrink-0"
            title="Download JSON"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Section - Collapsible */}
      <div className="border border-wells-warm-grey/10 rounded-lg overflow-hidden bg-white">
        {/* Header */}
        <div className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
          <button
            onClick={() => setShowDetectionList(!showDetectionList)}
            className="flex items-center gap-3 flex-1"
          >
            <span className="text-sm font-semibold text-wells-dark-grey">
              {currentTask === 'detection' || currentTask.includes('detection') 
                ? 'Detections' 
                : currentTask === 'classification' || currentTask.includes('classification')
                ? 'Classifications'
                : currentTask === 'keypoint-detection'
                ? 'Keypoint Detections'
                : 'Results'}
            </span>
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-wells-warm-grey rounded-full font-medium">
              {getResultCount()}
            </span>
            {showDetectionList ? (
              <ChevronUp className="w-4 h-4 text-wells-warm-grey" />
            ) : (
              <ChevronDown className="w-4 h-4 text-wells-warm-grey" />
            )}
          </button>
          
          <div className="flex items-center gap-2">
            {/* Download and Copy Icons - Only show when viewing raw JSON */}
            {showRawJSON && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownloadJSON()
                  }}
                  className="p-2 rounded-md text-wells-warm-grey hover:text-wells-dark-grey hover:bg-gray-50 transition-colors"
                  title="Download JSON"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopyJSON()
                  }}
                  className="p-2 rounded-md text-wells-warm-grey hover:text-wells-dark-grey hover:bg-gray-50 transition-colors"
                  title="Copy JSON"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </>
            )}
            
            {/* Toggle for Raw JSON View */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowRawJSON(!showRawJSON)
                if (!showRawJSON) {
                  setShowDetectionList(true)
                }
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                showRawJSON
                  ? "bg-wells-dark-grey text-white"
                  : "bg-white text-wells-dark-grey border border-wells-warm-grey/20 hover:bg-gray-50"
              )}
            >
              {showRawJSON ? 'View Results' : 'View JSON'}
            </button>
          </div>
        </div>

        {/* Content */}
        {showDetectionList && (
          <>
            {showRawJSON ? (
              /* Raw JSON View */
              <div className="px-4 py-4">
                {/* JSON Display */}
                <div className="bg-gray-50 rounded-lg border border-wells-warm-grey/10 p-4 max-h-96 overflow-auto">
                  <pre className="text-xs text-wells-dark-grey font-mono whitespace-pre-wrap break-words">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              /* Normal Results List */
              <>
                {resultsForList.length > 0 && (
                  <div className="divide-y divide-wells-warm-grey/5 max-h-64 overflow-y-auto">
                    {resultsForList.map((result: any, index: number) => (
                      <div
                        key={index}
                        className="px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: result.color }} 
                          />
                          <span className="text-sm text-wells-dark-grey">{result.label}</span>
                        </div>
                        <span className="text-sm font-semibold text-wells-dark-grey">
                          {Math.round((result.score || 0) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {resultsForList.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-wells-warm-grey">
                    No results above {Math.round(confidenceThreshold * 100)}% confidence
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Metadata Footer - Ultra Compact */}
      <div className="flex items-center justify-between text-xs text-wells-warm-grey/60 pt-1">
        <span>{response.timestamp ? new Date(response.timestamp).toLocaleString() : new Date().toLocaleString()}</span>
        {response.model_version && (
          <span className="text-wells-warm-grey/40">{response.model_version}</span>
        )}
      </div>
    </div>
  )
})

export default ResultsDisplay
