'use client'

import { useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'

interface SAMRedirectModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SAMRedirectModal({
  isOpen,
  onClose
}: SAMRedirectModalProps) {
  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleGoClick = () => {
    window.open('https://aidemos.meta.com/segment-anything/', '_blank', 'noopener,noreferrer')
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sam-modal-title"
      aria-describedby="sam-modal-description"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal Content */}
      <div className="relative bg-wells-white rounded-xl shadow-2xl w-full max-w-md border border-wells-warm-grey/20 animate-scale-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-wells-light-beige rounded-full transition-colors z-10"
          aria-label="Close modal"
        >
          <X className="w-5 h-5 text-wells-warm-grey" />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Icon/Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-wells-light-beige flex items-center justify-center">
              <img
                src="/logos/meta-logo.png"
                alt="Meta AI"
                className="w-10 h-10 object-contain"
              />
            </div>
          </div>

          {/* Title */}
          <h2
            id="sam-modal-title"
            className="text-2xl font-serif font-bold text-wells-dark-grey text-center mb-4"
          >
            Segment Anything Model
          </h2>

          {/* Description */}
          <p
            id="sam-modal-description"
            className="text-wells-warm-grey text-center mb-8"
          >
            You'll be taken to the Meta AI Demos studio
          </p>

          {/* Action Button */}
          <div className="flex justify-center">
            <button
              onClick={handleGoClick}
              className="btn-primary btn-lg flex items-center gap-2 hover-lift"
            >
              <span>Go!</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

