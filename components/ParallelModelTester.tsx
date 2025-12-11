'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ModelMetadata } from '@/types/models'
import ResultsDisplay from './ResultsDisplay'
import { useCVTask } from '@/hooks/useCVTask'
import { Loader2, Upload, Image as ImageIcon, Lightbulb, AlertCircle, Bell, X } from 'lucide-react'
import Image from 'next/image'
import { validateMediaFile } from '@/lib/validation'
import ModelSelectDropdown from './ModelSelectDropdown'

interface ParallelModelTesterProps {
  featuredModels: ModelMetadata[]
  sharedImage: string | null
  onImageChange: (image: string) => void
  selectedTaskType?: 'detection' | 'classification' | 'segmentation' | 'keypoint-detection'
}

// Model categorization by task type
const modelsByTaskType: Record<string, string[]> = {
  detection: [
    'gemini-2.0-flash-exp',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-3-pro',
    'facebook/detr-resnet-101',
    'facebook/detr-resnet-50',
  ],
  classification: [
    // Most capable models first (ordered by capability: speed + accuracy)
    // Tier 1: Gemini models (fastest, most capable, multimodal)
    'gemini-2.0-flash-exp',      // Ultra-fast, experimental, best speed
    'gemini-2.5-flash-lite',     // Ultra-fast, lightweight
    'gemini-2.5-flash',          // Fast, balanced
    'gemini-2.5-pro',            // Balanced speed/accuracy
    'gemini-3-pro',              // Most accurate, slightly slower
    // Tier 2: State-of-the-art Vision Transformers (high accuracy)
    'google/vit-base-patch16-224', // SOTA ViT, excellent accuracy
    'microsoft/beit-base-patch16-224-pt22k-ft22k', // BEiT, strong performance
    // Tier 3: Modern CNNs (efficient, fast)
    'facebook/convnext-base-224',  // Larger ConvNeXt, higher accuracy
    'facebook/convnext-tiny-224',  // Efficient ConvNeXt, fast
    // Tier 4: Efficient models (good balance)
    'google/efficientnet-b0',      // EfficientNet, good speed/accuracy
    'apple/mobilevit-small',      // Mobile-optimized, fast
    // Tier 5: Classic models (reliable baseline)
    'microsoft/resnet-50',        // Classic ResNet, reliable
  ],
  segmentation: [
    'facebook/maskformer-swin-large-ade',  // Semantic segmentation
    'nvidia/segformer-b0-finetuned-ade-512-512', // Scene segmentation
    'facebook/detr-resnet-50-panoptic' // Panoptic segmentation
  ],
  'keypoint-detection': [] // Coming soon - will be populated when MediaPipe Pose is added
}


export default function ParallelModelTester({ 
  featuredModels, 
  sharedImage,
  onImageChange,
  selectedTaskType = 'detection'
}: ParallelModelTesterProps) {
  const [prompt, setPrompt] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Filter models based on task type using proper categorization
  // Maintain order by capability (most capable first)
  const filteredModels = useMemo(() => {
    const taskTypeKey = selectedTaskType.toLowerCase()
    const allowedModelIds = modelsByTaskType[taskTypeKey] || []
    
    if (allowedModelIds.length === 0) {
      // No models available for this task type (e.g., segmentation)
      return []
    }
    
    // Filter and sort models to maintain capability order
    // Create a map for quick lookup
    const modelMap = new Map(featuredModels.map(model => [model.id, model]))
    
    // Return models in the order specified in modelsByTaskType (capability order)
    return allowedModelIds
      .map(id => modelMap.get(id))
      .filter((model): model is ModelMetadata => model !== undefined)
  }, [selectedTaskType, featuredModels])
  
  // Initialize models based on task type - auto-select first 3 available models
  // For detection, prioritize gemini-2.5-flash-lite (fastest) as Model 1
  const getInitialModels = useCallback((filtered: ModelMetadata[], taskType: string): (ModelMetadata | null)[] => {
    if (filtered.length === 0) {
      return [null, null, null]
    }
    
    // For detection task, set specific default models:
    // Model 1: gemini-2.0-flash-exp (fastest: 1-2s)
    // Model 2: facebook/detr-resnet-101
    // Model 3: facebook/detr-resnet-50
    let sortedModels = [...filtered]
    if (taskType.toLowerCase() === 'detection') {
      sortedModels = [...filtered].sort((a, b) => {
        // Model 1: gemini-2.0-flash-exp (fastest: 1-2s)
        if (a.id === 'gemini-2.0-flash-exp') return -1
        if (b.id === 'gemini-2.0-flash-exp') return 1
        // Model 2: facebook/detr-resnet-101
        if (a.id === 'facebook/detr-resnet-101') return -1
        if (b.id === 'facebook/detr-resnet-101') return 1
        // Model 3: facebook/detr-resnet-50
        if (a.id === 'facebook/detr-resnet-50') return -1
        if (b.id === 'facebook/detr-resnet-50') return 1
        // Keep original order for others
        return 0
      })
    } else if (taskType.toLowerCase() === 'classification') {
      // For classification task, select top 3 models (fast path):
      // Model 1: facebook/convnext-tiny-224
      // Model 2: google/efficientnet-b0
      // Model 3: apple/mobilevit-small
      sortedModels = [...filtered].sort((a, b) => {
        // Priority order for default selection
        // Top 3 for default: ConvNeXt Tiny + EfficientNet B0 + MobileViT Small
        if (a.id === 'facebook/convnext-tiny-224') return -1
        if (b.id === 'facebook/convnext-tiny-224') return 1
        if (a.id === 'google/efficientnet-b0') return -1
        if (b.id === 'google/efficientnet-b0') return 1
        if (a.id === 'apple/mobilevit-small') return -1
        if (b.id === 'apple/mobilevit-small') return 1
        
        // Rest maintain the order from modelsByTaskType (already sorted by capability)
        // This ensures dropdown shows models in capability order
        const capabilityOrder: Record<string, number> = {
          // Classification fast-path capability ordering (lower is higher priority)
          'facebook/convnext-tiny-224': 1,
          'google/efficientnet-b0': 2,
          'apple/mobilevit-small': 3,
          'gemini-2.0-flash-exp': 4,
          'gemini-2.5-flash-lite': 5,
          'gemini-2.5-flash': 6,
          'gemini-2.5-pro': 7,
          'gemini-3-pro': 8,
          'google/vit-base-patch16-224': 9,
          'microsoft/beit-base-patch16-224-pt22k-ft22k': 10,
          'facebook/convnext-base-224': 11,
          'microsoft/resnet-50': 12,
        }
        
        const aOrder = capabilityOrder[a.id] || 999
        const bOrder = capabilityOrder[b.id] || 999
        
        return aOrder - bOrder
      })
    }
    
    // Auto-select first 3 models, or all available if less than 3
    const initialModels: (ModelMetadata | null)[] = [...sortedModels.slice(0, 3)]
    
    // Pad with nulls if we have less than 3 models
    while (initialModels.length < 3) {
      initialModels.push(null)
    }
    
    return initialModels.slice(0, 3)
  }, [])
  
  const [selectedModels, setSelectedModels] = useState<(ModelMetadata | null)[]>(() => getInitialModels(filteredModels, selectedTaskType))

  // Update models when task type or filtered models change
  useEffect(() => {
    const newModels = getInitialModels(filteredModels, selectedTaskType)
    setSelectedModels(newModels)
  }, [selectedTaskType, filteredModels, getInitialModels])
  
  // Check if we have models available for the selected task type
  const hasAvailableModels = filteredModels.length > 0
  const isSegmentationComingSoon = selectedTaskType === 'segmentation' && filteredModels.length === 0
  const isKeypointDetectionComingSoon = selectedTaskType === 'keypoint-detection' && filteredModels.length === 0

  // Get dynamic heading based on task type
  const getHeading = () => {
    switch (selectedTaskType) {
      case 'detection':
        return 'What would you like to analyze?'
      case 'classification':
        return 'What would you like to classify?'
      case 'segmentation':
        return 'What would you like to segment?'
      case 'keypoint-detection':
        return 'What would you like to detect keypoints on?'
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
      case 'keypoint-detection':
        return [
          'Detect human pose keypoints in fitness videos',
          'Track athlete movements and form analysis',
          'Detect hand gestures and sign language',
          'Analyze dance movements and choreography',
          'Detect facial keypoints for emotion recognition'
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

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  return (
    <div className="space-y-6">
      {/* Upload and Prompt Section */}
      <div className="bg-white rounded-xl shadow-sm border border-wells-warm-grey/10 p-6">
        <div className="space-y-4">
          {/* Drop Zone - Primary Action First */}
          <div
            className={`relative border-2 border-dashed rounded-lg transition-all duration-300 overflow-hidden ${
              dragActive 
                ? 'border-wells-dark-grey bg-wells-light-beige scale-[1.01] shadow-lg' 
                : sharedImage
                ? 'border-wells-warm-grey/20'
                : 'border-wells-warm-grey/30 hover:border-wells-warm-grey/50 hover:bg-wells-light-beige/50'
            } ${
              !hasAvailableModels ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={(e) => {
              if (!hasAvailableModels) return
              // Don't trigger file input if clicking on the image or remove button
              if ((e.target as HTMLElement).closest('.image-preview') || (e.target as HTMLElement).closest('.remove-button')) {
                return
              }
              // Only trigger file input if clicking on the drop zone itself (not on nested elements)
              if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.drop-zone-content')) {
                fileInputRef.current?.click()
              }
            }}
          >
            {sharedImage ? (
              // Image Preview Mode
              <div className="relative group">
                <div className="relative w-full h-64 image-preview">
                  <Image
                    src={sharedImage}
                    alt="Uploaded image"
                    fill
                    className="object-contain"
                  />
                </div>
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      className="px-4 py-2 bg-white/90 hover:bg-white text-wells-dark-grey rounded-lg font-medium text-sm transition-all flex items-center gap-2 shadow-lg"
                    >
                      <Upload className="w-4 h-4" />
                      Change Image
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onImageChange('')
                      }}
                      className="p-2 bg-red-500/90 hover:bg-red-600 text-white rounded-lg transition-all remove-button shadow-lg"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // Upload Mode
              <div className="p-8 flex flex-col items-center justify-center gap-3 drop-zone-content min-h-[200px]">
                <div className={`w-14 h-14 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  dragActive 
                    ? 'bg-wells-dark-grey scale-110 shadow-lg' 
                    : 'bg-wells-light-beige shadow-sm'
                }`}>
                  <Upload className={`w-7 h-7 transition-colors duration-300 ${
                    dragActive ? 'text-white' : 'text-wells-warm-grey'
                  }`} />
                </div>
                <div className="text-center">
                  <p className={`text-base font-medium ${
                    dragActive ? 'text-wells-dark-grey' : 'text-wells-dark-grey'
                  }`}>
                    {dragActive ? 'Drop your image here' : 'Drop image or click to upload'}
                  </p>
                  <p className="text-xs text-wells-warm-grey mt-1.5">
                    {dragActive ? 'Release to upload' : 'Supports images and videos'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Prompt Input - Secondary Action */}
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
          
          {/* Status Messages */}
          {isSegmentationComingSoon && (
            <div className="flex items-center gap-2 text-sm text-wells-warm-grey">
              <Bell className="w-4 h-4" />
              <span>Segmentation models coming soon!</span>
            </div>
          )}
          
          {isKeypointDetectionComingSoon && (
            <div className="flex items-center gap-2 text-sm text-wells-warm-grey">
              <Bell className="w-4 h-4" />
              <span>Keypoint Detection models coming soon!</span>
            </div>
          )}
          
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
          
          {/* Coming Soon Message for Keypoint Detection */}
          {isKeypointDetectionComingSoon && (
            <div className="mt-4 p-4 bg-wells-light-beige/50 border border-wells-warm-grey/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-wells-warm-grey flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-wells-dark-grey mb-1">
                    Keypoint Detection models coming soon!
                  </p>
                  <p className="text-xs text-wells-warm-grey">
                    We're working on adding MediaPipe Pose and other keypoint detection models. Try Detection, Classification, or Segmentation in the meantime.
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
      {(isSegmentationComingSoon || isKeypointDetectionComingSoon) ? (
        <div className="bg-white rounded-xl shadow-sm border border-wells-warm-grey/10 p-12">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-wells-light-beige/50 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-wells-warm-grey" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-wells-dark-grey mb-2">
                {isKeypointDetectionComingSoon ? 'Keypoint Detection Models Coming Soon' : 'Segmentation Models Coming Soon'}
              </h3>
              <p className="text-sm text-wells-warm-grey max-w-md mx-auto">
                {isKeypointDetectionComingSoon 
                  ? "We're working on adding MediaPipe Pose and other keypoint detection models. Please try Detection, Classification, or Segmentation tasks in the meantime."
                  : "We're working on adding segmentation models like SAM, Mask R-CNN, and DeepLab. Please try Detection or Classification tasks in the meantime."}
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
                {isKeypointDetectionComingSoon ? 'Try Other Tasks' : 'Try Detection or Classification'}
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
  const { processImage, isProcessing, lastResponse } = useCVTask(
    model || undefined
  )
  const [currentImageFile, setCurrentImageFile] = useState<File | null>(null)
  const [hasProcessedCurrentImage, setHasProcessedCurrentImage] = useState(false)
  const [lastProcessedImageUrl, setLastProcessedImageUrl] = useState<string | null>(null)
  const [isLocalProcessing, setIsLocalProcessing] = useState(false)

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
          setIsLocalProcessing(true)
          console.log(`[Model ${windowNumber}] Processing with model:`, {
            id: model.id,
            name: model.name,
            source: model.source,
            isGemini: model.id?.toLowerCase().includes('gemini')
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
          setIsLocalProcessing(false)
        } catch (error) {
          console.error(`[Model ${windowNumber}] Error processing image:`, error)
          setIsLocalProcessing(false)
        }
      }
      
      // Process if we haven't processed this image with this model yet
      if (!hasProcessedCurrentImage) {
        processWithModel()
      }
    }
  }, [sharedImage, model, isProcessing, processImage, hasProcessedCurrentImage, currentImageFile, windowNumber])

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
          <ModelSelectDropdown
            selectedModel={model}
            availableModels={availableModels}
            onModelChange={onModelChange}
          />
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
            isProcessing={isProcessing || isLocalProcessing || (!hasProcessedCurrentImage && currentImageFile !== null && model !== null)}
          />
        )}
      </div>
    </div>
  )
}

