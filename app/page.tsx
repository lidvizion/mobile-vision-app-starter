'use client'

import { useState } from 'react'
import { useCVTask } from '@/hooks/useCVTask'
import { useResultHistory } from '@/hooks/useResultHistory'
import GuidedModelFlow from '@/components/GuidedModelFlow'
import CameraPreview from '@/components/CameraPreview'
import ResultsDisplay from '@/components/ResultsDisplay'
import ResultHistory from '@/components/ResultHistory'
import { ResultHistoryItem } from '@/types'
import { ModelMetadata } from '@/types/models'
import { modelViewStore } from '@/stores/modelViewStore'
import { Github, ExternalLink, Sparkles, ArrowRight } from 'lucide-react'
import LidVizionIcon from '@/components/LidVizionIcon'

export default function Home() {
  const [selectedModel, setSelectedModel] = useState<ModelMetadata | null>(null)
  const { currentTask, switchTask, processImage, isProcessing, lastResponse } = useCVTask(selectedModel)
  
  const { history, addResult, clearHistory } = useResultHistory()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [viewingHistoryItem, setViewingHistoryItem] = useState<ResultHistoryItem | null>(null)

  const handleImageProcessed = (response: any) => {
    if (selectedImage) {
      addResult({
        image_url: selectedImage,
        task: currentTask,
        response
      })
    }
  }

  const handleViewHistoryItem = (item: ResultHistoryItem) => {
    setViewingHistoryItem(item)
    setSelectedImage(item.image_url)
  }

  const handleNewImage = () => {
    setViewingHistoryItem(null)
    setSelectedImage(null)
  }

  const handleModelSelect = (model: ModelMetadata) => {
    setSelectedModel(model)
  }

  return (
    <div className="min-h-screen bg-wells-beige">
      {/* Luxury Header with Glassmorphism */}
      <header className="sticky top-0 z-50 glass-strong border-b border-wells-warm-grey/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <LidVizionIcon className="w-15 h-15" />
              <div>
                {/* <h1 className="text-lg font-serif font-semibold text-wells-dark-grey">Lid Vizion</h1> */}
                <p className="text-xs text-wells-warm-grey">Computer Vision Platform</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <a href="https://github.com/lidvizion/mobile-vision-app-starter" target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm flex items-center justify-center">
                  <Github className="w-4 h-4" />
                </a>
                <a href="https://calendly.com/lidvizion-info/15" target="_blank" rel="noopener noreferrer" className="btn-primary btn-lg rounded-2xl flex items-center gap-2">
                  <span>Book a Call</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Luxury Hero Section with Gradient Background */}
      <section className="relative py-20 bg-luxury-gradient border-b border-wells-warm-grey/20 overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-32 h-32 bg-wells-dark-grey/5 rounded-full animate-float"></div>
          <div className="absolute bottom-20 right-10 w-24 h-24 bg-wells-dark-grey/5 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-wells-dark-grey/5 rounded-full animate-float" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm text-wells-dark-grey rounded-xl text-sm font-medium mb-8 shadow-sm border border-wells-warm-grey/20">
            <Sparkles className="w-4 h-4" />
            <span>Cross-platform Computer Vision</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-wells-dark-grey mb-6 leading-tight">
            Deploy CV Apps <span className="text-wells-warm-grey">Faster Than Ever</span>
          </h1>
          
          <p className="text-lg text-wells-warm-grey max-w-2xl mx-auto mb-10 leading-relaxed">
            Professional Starter kit for computer vision apps, overlays, and scalable cloud infra.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://calendly.com/lidvizion-info/15" target="_blank" rel="noopener noreferrer" className="btn-primary btn-lg rounded-2xl hover-lift flex items-center gap-2">
              <span>Book a Call</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Main Content with Layered Cards */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Interface */}
          <div className="lg:col-span-2 space-y-8">
            {/* Guided Model Discovery - Replaces Task Selector */}
            {!selectedModel ? (
              <div className="animate-fade-in">
                <GuidedModelFlow onModelSelect={handleModelSelect} />
              </div>
            ) : (
              <>
                {/* Selected Model Info */}
                <div className="card-floating p-4 animate-fade-in mb-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-wells-warm-grey mb-1">Selected Model</div>
                      <div className="font-semibold text-wells-dark-grey">{selectedModel.name}</div>
                      <div className="text-sm text-wells-warm-grey">{selectedModel.source} • {selectedModel.task}</div>
                    </div>
                    <button
                      onClick={() => setSelectedModel(null)}
                      className="px-4 py-2 text-sm border border-wells-warm-grey/30 rounded-lg hover:bg-wells-warm-grey/5"
                    >
                      Change Model
                    </button>
                  </div>
                </div>

                {/* Camera Preview - Visible After Model Selection */}
                <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                  <CameraPreview
                    currentTask={currentTask}
                    onImageProcessed={handleImageProcessed}
                    isProcessing={isProcessing}
                    processImage={processImage}
                    selectedImage={selectedImage}
                    setSelectedImage={setSelectedImage}
                    selectedModel={selectedModel}
                    onModelSelect={handleModelSelect}
                    availableModels={modelViewStore.modelList}
                  />
                </div>

                {/* Results Display - Visible After Model Selection */}
                <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                  <ResultsDisplay
                    response={viewingHistoryItem?.response || lastResponse}
                    selectedImage={selectedImage}
                  />
                </div>
              </>
            )}
          </div>

          {/* Right Column - History & Info */}
          <div className="space-y-8">
            <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <ResultHistory
                history={history}
                onClearHistory={clearHistory}
                onViewResult={handleViewHistoryItem}
              />
            </div>
            
            {/* SDK Info - Floating Card */}
            <div className="card-floating p-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="mb-6">
                <h3 className="text-lg font-serif font-semibold text-wells-dark-grey">SDK Integration</h3>
                <p className="text-sm text-wells-warm-grey">Cross-platform support</p>
              </div>
              
              <div className="space-y-3">
                <div className="p-4 bg-wells-light-beige rounded-xl border border-wells-warm-grey/20 hover:bg-wells-white transition-colors duration-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 bg-blue-500 rounded-lg text-white text-xs font-bold flex items-center justify-center">RN</div>
                    <span className="font-medium text-wells-dark-grey">React Native</span>
                  </div>
                  <p className="text-sm text-wells-warm-grey">Camera capture + on-device models</p>
                </div>
                
                <div className="p-4 bg-wells-light-beige rounded-xl border border-wells-warm-grey/20 hover:bg-wells-white transition-colors duration-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 bg-green-500 rounded-lg text-white text-xs font-bold flex items-center justify-center">FL</div>
                    <span className="font-medium text-wells-dark-grey">Flutter</span>
                  </div>
                  <p className="text-sm text-wells-warm-grey">Gallery upload + remote APIs</p>
                </div>
                
                <div className="p-4 bg-wells-light-beige rounded-xl border border-wells-warm-grey/20 hover:bg-wells-white transition-colors duration-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 bg-purple-500 rounded-lg text-white text-xs font-bold flex items-center justify-center">API</div>
                    <span className="font-medium text-wells-dark-grey">Backend SDK</span>
                  </div>
                  <p className="text-sm text-wells-warm-grey">Thin integration layer</p>
                </div>
              </div>
            </div>
            
            {/* Key Features - Elevated Card */}
            <div className="card-elevated p-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-wells-dark-grey rounded-xl flex items-center justify-center shadow-md">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-semibold text-wells-dark-grey">Key Features</h3>
                  <p className="text-sm text-wells-warm-grey">Everything you need</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-wells-warm-grey">
                  <div className="w-1.5 h-1.5 bg-wells-dark-grey rounded-full"></div>
                  <span>Camera capture + gallery upload</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-wells-warm-grey">
                  <div className="w-1.5 h-1.5 bg-wells-dark-grey rounded-full"></div>
                  <span>Real-time overlays (boxes, masks, labels)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-wells-warm-grey">
                  <div className="w-1.5 h-1.5 bg-wells-dark-grey rounded-full"></div>
                  <span>Task switching at runtime</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-wells-warm-grey">
                  <div className="w-1.5 h-1.5 bg-wells-dark-grey rounded-full"></div>
                  <span>Secure upload + result history</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-wells-warm-grey">
                  <div className="w-1.5 h-1.5 bg-wells-dark-grey rounded-full"></div>
                  <span>Auth & theming support</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-wells-warm-grey">
                  <div className="w-1.5 h-1.5 bg-wells-dark-grey rounded-full"></div>
                  <span>TFLite & PyTorch Mobile support</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Luxury Footer */}
      <footer className="border-t border-wells-warm-grey/20 bg-wells-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <LidVizionIcon className="w-30 h-30" />
              <span className="text-xl font-serif font-semibold text-wells-dark-grey">Lid Vizion</span>
            </div>
            <p className="text-wells-warm-grey text-sm mb-6 max-w-2xl mx-auto leading-relaxed">
              Cross-platform mobile starter kit for camera-based CV apps. Built with modern design principles and professional-grade components.
            </p>
            <div className="flex items-center justify-center gap-6 text-sm text-wells-warm-grey">
              <span>© 2024 Lid Vizion</span>
              <span>•</span>
              <span>MIT License</span>
              <span>•</span>
              <span>Made for developers</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
