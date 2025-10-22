'use client'

import { useEffect, useRef } from 'react'

interface PixelStripRendererProps {
  pixelStrip: {
    contourPoints?: Array<{x: number, y: number}>
    centerLine?: Array<{x: number, y: number}>
    boundaryPixels?: Array<{x: number, y: number, intensity: number}>
    dimensions?: {width: number, height: number}
  } | null
  imageWidth: number
  imageHeight: number
  containerWidth: number
  containerHeight: number
  color: string
  className?: string
}

export default function PixelStripRenderer({
  pixelStrip,
  imageWidth,
  imageHeight,
  containerWidth,
  containerHeight,
  color,
  className = ''
}: PixelStripRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pixelStrip) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate scale factors
    const scaleX = containerWidth / imageWidth
    const scaleY = containerHeight / imageHeight

    // Set drawing properties
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Render contour points
    if (pixelStrip.contourPoints && pixelStrip.contourPoints.length > 0) {
      ctx.beginPath()
      pixelStrip.contourPoints.forEach((point, index) => {
        const x = point.x * scaleX
        const y = point.y * scaleY
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()
      
      // Draw contour points as circles
      ctx.fillStyle = color
      pixelStrip.contourPoints.forEach(point => {
        const x = point.x * scaleX
        const y = point.y * scaleY
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, 2 * Math.PI)
        ctx.fill()
      })
    }

    // Render center line
    if (pixelStrip.centerLine && pixelStrip.centerLine.length > 0) {
      ctx.strokeStyle = `${color}80` // Semi-transparent
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5]) // Dashed line
      
      ctx.beginPath()
      pixelStrip.centerLine.forEach((point, index) => {
        const x = point.x * scaleX
        const y = point.y * scaleY
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()
      ctx.setLineDash([]) // Reset dash
    }

    // Render boundary pixels
    if (pixelStrip.boundaryPixels && pixelStrip.boundaryPixels.length > 0) {
      pixelStrip.boundaryPixels.forEach(pixel => {
        const x = pixel.x * scaleX
        const y = pixel.y * scaleY
        const alpha = pixel.intensity
        
        ctx.fillStyle = `${color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`
        ctx.beginPath()
        ctx.arc(x, y, 1, 0, 2 * Math.PI)
        ctx.fill()
      })
    }

  }, [pixelStrip, imageWidth, imageHeight, containerWidth, containerHeight, color])

  if (!pixelStrip) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      width={containerWidth}
      height={containerHeight}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover'
      }}
    />
  )
}
