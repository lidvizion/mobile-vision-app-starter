'use client'

import React from 'react'
import { RoboflowModel } from '@/hooks/useRoboflowSearch'
import { logger, createLogContext } from '@/lib/logger'

interface RoboflowSearchResultsProps {
  models: RoboflowModel[]
  searchQuery: string
  isSearching: boolean
  onSelectModel: (model: RoboflowModel) => void
}

export function RoboflowSearchResults({ 
  models, 
  searchQuery, 
  isSearching, 
  onSelectModel 
}: RoboflowSearchResultsProps) {
  const context = createLogContext('roboflow-search', 'RoboflowSearchResults', 'render-results')
  
  if (isSearching) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Searching Roboflow Universe...</p>
        </div>
      </div>
    )
  }

  if (!models || models.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.709M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No models found</h3>
        <p className="text-gray-500">Try adjusting your search query or task type.</p>
      </div>
    )
  }

  logger.info('Rendering Roboflow search results', context, {
    modelCount: models.length,
    searchQuery
  })

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Roboflow Universe Models
        </h3>
        <p className="text-sm text-gray-600">
          Found {models.length} models for: "{searchQuery}"
        </p>
      </div>

      <div className="grid gap-4">
        {models.map((model, index) => (
          <RoboflowModelCard
            key={model.id}
            model={model}
            rank={index + 1}
            onSelect={() => {
              logger.info('User selected Roboflow model', context, {
                modelId: model.id,
                modelName: model.name
              })
              onSelectModel(model)
            }}
          />
        ))}
      </div>
    </div>
  )
}

interface RoboflowModelCardProps {
  model: RoboflowModel
  rank: number
  onSelect: () => void
}

function RoboflowModelCard({ model, rank, onSelect }: RoboflowModelCardProps) {
  const getTaskIcon = (taskType: string) => {
    const icons = {
      'detection': '🎯',
      'segmentation': '🎨',
      'classification': '📊',
      'instance-segmentation': '🔍'
    }
    return icons[taskType as keyof typeof icons] || '🤖'
  }

  const getTaskColor = (taskType: string) => {
    const colors = {
      'detection': 'bg-blue-100 text-blue-800',
      'segmentation': 'bg-green-100 text-green-800',
      'classification': 'bg-purple-100 text-purple-800',
      'instance-segmentation': 'bg-orange-100 text-orange-800'
    }
    return colors[taskType as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const formatDownloads = (downloads: number) => {
    if (downloads >= 1000) {
      return `${(downloads / 1000).toFixed(1)}k`
    }
    return downloads.toString()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-semibold">
            #{rank}
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900">{model.name}</h4>
            <p className="text-sm text-gray-600">by {model.author}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTaskColor(model.task_type)}`}>
            {getTaskIcon(model.task_type)} {model.task_type}
          </span>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {Math.round(model.confidence * 100)}% confidence
            </div>
            <div className="text-xs text-gray-500">
              {formatDownloads(model.downloads)} downloads
            </div>
          </div>
        </div>
      </div>

      <p className="text-gray-700 mb-4">{model.description}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {model.tags.map((tag, index) => (
          <span
            key={index}
            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          <span>Created: {new Date(model.created).toLocaleDateString()}</span>
          <span className="mx-2">•</span>
          <span>Endpoint: {model.endpoint.split('/').pop()}</span>
        </div>
        
        <button
          onClick={onSelect}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Use Model
        </button>
      </div>
    </div>
  )
}
