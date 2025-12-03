'use client'

import { useState, useRef, useEffect } from 'react'
import { Detection, Classification, SegmentationRegion, KeypointDetection } from '@/types'
import { formatConfidence } from '@/lib/utils'

interface EditableAnnotationOverlayProps {
  // Detection annotations (bounding boxes with drag/resize)
  detections?: Detection[]
  imageWidth: number
  imageHeight: number
  onDetectionsChange?: (detections: Detection[]) => void
  onSave: (annotations: {
    detections?: Detection[]
    labels?: Classification[]
    segmentation?: SegmentationRegion[]
    keypoint_detections?: KeypointDetection[]
  }) => void
  onCancel: () => void
  confidenceThreshold?: number // 0.0 to 1.0, default 0.0 - filters visual display only
  
  // Classification annotations
  labels?: Classification[]
  onLabelsChange?: (labels: Classification[]) => void
  
  // Segmentation annotations
  segmentationRegions?: SegmentationRegion[]
  onSegmentationChange?: (regions: SegmentationRegion[]) => void
  
  // Keypoint detection annotations
  keypointDetections?: KeypointDetection[]
  onKeypointDetectionsChange?: (detections: KeypointDetection[]) => void
  
  // Task type
  task?: string
}

export default function EditableAnnotationOverlay({
  detections = [],
  imageWidth,
  imageHeight,
  onDetectionsChange,
  onSave,
  onCancel,
  confidenceThreshold = 0.0,
  labels = [],
  onLabelsChange,
  segmentationRegions = [],
  onSegmentationChange,
  keypointDetections = [],
  onKeypointDetectionsChange,
  task
}: EditableAnnotationOverlayProps) {
  const [editingDetection, setEditingDetection] = useState<number | null>(null)
  const [editingField, setEditingField] = useState<'class' | 'confidence' | 'score' | 'area' | null>(null)
  const [editingClass, setEditingClass] = useState<string>('')
  const [editingConfidence, setEditingConfidence] = useState<string>('')
  const [editingIndex, setEditingIndex] = useState<{ type: 'detection' | 'label' | 'segmentation' | 'keypoint'; index: number } | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [dragging, setDragging] = useState<number | null>(null)
  const [resizing, setResizing] = useState<{ index: number; corner: 'nw' | 'ne' | 'sw' | 'se' } | null>(null)
  const [draggingPoint, setDraggingPoint] = useState<{ regionIndex: number; pointIndex: number } | null>(null)
  const [draggingKeypoint, setDraggingKeypoint] = useState<{ detectionIndex: number; keypointIndex: number } | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']

  // Handle mouse down for dragging 
  const handleMouseDown = (e: React.MouseEvent, index: number, type: 'drag' | 'resize', corner?: 'nw' | 'ne' | 'sw' | 'se') => {
    // Don't start dragging if we're editing a class name or confidence
    if (editingDetection !== null) {
      return
    }
    
    e.preventDefault()
    e.stopPropagation()
    
    if (type === 'drag') {
      setDragging(index)
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        setDragStart({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        })
      }
    } else if (type === 'resize' && corner) {
      setResizing({ index, corner })
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        setDragStart({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        })
      }
    }
  }

  // Handle mouse move for dragging/resizing 
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const currentX = e.clientX - rect.left
      const currentY = e.clientY - rect.top

      if (dragging !== null && dragStart) {
        const deltaX = currentX - dragStart.x
        const deltaY = currentY - dragStart.y
        
        const deltaXPercent = (deltaX / rect.width) * 100
        const deltaYPercent = (deltaY / rect.height) * 100
        
        const updatedDetections = [...detections]
        const detection = updatedDetections[dragging]
        
        const newX = Math.max(0, Math.min(100 - (detection.bbox.width / imageWidth) * 100, (detection.bbox.x / imageWidth) * 100 + deltaXPercent))
        const newY = Math.max(0, Math.min(100 - (detection.bbox.height / imageHeight) * 100, (detection.bbox.y / imageHeight) * 100 + deltaYPercent))
        
        detection.bbox.x = (newX / 100) * imageWidth
        detection.bbox.y = (newY / 100) * imageHeight
        
        updatedDetections[dragging] = detection
        onDetectionsChange?.(updatedDetections)
        setDragStart({ x: currentX, y: currentY })
      } else if (resizing && dragStart) {
        const updatedDetections = [...detections]
        const detection = updatedDetections[resizing.index]
        
        const bboxXPercent = (detection.bbox.x / imageWidth) * 100
        const bboxYPercent = (detection.bbox.y / imageHeight) * 100
        const bboxWPercent = (detection.bbox.width / imageWidth) * 100
        const bboxHPercent = (detection.bbox.height / imageHeight) * 100
        
        const currentXPercent = (currentX / rect.width) * 100
        const currentYPercent = (currentY / rect.height) * 100
        
        let newX = bboxXPercent
        let newY = bboxYPercent
        let newW = bboxWPercent
        let newH = bboxHPercent
        
        if (resizing.corner === 'nw') {
          newX = Math.max(0, Math.min(currentXPercent, bboxXPercent + bboxWPercent - 1))
          newY = Math.max(0, Math.min(currentYPercent, bboxYPercent + bboxHPercent - 1))
          newW = bboxXPercent + bboxWPercent - newX
          newH = bboxYPercent + bboxHPercent - newY
        } else if (resizing.corner === 'ne') {
          newY = Math.max(0, Math.min(currentYPercent, bboxYPercent + bboxHPercent - 1))
          newW = Math.max(1, Math.min(currentXPercent - bboxXPercent, 100 - bboxXPercent))
          newH = bboxYPercent + bboxHPercent - newY
        } else if (resizing.corner === 'sw') {
          newX = Math.max(0, Math.min(currentXPercent, bboxXPercent + bboxWPercent - 1))
          newW = bboxXPercent + bboxWPercent - newX
          newH = Math.max(1, Math.min(currentYPercent - bboxYPercent, 100 - bboxYPercent))
        } else if (resizing.corner === 'se') {
          newW = Math.max(1, Math.min(currentXPercent - bboxXPercent, 100 - bboxXPercent))
          newH = Math.max(1, Math.min(currentYPercent - bboxYPercent, 100 - bboxYPercent))
        }
        
        detection.bbox.x = (newX / 100) * imageWidth
        detection.bbox.y = (newY / 100) * imageHeight
        detection.bbox.width = (newW / 100) * imageWidth
        detection.bbox.height = (newH / 100) * imageHeight
        
        updatedDetections[resizing.index] = detection
        onDetectionsChange?.(updatedDetections)
        setDragStart({ x: currentX, y: currentY })
      } else if (draggingPoint !== null && dragStart) {
        // Handle dragging polygon points for segmentation
        if (!onSegmentationChange) return
        
        const rect = containerRef.current.getBoundingClientRect()
        const scaleX = imageWidth / rect.width
        const scaleY = imageHeight / rect.height
        
        const deltaX = (currentX - dragStart.x) * scaleX
        const deltaY = (currentY - dragStart.y) * scaleY
        
        const updatedRegions = [...segmentationRegions]
        const region = updatedRegions[draggingPoint.regionIndex]
        
        if (region.points && region.points.length > draggingPoint.pointIndex) {
          const updatedPoints = [...region.points]
          const point = updatedPoints[draggingPoint.pointIndex]
          
          // Update point position
          updatedPoints[draggingPoint.pointIndex] = {
            ...point,
            x: Math.max(0, Math.min(imageWidth, point.x + deltaX)),
            y: Math.max(0, Math.min(imageHeight, point.y + deltaY))
          }
          
          // Recalculate area based on polygon
          const polygonArea = calculatePolygonArea(updatedPoints, imageWidth, imageHeight)
          
          updatedRegions[draggingPoint.regionIndex] = {
            ...region,
            points: updatedPoints,
            area: polygonArea
          }
          
          onSegmentationChange(updatedRegions)
          setDragStart({ x: currentX, y: currentY })
        }
      } else if (draggingKeypoint !== null && dragStart) {
        // Handle dragging individual keypoints
        if (!onKeypointDetectionsChange) return
        
        const rect = containerRef.current.getBoundingClientRect()
        const scaleX = imageWidth / rect.width
        const scaleY = imageHeight / rect.height
        
        const deltaX = (currentX - dragStart.x) * scaleX
        const deltaY = (currentY - dragStart.y) * scaleY
        
        const updatedDetections = [...keypointDetections]
        const detection = updatedDetections[draggingKeypoint.detectionIndex]
        
        if (detection.keypoints && detection.keypoints.length > draggingKeypoint.keypointIndex) {
          const updatedKeypoints = [...detection.keypoints]
          const keypoint = updatedKeypoints[draggingKeypoint.keypointIndex]
          
          // Update keypoint position
          updatedKeypoints[draggingKeypoint.keypointIndex] = {
            ...keypoint,
            x: Math.max(0, Math.min(imageWidth, keypoint.x + deltaX)),
            y: Math.max(0, Math.min(imageHeight, keypoint.y + deltaY))
          }
          
          updatedDetections[draggingKeypoint.detectionIndex] = {
            ...detection,
            keypoints: updatedKeypoints
          }
          
          onKeypointDetectionsChange(updatedDetections)
          setDragStart({ x: currentX, y: currentY })
        }
      }
    }

    const handleMouseUp = () => {
      setDragging(null)
      setResizing(null)
      setDraggingPoint(null)
      setDraggingKeypoint(null)
      setDragStart(null)
    }

    if (dragging !== null || resizing !== null || draggingPoint !== null || draggingKeypoint !== null) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, resizing, draggingPoint, draggingKeypoint, dragStart, detections, segmentationRegions, keypointDetections, imageWidth, imageHeight, onDetectionsChange, onSegmentationChange, onKeypointDetectionsChange])

  // Helper function to calculate polygon area
  const calculatePolygonArea = (points: Array<{ x: number; y: number }>, imgWidth: number, imgHeight: number): number => {
    if (points.length < 3) return 0
    
    let area = 0
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      area += points[i].x * points[j].y
      area -= points[j].x * points[i].y
    }
    area = Math.abs(area) / 2
    return Math.min(0.95, Math.max(0.01, area / (imgWidth * imgHeight)))
  }

  const handleClassEdit = (e: React.MouseEvent, originalIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingDetection(originalIndex)
    setEditingField('class')
    setEditingClass(detections[originalIndex].class)
    // Cancel any ongoing drag/resize
    setDragging(null)
    setResizing(null)
  }

  const handleConfidenceEdit = (e: React.MouseEvent, originalIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingDetection(originalIndex)
    setEditingField('confidence')
    // Convert confidence (0-1) to percentage (0-100) for editing
    setEditingConfidence((detections[originalIndex].confidence * 100).toFixed(1))
    // Cancel any ongoing drag/resize
    setDragging(null)
    setResizing(null)
  }

  const handleClassSave = (originalIndex: number) => {
    if (!onDetectionsChange) return
    const updatedDetections = [...detections]
    updatedDetections[originalIndex].class = editingClass
    onDetectionsChange(updatedDetections)
    setEditingDetection(null)
    setEditingField(null)
    setEditingClass('')
  }

  const handleConfidenceSave = (originalIndex: number) => {
    if (!onDetectionsChange) return
    const updatedDetections = [...detections]
    // Convert percentage (0-100) to confidence (0-1)
    const confidenceValue = parseFloat(editingConfidence)
    if (!isNaN(confidenceValue) && confidenceValue >= 0 && confidenceValue <= 100) {
      updatedDetections[originalIndex].confidence = confidenceValue / 100
      onDetectionsChange(updatedDetections)
    }
    setEditingDetection(null)
    setEditingField(null)
    setEditingConfidence('')
  }

  const handleDelete = (originalIndex: number) => {
    if (!onDetectionsChange) return
    const updatedDetections = detections.filter((_, i) => i !== originalIndex)
    onDetectionsChange(updatedDetections)
  }

  // Handlers for Classification Labels
  const handleLabelEdit = (index: number, field: 'class' | 'score', value: string) => {
    if (!onLabelsChange) return
    const updated = [...labels]
    if (field === 'class') {
      updated[index] = { ...updated[index], class: value }
    } else if (field === 'score') {
      const numValue = parseFloat(value)
      if (!isNaN(numValue) && numValue >= 0 && numValue <= 1) {
        updated[index] = { ...updated[index], score: numValue }
      }
    }
    onLabelsChange(updated)
  }

  const handleLabelDelete = (index: number) => {
    if (!onLabelsChange) return
    onLabelsChange(labels.filter((_, i) => i !== index))
  }

  // Handlers for Segmentation Regions
  const handleSegmentationEdit = (index: number, field: 'class' | 'area', value: string) => {
    if (!onSegmentationChange) return
    const updated = [...segmentationRegions]
    if (field === 'class') {
      updated[index] = { ...updated[index], class: value }
    } else if (field === 'area') {
      const numValue = parseFloat(value)
      if (!isNaN(numValue) && numValue >= 0 && numValue <= 1) {
        updated[index] = { ...updated[index], area: numValue }
      }
    }
    onSegmentationChange(updated)
  }

  const handleSegmentationDelete = (index: number) => {
    if (!onSegmentationChange) return
    onSegmentationChange(segmentationRegions.filter((_, i) => i !== index))
  }

  // Handlers for Keypoint Detections
  const handleKeypointEdit = (index: number, field: 'class' | 'confidence', value: string) => {
    if (!onKeypointDetectionsChange) return
    const updated = [...keypointDetections]
    if (field === 'class') {
      updated[index] = { ...updated[index], class: value }
    } else if (field === 'confidence') {
      const numValue = parseFloat(value)
      if (!isNaN(numValue) && numValue >= 0 && numValue <= 1) {
        updated[index] = { ...updated[index], confidence: numValue }
      }
    }
    onKeypointDetectionsChange(updated)
  }

  const handleKeypointDelete = (index: number) => {
    if (!onKeypointDetectionsChange) return
    onKeypointDetectionsChange(keypointDetections.filter((_, i) => i !== index))
  }

  // Filter detections by confidence threshold (visual display only - all data remains in JSON)
  // Map to include original index for proper editing/deletion
  // At 0% (confidenceThreshold = 0.0), show all detections
  const filteredDetectionsWithIndex = detections
    .map((detection, originalIndex) => ({ detection, originalIndex }))
    .filter(({ detection }) => {
      // Handle undefined/null confidence - show if threshold is 0%
      if (detection.confidence == null) {
        return confidenceThreshold === 0.0
      }
      return detection.confidence >= confidenceThreshold
    })

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-auto">
      {filteredDetectionsWithIndex.map(({ detection, originalIndex }, displayIndex) => {
        const color = colors[displayIndex % colors.length]
        const xPercent = (detection.bbox.x / imageWidth) * 100
        const yPercent = (detection.bbox.y / imageHeight) * 100
        const wPercent = (detection.bbox.width / imageWidth) * 100
        const hPercent = (detection.bbox.height / imageHeight) * 100

        return (
          <div key={originalIndex}>
            {/* Bounding box */}
            <div
              className="absolute border-2 cursor-move"
              style={{
                borderColor: color,
                backgroundColor: `${color}15`,
                left: `${xPercent}%`,
                top: `${yPercent}%`,
                width: `${wPercent}%`,
                height: `${hPercent}%`,
              }}
              onMouseDown={(e) => handleMouseDown(e, originalIndex, 'drag')}
            >
              {/* Resize handles */}
              <div
                className="absolute w-3 h-3 bg-white border-2 cursor-nwse-resize"
                style={{
                  borderColor: color,
                  left: '-6px',
                  top: '-6px',
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  handleMouseDown(e, originalIndex, 'resize', 'nw')
                }}
              />
              <div
                className="absolute w-3 h-3 bg-white border-2 cursor-nesw-resize"
                style={{
                  borderColor: color,
                  right: '-6px',
                  top: '-6px',
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  handleMouseDown(e, originalIndex, 'resize', 'ne')
                }}
              />
              <div
                className="absolute w-3 h-3 bg-white border-2 cursor-nesw-resize"
                style={{
                  borderColor: color,
                  left: '-6px',
                  bottom: '-6px',
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  handleMouseDown(e, originalIndex, 'resize', 'sw')
                }}
              />
              <div
                className="absolute w-3 h-3 bg-white border-2 cursor-nwse-resize"
                style={{
                  borderColor: color,
                  right: '-6px',
                  bottom: '-6px',
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  handleMouseDown(e, originalIndex, 'resize', 'se')
                }}
              />
            </div>

            {/* Label with edit capability */}
            <div
              className="absolute text-white text-xs px-2 py-0.5 rounded-t font-medium shadow-md z-20"
              style={{
                backgroundColor: color,
                left: `${xPercent}%`,
                top: `${yPercent}%`,
                transform: 'translateY(-100%)',
                minWidth: 'max-content',
                whiteSpace: 'nowrap',
                pointerEvents: 'auto'
              }}
              onMouseDown={(e) => {
                // Prevent dragging when clicking on label
                e.stopPropagation()
                e.preventDefault()
              }}
            >
              {editingDetection === originalIndex && editingField === 'class' ? (
                <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editingClass}
                    onChange={(e) => {
                      e.stopPropagation()
                      setEditingClass(e.target.value)
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') {
                        handleClassSave(originalIndex)
                      } else if (e.key === 'Escape') {
                        setEditingDetection(null)
                        setEditingField(null)
                        setEditingClass('')
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-1 py-0.5 text-xs bg-white text-wells-dark-grey rounded border border-wells-warm-grey/30 focus:outline-none focus:border-wells-dark-grey min-w-[60px]"
                    autoFocus
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      handleClassSave(originalIndex)
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-1 py-0.5 text-xs bg-green-500 hover:bg-green-600 rounded text-white"
                  >
                    ✓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      setEditingDetection(null)
                      setEditingField(null)
                      setEditingClass('')
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-1 py-0.5 text-xs bg-red-500 hover:bg-red-600 rounded text-white"
                  >
                    ✕
                  </button>
                </div>
              ) : editingDetection === originalIndex && editingField === 'confidence' ? (
                <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
                  <span className="capitalize">{detection.class}</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={editingConfidence}
                    onChange={(e) => {
                      e.stopPropagation()
                      setEditingConfidence(e.target.value)
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') {
                        handleConfidenceSave(originalIndex)
                      } else if (e.key === 'Escape') {
                        setEditingDetection(null)
                        setEditingField(null)
                        setEditingConfidence('')
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-1 py-0.5 text-xs bg-white text-wells-dark-grey rounded border border-wells-warm-grey/30 focus:outline-none focus:border-wells-dark-grey w-16"
                    autoFocus
                  />
                  <span className="text-xs">%</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      handleConfidenceSave(originalIndex)
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-1 py-0.5 text-xs bg-green-500 hover:bg-green-600 rounded text-white"
                  >
                    ✓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      setEditingDetection(null)
                      setEditingField(null)
                      setEditingConfidence('')
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-1 py-0.5 text-xs bg-red-500 hover:bg-red-600 rounded text-white"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span 
                    className="capitalize cursor-pointer hover:underline"
                    onClick={(e) => handleClassEdit(e, originalIndex)}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {detection.class}
                  </span>
                  <span 
                    className="opacity-90 cursor-pointer hover:underline"
                    onClick={(e) => handleConfidenceEdit(e, originalIndex)}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {formatConfidence(detection.confidence)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      handleDelete(originalIndex)
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="ml-1 px-1 py-0 text-xs hover:bg-red-600 rounded"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Classification Labels */}
      {task === 'classification' && labels.length > 0 && (
        <div className="absolute top-4 left-4 bg-black/80 text-white rounded-lg p-3 space-y-2 min-w-[200px] max-w-[300px]">
          <div className="text-xs font-semibold mb-2">Classification Results</div>
          {labels
            .filter(l => l.score >= confidenceThreshold)
            .map((label, index) => (
              <div key={index} className="flex items-center justify-between gap-2 p-2 bg-white/10 rounded">
                {editingIndex?.type === 'label' && editingIndex.index === index && editingField === 'class' ? (
                  <input
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => {
                      handleLabelEdit(index, 'class', editingValue)
                      setEditingIndex(null)
                      setEditingField(null)
                      setEditingValue('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleLabelEdit(index, 'class', editingValue)
                        setEditingIndex(null)
                        setEditingField(null)
                        setEditingValue('')
                      }
                    }}
                    autoFocus
                    className="bg-transparent border-none outline-none text-white flex-1"
                  />
                ) : editingIndex?.type === 'label' && editingIndex.index === index && editingField === 'score' ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => {
                      handleLabelEdit(index, 'score', editingValue)
                      setEditingIndex(null)
                      setEditingField(null)
                      setEditingValue('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleLabelEdit(index, 'score', editingValue)
                        setEditingIndex(null)
                        setEditingField(null)
                        setEditingValue('')
                      }
                    }}
                    autoFocus
                    className="bg-transparent border-none outline-none text-white w-16"
                  />
                ) : (
                  <div className="flex items-center justify-between flex-1">
                    <span
                      className="capitalize cursor-pointer hover:underline"
                      onClick={() => {
                        setEditingIndex({ type: 'label', index })
                        setEditingField('class')
                        setEditingValue(label.class)
                      }}
                    >
                      {label.class}
                    </span>
                    <span
                      className="opacity-90 cursor-pointer hover:underline ml-2"
                      onClick={() => {
                        setEditingIndex({ type: 'label', index })
                        setEditingField('score')
                        setEditingValue(label.score.toString())
                      }}
                    >
                      {formatConfidence(label.score)}
                    </span>
                    <button
                      onClick={() => handleLabelDelete(index)}
                      className="ml-2 px-1 py-0 text-xs hover:bg-red-600 rounded"
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Segmentation Regions - Render polygons with draggable points */}
      {task === 'segmentation' && segmentationRegions.length > 0 && (
        <>
          {segmentationRegions
            .filter(r => {
              // If confidence exists, use it; otherwise use area as proxy
              if ((r as any).confidence !== undefined && typeof (r as any).confidence === 'number') {
                return (r as any).confidence >= confidenceThreshold
              }
              return r.area >= confidenceThreshold
            })
            .map((region, regionIndex) => {
              const color = colors[regionIndex % colors.length]
              
              // Render polygon if points are available
              if (region.points && region.points.length > 0) {
                return (
                  <div key={regionIndex} className="absolute inset-0">
                    {/* Render polygon outline using canvas for better interactivity */}
                    <svg
                      className="absolute inset-0 pointer-events-none"
                      style={{ width: '100%', height: '100%' }}
                      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
                      preserveAspectRatio="none"
                    >
                      <polygon
                        points={region.points.map(p => `${p.x},${p.y}`).join(' ')}
                        fill={`${color}40`}
                        stroke={color}
                        strokeWidth="2"
                      />
                      {/* Draw lines connecting points */}
                      {region.points && region.points.map((point, idx) => {
                        const nextPoint = region.points![(idx + 1) % region.points!.length]
                        return (
                          <line
                            key={idx}
                            x1={point.x}
                            y1={point.y}
                            x2={nextPoint.x}
                            y2={nextPoint.y}
                            stroke={color}
                            strokeWidth="2"
                          />
                        )
                      })}
                    </svg>
                    
                    {/* Render draggable points */}
                    {region.points.map((point, pointIndex) => (
                      <div
                        key={pointIndex}
                        className="absolute cursor-move rounded-full border-2 z-20"
                        style={{
                          backgroundColor: color,
                          borderColor: '#FFFFFF',
                          left: `${(point.x / imageWidth) * 100}%`,
                          top: `${(point.y / imageHeight) * 100}%`,
                          width: '10px',
                          height: '10px',
                          transform: 'translate(-50%, -50%)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDraggingPoint({ regionIndex, pointIndex })
                          const rect = containerRef.current?.getBoundingClientRect()
                          if (rect) {
                            setDragStart({
                              x: e.clientX - rect.left,
                              y: e.clientY - rect.top
                            })
                          }
                        }}
                        title={`Point ${pointIndex + 1}: (${Math.round(point.x)}, ${Math.round(point.y)})`}
                      />
                    ))}
                    
                    {/* Label with edit capability */}
                    <div
                      className="absolute text-white text-xs px-2 py-1 rounded font-medium shadow-md z-20 pointer-events-auto"
                      style={{
                        backgroundColor: color,
                        left: region.bbox ? `${(region.bbox.x / imageWidth) * 100}%` : '10px',
                        top: region.bbox ? `${((region.bbox.y - 25) / imageHeight) * 100}%` : '10px',
                        transform: region.bbox ? 'translateX(-50%)' : 'none'
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {editingIndex?.type === 'segmentation' && editingIndex.index === regionIndex && editingField === 'class' ? (
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => {
                            handleSegmentationEdit(regionIndex, 'class', editingValue)
                            setEditingIndex(null)
                            setEditingField(null)
                            setEditingValue('')
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSegmentationEdit(regionIndex, 'class', editingValue)
                              setEditingIndex(null)
                              setEditingField(null)
                              setEditingValue('')
                            }
                          }}
                          autoFocus
                          className="bg-transparent border-none outline-none text-white"
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <span
                            className="capitalize cursor-pointer hover:underline"
                            onClick={() => {
                              setEditingIndex({ type: 'segmentation', index: regionIndex })
                              setEditingField('class')
                              setEditingValue(region.class)
                            }}
                          >
                            {region.class}
                          </span>
                          <span className="opacity-90">
                            {(region.area * 100).toFixed(1)}%
                          </span>
                          <button
                            onClick={() => handleSegmentationDelete(regionIndex)}
                            className="ml-1 px-1 py-0 text-xs hover:bg-red-600 rounded"
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              
              // Fallback: render bounding box if no points
              if (region.bbox) {
                return (
                  <div
                    key={regionIndex}
                    className="absolute border-2 rounded"
                    style={{
                      left: `${(region.bbox.x / imageWidth) * 100}%`,
                      top: `${(region.bbox.y / imageHeight) * 100}%`,
                      width: `${(region.bbox.width / imageWidth) * 100}%`,
                      height: `${(region.bbox.height / imageHeight) * 100}%`,
                      borderColor: color,
                      backgroundColor: `${color}15`
                    }}
                  >
                    <div className="absolute -top-6 left-0 bg-black/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <span
                        className="capitalize cursor-pointer hover:underline"
                        onClick={() => {
                          setEditingIndex({ type: 'segmentation', index: regionIndex })
                          setEditingField('class')
                          setEditingValue(region.class)
                        }}
                      >
                        {region.class}
                      </span>
                      <button
                        onClick={() => handleSegmentationDelete(regionIndex)}
                        className="ml-1 px-1 py-0 text-xs hover:bg-red-600 rounded"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )
              }
              
              return null
            })}
        </>
      )}

      {/* Keypoint Detections */}
      {task === 'keypoint-detection' && keypointDetections.length > 0 && (
        <>
          {keypointDetections
            .filter(d => d.confidence >= confidenceThreshold)
            .map((detection, index) => {
              const color = colors[index % colors.length]
              const bbox = detection.bbox
              return (
                <div
                  key={index}
                  className="absolute border-2 rounded"
                  style={{
                    left: `${(bbox.x / imageWidth) * 100}%`,
                    top: `${(bbox.y / imageHeight) * 100}%`,
                    width: `${(bbox.width / imageWidth) * 100}%`,
                    height: `${(bbox.height / imageHeight) * 100}%`,
                    borderColor: color,
                    backgroundColor: `${color}15`
                  }}
                >
                  {/* Skeleton lines connecting keypoints */}
                  {detection.keypoints && detection.keypoints.length > 1 && (() => {
                    const highConfidenceKeypoints = detection.keypoints.filter(kp => kp.confidence >= confidenceThreshold)
                    
                    if (highConfidenceKeypoints.length < 2) return null
                    
                    // Calculate distance between two keypoints
                    const distance = (kp1: typeof highConfidenceKeypoints[0], kp2: typeof highConfidenceKeypoints[0]) => {
                      return Math.sqrt(Math.pow(kp2.x - kp1.x, 2) + Math.pow(kp2.y - kp1.y, 2))
                    }
                    
                    // Calculate average distance to nearest neighbors
                    const distances: number[] = []
                    highConfidenceKeypoints.forEach((kp, i) => {
                      let minDist = Infinity
                      highConfidenceKeypoints.forEach((otherKp, j) => {
                        if (i !== j) {
                          const dist = distance(kp, otherKp)
                          if (dist < minDist) minDist = dist
                        }
                      })
                      if (minDist !== Infinity) distances.push(minDist)
                    })
                    const avgNearestDistance = distances.length > 0 
                      ? distances.reduce((a, b) => a + b, 0) / distances.length 
                      : 100
                    
                    // Connection threshold: connect if distance is less than 2x the average nearest neighbor distance
                    const connectionThreshold = avgNearestDistance * 2
                    
                    // Sort keypoints by class_id/class for consistent ordering
                    const sortedKeypoints = [...highConfidenceKeypoints].sort((a, b) => {
                      if (a.class_id !== undefined && b.class_id !== undefined) {
                        return a.class_id - b.class_id
                      }
                      const aNum = a.class ? parseInt(a.class, 10) : a.class_id || 0
                      const bNum = b.class ? parseInt(b.class, 10) : b.class_id || 0
                      return aNum - bNum
                    })
                    
                    // Generate connections
                    const connectionPairs: Array<[typeof highConfidenceKeypoints[0], typeof highConfidenceKeypoints[0]]> = []
                    sortedKeypoints.forEach((kp, i) => {
                      if (i < sortedKeypoints.length - 1) {
                        const nextKp = sortedKeypoints[i + 1]
                        const nextDist = distance(kp, nextKp)
                        if (nextDist < connectionThreshold) {
                          connectionPairs.push([kp, nextKp])
                        }
                      }
                    })
                    
                    return (
                      <svg
                        className="absolute inset-0 pointer-events-none z-10"
                        style={{ width: '100%', height: '100%', overflow: 'visible' }}
                        viewBox={`0 0 ${imageWidth} ${imageHeight}`}
                        preserveAspectRatio="none"
                      >
                        {connectionPairs.map(([kp1, kp2], lineIndex) => (
                          <line
                            key={`line-${lineIndex}-${kp1.class_id || kp1.class}-${kp2.class_id || kp2.class}`}
                            x1={kp1.x}
                            y1={kp1.y}
                            x2={kp2.x}
                            y2={kp2.y}
                            stroke={color}
                            strokeWidth="2"
                            strokeOpacity={Math.max(0.7, Math.min(kp1.confidence, kp2.confidence))}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ))}
                      </svg>
                    )
                  })()}
                  
                  {/* Keypoints - draggable, filtered by confidence threshold */}
                  {detection.keypoints?.filter(kp => kp.confidence >= confidenceThreshold).map((kp, kpIndex) => (
                    <div
                      key={kpIndex}
                      className="absolute cursor-move rounded-full border-2 z-20"
                      style={{
                        backgroundColor: color,
                        borderColor: '#FFFFFF',
                        left: `${(kp.x / imageWidth) * 100}%`,
                        top: `${(kp.y / imageHeight) * 100}%`,
                        width: '10px',
                        height: '10px',
                        transform: 'translate(-50%, -50%)',
                        opacity: Math.max(0.6, kp.confidence),
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDraggingKeypoint({ detectionIndex: index, keypointIndex: kpIndex })
                        const rect = containerRef.current?.getBoundingClientRect()
                        if (rect) {
                          setDragStart({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top
                          })
                        }
                      }}
                      title={`${kp.class || `Keypoint ${kpIndex}`}: ${formatConfidence(kp.confidence)} - Drag to move`}
                    />
                  ))}
                  
                  <div className="absolute -top-6 left-0 bg-black/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    {editingIndex?.type === 'keypoint' && editingIndex.index === index && editingField === 'class' ? (
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => {
                          handleKeypointEdit(index, 'class', editingValue)
                          setEditingIndex(null)
                          setEditingField(null)
                          setEditingValue('')
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleKeypointEdit(index, 'class', editingValue)
                            setEditingIndex(null)
                            setEditingField(null)
                            setEditingValue('')
                          }
                        }}
                        autoFocus
                        className="bg-transparent border-none outline-none text-white"
                      />
                    ) : editingIndex?.type === 'keypoint' && editingIndex.index === index && editingField === 'confidence' ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => {
                          handleKeypointEdit(index, 'confidence', editingValue)
                          setEditingIndex(null)
                          setEditingField(null)
                          setEditingValue('')
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleKeypointEdit(index, 'confidence', editingValue)
                            setEditingIndex(null)
                            setEditingField(null)
                            setEditingValue('')
                          }
                        }}
                        autoFocus
                        className="bg-transparent border-none outline-none text-white w-16"
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        <span
                          className="capitalize cursor-pointer hover:underline"
                          onClick={() => {
                            setEditingIndex({ type: 'keypoint', index })
                            setEditingField('class')
                            setEditingValue(detection.class)
                          }}
                        >
                          {detection.class}
                        </span>
                        <span
                          className="opacity-90 cursor-pointer hover:underline"
                          onClick={() => {
                            setEditingIndex({ type: 'keypoint', index })
                            setEditingField('confidence')
                            setEditingValue(detection.confidence.toString())
                          }}
                        >
                          {formatConfidence(detection.confidence)}
                        </span>
                        <button
                          onClick={() => handleKeypointDelete(index)}
                          className="ml-1 px-1 py-0 text-xs hover:bg-red-600 rounded"
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
        </>
      )}
    </div>
  )
}

