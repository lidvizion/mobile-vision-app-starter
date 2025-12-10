'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { ChevronDown, Check } from 'lucide-react'
import { ModelMetadata } from '@/types/models'
import { cn } from '@/lib/utils'

// Model logos mapping
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

  const selectedLogo = modelLogos[selectedModel.id]
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
              const logo = modelLogos[model.id]
              const isSelected = model.id === selectedModel.id
              const geminiInfo = getGeminiModelInfo(model.id)

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    onModelChange(model)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    'hover:bg-wells-light-beige/50',
                    isSelected && 'bg-wells-light-beige/30'
                  )}
                >
                  {/* Model Logo */}
                  {logo ? (
                    <div className="flex-shrink-0 w-6 h-6 relative">
                      <Image
                        src={logo}
                        alt={model.author}
                        fill
                        className="object-contain"
                        sizes="24px"
                        style={{ mixBlendMode: 'normal' }}
                      />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-6 h-6" />
                  )}
                  
                  {/* Model Name with Speed Indicator */}
                  <div className="flex-1 flex flex-col">
                    <span className="text-sm font-medium text-wells-dark-grey">
                      {model.name}
                    </span>
                    {geminiInfo && (
                      <span className="text-xs text-wells-warm-grey">
                        {geminiInfo.icon} {geminiInfo.speed}
                      </span>
                    )}
                  </div>
                  
                  {/* Checkmark for selected */}
                  {isSelected && (
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

