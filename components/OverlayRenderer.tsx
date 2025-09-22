'use client'

import { Detection, SegmentationRegion } from '@/types'
import { formatConfidence } from '@/lib/utils'

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
  if (task === 'detection' && detections) {
    return (
      <div className="absolute inset-0 pointer-events-none">
        {detections.map((detection, index) => (
          <div key={index} className="animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
            {/* Bounding box */}
                   <div
                     className="absolute border-2 border-red-500 bg-red-500/10 rounded"
              style={{
                left: `${(detection.bbox.x / imageWidth) * 100}%`,
                top: `${(detection.bbox.y / imageHeight) * 100}%`,
                width: `${(detection.bbox.width / imageWidth) * 100}%`,
                height: `${(detection.bbox.height / imageHeight) * 100}%`,
              }}
            />
            {/* Label */}
                   <div
                     className="absolute bg-red-600 text-white text-xs px-2 py-1 rounded font-medium"
              style={{
                left: `${(detection.bbox.x / imageWidth) * 100}%`,
                top: `${((detection.bbox.y - 30) / imageHeight) * 100}%`,
              }}
            >
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span>{detection.class}</span>
                <span className="opacity-90">({formatConfidence(detection.confidence)})</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (task === 'segmentation' && segmentation) {
    return (
      <div className="absolute inset-0 pointer-events-none">
        {segmentation.map((region, index) => (
          <div key={index} className="animate-fade-in" style={{ animationDelay: `${index * 0.2}s` }}>
            {/* Region overlay - simplified for area-based display */}
                   <div
                     className="absolute rounded border border-white/30"
              style={{
                backgroundColor: `${region.color}40`,
                left: '10%',
                top: '10%',
                width: '80%',
                height: '80%',
              }}
            />
            {/* Region label */}
                   <div
                     className="absolute bg-white text-gray-800 text-xs px-2 py-1 rounded font-medium border border-gray-200"
              style={{
                left: '10px',
                top: '10px',
              }}
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full border border-white/50 shadow-soft"
                  style={{ backgroundColor: region.color }}
                />
                <span>{region.class}</span>
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
