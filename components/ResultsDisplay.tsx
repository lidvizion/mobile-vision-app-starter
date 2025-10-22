'use client'

import { useState } from 'react'
import { CVResponse } from '@/types'
import { formatTimestamp, formatConfidence } from '@/lib/utils'
import { Clock, Zap, Image as ImageIcon, BarChart3, Target, Tag, Palette, Code, List } from 'lucide-react'
import OverlayRenderer from './OverlayRenderer'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface ResultsDisplayProps {
  response: CVResponse | null
  selectedImage: string | null
}

export default function ResultsDisplay({ response, selectedImage }: ResultsDisplayProps) {
  const [viewMode, setViewMode] = useState<'json' | 'classes'>('classes')

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
      'multi-type': 'bg-purple-50 text-purple-700 border-purple-200'
    }
    return colors[task as keyof typeof colors] || 'bg-wells-light-beige text-wells-warm-grey border-wells-warm-grey/20'
  }

  const TaskIcon = getTaskIcon(response.task)

  return (
    <div className="card-floating p-6">
      <div className="flex items-center justify-between mb-6">
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

      {/* Image on its own row */}
      <div className="relative rounded-2xl overflow-hidden border border-wells-warm-grey/20 shadow-md mb-6">
        <Image
          src={selectedImage}
          alt="Processed"
          width={800}
          height={400}
          className="w-full h-full object-contain bg-wells-light-beige"
        />
        <OverlayRenderer
          detections={response.results.detections}
          segmentation={response.results.segmentation?.regions}
          imageWidth={response.image_metadata.width}
          imageHeight={response.image_metadata.height}
          task={response.task}
        />
      </div>

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
            <pre className="text-sm text-wells-dark-grey whitespace-pre-wrap font-mono">
              {JSON.stringify(response, null, 2)}
            </pre>
          ) : (
            <div className="space-y-2">
              {/* Detection Results */}
              {response.results.detections && response.results.detections.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-wells-dark-grey">Detections</span>
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      {response.results.detections.length} objects
                    </span>
                  </div>
                  <div className="space-y-2">
                    {response.results.detections.map((detection, index) => (
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
                      {response.results.labels.length} items
                    </span>
                  </div>
                  <div className="space-y-2">
                    {response.results.labels.map((label, index) => (
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
                      {response.results.segmentation.regions.length} {response.task === 'instance-segmentation' || response.results.segmentation.regions.some(r => r.bbox) ? 'instances' : 'regions'}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                      Pixel-level masks
                    </span>
                  </div>
                  <div className="space-y-2">
                    {response.results.segmentation.regions.map((region, index) => (
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

              {/* No results message */}
              {(!response.results.detections || response.results.detections.length === 0) && 
               (!response.results.labels || response.results.labels.length === 0) && 
               (!response.results.segmentation || !response.results.segmentation.regions || response.results.segmentation.regions.length === 0) && (
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
}