'use client';

import React, { useState } from 'react';
import { CVResponse } from '@lidvizion/cv-validation';
import { formatTimestamp, formatConfidence, cn, getTaskIcon, getTaskColor } from '../utils';
import { ResultsDisplayProps } from '../types';
import OverlayRenderer from './OverlayRenderer';

export default function ResultsDisplay({ response, selectedImage, className }: ResultsDisplayProps) {
  const [viewMode, setViewMode] = useState<'json' | 'classes'>('classes');

  if (!response || !selectedImage) {
    return (
      <div className={cn("p-6 border rounded-lg", className)}>
        <div className="text-center py-16">
          <h4 className="text-xl font-semibold mb-3">No Results Yet</h4>
          <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
            Upload an image to see computer vision analysis results and insights
          </p>
        </div>
      </div>
    );
  }

  const TaskIcon = getTaskIcon(response.task);

  return (
    <div className={cn("p-6 border rounded-lg shadow-sm", className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-800 rounded-xl flex items-center justify-center shadow-md">
            <TaskIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Analysis Results</h3>
            <p className="text-sm text-gray-600">Computer vision analysis complete</p>
          </div>
        </div>
        <div className={cn(
          'px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border shadow-sm',
          getTaskColor(response.task)
        )}>
          <TaskIcon className="w-4 h-4" />
          <span className="capitalize">{response.task.replace('-', ' ')}</span>
        </div>
      </div>

      {/* Image on its own row */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-md mb-6">
        <img
          src={selectedImage}
          alt="Processed"
          className="w-full h-full object-contain bg-gray-50"
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
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-800 rounded-lg flex items-center justify-center">
              {viewMode === 'json' ? (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              )}
            </div>
            <h4 className="text-lg font-semibold text-gray-800">
              {viewMode === 'json' ? 'JSON Output' : 'Detection Results'}
            </h4>
          </div>
          
          {/* Toggle buttons */}
          <div className="flex bg-white rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setViewMode('classes')}
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
                viewMode === 'classes'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Classes
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
                viewMode === 'json'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              JSON
            </button>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-auto max-h-96">
          {viewMode === 'json' ? (
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
              {JSON.stringify(response, null, 2)}
            </pre>
          ) : (
            <div className="space-y-2">
              {/* Detection Results */}
              {response.results.detections && response.results.detections.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <span className="text-sm font-medium text-gray-800">Detections</span>
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      {response.results.detections.length} objects
                    </span>
                  </div>
                  <div className="space-y-2">
                    {response.results.detections.map((detection: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="font-medium text-gray-800 capitalize">{detection.class}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-800">{formatConfidence(detection.confidence)}</p>
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
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-800">Classifications</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      {response.results.labels.length} items
                    </span>
                  </div>
                  <div className="space-y-2">
                    {response.results.labels.map((label: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="font-medium text-gray-800 capitalize">{label.class}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-800">{formatConfidence(label.score)}</p>
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
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-800">Segmentation</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      {response.results.segmentation.regions.length} regions
                    </span>
                  </div>
                  <div className="space-y-2">
                    {response.results.segmentation.regions.map((region: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded border border-gray-300"
                            style={{ backgroundColor: region.color }}
                          ></div>
                          <span className="font-medium text-gray-800 capitalize">{region.class}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-800">{Math.round(region.area * 100)}%</p>
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
                <div className="text-center py-8 text-gray-600">
                  <p>No detection results available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 mb-8 mt-6">
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-white transition-colors duration-200">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-800">Processed</p>
              <p className="text-sm text-gray-600">{formatTimestamp(response.timestamp)}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-white transition-colors duration-200">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-800">Processing Time</p>
              <p className="text-sm text-gray-600">{response.processing_time}s</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
