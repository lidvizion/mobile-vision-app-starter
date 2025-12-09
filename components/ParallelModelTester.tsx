'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ModelMetadata } from '@/types/models'
import ResultsDisplay from './ResultsDisplay'
import { useCVTask } from '@/hooks/useCVTask'
import { Loader2, Upload, Image as ImageIcon, Lightbulb, AlertCircle, Bell } from 'lucide-react'
import { validateMediaFile } from '@/lib/validation'
import Image from 'next/image'

// Model logos mapping
const modelLogos: Record<string, string> = {
  'gemini-3-pro-preview': '/logos/google-gemini.png',
  'facebook/detr-resnet-101': '/logos/meta.png',
  'facebook/detr-resnet-50': '/logos/meta.png',
  'microsoft/resnet-50': '/logos/microsoft.svg',
}

interface ParallelModelTesterProps {
  featuredModels: ModelMetadata[]
  sharedImage: string | null
  onImageChange: (image: string) => void
  selectedTaskType?: 'detection' | 'classification' | 'segmentation'
}

// Model categorization by task type
const modelsByTaskType: Record<string, string[]> = {
  detection: [
    'gemini-3-pro-preview',
    'facebook/detr-resnet-101',
    'facebook/detr-resnet-50',
  ],
  classification: [
    'microsoft/resnet-50',
  ],
  segmentation: [] // Coming soon
}


export default function ParallelModelTester({ 
  featuredModels, 
  sharedImage,
  onImageChange,
  selectedTaskType = 'detection'
}: ParallelModelTesterProps) {
  const [prompt, setPrompt] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Filter models based on task type using proper categorization
  const filteredModels = useMemo(() => {
    const taskTypeKey = selectedTaskType.toLowerCase()
    const allowedModelIds = modelsByTaskType[taskTypeKey] || []
    
    if (allowedModelIds.length === 0) {
      // No models available for this task type (e.g., segmentation)
      return []
    }
    
    // Filter featuredModels to only include models that match the task type
    return featuredModels.filter(model => 
      allowedModelIds.includes(model.id)
    )
  }, [selectedTaskType, featuredModels])
  
  // Initialize models based on task type - auto-select first 3 available models
  const getInitialModels = useCallback((filtered: ModelMetadata[]): (ModelMetadata | null)[] => {
    if (filtered.length === 0) {
      return [null, null, null]
    }
    
    // Auto-select first 3 models, or all available if less than 3
    const initialModels: (ModelMetadata | null)[] = [...filtered.slice(0, 3)]
    
    // Pad with nulls if we have less than 3 models
    while (initialModels.length < 3) {
      initialModels.push(null)
    }
    
    return initialModels.slice(0, 3)
  }, [])
  
  const [selectedModels, setSelectedModels] = useState<(ModelMetadata | null)[]>(() => getInitialModels(filteredModels))

  // Update models when task type or filtered models change
  useEffect(() => {
    const newModels = getInitialModels(filteredModels)
    setSelectedModels(newModels)
  }, [selectedTaskType, filteredModels, getInitialModels])
  
  // Check if we have models available for the selected task type
  const hasAvailableModels = filteredModels.length > 0
  const isSegmentationComingSoon = selectedTaskType === 'segmentation' && filteredModels.length === 0

  // Get dynamic heading based on task type
  const getHeading = () => {
    switch (selectedTaskType) {
      case 'detection':
        return 'What would you like to analyze?'
      case 'classification':
        return 'What would you like to classify?'
      case 'segmentation':
        return 'What would you like to segment?'
      default:
        return 'What would you like to analyze?'
    }
  }

  // Get example prompts based on task type (memoized to update when task type changes)
  const examplePrompts = useMemo(() => {
    switch (selectedTaskType) {
      case 'detection':
        return [
          'Detect PPE and safety equipment on construction sites',
          'Detect defects on circuit boards in manufacturing',
          'Count people entering and leaving my store',
          'Detect vehicles in traffic footage',
          'Detect trash in images from beach cleanups'
        ]
      case 'classification':
        return [
          'Classify product quality as pass or fail',
          'Classify different types of plants and diseases',
          'Classify damage severity in insurance photos',
          'Classify inventory items by category',
          'Classify basketball shots and player positions'
        ]
      case 'segmentation':
        return [
          'Segment building components in architectural images',
          'Segment road lanes and markings in traffic footage',
          'Segment people from background in photos',
          'Segment different materials in recycling images',
          'Segment damaged areas in insurance claims'
        ]
      default:
        return []
    }
  }, [selectedTaskType])

  // Handle example bubble click
  const handleExampleClick = useCallback((example: string) => {
    setPrompt(example)
    // Focus the textarea so user can edit if needed
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }, [])

  // Handle file upload
  const handleFileSelect = useCallback(async (file: File) => {
    // Validate file
    const validation = validateMediaFile(file)
    if (!validation.isValid) {
      alert(validation.error || 'Invalid file format')
      return
    }

    // Convert to base64 and trigger upload
    const reader = new FileReader()
    reader.onload = (e) => {
      const imageDataUrl = e.target?.result as string
      onImageChange(imageDataUrl)
    }
    reader.readAsDataURL(file)
  }, [onImageChange])

  return (
    <div className="space-y-6">
      {/* Prompt and Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border border-wells-warm-grey/10 p-6">
        <div className="space-y-4">
          {/* Prompt Input */}
          <div>
            <label className="block text-sm font-semibold text-wells-dark-grey mb-2">
              {getHeading()}
            </label>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                selectedTaskType === 'detection'
                  ? "E.g., 'Detect objects in construction site' or 'Identify safety equipment'"
                  : selectedTaskType === 'classification'
                  ? "E.g., 'Classify product quality' or 'Identify plant diseases'"
                  : "E.g., 'Segment building components' or 'Separate objects from background'"
              }
              className="w-full px-4 py-3 rounded-lg border border-wells-warm-grey/20 text-sm text-wells-dark-grey placeholder:text-wells-warm-grey/50 focus:border-wells-dark-grey focus:ring-2 focus:ring-wells-dark-grey/10 focus:outline-none resize-none transition-all"
              rows={2}
            />
          </div>

          {/* Upload Button and Status */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!hasAvailableModels}
              className={`px-6 py-3 rounded-lg font-medium text-sm transition-all flex items-center gap-2 shadow-sm ${
                hasAvailableModels
                  ? 'bg-wells-dark-grey text-white hover:bg-wells-dark-grey/90 cursor-pointer'
                  : 'bg-wells-warm-grey/30 text-wells-warm-grey cursor-not-allowed'
              }`}
            >
              <Upload className="w-5 h-5" />
              Upload Image
            </button>
            {isSegmentationComingSoon && (
              <div className="flex items-center gap-2 text-sm text-wells-warm-grey">
                <Bell className="w-4 h-4" />
                <span>Segmentation models coming soon!</span>
              </div>
            )}
          </div>
          
          {/* Coming Soon Message for Segmentation */}
          {isSegmentationComingSoon && (
            <div className="mt-4 p-4 bg-wells-light-beige/50 border border-wells-warm-grey/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-wells-warm-grey flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-wells-dark-grey mb-1">
                    Segmentation models coming soon!
                  </p>
                  <p className="text-xs text-wells-warm-grey">
                    We're working on adding SAM, Mask R-CNN, and DeepLab models. Try Detection or Classification in the meantime.
                  </p>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                handleFileSelect(file)
              }
            }}
            className="hidden"
          />

          {/* Example Prompts Section */}
          {examplePrompts.length > 0 && (
            <div className="pt-4 border-t border-wells-warm-grey/10">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-wells-warm-grey" />
                <span className="text-xs font-medium text-wells-warm-grey uppercase tracking-wide">
                  Try these examples:
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {examplePrompts.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(example)}
                    className="px-4 py-2.5 text-left text-sm text-wells-dark-grey bg-white border border-wells-warm-grey/20 rounded-lg hover:bg-gray-50 hover:border-wells-dark-grey/30 transition-all cursor-pointer"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Model Windows - Show only available models or placeholder for coming soon */}
      {isSegmentationComingSoon ? (
        <div className="bg-white rounded-xl shadow-sm border border-wells-warm-grey/10 p-12">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-wells-light-beige/50 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-wells-warm-grey" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-wells-dark-grey mb-2">
                Segmentation Models Coming Soon
              </h3>
              <p className="text-sm text-wells-warm-grey max-w-md mx-auto">
                We're working on adding segmentation models like SAM, Mask R-CNN, and DeepLab. 
                Please try Detection or Classification tasks in the meantime.
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={() => {
                  // This would need to be handled by parent component
                  // For now, just show a message
                  alert('Please select Detection or Classification from the task type dropdown above.')
                }}
                className="px-6 py-2.5 bg-wells-dark-grey text-white rounded-lg font-medium text-sm hover:bg-wells-dark-grey/90 transition-all"
              >
                Try Detection or Classification
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-6 ${
          filteredModels.length === 1 
            ? 'lg:grid-cols-1 max-w-md mx-auto' 
            : filteredModels.length === 2 
            ? 'lg:grid-cols-2 max-w-4xl mx-auto'
            : 'lg:grid-cols-3'
        }`}>
          {[0, 1, 2].map((index) => {
            // Only render ModelWindow if we have a model for this slot or if there are more models available
            if (!selectedModels[index] && index >= filteredModels.length) {
              return null
            }
            
            return (
              <ModelWindow
                key={index}
                model={selectedModels[index]}
                availableModels={filteredModels}
                onModelChange={(model) => {
                  const newModels = [...selectedModels]
                  newModels[index] = model
                  setSelectedModels(newModels)
                }}
                sharedImage={sharedImage}
                windowNumber={index + 1}
                prompt={prompt}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function ModelWindow({ 
  model, 
  availableModels, 
  onModelChange,
  sharedImage,
  windowNumber,
  prompt
}: {
  model: ModelMetadata | null
  availableModels: ModelMetadata[]
  onModelChange: (model: ModelMetadata) => void
  sharedImage: string | null
  windowNumber: number
  prompt: string
}) {
  const [geminiVariant, setGeminiVariant] = useState('gemini-2.5-flash-lite')
  const { processImage, isProcessing, lastResponse } = useCVTask(
    model || undefined, 
    geminiVariant
  )
  const [currentImageFile, setCurrentImageFile] = useState<File | null>(null)
  const [hasProcessedCurrentImage, setHasProcessedCurrentImage] = useState(false)
  const [lastProcessedImageUrl, setLastProcessedImageUrl] = useState<string | null>(null)

  // Load image file when shared image changes
  useEffect(() => {
    if (sharedImage && sharedImage !== lastProcessedImageUrl) {
      const loadImageFile = async () => {
        try {
          const response = await fetch(sharedImage)
          const blob = await response.blob()
          const file = new File([blob], 'image.jpg', { type: 'image/jpeg' })
          setCurrentImageFile(file)
          setHasProcessedCurrentImage(false) // Reset to trigger reprocessing
          setLastProcessedImageUrl(sharedImage)
        } catch (error) {
          console.error(`Error loading image file in Model ${windowNumber}:`, error)
        }
      }
      loadImageFile()
    }
  }, [sharedImage, windowNumber, lastProcessedImageUrl])

  // Auto-process when image file or model changes
  useEffect(() => {
    if (sharedImage && model && !isProcessing && currentImageFile) {
      // Process the image with current model
      const processWithModel = async () => {
        try {
          console.log(`[Model ${windowNumber}] Processing with model:`, {
            id: model.id,
            name: model.name,
            source: model.source,
            isGemini: model.id === 'gemini-3-pro-preview' || model.id?.toLowerCase().includes('gemini'),
            geminiVariant
          })
          const result = await processImage(currentImageFile)
          console.log(`[Model ${windowNumber}] Processing result:`, {
            task: result.task,
            hasDetections: !!result.results?.detections?.length,
            hasLabels: !!result.results?.labels?.length,
            detectionsCount: result.results?.detections?.length || 0,
            labelsCount: result.results?.labels?.length || 0,
            fullResponse: result
          })
          setHasProcessedCurrentImage(true)
        } catch (error) {
          console.error(`[Model ${windowNumber}] Error processing image:`, error)
        }
      }
      
      // Process if we haven't processed this image with this model yet
      if (!hasProcessedCurrentImage) {
        processWithModel()
      }
    }
  }, [sharedImage, model, isProcessing, processImage, hasProcessedCurrentImage, currentImageFile, windowNumber, geminiVariant])

  // Reset processed flag when model changes (to trigger reprocessing)
  useEffect(() => {
    if (model && currentImageFile) {
      setHasProcessedCurrentImage(false)
    }
  }, [model?.id, currentImageFile])

  if (!model) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-wells-warm-grey/10 overflow-hidden">
        <div className="p-5">
          <div className="text-center py-8 text-wells-warm-grey">
            <p className="text-sm">Loading model...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-wells-warm-grey/10 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-wells-warm-grey/10 bg-gray-50/50">
        <div className="space-y-3">
          {/* Model Label */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-wells-warm-grey uppercase tracking-wide">
              Model {windowNumber}
            </span>
          </div>
          
          {/* Model Selector with Logo */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-wells-warm-grey/20 bg-white focus-within:border-wells-dark-grey focus-within:ring-2 focus-within:ring-wells-dark-grey/10 transition-all">
            {modelLogos[model.id] && (
              <div className="flex-shrink-0 w-6 h-6 relative">
                <Image
                  src={modelLogos[model.id]}
                  alt={model.author}
                  fill
                  className="object-contain"
                  sizes="24px"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                  }}
                />
              </div>
            )}
            <select
              value={model.id}
              onChange={(e) => {
                const selected = availableModels.find(m => m.id === e.target.value)
                if (selected) onModelChange(selected)
              }}
              className="flex-1 text-sm font-medium text-wells-dark-grey bg-transparent border-none focus:outline-none cursor-pointer"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} - {m.author}
                </option>
              ))}
            </select>
          </div>

          {/* Gemini Variant Selector */}
          {(model.id === 'gemini-3-pro-preview' || model.id?.toLowerCase().includes('gemini')) && (
            <select
              value={geminiVariant}
              onChange={(e) => setGeminiVariant(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-wells-warm-grey/20 text-xs text-wells-warm-grey bg-white focus:border-wells-dark-grey focus:outline-none"
            >
              <option value="gemini-2.5-flash-lite">⚡⚡ Ultra Fast (1-3s)</option>
              <option value="gemini-2.5-flash">⚡ Balanced (2-5s)</option>
              <option value="gemini-2.5-pro">🎯 Most Accurate (5-10s)</option>
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {!sharedImage ? (
          <div className="flex items-center justify-center py-20 text-center">
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-wells-warm-grey">Awaiting image upload</p>
            </div>
          </div>
        ) : (
          <ResultsDisplay
            response={lastResponse}
            selectedImage={sharedImage}
          />
        )}
      </div>
    </div>
  )
}

