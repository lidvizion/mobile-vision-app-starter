'use client'

import { Detection, SegmentationRegion } from '@/types'
import { formatConfidence } from '@/lib/utils'
import SegmentationMaskRenderer from './SegmentationMaskRenderer'

interface OverlayRendererProps {
  detections?: Detection[]
  segmentation?: SegmentationRegion[]
  imageWidth: number
  imageHeight: number
  task: string
}

export default function OverlayRenderer({ 
  detections, 
  segmentation, 
  imageWidth, 
  imageHeight, 
  task 
}: OverlayRendererProps) {
  // Show detection overlays only for detection tasks, not for segmentation
  if (task === 'detection' && detections && detections.length > 0) {
    return (
      <div className="absolute inset-0 pointer-events-none">
        {detections.map((detection, index) => {
          // Generate a unique color for each detection
          const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
          const color = colors[index % colors.length]
          
          return (
            <div key={index} className="animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
              {/* Bounding box with enhanced styling */}
              <div
                className="absolute border-2 rounded shadow-lg"
                style={{
                  borderColor: color,
                  backgroundColor: `${color}15`,
                  left: `${(detection.bbox.x / imageWidth) * 100}%`,
                  top: `${(detection.bbox.y / imageHeight) * 100}%`,
                  width: `${(detection.bbox.width / imageWidth) * 100}%`,
                  height: `${(detection.bbox.height / imageHeight) * 100}%`,
                }}
              />
              
              {/* Corner indicators for better visibility */}
              <div
                className="absolute w-3 h-3 border-2 rounded-full"
                style={{
                  borderColor: color,
                  backgroundColor: color,
                  left: `${(detection.bbox.x / imageWidth) * 100}%`,
                  top: `${(detection.bbox.y / imageHeight) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              />
              <div
                className="absolute w-3 h-3 border-2 rounded-full"
                style={{
                  borderColor: color,
                  backgroundColor: color,
                  left: `${((detection.bbox.x + detection.bbox.width) / imageWidth) * 100}%`,
                  top: `${(detection.bbox.y / imageHeight) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              />
              <div
                className="absolute w-3 h-3 border-2 rounded-full"
                style={{
                  borderColor: color,
                  backgroundColor: color,
                  left: `${(detection.bbox.x / imageWidth) * 100}%`,
                  top: `${((detection.bbox.y + detection.bbox.height) / imageHeight) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              />
              <div
                className="absolute w-3 h-3 border-2 rounded-full"
                style={{
                  borderColor: color,
                  backgroundColor: color,
                  left: `${((detection.bbox.x + detection.bbox.width) / imageWidth) * 100}%`,
                  top: `${((detection.bbox.y + detection.bbox.height) / imageHeight) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              />
              
              {/* Enhanced label with better positioning */}
              <div
                className="absolute text-white text-sm px-3 py-1 rounded-lg font-semibold shadow-lg border"
                style={{
                  backgroundColor: color,
                  borderColor: color,
                  left: `${(detection.bbox.x / imageWidth) * 100}%`,
                  top: `${((detection.bbox.y - 35) / imageHeight) * 100}%`,
                  transform: 'translateX(-50%)',
                  minWidth: 'max-content'
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span className="capitalize">{detection.class}</span>
                  <span className="opacity-90 text-xs">({formatConfidence(detection.confidence)})</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if ((task === 'segmentation' || task === 'instance-segmentation') && segmentation) {
    return (
      <div className="absolute inset-0 pointer-events-none">
        {/* Render pixel-level segmentation masks */}
        <SegmentationMaskRenderer
          regions={segmentation}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          containerWidth={imageWidth}
          containerHeight={imageHeight}
        />
        
        {/* Render labels for each region */}
        {segmentation.map((region, index) => (
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
                <span className="opacity-70">({Math.round(region.area * 100)}%)</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return null
}
