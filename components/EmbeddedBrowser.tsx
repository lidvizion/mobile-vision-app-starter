'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Maximize2, Minimize2, RefreshCw, ExternalLink } from 'lucide-react'

interface EmbeddedBrowserProps {
  isOpen: boolean
  onClose: () => void
  initialUrl?: string
  title?: string
}

export default function EmbeddedBrowser({ 
  isOpen, 
  onClose, 
  initialUrl = 'https://universe.roboflow.com',
  title = 'Roboflow Universe Browser'
}: EmbeddedBrowserProps) {
  const [currentUrl, setCurrentUrl] = useState(initialUrl)
  const [isLoading, setIsLoading] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleUrlChange = (url: string) => {
    setCurrentUrl(url)
    setIsLoading(true)
  }

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src
      setIsLoading(true)
    }
  }

  const handleExternalOpen = () => {
    window.open(currentUrl, '_blank')
  }

  const handleIframeLoad = () => {
    setIsLoading(false)
  }

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 ${isMaximized ? 'p-0' : ''}`}>
      <div className={`bg-white rounded-lg shadow-xl flex flex-col ${isMaximized ? 'w-full h-full' : 'w-4/5 h-4/5 max-w-6xl'}`}>
        {/* Browser Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="ml-3 text-sm font-medium text-gray-700">{title}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={handleExternalOpen}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* URL Bar */}
        <div className="flex items-center p-3 border-b bg-white">
          <div className="flex-1 flex items-center space-x-2">
            <div className="flex-1 bg-gray-100 rounded-lg px-3 py-2">
              <input
                type="url"
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleUrlChange(currentUrl)
                  }
                }}
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Enter URL..."
              />
            </div>
            <button
              onClick={() => handleUrlChange(currentUrl)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            >
              Go
            </button>
          </div>
        </div>

        {/* Browser Content */}
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                <span className="text-sm text-gray-600">Loading...</span>
              </div>
            </div>
          )}
          
          <iframe
            ref={iframeRef}
            src={currentUrl}
            onLoad={handleIframeLoad}
            className="w-full h-full border-0"
            title={title}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      </div>
    </div>
  )
}
