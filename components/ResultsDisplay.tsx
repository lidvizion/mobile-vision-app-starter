'use client'

import { useState, useEffect, useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import { CVResponse } from '@/types'
import { formatTimestamp, formatConfidence } from '@/lib/utils'
import { Clock, Zap, Image as ImageIcon, BarChart3, Target, Tag, Palette, Code, List, Settings } from 'lucide-react'
import OverlayRenderer from './OverlayRenderer'
import EditableAnnotationOverlay from './EditableAnnotationOverlay'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { modelViewStore } from '@/stores/modelViewStore'

interface ResultsDisplayProps {
  response: CVResponse | null
  selectedImage: string | null
}

type LabelDisplayMode = 'boxes' | 'labels' | 'confidence' | 'shapes'

const ResultsDisplay = observer(function ResultsDisplay({ response, selectedImage }: ResultsDisplayProps) {
  const [viewMode, setViewMode] = useState<'json' | 'classes'>('classes')
  const [sliderValue, setSliderValue] = useState<number>(0)
  const [labelDisplayMode, setLabelDisplayMode] = useState<LabelDisplayMode>('confidence')
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  
  // Get confidence threshold from MobX store (this will trigger re-render when it changes)
  const confidenceThreshold = modelViewStore.confidenceThreshold
  
  // Sync local slider state with MobX store when store changes externally
  useEffect(() => {
    setSliderValue(Math.floor(confidenceThreshold * 100))
  }, [confidenceThreshold])
  
  // Filter results client-side based on confidence threshold
  // Use useMemo to prevent dependency issues in useEffect
  const filteredDetections = useMemo(
    () => response?.results.detections?.filter(d => d.confidence >= confidenceThreshold) || [],
    [response?.results.detections, confidenceThreshold]
  )
  const [editedDetections, setEditedDetections] = useState(filteredDetections)
  
  // Update editedDetections when filteredDetections change (but not when editing)
  useEffect(() => {
    if (!isEditing) {
      setEditedDetections(filteredDetections)
    }
  }, [filteredDetections, isEditing])
  const filteredLabels = response?.results.labels?.filter(l => l.score >= confidenceThreshold) || []
  const filteredKeypointDetections = response?.results.keypoint_detections?.map(detection => ({
    ...detection,
    // Filter keypoints within each detection
    keypoints: detection.keypoints?.filter(kp => kp.confidence >= confidenceThreshold) || []
  })).filter(d => d.confidence >= confidenceThreshold) || []
  const filteredSegmentationRegions = response?.results.segmentation?.regions?.filter(r => {
    // Some segmentation regions might not have confidence, include them if they don't 
    // If region has confidence property, filter by it; otherwise include all 
    return (r as any).confidence === undefined || (r as any).confidence >= confidenceThreshold
  }) || []
  
  // Create filtered response for JSON view
  const filteredResponse = response ? {
    ...response,
    results: {
      ...response.results,
      detections: filteredDetections,
      labels: filteredLabels,
      keypoint_detections: filteredKeypointDetections,
      segmentation: response.results.segmentation ? {
        ...response.results.segmentation,
        regions: filteredSegmentationRegions
      } : undefined
    }
  } : null

  if (!response || !selectedImage) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-wells-dark-grey rounded-xl flex items-center justify-center shadow-wells-md">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-serif font-semibold text-wells-dark-grey">Results</h3>
            <p className="text-sm text-wells-warm-grey">CV analysis results will appear here</p>
          </div>
        </div>
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-wells-light-beige rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <ImageIcon className="w-10 h-10 text-wells-warm-grey" />
          </div>
          <h4 className="text-xl font-serif font-semibold text-wells-dark-grey mb-3">No Results Yet</h4>
          <p className="text-wells-warm-grey max-w-md mx-auto leading-relaxed">
            Upload an image to see computer vision analysis results and insights
          </p>
        </div>
      </div>
    )
  }

  const getTaskIcon = (task: string) => {
    const icons = {
      detection: Target,
      classification: Tag,
      segmentation: Palette,
      'instance-segmentation': Palette,
      'keypoint-detection': Target,
      'multi-type': BarChart3
    }
    return icons[task as keyof typeof icons] || BarChart3
  }

  const getTaskColor = (task: string) => {
    const colors = {
      detection: 'bg-red-50 text-red-700 border-red-200',
      classification: 'bg-blue-50 text-blue-700 border-blue-200',
      segmentation: 'bg-green-50 text-green-700 border-green-200',
      'instance-segmentation': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'keypoint-detection': 'bg-purple-50 text-purple-700 border-purple-200',
      'multi-type': 'bg-purple-50 text-purple-700 border-purple-200'
    }
    return colors[task as keyof typeof colors] || 'bg-wells-light-beige text-wells-warm-grey border-wells-warm-grey/20'
  }

  const TaskIcon = getTaskIcon(response.task)

  return (
    <div className="card-floating p-6">
      <div className="mb-6">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-wells-dark-grey rounded-xl flex items-center justify-center shadow-wells-md">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-semibold text-wells-dark-grey">Analysis Results</h3>
              <p className="text-sm text-wells-warm-grey">Computer vision analysis complete</p>
            </div>
          </div>
          <div className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border shadow-wells-sm',
            getTaskColor(response.task)
          )}>
            <TaskIcon className="w-4 h-4" />
            <span className="capitalize">{response.task.replace('-', ' ')}</span>
          </div>
        </div>
        
        {/* Controls Row - Roboflow style */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Confidence Threshold Slider */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-wells-dark-grey whitespace-nowrap">
              Confidence: {Math.floor(confidenceThreshold * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={sliderValue}
              onChange={(e) => {
                const newValue = parseInt(e.target.value, 10)
                if (!isNaN(newValue) && newValue >= 0 && newValue <= 100) {
                  setSliderValue(newValue)
                  const thresholdValue = newValue / 100
                  modelViewStore.setConfidenceThreshold(thresholdValue)
                }
              }}
              className="w-32 h-2 bg-wells-warm-grey rounded-lg appearance-none cursor-pointer accent-wells-dark-grey"
              style={{
                background: `linear-gradient(to right, #2C2C2C 0%, #2C2C2C ${sliderValue}%, #D4D4D4 ${sliderValue}%, #D4D4D4 100%)`
              }}
            />
            {confidenceThreshold > 0 && (
              <button
                onClick={() => modelViewStore.resetConfidenceThreshold()}
                className="px-2 py-1 text-xs font-medium text-wells-dark-grey bg-wells-white rounded-lg border border-wells-warm-grey/20 hover:bg-wells-warm-grey/10 transition-colors"
                title="Reset to show all"
              >
                Reset
              </button>
            )}
          </div>
          
          {/* Label Display Mode Dropdown - Roboflow style */}
          {(response.results.detections && response.results.detections.length > 0) || 
           (response.results.keypoint_detections && response.results.keypoint_detections.length > 0) ||
           (response.results.segmentation && response.results.segmentation.regions && response.results.segmentation.regions.length > 0) ? (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-wells-dark-grey whitespace-nowrap">
                Label Display:
              </label>
              <select
                value={labelDisplayMode}
                onChange={(e) => setLabelDisplayMode(e.target.value as LabelDisplayMode)}
                className="px-3 py-1.5 text-sm border border-wells-warm-grey/30 rounded-lg bg-white text-wells-dark-grey focus:border-wells-dark-grey focus:outline-none min-w-[140px]"
                disabled={isEditing}
              >
                {response.results.segmentation && response.results.segmentation.regions && response.results.segmentation.regions.length > 0 ? (
                  <>
                    <option value="shapes">Shapes</option>
                    <option value="labels">Labels</option>
                    <option value="confidence">Confidence</option>
                  </>
                ) : (
                  <>
                    <option value="boxes">Boxes</option>
                    <option value="labels">Labels</option>
                    <option value="confidence">Confidence</option>
                  </>
                )}
              </select>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={cn(
                  "p-1.5 rounded-lg border transition-colors",
                  isEditing 
                    ? "bg-wells-dark-grey text-white border-wells-dark-grey" 
                    : "bg-white text-wells-dark-grey border-wells-warm-grey/30 hover:bg-wells-warm-grey/10"
                )}
                title={isEditing ? "Exit annotation editor" : "Edit annotations"}
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>


      {/* Image on its own row */}
      <div className="relative rounded-2xl overflow-hidden border border-wells-warm-grey/20 shadow-md mb-6">
        <Image
          src={selectedImage}
          alt="Processed"
          width={800}
          height={400}
          className="w-full h-full object-contain bg-wells-light-beige"
        />
        {isEditing && response.results.detections && response.results.detections.length > 0 ? (
          <EditableAnnotationOverlay
            detections={editedDetections}
            imageWidth={response.image_metadata.width}
            imageHeight={response.image_metadata.height}
            onDetectionsChange={setEditedDetections}
            onSave={async (detections) => {
              setIsSaving(true)
              try {
                // Save edited annotations to MongoDB
                const saveResponse = await fetch('/api/save-edited-annotations', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    original_timestamp: response.timestamp,
                    original_image_url: selectedImage,
                    model_id: response.model_version || 'unknown',
                    task: response.task,
                    edited_detections: detections,
                    version: 2
                  })
                })
                
                if (!saveResponse.ok) {
                  throw new Error('Failed to save edited annotations')
                }
                
                setIsEditing(false)
                // Optionally show success message
              } catch (error) {
                console.error('Error saving edited annotations:', error)
                alert('Failed to save edited annotations. Please try again.')
              } finally {
                setIsSaving(false)
              }
            }}
            onCancel={() => {
              setEditedDetections(filteredDetections)
              setIsEditing(false)
            }}
          />
        ) : (
          <OverlayRenderer
            detections={filteredDetections}
            segmentation={filteredSegmentationRegions}
            keypointDetections={filteredKeypointDetections}
            imageWidth={response.image_metadata.width}
            imageHeight={response.image_metadata.height}
            task={response.task}
            confidenceThreshold={confidenceThreshold}
            labelDisplayMode={labelDisplayMode}
          />
        )}
      </div>
      
      {/* Save/Cancel buttons when editing */}
      {isEditing && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={async () => {
              setIsSaving(true)
              try {
                const saveResponse = await fetch('/api/save-edited-annotations', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    original_timestamp: response.timestamp,
                    original_image_url: selectedImage,
                    model_id: response.model_version || 'unknown',
                    task: response.task,
                    edited_detections: editedDetections,
                    version: 2
                  })
                })
                
                if (!saveResponse.ok) {
                  throw new Error('Failed to save edited annotations')
                }
                
                setIsEditing(false)
              } catch (error) {
                console.error('Error saving edited annotations:', error)
                alert('Failed to save edited annotations. Please try again.')
              } finally {
                setIsSaving(false)
              }
            }}
            disabled={isSaving}
            className="px-4 py-2 bg-wells-dark-grey text-white rounded-lg hover:bg-wells-dark-grey/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Annotations'}
          </button>
          <button
            onClick={() => {
              setEditedDetections(filteredDetections)
              setIsEditing(false)
            }}
            disabled={isSaving}
            className="px-4 py-2 bg-wells-warm-grey/20 text-wells-dark-grey rounded-lg hover:bg-wells-warm-grey/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Output section with toggle */}
      <div className="bg-wells-light-beige rounded-2xl border border-wells-warm-grey/20 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-wells-dark-grey rounded-lg flex items-center justify-center">
              {viewMode === 'json' ? (
                <Code className="w-4 h-4 text-white" />
              ) : (
                <List className="w-4 h-4 text-white" />
              )}
            </div>
            <h4 className="text-lg font-serif font-semibold text-wells-dark-grey">
              {viewMode === 'json' ? 'JSON Output' : 'Detection Results'}
            </h4>
          </div>
          
          {/* Toggle buttons */}
          <div className="flex bg-wells-white rounded-lg border border-wells-warm-grey/20 p-1">
            <button
              onClick={() => setViewMode('classes')}
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
                viewMode === 'classes'
                  ? 'bg-wells-dark-grey text-white shadow-sm'
                  : 'text-wells-warm-grey hover:text-wells-dark-grey'
              )}
            >
              <List className="w-4 h-4" />
              Classes
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
                viewMode === 'json'
                  ? 'bg-wells-dark-grey text-white shadow-sm'
                  : 'text-wells-warm-grey hover:text-wells-dark-grey'
              )}
            >
              <Code className="w-4 h-4" />
              JSON
            </button>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="bg-wells-white rounded-xl border border-wells-warm-grey/20 p-4 overflow-auto max-h-96">
          {viewMode === 'json' ? (
            <div>
              <div className="mb-2 text-xs text-wells-warm-grey flex items-center justify-between">
                <span>Filtered by confidence threshold: {Math.floor(confidenceThreshold * 100)}%</span>
                {confidenceThreshold > 0 && (
                  <button
                    onClick={() => modelViewStore.resetConfidenceThreshold()}
                    className="px-2 py-1 text-xs font-medium text-wells-dark-grey bg-wells-light-beige rounded border border-wells-warm-grey/20 hover:bg-wells-warm-grey/10 transition-colors"
                  >
                    Show All
                  </button>
                )}
              </div>
              <pre className="text-sm text-wells-dark-grey whitespace-pre-wrap font-mono">
                {JSON.stringify(filteredResponse || response, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Detection Results */}
              {response.results.detections && response.results.detections.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-wells-dark-grey">Detections</span>
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      {filteredDetections.length} / {response.results.detections.length} objects
                    </span>
                    {filteredDetections.length < response.results.detections.length && (
                      <span className="px-2 py-1 bg-wells-warm-grey/20 text-wells-warm-grey text-xs font-medium rounded-full">
                        ({response.results.detections.length - filteredDetections.length} hidden)
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {filteredDetections.map((detection, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-wells-light-beige rounded-lg border border-wells-warm-grey/20">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="font-medium text-wells-dark-grey capitalize">{detection.class}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-wells-dark-grey">{formatConfidence(detection.confidence)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Classification Results */}
              {response.results.labels && response.results.labels.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-wells-dark-grey">Classifications</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      {filteredLabels.length} / {response.results.labels.length} items
                    </span>
                    {filteredLabels.length < response.results.labels.length && (
                      <span className="px-2 py-1 bg-wells-warm-grey/20 text-wells-warm-grey text-xs font-medium rounded-full">
                        ({response.results.labels.length - filteredLabels.length} hidden)
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {filteredLabels.map((label, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-wells-light-beige rounded-lg border border-wells-warm-grey/20">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="font-medium text-wells-dark-grey capitalize">{label.class}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-wells-dark-grey">{formatConfidence(label.score)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Segmentation Results */}
              {response.results.segmentation && response.results.segmentation.regions && response.results.segmentation.regions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Palette className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-wells-dark-grey">
                      {response.task === 'instance-segmentation' || response.results.segmentation.regions.some(r => r.bbox) ? 'Instance Segmentation' : 'Segmentation'}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      response.task === 'instance-segmentation' || response.results.segmentation.regions.some(r => r.bbox)
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {filteredSegmentationRegions.length} / {response.results.segmentation.regions.length} {response.task === 'instance-segmentation' || response.results.segmentation.regions.some(r => r.bbox) ? 'instances' : 'regions'}
                    </span>
                    {filteredSegmentationRegions.length < response.results.segmentation.regions.length && (
                      <span className="px-2 py-1 bg-wells-warm-grey/20 text-wells-warm-grey text-xs font-medium rounded-full">
                        ({response.results.segmentation.regions.length - filteredSegmentationRegions.length} hidden)
                      </span>
                    )}
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                      Pixel-level masks
                    </span>
                  </div>
                  <div className="space-y-2">
                    {filteredSegmentationRegions.map((region, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-wells-light-beige rounded-lg border border-wells-warm-grey/20">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded border border-wells-warm-grey/30"
                            style={{ backgroundColor: region.color }}
                          ></div>
                          <div className="flex flex-col">
                            <span className="font-medium text-wells-dark-grey capitalize">{region.class}</span>
                            <div className="flex items-center gap-2 text-xs text-wells-warm-grey">
                              {region.mask && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                  ✓ Pixel mask
                                </span>
                              )}
                              {region.bbox && (
                                <span className="text-xs">
                                  Box: {Math.round(region.bbox.width)}×{Math.round(region.bbox.height)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-wells-dark-grey">{Math.round(region.area * 100)}%</p>
                          <p className="text-xs text-wells-warm-grey">coverage</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keypoint Detection Results */}
              {response.results.keypoint_detections && response.results.keypoint_detections.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-wells-dark-grey">Keypoint Detections</span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                      {filteredKeypointDetections.length} / {response.results.keypoint_detections.length} objects
                    </span>
                    {filteredKeypointDetections.length < response.results.keypoint_detections.length && (
                      <span className="px-2 py-1 bg-wells-warm-grey/20 text-wells-warm-grey text-xs font-medium rounded-full">
                        ({response.results.keypoint_detections.length - filteredKeypointDetections.length} hidden)
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {filteredKeypointDetections.map((detection, index) => (
                      <div key={index} className="p-3 bg-wells-light-beige rounded-lg border border-wells-warm-grey/20">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span className="font-medium text-wells-dark-grey capitalize">{detection.class}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-wells-dark-grey">{formatConfidence(detection.confidence)}</p>
                          </div>
                        </div>
                        {detection.keypoints && detection.keypoints.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-wells-warm-grey/20">
                            <p className="text-xs text-wells-warm-grey mb-1">
                              {detection.keypoints.filter(kp => kp.confidence >= confidenceThreshold).length} / {detection.keypoints.length} keypoints
                              {detection.keypoints.filter(kp => kp.confidence >= confidenceThreshold).length < detection.keypoints.length && (
                                <span className="ml-1 text-wells-warm-grey">
                                  ({detection.keypoints.length - detection.keypoints.filter(kp => kp.confidence >= confidenceThreshold).length} hidden)
                                </span>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {detection.keypoints
                                .filter(kp => kp.confidence >= confidenceThreshold)
                                .slice(0, 10)
                                .map((kp, kpIndex) => (
                                  <div
                                    key={kpIndex}
                                    className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs"
                                    title={`${kp.class || `KP ${kpIndex}`}: ${(kp.confidence * 100).toFixed(1)}%`}
                                  >
                                    {kp.class || kpIndex}
                                  </div>
                                ))}
                              {detection.keypoints.filter(kp => kp.confidence >= confidenceThreshold).length > 10 && (
                                <div className="px-2 py-1 bg-wells-warm-grey/20 text-wells-warm-grey rounded text-xs">
                                  +{detection.keypoints.filter(kp => kp.confidence >= confidenceThreshold).length - 10} more
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No results message */}
              {(!response.results.detections || response.results.detections.length === 0) && 
               (!response.results.labels || response.results.labels.length === 0) && 
               (!response.results.segmentation || !response.results.segmentation.regions || response.results.segmentation.regions.length === 0) &&
               (!response.results.keypoint_detections || response.results.keypoint_detections.length === 0) && (
                <div className="text-center py-8 text-wells-warm-grey">
                  <p>No detection results available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 mb-8 mt-6">
        <div className="p-4 bg-wells-light-beige rounded-xl border border-wells-warm-grey/20 hover:bg-wells-white transition-colors duration-200">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-4 h-4 text-wells-warm-grey" />
            <div>
              <p className="text-sm font-medium text-wells-dark-grey">Processed</p>
              <p className="text-sm text-wells-warm-grey">{formatTimestamp(response.timestamp)}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-wells-light-beige rounded-xl border border-wells-warm-grey/20 hover:bg-wells-white transition-colors duration-200">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-4 h-4 text-wells-warm-grey" />
            <div>
              <p className="text-sm font-medium text-wells-dark-grey">Processing Time</p>
              <p className="text-sm text-wells-warm-grey">{response.processing_time}s</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
})

export default ResultsDisplay