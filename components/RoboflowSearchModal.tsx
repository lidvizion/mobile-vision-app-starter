'use client'

import { useState, useEffect } from 'react'
import { X, Search, Download, ExternalLink, Loader2 } from 'lucide-react'
import EmbeddedBrowser from './EmbeddedBrowser'

interface RoboflowSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onResults: (models: any[]) => void
  searchKeywords: string[]
  maxModels?: number
}

import { ModelMetadata } from '@/types/models'

interface ModelResult extends ModelMetadata {
  // Keep backward compatibility with old format
  model_identifier?: string
  model_name?: string
  model_url?: string
  mAP?: string
  precision?: string
  recall?: string
  training_images?: string
  api_endpoint?: string
}

export default function RoboflowSearchModal({ 
  isOpen, 
  onClose, 
  onResults, 
  searchKeywords,
  maxModels = 5 
}: RoboflowSearchModalProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<ModelResult[]>([])
  const [showBrowser, setShowBrowser] = useState(false)
  const [searchProgress, setSearchProgress] = useState('')

  const startRoboflowSearch = async () => {
    setIsSearching(true)
    setSearchProgress('Starting AI-powered search...')
    setShowBrowser(true)

    try {
      // Call the Python script for Roboflow search
      const response = await fetch('/api/roboflow-python-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords: searchKeywords,
          max_models: maxModels
        })
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      
      if (data.success && data.models) {
        setSearchResults(data.models)
        setSearchProgress(`Found ${data.models.length} models`)
      } else {
        throw new Error(data.error || 'No models found')
      }

    } catch (error) {
      console.error('Roboflow search error:', error)
      setSearchProgress(`Error: ${error instanceof Error ? error.message : 'Search failed'}`)
    } finally {
      setIsSearching(false)
    }
  }

  const handleResults = (models: ModelResult[]) => {
    setSearchResults(models)
    onResults(models)
    setSearchProgress(`Successfully found ${models.length} models`)
  }

  const exportResults = () => {
    const resultsText = searchResults.map((model, index) => 
      `${index + 1}. ${model.name}
   Author: ${model.author}
   mAP: ${model.metrics?.mAP?.toFixed(1) || 'N/A'}%
   Precision: ${model.metrics?.precision?.toFixed(1) || 'N/A'}%
   Recall: ${model.metrics?.recall?.toFixed(1) || 'N/A'}%
   Training Images: ${model.trainingImages?.toLocaleString() || 'N/A'}
   URL: ${model.modelUrl}
   API Endpoint: ${model.inferenceEndpoint || 'N/A'}
   Tags: ${model.tags.join(', ')}
   Classes: ${model.classes?.join(', ') || 'N/A'}
   Description: ${model.description}
   Task: ${model.task}
   Frameworks: ${model.frameworks.join(', ')}
`
    ).join('\n')

    const blob = new Blob([resultsText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roboflow_search_results_${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">🤖 AI-Powered Roboflow Search</h2>
            <p className="text-sm text-gray-600">
              Search terms: {searchKeywords.join(', ')} | Target: {maxModels} models
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          {!showBrowser ? (
            /* Search Setup */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">AI-Powered Model Search</h3>
                <p className="text-gray-600 mb-6">
                  Our AI agent will browse Roboflow Universe to find the best models for your search terms.
                  The browser will open in a controlled environment within this application.
                </p>
                <button
                  onClick={startRoboflowSearch}
                  disabled={isSearching}
                  className="btn-primary btn-lg hover-lift disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      <span>Start AI Search</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Browser and Results */
            <div className="flex-1 flex">
              {/* Browser Section */}
              <div className="flex-1 border-r">
                <EmbeddedBrowser
                  isOpen={true}
                  onClose={() => setShowBrowser(false)}
                  initialUrl="https://universe.roboflow.com"
                  title="Roboflow Universe - AI Search"
                />
              </div>

              {/* Results Section */}
              <div className="w-1/3 p-4 bg-gray-50">
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Search Progress</h3>
                  <div className="text-sm text-gray-600 mb-4">{searchProgress}</div>
                  
                  {searchResults.length > 0 && (
                    <button
                      onClick={exportResults}
                      className="btn-secondary btn-sm mb-4"
                    >
                      <Download className="w-4 h-4" />
                      Export Results
                    </button>
                  )}
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Found Models ({searchResults.length})</h4>
                    {searchResults.map((model, index) => (
                      <div key={index} className="bg-white p-3 rounded border">
                        <div className="font-medium text-sm">{model.name}</div>
                        <div className="text-xs text-gray-500 mb-1">by {model.author}</div>
                        <div className="text-xs space-y-1">
                          {model.metrics?.mAP && (
                            <div>mAP: {model.metrics.mAP.toFixed(1)}%</div>
                          )}
                          {model.trainingImages && (
                            <div>Training Images: {model.trainingImages.toLocaleString()}</div>
                          )}
                          <div className="flex items-center space-x-1">
                            <span>Tags:</span>
                            <div className="flex flex-wrap gap-1">
                              {model.tags.slice(0, 2).map((tag, i) => (
                                <span key={i} className="bg-blue-100 text-blue-800 text-xs px-1 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          {model.classes && model.classes.length > 0 && (
                            <div className="flex items-center space-x-1">
                              <span>Classes:</span>
                              <div className="flex flex-wrap gap-1">
                                {model.classes.slice(0, 3).map((cls, i) => (
                                  <span key={i} className="bg-green-100 text-green-800 text-xs px-1 rounded">
                                    {cls}
                                  </span>
                                ))}
                                {model.classes.length > 3 && (
                                  <span className="text-xs text-gray-500">+{model.classes.length - 3} more</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <a
                          href={model.modelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center mt-1"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View Model
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {searchResults.length > 0 && (
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Found {searchResults.length} models
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => onResults(searchResults)}
                  className="btn-primary btn-sm"
                >
                  Use These Models
                </button>
                <button
                  onClick={onClose}
                  className="btn-secondary btn-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
