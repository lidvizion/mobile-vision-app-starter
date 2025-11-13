'use client'

import { Detection, SegmentationRegion, KeypointDetection, Keypoint } from '@/types'
import { formatConfidence } from '@/lib/utils'
import SegmentationMaskRenderer from './SegmentationMaskRenderer'

type LabelDisplayMode = 'boxes' | 'labels' | 'confidence' | 'shapes'

interface OverlayRendererProps {
  detections?: Detection[]
  segmentation?: SegmentationRegion[]
  keypointDetections?: KeypointDetection[]
  imageWidth: number
  imageHeight: number
  task: string
  confidenceThreshold?: number // 0.0 to 1.0, default 0.0
  labelDisplayMode?: LabelDisplayMode // 'boxes' = no label, 'labels' = label only, 'confidence' = label + confidence
}

export default function OverlayRenderer({ 
  detections, 
  segmentation,
  keypointDetections,
  imageWidth, 
  imageHeight, 
  task,
  confidenceThreshold = 0.0,
  labelDisplayMode = 'confidence'
}: OverlayRendererProps) {
  // Keypoint Detection: Render bounding boxes + keypoints
  if (task === 'keypoint-detection' && keypointDetections && keypointDetections.length > 0) {
    // Filter by confidence threshold
    const filteredKeypointDetections = keypointDetections.filter(detection => detection.confidence >= confidenceThreshold)
    
    return (
      <div className="absolute inset-0 pointer-events-none">
        {filteredKeypointDetections.map((detection, index) => {
          const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
          const color = colors[index % colors.length]
          
          return (
            <div 
              key={index} 
              className="absolute animate-scale-in" 
              style={{ 
                animationDelay: `${index * 0.1}s`,
                left: `${(detection.bbox.x / imageWidth) * 100}%`,
                top: `${(detection.bbox.y / imageHeight) * 100}%`,
                width: `${(detection.bbox.width / imageWidth) * 100}%`,
                height: `${(detection.bbox.height / imageHeight) * 100}%`,
              }}
            >
              {/* Bounding box */}
              <div
                className="absolute inset-0 border-2 rounded shadow-lg"
                style={{
                  borderColor: color,
                  backgroundColor: `${color}15`,
                }}
              />
              
              {/* Keypoints connected by lines */}
              {detection.keypoints && detection.keypoints.length > 0 && (
                <>
                  {(() => {
                    // Filter to only high-confidence keypoints based on confidence threshold
                    const highConfidenceKeypoints = detection.keypoints.filter(kp => kp.confidence >= confidenceThreshold)
                    
                    if (highConfidenceKeypoints.length < 2) {
                      // Not enough keypoints to draw lines
                      return (
                        <>
                          {detection.keypoints.map((kp, kpIndex) => {
                            if (kp.confidence < confidenceThreshold) return null
                            return (
                              <div
                                key={`kp-${kpIndex}-${kp.class_id || kp.class}`}
                                className="absolute rounded-full border-2 shadow-md z-10"
                                style={{
                                  backgroundColor: color,
                                  borderColor: '#FFFFFF',
                                  left: `${(kp.x / imageWidth) * 100}%`,
                                  top: `${(kp.y / imageHeight) * 100}%`,
                                  width: '8px',
                                  height: '8px',
                                  transform: 'translate(-50%, -50%)',
                                  opacity: Math.max(0.6, kp.confidence)
                                }}
                                title={`${kp.class || `Keypoint ${kpIndex}`}: ${(kp.confidence * 100).toFixed(1)}%`}
                              />
                            )
                          })}
                        </>
                      )
                    }
                    
                    // Calculate distance between two keypoints
                    const distance = (kp1: typeof highConfidenceKeypoints[0], kp2: typeof highConfidenceKeypoints[0]) => {
                      return Math.sqrt(Math.pow(kp2.x - kp1.x, 2) + Math.pow(kp2.y - kp1.y, 2))
                    }
                    
                    // Calculate average distance to nearest neighbors to determine connection threshold
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
                    
                    // Separate keypoints into groups by class_id/class to potentially form separate polygons
                    // Sort by class_id or parse class as number for consistent ordering
                    const sortedKeypoints = [...highConfidenceKeypoints].sort((a, b) => {
                      if (a.class_id !== undefined && b.class_id !== undefined) {
                        return a.class_id - b.class_id
                      }
                      const aNum = a.class ? parseInt(a.class, 10) : a.class_id || 0
                      const bNum = b.class ? parseInt(b.class, 10) : b.class_id || 0
                      return aNum - bNum
                    })
                    
                    // Generate connections: connect keypoints sequentially in sorted order
                    // Only connect consecutive keypoints that are within reasonable distance
                    const connectionPairs: Array<[Keypoint, Keypoint]> = []
                    
                    sortedKeypoints.forEach((kp, i) => {
                      // Connect to next keypoint in sorted order if within threshold
                      if (i < sortedKeypoints.length - 1) {
                        const nextKp = sortedKeypoints[i + 1]
                        const nextDist = distance(kp, nextKp)
                        if (nextDist < connectionThreshold) {
                          connectionPairs.push([kp, nextKp])
                        }
                      }
                    })
                    
                    return (
                      <>
                        {/* Draw lines connecting keypoints based on proximity and sorted order */}
                        <svg
                          className="absolute inset-0 pointer-events-none"
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
                              stroke="#00FFFF"
                              strokeWidth="5"
                              strokeOpacity={Math.max(0.7, Math.min(kp1.confidence, kp2.confidence))}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ))}
                        </svg>
                        
                        {/* Render keypoint dots */}
                        {detection.keypoints.map((kp, kpIndex) => {
                          if (kp.confidence < confidenceThreshold) return null
                          
                          return (
                            <div
                              key={`kp-${kpIndex}-${kp.class_id || kp.class}`}
                              className="absolute rounded-full border-2 shadow-md z-10"
                              style={{
                                backgroundColor: color,
                                borderColor: '#FFFFFF',
                                left: `${(kp.x / imageWidth) * 100}%`,
                                top: `${(kp.y / imageHeight) * 100}%`,
                                width: '8px',
                                height: '8px',
                                transform: 'translate(-50%, -50%)',
                                opacity: Math.max(0.6, kp.confidence)
                              }}
                              title={`${kp.class || `Keypoint ${kpIndex}`}: ${(kp.confidence * 100).toFixed(1)}%`}
                            />
                          )
                        })}
                      </>
                    )
                  })()}
                </>
              )}
              
              {/* Label attached to top of box */}
              {labelDisplayMode !== 'boxes' && (() => {
                const showConfidence = labelDisplayMode === 'confidence'
                const hasKeypoints = detection.keypoints && detection.keypoints.length > 0
                
                // Estimate label text width (rough calculation: ~7px per character for text-xs)
                const labelText = `${detection.class}${showConfidence ? ` ${formatConfidence(detection.confidence)}` : ''}${hasKeypoints ? ` • ${detection.keypoints.filter(kp => kp.confidence >= confidenceThreshold).length} keypoints` : ''}`
                const estimatedLabelWidth = labelText.length * 7 + 16 // 7px per char + 16px padding
                const estimatedLabelHeight = 24 // Approximate height
                
                // Calculate box position in pixels (absolute coordinates)
                const boxLeft = detection.bbox.x
                const boxTop = detection.bbox.y
                const boxWidth = detection.bbox.width
                const boxRight = boxLeft + boxWidth
                const boxCenterX = boxLeft + boxWidth / 2
                
                // Check if label would overflow top edge
                const hasRoomAbove = boxTop >= estimatedLabelHeight
                
                // Check if label would overflow left/right edges when centered
                const boxWidthPercent = (boxWidth / imageWidth) * 100
                const shouldCenter = boxWidthPercent > 15
                
                // Calculate label position (relative to the box container)
                let labelLeft = '0%'
                let labelTop = '0%'
                let labelTransform = 'translateY(-100%)'
                
                if (shouldCenter) {
                  // Center the label on the box
                  const labelHalfWidth = estimatedLabelWidth / 2
                  
                  // Check if centered label would overflow left edge
                  if (boxCenterX - labelHalfWidth < 0) {
                    // Position at left edge of image (shift right)
                    const shiftRight = (labelHalfWidth - boxCenterX) / boxWidth
                    labelLeft = `${shiftRight * 100}%`
                    labelTransform = 'translateY(-100%)'
                  } 
                  // Check if centered label would overflow right edge
                  else if (boxCenterX + labelHalfWidth > imageWidth) {
                    // Position at right edge of image (shift left)
                    const overflowRight = (boxCenterX + labelHalfWidth) - imageWidth
                    const shiftLeft = overflowRight / boxWidth
                    labelLeft = `${(50 - shiftLeft * 100)}%`
                    labelTransform = 'translate(-100%, -100%)'
                  } else {
                    // Center is fine
                    labelLeft = '50%'
                    labelTransform = 'translate(-50%, -100%)'
                  }
                } else {
                  // Left-aligned label
                  // Check if label would overflow left edge
                  if (boxLeft < estimatedLabelWidth) {
                    // Shift label right to stay within bounds
                    const shiftRight = (estimatedLabelWidth - boxLeft) / boxWidth
                    labelLeft = `${shiftRight * 100}%`
                  }
                  // Check if label would overflow right edge
                  else if (boxLeft + estimatedLabelWidth > imageWidth) {
                    // Position at right edge of box
                    labelLeft = `${((imageWidth - boxLeft) / boxWidth) * 100}%`
                    labelTransform = 'translate(-100%, -100%)'
                  }
                }
                
                // If no room above, show label below the box
                if (!hasRoomAbove) {
                  labelTop = '100%'
                  labelTransform = labelTransform.replace('-100%', '0%')
                }
                
                return (
                  <div
                    className="absolute text-white text-xs px-2 py-0.5 rounded-t font-medium shadow-md z-10"
                    style={{
                      backgroundColor: color,
                      left: labelLeft,
                      top: labelTop,
                      transform: labelTransform,
                      minWidth: 'max-content',
                      whiteSpace: 'nowrap',
                      maxWidth: '90%' // Prevent overflow
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="capitalize">{detection.class}</span>
                      {showConfidence && (
                        <span className="opacity-90">{formatConfidence(detection.confidence)}</span>
                      )}
                      {hasKeypoints && (
                        <span className="opacity-90 text-xs">
                          • {detection.keypoints.filter(kp => kp.confidence >= confidenceThreshold).length} keypoints
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>
    )
  }
  
  // Show detection overlays only for detection tasks, not for segmentation
  if (task === 'detection' && detections && detections.length > 0) {
    // Filter by confidence threshold
    const filteredDetections = detections.filter(detection => detection.confidence >= confidenceThreshold)
    
    return (
      <div className="absolute inset-0 pointer-events-none">
        {filteredDetections.map((detection, index) => {
          // Generate a unique color for each detection
          const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
          const color = colors[index % colors.length]
          
          return (
            <div 
              key={index} 
              className="absolute animate-scale-in" 
              style={{ 
                animationDelay: `${index * 0.1}s`,
                left: `${(detection.bbox.x / imageWidth) * 100}%`,
                top: `${(detection.bbox.y / imageHeight) * 100}%`,
                width: `${(detection.bbox.width / imageWidth) * 100}%`,
                height: `${(detection.bbox.height / imageHeight) * 100}%`,
              }}
            >
              {/* Bounding box with enhanced styling */}
              <div
                className="absolute inset-0 border-2 rounded shadow-lg"
                style={{
                  borderColor: color,
                  backgroundColor: `${color}15`,
                }}
              />
              
              {/* Corner indicators for better visibility */}
              <div
                className="absolute w-3 h-3 border-2 rounded-full"
                style={{
                  borderColor: color,
                  backgroundColor: color,
                  left: '0%',
                  top: '0%',
                  transform: 'translate(-50%, -50%)'
                }}
              />
              <div
                className="absolute w-3 h-3 border-2 rounded-full"
                style={{
                  borderColor: color,
                  backgroundColor: color,
                  right: '0%',
                  top: '0%',
                  transform: 'translate(50%, -50%)'
                }}
              />
              <div
                className="absolute w-3 h-3 border-2 rounded-full"
                style={{
                  borderColor: color,
                  backgroundColor: color,
                  left: '0%',
                  bottom: '0%',
                  transform: 'translate(-50%, 50%)'
                }}
              />
              <div
                className="absolute w-3 h-3 border-2 rounded-full"
                style={{
                  borderColor: color,
                  backgroundColor: color,
                  right: '0%',
                  bottom: '0%',
                  transform: 'translate(50%, 50%)'
                }}
              />
              
              {/* Label attached to top of box */}
              {labelDisplayMode !== 'boxes' && (() => {
                const showConfidence = labelDisplayMode === 'confidence'
                
                // Estimate label text width (rough calculation: ~7px per character for text-xs)
                const labelText = `${detection.class}${showConfidence ? ` ${formatConfidence(detection.confidence)}` : ''}`
                const estimatedLabelWidth = labelText.length * 7 + 16 // 7px per char + 16px padding
                const estimatedLabelHeight = 24 // Approximate height
                
                // Calculate box position in pixels (absolute coordinates)
                const boxLeft = detection.bbox.x
                const boxTop = detection.bbox.y
                const boxWidth = detection.bbox.width
                const boxRight = boxLeft + boxWidth
                const boxCenterX = boxLeft + boxWidth / 2
                
                // Check if label would overflow top edge
                const hasRoomAbove = boxTop >= estimatedLabelHeight
                
                // Check if label would overflow left/right edges when centered
                const boxWidthPercent = (boxWidth / imageWidth) * 100
                const shouldCenter = boxWidthPercent > 15
                
                // Calculate label position (relative to the box container)
                let labelLeft = '0%'
                let labelTop = '0%'
                let labelTransform = 'translateY(-100%)'
                
                if (shouldCenter) {
                  // Center the label on the box
                  const labelHalfWidth = estimatedLabelWidth / 2
                  
                  // Check if centered label would overflow left edge
                  if (boxCenterX - labelHalfWidth < 0) {
                    // Position at left edge of image (shift right)
                    const shiftRight = (labelHalfWidth - boxCenterX) / boxWidth
                    labelLeft = `${shiftRight * 100}%`
                    labelTransform = 'translateY(-100%)'
                  } 
                  // Check if centered label would overflow right edge
                  else if (boxCenterX + labelHalfWidth > imageWidth) {
                    // Position at right edge of image (shift left)
                    const overflowRight = (boxCenterX + labelHalfWidth) - imageWidth
                    const shiftLeft = overflowRight / boxWidth
                    labelLeft = `${(50 - shiftLeft * 100)}%`
                    labelTransform = 'translate(-100%, -100%)'
                  } else {
                    // Center is fine
                    labelLeft = '50%'
                    labelTransform = 'translate(-50%, -100%)'
                  }
                } else {
                  // Left-aligned label
                  // Check if label would overflow left edge
                  if (boxLeft < estimatedLabelWidth) {
                    // Shift label right to stay within bounds
                    const shiftRight = (estimatedLabelWidth - boxLeft) / boxWidth
                    labelLeft = `${shiftRight * 100}%`
                  }
                  // Check if label would overflow right edge
                  else if (boxLeft + estimatedLabelWidth > imageWidth) {
                    // Position at right edge of box
                    labelLeft = `${((imageWidth - boxLeft) / boxWidth) * 100}%`
                    labelTransform = 'translate(-100%, -100%)'
                  }
                }
                
                // If no room above, show label below the box
                if (!hasRoomAbove) {
                  labelTop = '100%'
                  labelTransform = labelTransform.replace('-100%', '0%')
                }
                
                return (
                  <div
                    className="absolute text-white text-xs px-2 py-0.5 rounded-t font-medium shadow-md z-10"
                    style={{
                      backgroundColor: color,
                      left: labelLeft,
                      top: labelTop,
                      transform: labelTransform,
                      minWidth: 'max-content',
                      whiteSpace: 'nowrap',
                      maxWidth: '90%' // Prevent overflow
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="capitalize">{detection.class}</span>
                      {showConfidence && (
                        <span className="opacity-90">{formatConfidence(detection.confidence)}</span>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>
    )
  }

  if ((task === 'segmentation' || task === 'instance-segmentation') && segmentation) {
    // Filter by confidence threshold (segmentation regions may have confidence or we use area as proxy)
    // Note: Segmentation regions might not have confidence, so we filter if they do, otherwise show all
    const filteredSegmentation = segmentation.filter(region => {
      // Check if region has confidence field, otherwise include all
      if ('confidence' in region && typeof (region as any).confidence === 'number') {
        return (region as any).confidence >= confidenceThreshold
      }
      // If no confidence field, include all regions (area-based filtering could be added later)
      return true
    })
    
    // Determine what to show based on labelDisplayMode
    const showShapes = labelDisplayMode === 'shapes' || labelDisplayMode === 'confidence'
    const showLabels = labelDisplayMode === 'labels' || labelDisplayMode === 'confidence'
    
    return (
      <div className="absolute inset-0 pointer-events-none">
        {/* Render pixel-level segmentation masks/shapes */}
        {showShapes && (
          <SegmentationMaskRenderer
            regions={filteredSegmentation}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            containerWidth={imageWidth}
            containerHeight={imageHeight}
          />
        )}
        
        {/* Render labels for each region */}
        {showLabels && filteredSegmentation.map((region, index) => (
          <div key={index} className="animate-fade-in" style={{ animationDelay: `${index * 0.2}s` }}>
            {/* Region label positioned at the center of the region */}
            <div
              className="absolute bg-white text-gray-800 text-xs px-2 py-1 rounded font-medium border border-gray-200 shadow-sm"
              style={{
                left: region.bbox ? `${(region.bbox.x / imageWidth) * 100}%` : '10px',
                top: region.bbox ? `${((region.bbox.y - 25) / imageHeight) * 100}%` : '10px',
                transform: region.bbox ? 'translateX(-50%)' : 'none'
              }}
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full border border-white/50 shadow-soft"
                  style={{ backgroundColor: region.color }}
                />
                <span className="capitalize">{region.class}</span>
                {labelDisplayMode === 'confidence' && (
                  <span className="opacity-70">
                    {(region as any).confidence !== undefined 
                      ? formatConfidence((region as any).confidence)
                      : `(${Math.round(region.area * 100)}%)`
                    }
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return null
}
