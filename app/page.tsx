'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useCVTask } from '@/hooks/useCVTask'
import GuidedModelFlow from '@/components/GuidedModelFlow'
import CameraPreview from '@/components/CameraPreview'
import ResultsDisplay from '@/components/ResultsDisplay'
import { ModelMetadata } from '@/types/models'
import { modelViewStore } from '@/stores/modelViewStore'
import { Github, ExternalLink, Sparkles, ArrowRight, Info } from 'lucide-react'
import LidVizionIcon from '@/components/LidVizionIcon'

export default function Home() {
  const router = useRouter()
  const [selectedModel, setSelectedModel] = useState<ModelMetadata | null>(null)
  const [geminiModelVariant, setGeminiModelVariant] = useState<string>('gemini-2.5-flash-lite')
  const { currentTask, processImage, isProcessing, lastResponse, compressionInfo } = useCVTask(selectedModel, geminiModelVariant)
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Handle image processing completion
  const handleImageProcessed = useCallback((response: any) => {
    // Image processing completed
  }, [])


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
        <div className="max-w-4xl mx-auto">
          {/* Main Interface - Centered */}
          <div className="space-y-8 w-full">
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
                      <div className="flex items-center gap-2">
                        {selectedModel.id === 'gemini-3-pro-preview' && (
                          <Image 
                            src="/icons/gemini-icon.svg" 
                            alt="Gemini" 
                            width={32} 
                            height={32}
                            className="flex-shrink-0"
                          />
                        )}
                        <div className="font-semibold text-wells-dark-grey">{selectedModel.name}</div>
                      </div>
                      <div className="text-sm text-wells-warm-grey">
                        {selectedModel.id === 'gemini-3-pro-preview' ? 'Google' : selectedModel.source} • {selectedModel.task}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedModel(null)
                        router.push('/')
                      }}
                      className="px-4 py-2 text-sm border border-wells-warm-grey/30 rounded-lg hover:bg-wells-warm-grey/5"
                    >
                      Change Model
                    </button>
                  </div>
                </div>

                {/* Gemini Model Variant Selector - Only show for Gemini models */}
                {selectedModel && (selectedModel.id === 'gemini-3-pro-preview' || selectedModel.id?.toLowerCase().includes('gemini')) && (
                  <div className="card-floating p-4 animate-fade-in mb-8">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-wells-warm-grey mb-1">Model Variant</div>
                          <div className="text-sm font-semibold text-wells-dark-grey">Choose Gemini Model</div>
                        </div>
                      </div>
                      <div>
                        <select
                          value={geminiModelVariant}
                          onChange={(e) => setGeminiModelVariant(e.target.value)}
                          className="w-full px-4 py-2.5 border border-wells-warm-grey/30 rounded-lg bg-white text-wells-dark-grey focus:outline-none focus:ring-2 focus:ring-wells-dark-grey/20 focus:border-wells-dark-grey/50 transition-all"
                        >
                          <option value="gemini-2.5-flash-lite">⚡⚡ Gemini 2.5 Flash-Lite - Ultra Fast (1-3s)</option>
                          <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash - Balanced (2-5s)</option>
                          <option value="gemini-2.5-pro">🎯 Gemini 2.5 Pro - Most Accurate (5-10s)</option>
                        </select>
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-wells-light-beige/50 rounded-lg border border-wells-warm-grey/20">
                        <Info className="w-4 h-4 text-wells-warm-grey mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-wells-warm-grey">
                          💡 Tip: Using Flash-Lite for fastest results. Switch to Pro for maximum accuracy.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
                    compressionInfo={compressionInfo}
                  />
                </div>

                {/* Results Display - Visible After Model Selection */}
                <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                  <ResultsDisplay
                    response={lastResponse}
                    selectedImage={selectedImage}
                  />
                </div>
              </>
            )}
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
              <span>© 2025 Lid Vizion</span>
              {/* <span>•</span> */}
              {/* <span>MIT License</span>
              <span>•</span>
              <span>Made for developers</span> */}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
