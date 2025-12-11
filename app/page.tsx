'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useCVTask } from '@/hooks/useCVTask'
import GuidedModelFlow from '@/components/GuidedModelFlow'
import CameraPreview from '@/components/CameraPreview'
import ResultsDisplay from '@/components/ResultsDisplay'
import ParallelModelTester from '@/components/ParallelModelTester'
import { ModelMetadata } from '@/types/models'
import { modelViewStore } from '@/stores/modelViewStore'
import { Github, ExternalLink, Sparkles, ArrowRight, Info, ArrowLeft } from 'lucide-react'
import LidVizionIcon from '@/components/LidVizionIcon'
import TaskTypeSelectDropdown from '@/components/TaskTypeSelectDropdown'

export default function Home() {
  const router = useRouter()
  const [selectedModel, setSelectedModel] = useState<ModelMetadata | null>(null)
  const { currentTask, processImage, isProcessing, lastResponse, compressionInfo } = useCVTask(selectedModel)
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [showMoreModels, setShowMoreModels] = useState(false)
  const [selectedTaskType, setSelectedTaskType] = useState<'detection' | 'classification' | 'segmentation'>('detection')

  // Featured models for quick testing (all task types)
  const featuredModels: ModelMetadata[] = [
    {
      id: 'gemini-2.0-flash-exp',
      name: 'Gemini 2.0 Flash Exp',
      description: 'Google\'s experimental ultra-fast multimodal AI model',
      task: 'multimodal',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: [],
      frameworks: [],
      modelUrl: 'https://ai.google.dev/models/gemini',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: '/api/gemini-inference'
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: 'Google\'s fast multimodal AI model',
      task: 'multimodal',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: [],
      frameworks: [],
      modelUrl: 'https://ai.google.dev/models/gemini',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: '/api/gemini-inference'
    },
    {
      id: 'gemini-2.5-flash-lite',
      name: 'Gemini 2.5 Flash Lite',
      description: 'Google\'s ultra-fast lightweight multimodal AI model',
      task: 'multimodal',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: [],
      frameworks: [],
      modelUrl: 'https://ai.google.dev/models/gemini',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: '/api/gemini-inference'
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      description: 'Google\'s balanced multimodal AI model',
      task: 'multimodal',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: [],
      frameworks: [],
      modelUrl: 'https://ai.google.dev/models/gemini',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: '/api/gemini-inference'
    },
    {
      id: 'gemini-3-pro',
      name: 'Gemini 3 Pro',
      description: 'Google\'s most accurate multimodal AI model',
      task: 'multimodal',
      source: 'curated',
      author: 'Google',
      downloads: 0,
      tags: [],
      frameworks: [],
      modelUrl: 'https://ai.google.dev/models/gemini',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: '/api/gemini-inference'
    },
    {
      id: 'facebook/detr-resnet-101',
      name: 'DETR ResNet-101',
      description: 'Facebook\'s DETR object detection model with ResNet-101 backbone',
      task: 'object-detection',
      source: 'huggingface',
      author: 'Facebook',
      downloads: 1000000,
      tags: ['object-detection', 'detr'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/facebook/detr-resnet-101',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://api-inference.huggingface.co/models/facebook/detr-resnet-101'
    },
    {
      id: 'facebook/detr-resnet-50',
      name: 'DETR ResNet-50',
      description: 'Facebook\'s DETR object detection model with ResNet-50 backbone',
      task: 'object-detection',
      source: 'huggingface',
      author: 'Facebook',
      downloads: 2000000,
      tags: ['object-detection', 'detr'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/facebook/detr-resnet-50',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://api-inference.huggingface.co/models/facebook/detr-resnet-50'
    },
    {
      id: 'microsoft/resnet-50',
      name: 'ResNet-50',
      description: 'Microsoft\'s ResNet-50 image classification model',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Microsoft',
      downloads: 5000000,
      tags: ['image-classification', 'resnet'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/microsoft/resnet-50',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://api-inference.huggingface.co/models/microsoft/resnet-50'
    },
    {
      id: 'google/vit-base-patch16-224',
      name: 'Vision Transformer (ViT) Base',
      description: 'State-of-the-art Vision Transformer for image classification. Trained on ImageNet-21k, excellent accuracy.',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Google',
      downloads: 4050416,
      tags: ['vision', 'transformer', 'classification', 'imagenet', 'google', 'sota'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/google/vit-base-patch16-224',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224'
    },
    {
      id: 'google/efficientnet-b0',
      name: 'EfficientNet B0',
      description: 'Fast and efficient CNN for image classification. Excellent balance between speed and accuracy.',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Google',
      downloads: 863403,
      tags: ['efficientnet', 'classification', 'fast', 'efficient', 'google', 'mobile'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/google/efficientnet-b0',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/google/efficientnet-b0'
    },
    {
      id: 'facebook/convnext-tiny-224',
      name: 'ConvNeXt Tiny',
      description: 'Modern pure ConvNet. Lightweight and efficient with modern training techniques.',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Facebook',
      downloads: 1403276,
      tags: ['convnext', 'classification', 'modern-cnn', 'facebook', 'meta', 'fast'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/facebook/convnext-tiny-224',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/facebook/convnext-tiny-224'
    },
    {
      id: 'facebook/convnext-base-224',
      name: 'ConvNeXt Base',
      description: 'Larger ConvNeXt model for higher accuracy. Modern CNN with strong performance on ImageNet.',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Facebook',
      downloads: 0,
      tags: ['convnext', 'classification', 'modern-cnn', 'facebook', 'meta', 'accurate'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/facebook/convnext-base-224',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/facebook/convnext-base-224'
    },
    {
      id: 'microsoft/beit-base-patch16-224-pt22k-ft22k',
      name: 'BEiT Base',
      description: 'Microsoft Vision Transformer using masked image modeling. Pre-trained on ImageNet-22k.',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Microsoft',
      downloads: 982211,
      tags: ['beit', 'vision-transformer', 'classification', 'microsoft', 'imagenet'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/microsoft/beit-base-patch16-224-pt22k-ft22k',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/microsoft/beit-base-patch16-224-pt22k-ft22k'
    },
    {
      id: 'apple/mobilevit-small',
      name: 'MobileViT Small',
      description: 'Apple mobile-optimized vision transformer. Designed for on-device inference with low latency.',
      task: 'image-classification',
      source: 'huggingface',
      author: 'Apple',
      downloads: 1532816,
      tags: ['mobilevit', 'mobile', 'classification', 'apple', 'edge', 'fast'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/apple/mobilevit-small',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/apple/mobilevit-small'
    },
    {
      id: 'facebook/maskformer-swin-large-ade',
      name: 'MaskFormer Swin Large',
      description: 'Facebook MaskFormer with Swin Transformer backbone. State-of-the-art semantic segmentation on ADE20k dataset with 150 categories.',
      task: 'image-segmentation',
      source: 'huggingface',
      author: 'Facebook',
      downloads: 1766,
      tags: ['segmentation', 'maskformer', 'swin', 'facebook', 'meta', 'ade20k', 'semantic'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/facebook/maskformer-swin-large-ade',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/facebook/maskformer-swin-large-ade'
    },
    {
      id: 'nvidia/segformer-b0-finetuned-ade-512-512',
      name: 'SegFormer B0 - Scene Segmentation',
      description: 'NVIDIA SegFormer for scene segmentation. Segments images into 150 categories including sky, road, person, building, and more.',
      task: 'image-segmentation',
      source: 'huggingface',
      author: 'NVIDIA',
      downloads: 212434,
      tags: ['segmentation', 'scene-understanding', 'segformer', 'nvidia', 'ade20k'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/nvidia/segformer-b0-finetuned-ade-512-512',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/nvidia/segformer-b0-finetuned-ade-512-512'
    },
    {
      id: 'facebook/detr-resnet-50-panoptic',
      name: 'DETR Panoptic Segmentation',
      description: 'DETR model for panoptic segmentation. Combines instance and semantic segmentation for complete scene understanding.',
      task: 'image-segmentation',
      source: 'huggingface',
      author: 'Facebook',
      downloads: 54178,
      tags: ['segmentation', 'panoptic', 'detr', 'facebook', 'meta'],
      frameworks: ['transformers'],
      modelUrl: 'https://huggingface.co/facebook/detr-resnet-50-panoptic',
      platforms: [],
      supportsInference: true,
      inferenceEndpoint: 'https://router.huggingface.co/hf-inference/models/facebook/detr-resnet-50-panoptic'
    }
  ]

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
        <div className="max-w-6xl mx-auto">
          {/* Quick Test Section - Always visible */}
          {!showMoreModels && (
            <div className="space-y-8 animate-fade-in">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-wells-dark-grey mb-4">
                  Quick Model Comparison
                </h2>
                <p className="text-wells-warm-grey mb-6">
                  Test 3 models simultaneously on the same image
                </p>
              </div>

              {/* Task Type Selector */}
              <div className="flex items-center justify-center mb-6">
                <label className="text-sm font-medium text-wells-dark-grey mr-3">
                  Task Type:
                </label>
                <TaskTypeSelectDropdown
                  selectedTaskType={selectedTaskType}
                  onTaskTypeChange={setSelectedTaskType}
                />
              </div>

              <ParallelModelTester
                featuredModels={featuredModels}
                sharedImage={selectedImage}
                onImageChange={setSelectedImage}
                selectedTaskType={selectedTaskType}
              />

              {/* More Models Button */}
              <div className="text-center pt-8">
                <button
                  onClick={() => setShowMoreModels(true)}
                  className="btn-secondary btn-lg flex items-center gap-2 mx-auto"
                >
                  <span>Browse All Models</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Existing Model Discovery Flow */}
          {showMoreModels && (
            <div className="space-y-8 animate-fade-in">
              <button
                onClick={() => setShowMoreModels(false)}
                className="btn-ghost mb-6 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Quick Test</span>
              </button>
              
              {/* Existing GuidedModelFlow component */}
              {!selectedModel ? (
                <GuidedModelFlow onModelSelect={handleModelSelect} />
              ) : (
                <>
                  {/* Selected Model Info */}
                  <div className="card-floating p-4 animate-fade-in mb-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-wells-warm-grey mb-1">Selected Model</div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const modelIdLower = selectedModel.id?.toLowerCase() || ''
                            let logoPath: string | null = null
                            
                            if (modelIdLower.includes('gemini')) {
                              logoPath = '/logos/google-gemini.png'
                            } else if (modelIdLower.startsWith('google/')) {
                              logoPath = '/logos/google-gemini.png'
                            } else if (modelIdLower.startsWith('facebook/') || modelIdLower.startsWith('meta/')) {
                              logoPath = '/logos/meta-logo.png'
                            } else if (modelIdLower.startsWith('microsoft/')) {
                              logoPath = '/logos/microsoft.svg'
                            } else if (modelIdLower.startsWith('apple/')) {
                              logoPath = '/logos/meta-logo.png' // Fallback until Apple logo is added
                            }
                            // Note: NVIDIA and BRIA AI models don't have logos available, so logoPath remains null
                            
                            return logoPath ? (
                              <Image 
                                src={logoPath} 
                                alt={selectedModel.author} 
                                width={32} 
                                height={32}
                                className="flex-shrink-0 object-contain"
                              />
                            ) : null
                          })()}
                          <div className="font-semibold text-wells-dark-grey">{selectedModel.name}</div>
                        </div>
                        <div className="text-sm text-wells-warm-grey">
                          {selectedModel.author || (selectedModel.id?.toLowerCase().includes('gemini') ? 'Google' : selectedModel.source)} • {selectedModel.task}
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
          )}
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
