'use client'

import { useState, useRef, useEffect } from 'react'
import { Detection } from '@/types'
import { formatConfidence } from '@/lib/utils'

interface EditableAnnotationOverlayProps {
  detections: Detection[]
  imageWidth: number
  imageHeight: number
  onDetectionsChange: (detections: Detection[]) => void
  onSave: (detections: Detection[]) => void
  onCancel: () => void
}

export default function EditableAnnotationOverlay({
  detections,
  imageWidth,
  imageHeight,
  onDetectionsChange,
  onSave,
  onCancel
}: EditableAnnotationOverlayProps) {
  const [editingDetection, setEditingDetection] = useState<number | null>(null)
  const [editingField, setEditingField] = useState<'class' | 'confidence' | null>(null)
  const [editingClass, setEditingClass] = useState<string>('')
  const [editingConfidence, setEditingConfidence] = useState<string>('')
  const [dragging, setDragging] = useState<number | null>(null)
  const [resizing, setResizing] = useState<{ index: number; corner: 'nw' | 'ne' | 'sw' | 'se' } | null>(null)
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
        onDetectionsChange(updatedDetections)
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
        onDetectionsChange(updatedDetections)
        setDragStart({ x: currentX, y: currentY })
      }
    }

    const handleMouseUp = () => {
      setDragging(null)
      setResizing(null)
      setDragStart(null)
    }

    if (dragging !== null || resizing !== null) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, resizing, dragStart, detections, imageWidth, imageHeight, onDetectionsChange])

  const handleClassEdit = (e: React.MouseEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingDetection(index)
    setEditingField('class')
    setEditingClass(detections[index].class)
    // Cancel any ongoing drag/resize
    setDragging(null)
    setResizing(null)
  }

  const handleConfidenceEdit = (e: React.MouseEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingDetection(index)
    setEditingField('confidence')
    // Convert confidence (0-1) to percentage (0-100) for editing
    setEditingConfidence((detections[index].confidence * 100).toFixed(1))
    // Cancel any ongoing drag/resize
    setDragging(null)
    setResizing(null)
  }

  const handleClassSave = (index: number) => {
    const updatedDetections = [...detections]
    updatedDetections[index].class = editingClass
    onDetectionsChange(updatedDetections)
    setEditingDetection(null)
    setEditingField(null)
    setEditingClass('')
  }

  const handleConfidenceSave = (index: number) => {
    const updatedDetections = [...detections]
    // Convert percentage (0-100) to confidence (0-1)
    const confidenceValue = parseFloat(editingConfidence)
    if (!isNaN(confidenceValue) && confidenceValue >= 0 && confidenceValue <= 100) {
      updatedDetections[index].confidence = confidenceValue / 100
      onDetectionsChange(updatedDetections)
    }
    setEditingDetection(null)
    setEditingField(null)
    setEditingConfidence('')
  }

  const handleDelete = (index: number) => {
    const updatedDetections = detections.filter((_, i) => i !== index)
    onDetectionsChange(updatedDetections)
  }

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-auto">
      {detections.map((detection, index) => {
        const color = colors[index % colors.length]
        const xPercent = (detection.bbox.x / imageWidth) * 100
        const yPercent = (detection.bbox.y / imageHeight) * 100
        const wPercent = (detection.bbox.width / imageWidth) * 100
        const hPercent = (detection.bbox.height / imageHeight) * 100

        return (
          <div key={index}>
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
              onMouseDown={(e) => handleMouseDown(e, index, 'drag')}
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
                  handleMouseDown(e, index, 'resize', 'nw')
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
                  handleMouseDown(e, index, 'resize', 'ne')
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
                  handleMouseDown(e, index, 'resize', 'sw')
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
                  handleMouseDown(e, index, 'resize', 'se')
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
              {editingDetection === index && editingField === 'class' ? (
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
                        handleClassSave(index)
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
                      handleClassSave(index)
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
              ) : editingDetection === index && editingField === 'confidence' ? (
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
                        handleConfidenceSave(index)
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
                      handleConfidenceSave(index)
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
                    onClick={(e) => handleClassEdit(e, index)}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {detection.class}
                  </span>
                  <span 
                    className="opacity-90 cursor-pointer hover:underline"
                    onClick={(e) => handleConfidenceEdit(e, index)}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {formatConfidence(detection.confidence)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      handleDelete(index)
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
    </div>
  )
}

