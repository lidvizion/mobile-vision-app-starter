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
  // Keypoint Detection: Render keypoints with skeleton lines (Roboflow style - no bounding boxes)
  if (task === 'keypoint-detection' && keypointDetections && keypointDetections.length > 0) {
    // Filter by confidence threshold
    const filteredKeypointDetections = keypointDetections.filter(detection => detection.confidence >= confidenceThreshold)
    
    return (
      <div className="absolute inset-0 pointer-events-none">
        {filteredKeypointDetections.map((detection, index) => {
          const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
          const color = colors[index % colors.length]
          
          // Filter keypoints by confidence
          const visibleKeypoints = (detection.keypoints || []).filter(kp => kp.confidence >= confidenceThreshold)
          
          if (visibleKeypoints.length === 0) return null
          
          return (
            <div 
              key={index} 
              className="absolute inset-0 animate-scale-in" 
              style={{ 
                animationDelay: `${index * 0.1}s`,
              }}
            >
              {/* Keypoints connected by skeleton lines (Roboflow style) */}
                  {(() => {
                // Filter to only high-confidence keypoints
                const highConfidenceKeypoints = visibleKeypoints
                    
                    if (highConfidenceKeypoints.length < 2) {
                  // Not enough keypoints to draw lines - just show dots
                      return (
                        <>
                      {highConfidenceKeypoints.map((kp, kpIndex) => (
                              <div
                          key={`kp-${kpIndex}-${kp.class_id || kp.class || kpIndex}`}
                                className="absolute rounded-full border-2 shadow-md z-10"
                                style={{
                                  backgroundColor: color,
                                  borderColor: '#FFFFFF',
                                  left: `${(kp.x / imageWidth) * 100}%`,
                                  top: `${(kp.y / imageHeight) * 100}%`,
                            width: '10px',
                            height: '10px',
                                  transform: 'translate(-50%, -50%)',
                            opacity: Math.max(0.7, kp.confidence)
                                }}
                                title={`${kp.class || `Keypoint ${kpIndex}`}: ${(kp.confidence * 100).toFixed(1)}%`}
                              />
                      ))}
                        </>
                      )
                    }
                    
                    // Calculate distance between two keypoints
                const distance = (kp1: Keypoint, kp2: Keypoint) => {
                      return Math.sqrt(Math.pow(kp2.x - kp1.x, 2) + Math.pow(kp2.y - kp1.y, 2))
                    }
                    
                // Smart skeleton connection logic
                // NOTE: Roboflow does NOT provide skeleton connection data in the API response
                // Skeleton connections are manually defined in project settings but are only used
                // for visualization in Roboflow's UI, not returned via API
                // 
                // Priority 1: Use heuristic detection for human pose models (anatomical connections)
                // Priority 2: Use proximity-based connections for other models
                const connectionPairs: Array<[Keypoint, Keypoint]> = []
                
                // Helper function to find keypoint by class name or class_id
                const findKeypoint = (name: string, id?: number): Keypoint | undefined => {
                  return highConfidenceKeypoints.find(kp => 
                    (kp.class && kp.class.toLowerCase().includes(name.toLowerCase())) ||
                    (id !== undefined && kp.class_id === id)
                  )
                }
                
                // Check if this looks like a human pose model (has head, shoulders, etc.)
                const hasHead = findKeypoint('head', 2)
                const hasLeftShoulder = findKeypoint('left-shoulder', 0) || findKeypoint('left_shoulder', 0)
                const hasRightShoulder = findKeypoint('right-shoulder', 1) || findKeypoint('right_shoulder', 1)
                const isHumanPose = hasHead || (hasLeftShoulder && hasRightShoulder)
                
                if (isHumanPose) {
                  // Human pose skeleton connections (anatomical structure)
                  // Head connections
                  const head = findKeypoint('head', 2)
                  const leftShoulder = findKeypoint('left-shoulder', 0) || findKeypoint('left_shoulder', 0)
                  const rightShoulder = findKeypoint('right-shoulder', 1) || findKeypoint('right_shoulder', 1)
                  
                  if (head && leftShoulder) connectionPairs.push([head, leftShoulder])
                  if (head && rightShoulder) connectionPairs.push([head, rightShoulder])
                  
                  // Shoulder line
                  if (leftShoulder && rightShoulder) connectionPairs.push([leftShoulder, rightShoulder])
                  
                  // Left arm: shoulder -> elbow -> wrist
                  const leftElbow = findKeypoint('left-elbow', 3) || findKeypoint('left_elbow', 3)
                  const leftWrist = findKeypoint('left-wrist', 6) || findKeypoint('left_wrist', 6)
                  if (leftShoulder && leftElbow) connectionPairs.push([leftShoulder, leftElbow])
                  if (leftElbow && leftWrist) connectionPairs.push([leftElbow, leftWrist])
                  
                  // Right arm: shoulder -> elbow -> wrist
                  const rightElbow = findKeypoint('right-elbow', 4) || findKeypoint('right_elbow', 4)
                  const rightWrist = findKeypoint('right-wrist', 5) || findKeypoint('right_wrist', 5)
                  if (rightShoulder && rightElbow) connectionPairs.push([rightShoulder, rightElbow])
                  if (rightElbow && rightWrist) connectionPairs.push([rightElbow, rightWrist])
                  
                  // Left side: shoulder -> hip -> knee -> ankle
                  const leftHip = findKeypoint('left-hip', 7) || findKeypoint('left_hip', 7)
                  const leftKnee = findKeypoint('left-knee', 9) || findKeypoint('left_knee', 9)
                  const leftAnkle = findKeypoint('left-ankle', 12) || findKeypoint('left_ankle', 12)
                  if (leftShoulder && leftHip) connectionPairs.push([leftShoulder, leftHip])
                  if (leftHip && leftKnee) connectionPairs.push([leftHip, leftKnee])
                  if (leftKnee && leftAnkle) connectionPairs.push([leftKnee, leftAnkle])
                  
                  // Right side: shoulder -> hip -> knee -> ankle
                  const rightHip = findKeypoint('right-hip', 8) || findKeypoint('right_hip', 8)
                  const rightKnee = findKeypoint('right-knee', 10) || findKeypoint('right_knee', 10)
                  const rightAnkle = findKeypoint('right-ankle', 11) || findKeypoint('right_ankle', 11)
                  if (rightShoulder && rightHip) connectionPairs.push([rightShoulder, rightHip])
                  if (rightHip && rightKnee) connectionPairs.push([rightHip, rightKnee])
                  if (rightKnee && rightAnkle) connectionPairs.push([rightKnee, rightAnkle])
                  
                  // Hip line
                  if (leftHip && rightHip) connectionPairs.push([leftHip, rightHip])
                } else {
                  // Fallback: Use proximity-based connections for non-human pose models
                  // This creates connections based on spatial proximity
                  // Sort keypoints by y-coordinate (top to bottom) and x-coordinate (left to right)
                  const sortedKeypoints = [...highConfidenceKeypoints].sort((a, b) => {
                    // First sort by y (vertical position)
                    if (Math.abs(a.y - b.y) > 20) {
                      return a.y - b.y
                    }
                    // Then by x (horizontal position)
                    return a.x - b.x
                  })
                  
                  // Calculate average distance to nearest neighbors
                    const distances: number[] = []
                  sortedKeypoints.forEach((kp, i) => {
                      let minDist = Infinity
                    sortedKeypoints.forEach((otherKp, j) => {
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
                    
                  // Connection threshold: connect if distance is less than 3x the average nearest neighbor distance
                  const connectionThreshold = avgNearestDistance * 3
                  
                  // Generate connections: connect keypoints that are close
                  sortedKeypoints.forEach((kp, i) => {
                    sortedKeypoints.forEach((otherKp, j) => {
                      if (i !== j) {
                        const dist = distance(kp, otherKp)
                        if (dist < connectionThreshold) {
                          // Check if this pair already exists (avoid duplicates)
                          const exists = connectionPairs.some(([k1, k2]) => 
                            (k1 === kp && k2 === otherKp) || (k1 === otherKp && k2 === kp)
                          )
                          if (!exists) {
                            connectionPairs.push([kp, otherKp])
                          }
                        }
                      }
                    })
                  })
                }
                
                // Remove duplicate connections
                const uniquePairs: Array<[Keypoint, Keypoint]> = []
                connectionPairs.forEach(([kp1, kp2]) => {
                  const exists = uniquePairs.some(([k1, k2]) => 
                    (k1 === kp1 && k2 === kp2) || (k1 === kp2 && k2 === kp1)
                  )
                  if (!exists) {
                    uniquePairs.push([kp1, kp2])
                      }
                    })
                    
                    return (
                      <>
                    {/* Draw skeleton lines connecting keypoints (Roboflow style) */}
                        <svg
                          className="absolute inset-0 pointer-events-none"
                          style={{ width: '100%', height: '100%', overflow: 'visible' }}
                          viewBox={`0 0 ${imageWidth} ${imageHeight}`}
                          preserveAspectRatio="none"
                        >
                      {uniquePairs.map(([kp1, kp2], lineIndex) => {
                        const avgConfidence = (kp1.confidence + kp2.confidence) / 2
                        return (
                            <line
                            key={`line-${lineIndex}-${kp1.class_id || kp1.class || 'kp'}-${kp2.class_id || kp2.class || 'kp'}`}
                              x1={kp1.x}
                              y1={kp1.y}
                              x2={kp2.x}
                              y2={kp2.y}
                            stroke={color}
                            strokeWidth="3"
                            strokeOpacity={Math.max(0.6, avgConfidence)}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                        )
                      })}
                        </svg>
                        
                    {/* Render keypoint dots (Roboflow style - colored circles) */}
                    {highConfidenceKeypoints.map((kp, kpIndex) => (
                      <div
                        key={`kp-${kpIndex}-${kp.class_id || kp.class || kpIndex}`}
                        className="absolute rounded-full border-2 shadow-lg z-10"
                              style={{
                                backgroundColor: color,
                                borderColor: '#FFFFFF',
                                left: `${(kp.x / imageWidth) * 100}%`,
                                top: `${(kp.y / imageHeight) * 100}%`,
                          width: '10px',
                          height: '10px',
                                transform: 'translate(-50%, -50%)',
                          opacity: Math.max(0.8, kp.confidence)
                              }}
                              title={`${kp.class || `Keypoint ${kpIndex}`}: ${(kp.confidence * 100).toFixed(1)}%`}
                            />
                    ))}
                      </>
                    )
                  })()}
              
              {/* Optional label (Roboflow typically doesn't show labels for keypoint detection) */}
              {labelDisplayMode !== 'boxes' && labelDisplayMode === 'confidence' && (() => {
                const showConfidence = labelDisplayMode === 'confidence'
                const hasKeypoints = detection.keypoints && detection.keypoints.length > 0
                const keypointCount = visibleKeypoints.length
                
                // For keypoint detection, show minimal label at top-left of keypoint area
                // Find the topmost keypoint to position label
                if (visibleKeypoints.length === 0) return null
                
                const topmostKeypoint = visibleKeypoints.reduce((top, kp) => 
                  kp.y < top.y ? kp : top, visibleKeypoints[0]
                )
                
                const labelText = `${detection.class}${showConfidence ? ` ${formatConfidence(detection.confidence)}` : ''}${hasKeypoints ? ` • ${keypointCount} pts` : ''}`
                const estimatedLabelWidth = labelText.length * 7 + 16
                
                return (
                  <div
                    className="absolute text-white text-xs px-2 py-1 rounded font-semibold shadow-lg border z-20"
                    style={{
                      backgroundColor: `${color}E6`, // 90% opacity
                      borderColor: color,
                      left: `${(topmostKeypoint.x / imageWidth) * 100}%`,
                      top: `${((topmostKeypoint.y - 30) / imageHeight) * 100}%`,
                      transform: 'translate(-50%, -100%)',
                      minWidth: 'max-content',
                      maxWidth: `${Math.min(estimatedLabelWidth, imageWidth * 0.3)}px`
                    }}
                  >
                    {labelText}
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
    
    // Helper function to convert bbox coordinates (handles both normalized 0-1 and pixel coordinates)
    const normalizeBbox = (bbox: { x: number; y: number; width: number; height: number } | { x: number; y: number; w: number; h: number }) => {
      const width = 'width' in bbox ? bbox.width : bbox.w
      const height = 'height' in bbox ? bbox.height : bbox.h
      
      // Detect if coordinates are normalized (0-1) by checking if values are < 1.0
      // If x, y, width, or height are all < 1.0, assume normalized coordinates
      const isNormalized = bbox.x < 1.0 && bbox.y < 1.0 && width < 1.0 && height < 1.0
      
      if (isNormalized) {
        // Convert normalized (0-1) to pixels
        return {
          x: bbox.x * imageWidth,
          y: bbox.y * imageHeight,
          width: width * imageWidth,
          height: height * imageHeight
        }
      } else {
        // Already in pixels, use as-is
        return {
          x: bbox.x,
          y: bbox.y,
          width: width,
          height: height
        }
      }
    }
    
    return (
      <div className="absolute inset-0 pointer-events-none">
        {filteredDetections.map((detection, index) => {
          // Generate a unique color for each detection (using brighter colors for visibility)
          const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#FF1493']
          const color = colors[index % colors.length]
          
          // Normalize bbox coordinates (convert from 0-1 to pixels if needed)
          const bbox = detection.bbox || (detection as any).box || (detection as any).boundingBox
          const pixelBbox = normalizeBbox(bbox)
          
          return (
            <div 
              key={index} 
              className="absolute animate-scale-in" 
              style={{ 
                animationDelay: `${index * 0.1}s`,
                left: `${(pixelBbox.x / imageWidth) * 100}%`,
                top: `${(pixelBbox.y / imageHeight) * 100}%`,
                width: `${(pixelBbox.width / imageWidth) * 100}%`,
                height: `${(pixelBbox.height / imageHeight) * 100}%`,
              }}
            >
              {/* Clean, simple bounding box - parallel edges, no rounded corners */}
              <div
                className="absolute inset-0"
                style={{
                  border: `2px solid ${color}`,
                  borderColor: color,
                  backgroundColor: `${color}20`, // 20% opacity fill
                }}
              />
              
              {/* Label attached to top of box */}
              {labelDisplayMode !== 'boxes' && (() => {
                const showConfidence = labelDisplayMode === 'confidence'
                
                // Estimate label text width (rough calculation: ~7px per character for text-xs)
                const labelText = `${detection.class}${showConfidence ? ` ${formatConfidence(detection.confidence)}` : ''}`
                const estimatedLabelWidth = labelText.length * 7 + 16 // 7px per char + 16px padding
                const estimatedLabelHeight = 24 // Approximate height
                
                // Calculate box position in pixels (absolute coordinates) - use normalized pixelBbox
                const boxLeft = pixelBbox.x
                const boxTop = pixelBbox.y
                const boxWidth = pixelBbox.width
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
                    className="absolute text-white text-xs px-2 py-1 rounded font-semibold shadow-lg z-10"
                    style={{
                      backgroundColor: `${color}E6`, // 90% opacity background
                      border: `2px solid ${color}`,
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
    const filteredSegmentation = segmentation.filter(region => {
      // If confidence exists, use it; otherwise use area as a proxy (area is 0-1, similar to confidence)
      if ((region as any).confidence !== undefined && typeof (region as any).confidence === 'number') {
        return (region as any).confidence >= confidenceThreshold
      }
      // Use area as proxy for confidence threshold (area is also 0-1)
      // Filter out regions with very small area when threshold is high
      return region.area >= confidenceThreshold
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
