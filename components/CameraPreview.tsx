'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, Loader2, X, Video, Image as ImageIcon, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { CVTask, CVResponse } from '@/types'
import { validateImageFile } from '@/lib/validation'
import { logger, createLogContext } from '@/lib/logger'
import { cn } from '@/lib/utils'

interface CameraPreviewProps {
  currentTask: CVTask
  onImageProcessed: (response: CVResponse) => void
  isProcessing: boolean
  processImage: (file: File) => Promise<CVResponse>
  selectedImage: string | null
  setSelectedImage: (image: string | null) => void
}

export default function CameraPreview({ currentTask, onImageProcessed, isProcessing, processImage, selectedImage, setSelectedImage }: CameraPreviewProps) {
  const [dragActive, setDragActive] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileClickInProgress = useRef(false)

  const handleFileSelect = async (file: File) => {
    const context = createLogContext(currentTask, 'CameraPreview', 'file-select')
    logger.info('File selected for upload', context, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    })

    // Validate file
    const validation = validateImageFile(file)
    if (!validation.isValid) {
      setError(validation.error || 'Invalid file format')
      logger.warn('File validation failed', context, { error: validation.error })
      return
    }

    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    try {
      const response = await processImage(file)
      onImageProcessed(response)
      logger.info('File processed successfully', context)
    } catch (error) {
      logger.error('Error processing image', context, error as Error)
      setError('Failed to process image. Please try again.')
    }
  }

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment'
        } 
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setCameraActive(true)
      }
    } catch (err) {
      console.error('Camera access denied:', err)
      setError('Camera access denied. Please allow camera permissions and try again.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(async (blob) => {
      if (!blob) return

      const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' })
      
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      try {
        const response = await processImage(file)
        onImageProcessed(response)
        stopCamera()
      } catch (error) {
        console.error('Error processing image:', error)
        setError('Failed to process image. Please try again.')
      }
    }, 'image/jpeg', 0.9)
  }, [processImage, onImageProcessed, stopCamera, setSelectedImage])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = () => {
    setDragActive(false)
  }

  const handleNewImage = () => {
    setSelectedImage(null)
    setError(null)
    stopCamera()
  }

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-wells-dark-grey rounded-xl flex items-center justify-center shadow-wells-md">
          <Camera className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-serif font-semibold text-wells-dark-grey">Upload Image</h3>
          <p className="text-sm text-wells-warm-grey">Upload or capture images for processing</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 shadow-wells-sm">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Camera View */}
      {cameraActive && (
        <div className="mb-6 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 object-cover rounded-2xl border border-wells-warm-grey/20 shadow-wells-md"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3 items-center">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                capturePhoto()
              }}
              className="w-16 h-16 bg-wells-white rounded-full shadow-wells-lg flex items-center justify-center hover:bg-wells-light-beige transition-all hover:scale-110 border-4 border-wells-dark-grey/20"
              title="Capture Photo"
            >
              <Camera className="w-8 h-8 text-wells-dark-grey" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                stopCamera()
              }}
              className="w-12 h-12 bg-red-500 rounded-full shadow-wells-lg flex items-center justify-center hover:bg-red-600 transition-all hover:scale-110"
              title="Stop Camera"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Upload Area */}
      {!cameraActive && (
        <div
          className={cn(
            'relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300',
            dragActive 
              ? 'border-wells-dark-grey bg-wells-light-beige' 
              : 'border-wells-warm-grey/30 hover:border-wells-warm-grey/50 hover:bg-wells-light-beige',
            isProcessing && 'opacity-50 pointer-events-none'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {selectedImage ? (
            <div className="space-y-4">
              <div className="relative group">
                <Image
                  src={selectedImage}
                  alt="Selected"
                  width={400}
                  height={256}
                  className="max-w-full max-h-64 mx-auto rounded-2xl border border-wells-warm-grey/20 shadow-md"
                />
                <div className="absolute inset-0 bg-wells-dark-grey/0 group-hover:bg-wells-dark-grey/10 rounded-2xl transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button
                    onClick={handleNewImage}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-2xl flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <X className="w-4 h-4" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
              
              <div className="text-center">
                <h4 className="text-lg font-medium text-wells-dark-grey mb-1">
                  {isProcessing ? 'Processing Image...' : 'Image Ready'}
                </h4>
                <p className="text-sm text-wells-warm-grey">
                  {isProcessing 
                    ? 'Analyzing your image with computer vision models...'
                    : 'Your image is ready for analysis'
                  }
                </p>
              </div>
              
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 text-sm text-wells-warm-grey">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing with {currentTask} model...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-wells-light-beige rounded-2xl flex items-center justify-center shadow-sm">
                  <ImageIcon className="w-8 h-8 text-wells-warm-grey" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xl font-serif font-semibold text-wells-dark-grey">
                  {isProcessing ? 'Processing Image...' : 'Upload an Image'}
                </h4>
                <p className="text-wells-warm-grey max-w-md mx-auto leading-relaxed">
                  {isProcessing 
                    ? 'Analyzing your image with computer vision models...'
                    : 'Drag and drop an image here, or choose from the options below'
                  }
                </p>
              </div>
              
              {!isProcessing && (
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (fileClickInProgress.current) return
                      fileClickInProgress.current = true
                      fileInputRef.current?.click()
                      setTimeout(() => {
                        fileClickInProgress.current = false
                      }, 1000)
                    }}
                    className="btn-primary btn-lg hover-lift"
                  >
                    <Upload className="w-5 h-5" />
                    <span>Choose File</span>
                  </button>
                  <button 
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      startCamera()
                    }}
                    className="btn-secondary btn-lg hover-lift"
                  >
                    <Video className="w-5 h-5" />
                    <span>Use Camera</span>
                  </button>
                </div>
              )}
              
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 text-sm text-wells-warm-grey">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing with {currentTask} model...</span>
                </div>
              )}
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
            className="hidden"
          />
        </div>
      )}
    </div>
  )
}