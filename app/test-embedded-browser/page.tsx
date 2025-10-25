'use client'

import { useState } from 'react'
import EmbeddedBrowser from '@/components/EmbeddedBrowser'
import RoboflowSearchModal from '@/components/RoboflowSearchModal'

export default function TestEmbeddedBrowser() {
  const [showBrowser, setShowBrowser] = useState(false)
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Embedded Browser Test</h1>
        
        <div className="space-y-4">
          <button
            onClick={() => setShowBrowser(true)}
            className="btn-primary btn-lg"
          >
            Test Embedded Browser
          </button>
          
          <button
            onClick={() => setShowModal(true)}
            className="btn-secondary btn-lg"
          >
            Test Roboflow Search Modal
          </button>
        </div>

        <div className="mt-8 p-4 bg-white rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          <p className="text-gray-600">
            Click the buttons above to test the embedded browser functionality.
            The browser should open within the application without creating new windows.
          </p>
        </div>

        {/* Embedded Browser */}
        <EmbeddedBrowser
          isOpen={showBrowser}
          onClose={() => setShowBrowser(false)}
          initialUrl="https://universe.roboflow.com"
          title="Test Browser"
        />

        {/* Roboflow Search Modal */}
        <RoboflowSearchModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onResults={(models) => {
            console.log('Found models:', models)
            alert(`Found ${models.length} models!`)
          }}
          searchKeywords={['basketball', 'detection']}
          maxModels={3}
        />
      </div>
    </div>
  )
}
