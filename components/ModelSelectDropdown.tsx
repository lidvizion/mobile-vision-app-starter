'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { ChevronDown, Check } from 'lucide-react'
import { ModelMetadata } from '@/types/models'
import { cn } from '@/lib/utils'

// Model logos mapping - dynamically determine logo based on model ID prefix and provider
const getModelLogo = (modelId: string, provider?: string): string | null => {
  const idLower = modelId.toLowerCase()
  const providerLower = provider?.toLowerCase() || ''
  
  // Use provider field if available
  if (providerLower === 'google' || idLower.includes('gemini') || idLower.startsWith('google/')) {
    return '/logos/google-gemini.png'
  }
  
  if (providerLower === 'meta' || idLower.startsWith('facebook/') || idLower.startsWith('meta/')) {
    return '/logos/meta-logo.png'
  }
  
  if (providerLower === 'microsoft' || idLower.startsWith('microsoft/')) {
    return '/logos/microsoft.svg'
  }
  
  if (providerLower === 'nvidia' || idLower.startsWith('nvidia/')) {
    return '/logos/nvidia-logo.png'
  }
  
  // Anthropic, OpenAI, Mistral, xAI, Qwen - use logos from desktop
  if (providerLower === 'anthropic' || idLower.includes('claude')) {
    return '/logos/anthropic-claude.png'
  }
  if (providerLower === 'openai' || idLower.includes('gpt')) {
    return '/logos/openai-logo.webp'
  }
  if (providerLower === 'mistral' || idLower.includes('mistral') || idLower.includes('pixtral')) {
    return '/logos/mistral-logo.png'
  }
  if (providerLower === 'xai' || idLower.includes('grok')) {
    return '/logos/xai-grok.webp'
  }
  if (providerLower === 'qwen' || idLower.includes('qwen')) {
    return '/logos/qwen-logo.jpeg'
  }
  
  if (providerLower === 'ultralytics' || idLower.includes('yolo')) {
    return '/logos/yolo-logo.png'
  }
  
  // Apple models
  if (idLower.startsWith('apple/')) {
    return '/logos/apple-logo.png'
  }
  
  return null
}

// Legacy static mapping for backward compatibility
const modelLogos: Record<string, string> = {
  'gemini-2.0-flash-exp': '/logos/google-gemini.png',
  'gemini-2.5-flash': '/logos/google-gemini.png',
  'gemini-2.5-flash-lite': '/logos/google-gemini.png',
  'gemini-2.5-pro': '/logos/google-gemini.png',
  'gemini-3-pro': '/logos/google-gemini.png',
  'gemini-3-pro-preview': '/logos/google-gemini.png', // Legacy support
  'facebook/detr-resnet-101': '/logos/meta-logo.png',
  'facebook/detr-resnet-50': '/logos/meta-logo.png',
  'microsoft/resnet-50': '/logos/microsoft.svg',
  // New classification models
  'google/vit-base-patch16-224': '/logos/google-gemini.png',
  'google/efficientnet-b0': '/logos/google-gemini.png',
  'facebook/convnext-tiny-224': '/logos/meta-logo.png',
  'facebook/convnext-base-224': '/logos/meta-logo.png',
  'microsoft/beit-base-patch16-224-pt22k-ft22k': '/logos/microsoft.svg',
  'apple/mobilevit-small': '/logos/apple-logo.png',
  // NVIDIA models
  'nvidia/segformer-b0-finetuned-ade-512-512': '/logos/nvidia-logo.png',
  // Coming soon models - Anthropic
  'anthropic/claude-3-haiku': '/logos/anthropic-claude.png',
  'anthropic/claude-3.7-sonnet': '/logos/anthropic-claude.png',
  'anthropic/claude-4-opus': '/logos/anthropic-claude.png',
  'anthropic/claude-4-sonnet': '/logos/anthropic-claude.png',
  'anthropic/claude-4.1-opus': '/logos/anthropic-claude.png',
  'anthropic/claude-4.5-haiku': '/logos/anthropic-claude.png',
  'anthropic/claude-4.5-sonnet': '/logos/anthropic-claude.png',
  // Coming soon models - OpenAI
  'openai/gpt-4o': '/logos/openai-logo.webp',
  // Coming soon models - Microsoft
  'microsoft/florence-2': '/logos/microsoft.svg',
  // Coming soon models - Google
  'google/gemma-3-4b': '/logos/google-gemini.png',
  'google/gemma-3-12b': '/logos/google-gemini.png',
  'google/gemma-3-27b': '/logos/google-gemini.png',
  'google/vision-ocr': '/logos/google-gemini.png',
  // Coming soon models - Meta
  'meta/llama-3.2-vision-11b': '/logos/meta-logo.png',
  'meta/llama-3.2-vision-90b': '/logos/meta-logo.png',
  'meta/llama-4-maverick': '/logos/meta-logo.png',
  'meta/llama-4-scout': '/logos/meta-logo.png',
  // Coming soon models - Mistral
  'mistral/small-3.1-24b': '/logos/mistral-logo.png',
  'mistral/medium-3.1': '/logos/mistral-logo.png',
  'mistral/pixtral-12b': '/logos/mistral-logo.png',
  // Coming soon models - xAI
  'xai/grok-4': '/logos/xai-grok.webp',
  // Coming soon models - Qwen
  'qwen/qwen-vl-max': '/logos/qwen-logo.jpeg',
  'qwen/qwen2.5-vl-7b-instruct': '/logos/qwen-logo.jpeg',
}

// Gemini model speed indicators
const getGeminiModelInfo = (modelId: string): { icon: string; speed: string } | null => {
  const isGemini = modelId?.toLowerCase().includes('gemini')
  if (!isGemini) return null

  const modelIdLower = modelId.toLowerCase()
  
  if (modelIdLower.includes('2.0-flash-exp') || modelIdLower.includes('2.0-flash-exp')) {
    return { icon: '⚡⚡', speed: 'Ultra Fast (1-2s)' }
  }
  if (modelIdLower.includes('2.5-flash-lite') || modelIdLower.includes('flash-lite')) {
    return { icon: '⚡⚡', speed: 'Ultra Fast (1-3s)' }
  }
  if (modelIdLower.includes('2.5-flash') && !modelIdLower.includes('lite')) {
    return { icon: '⚡', speed: 'Fast (2-4s)' }
  }
  if (modelIdLower.includes('2.5-pro')) {
    return { icon: '⚖️', speed: 'Balanced (3-6s)' }
  }
  if (modelIdLower.includes('3-pro')) {
    return { icon: '🎯', speed: 'Most Accurate (5-10s)' }
  }
  
  // Default for other Gemini models
  return { icon: '⚡', speed: 'Fast' }
}

interface ModelSelectDropdownProps {
  selectedModel: ModelMetadata
  availableModels: ModelMetadata[]
  onModelChange: (model: ModelMetadata) => void
  className?: string
}

export default function ModelSelectDropdown({
  selectedModel,
  availableModels,
  onModelChange,
  className
}: ModelSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const selectedLogo = modelLogos[selectedModel.id] || getModelLogo(selectedModel.id, selectedModel.provider)
  const selectedGeminiInfo = getGeminiModelInfo(selectedModel.id)

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Selected Model Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
          className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-wells-warm-grey/20 bg-white',
          'focus:outline-none focus:ring-2 focus:ring-wells-dark-grey/10 focus:border-wells-dark-grey',
          'transition-all hover:border-wells-dark-grey/40',
          isOpen && 'ring-2 ring-wells-dark-grey/10 border-wells-dark-grey'
        )}
      >
        {/* Selected Model Logo */}
        {selectedLogo && (
          <div className="flex-shrink-0 w-6 h-6 relative">
            <Image
              src={selectedLogo}
              alt={selectedModel.author}
              fill
              className="object-contain"
              sizes="24px"
              style={{ mixBlendMode: 'normal' }}
            />
          </div>
        )}
        {/* Selected Model Name with Speed Indicator */}
        <span className="flex-1 text-sm font-medium text-wells-dark-grey text-left">
          {selectedModel.name}
          {selectedGeminiInfo && (
            <span className="ml-2 text-xs text-wells-warm-grey font-normal">
              {selectedGeminiInfo.icon} {selectedGeminiInfo.speed}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-wells-warm-grey transition-transform flex-shrink-0',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>

      {/* Dropdown Options */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-wells-warm-grey/20 rounded-lg shadow-lg overflow-hidden">
          <div className="py-1 max-h-60 overflow-auto">
            {availableModels.map((model) => {
              const logo = modelLogos[model.id] || getModelLogo(model.id, model.provider)
              const isSelected = model.id === selectedModel.id
              const geminiInfo = getGeminiModelInfo(model.id)
              const isComingSoon = model.status === 'coming_soon' || model.isDisabled

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    if (!isComingSoon) {
                      onModelChange(model)
                      setIsOpen(false)
                    }
                  }}
                  disabled={isComingSoon}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    isComingSoon 
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-wells-light-beige/50',
                    isSelected && !isComingSoon && 'bg-wells-light-beige/30'
                  )}
                >
                  {/* Model Logo */}
                  {logo ? (
                    logo.endsWith('-text') ? (
                      // Text-based logos for providers without image logos (none remaining)
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-wells-light-beige/50 flex items-center justify-center border border-wells-warm-grey/20">
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-6 h-6 relative">
                        <Image
                          src={logo}
                          alt={model.author}
                          fill
                          className="object-contain"
                          sizes="24px"
                          style={{ mixBlendMode: 'normal' }}
                          onError={(e) => {
                            // Fallback if logo doesn't exist
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const parent = target.parentElement
                            if (parent) {
                              parent.innerHTML = '<div class="w-full h-full rounded-full bg-wells-light-beige/50 flex items-center justify-center border border-wells-warm-grey/20"><span class="text-[10px] font-bold text-wells-dark-grey">?</span></div>'
                            }
                          }}
                        />
                      </div>
                    )
                  ) : (
                    <div className="flex-shrink-0 w-6 h-6" />
                  )}
                  
                  {/* Model Name with Speed Indicator */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-wells-dark-grey">
                        {model.name}
                      </span>
                      {isComingSoon && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-semibold">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    {geminiInfo && (
                      <span className="text-xs text-wells-warm-grey">
                        {geminiInfo.icon} {geminiInfo.speed}
                      </span>
                    )}
                  </div>
                  
                  {/* Checkmark for selected */}
                  {isSelected && !isComingSoon && (
                    <Check className="w-4 h-4 text-wells-dark-grey flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

