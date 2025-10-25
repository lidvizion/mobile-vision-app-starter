'use client'

import { useState } from 'react'
import { Search, Plus, Bot } from 'lucide-react'
import RoboflowSearchModal from './RoboflowSearchModal'

interface ModelSearchWithEmbeddedBrowserProps {
  onModelsFound: (models: any[]) => void
}

export default function ModelSearchWithEmbeddedBrowser({ onModelsFound }: ModelSearchWithEmbeddedBrowserProps) {
  const [showRoboflowModal, setShowRoboflowModal] = useState(false)
  const [searchKeywords, setSearchKeywords] = useState(['basketball', 'detection'])

  const handleRoboflowResults = (models: any[]) => {
    console.log('🤖 Roboflow models found:', models)
    onModelsFound(models)
    setShowRoboflowModal(false)
  }

  return (
    <div className="space-y-4">
      {/* Search Controls */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchKeywords.join(', ')}
            onChange={(e) => setSearchKeywords(e.target.value.split(',').map(s => s.trim()))}
            placeholder="Enter search keywords..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <button
          onClick={() => setShowRoboflowModal(true)}
          className="btn-primary hover-lift flex items-center space-x-2"
        >
          <Bot className="w-4 h-4" />
          <span>AI Search Roboflow</span>
        </button>
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-blue-900 mb-1">AI-Powered Roboflow Search</h3>
            <p className="text-sm text-blue-700 mb-2">
              Our AI agent will browse Roboflow Universe within an embedded browser to find the best models for your search terms.
            </p>
            <ul className="text-xs text-blue-600 space-y-1">
              <li>• Browser opens within the application (no new windows)</li>
              <li>• AI agent navigates and extracts model information</li>
              <li>• Results are automatically integrated into your search</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Roboflow Search Modal */}
      <RoboflowSearchModal
        isOpen={showRoboflowModal}
        onClose={() => setShowRoboflowModal(false)}
        onResults={handleRoboflowResults}
        searchKeywords={searchKeywords}
        maxModels={5}
      />
    </div>
  )
}
