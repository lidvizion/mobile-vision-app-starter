'use client'

import { useEffect, useRef, useState } from 'react'
import { SegmentationRegion } from '@/types'
import PixelStripRenderer from './PixelStripRenderer'

interface SegmentationMaskRendererProps {
  regions: SegmentationRegion[]
  imageWidth: number
  imageHeight: number
  containerWidth: number
  containerHeight: number
}

export default function SegmentationMaskRenderer({ 
  regions, 
  imageWidth, 
  imageHeight, 
  containerWidth, 
  containerHeight 
}: SegmentationMaskRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loadedMasks, setLoadedMasks] = useState<Set<number>>(new Set())

  useEffect(() => {
    console.log('🚀 NEW SEGMENTATION RENDERER V2.0 LOADED!')
    const canvas = canvasRef.current
    if (!canvas || !regions.length) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate scale factors
    const scaleX = containerWidth / imageWidth
    const scaleY = containerHeight / imageHeight

    // Store all mask data for winner-takes-all approach
    const allMaskData: Array<{
      region: any
      imageData: ImageData
      maxAlpha: number
    }> = []

    let loadedCount = 0
    const totalMasks = regions.filter(r => r.mask).length

    regions.forEach((region, index) => {
      if (!region.mask) {
        // Fallback: render bounding box if no mask available
        if (region.bbox) {
          ctx.globalAlpha = 0.3
          ctx.fillStyle = region.color
          ctx.fillRect(
            (region.bbox.x / imageWidth) * containerWidth,
            (region.bbox.y / imageHeight) * containerHeight,
            (region.bbox.width / imageWidth) * containerWidth,
            (region.bbox.height / imageHeight) * containerHeight
          )
          ctx.globalAlpha = 1
        }
        return
      }

      try {
        // Create image from base64 mask data
        const img = new Image()
        img.onload = () => {
          console.log(`Rendering mask for ${region.class}:`, {
            imgWidth: img.width,
            imgHeight: img.height,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            containerWidth,
            containerHeight,
            color: region.color,
            area: region.area
          })
          
          // Create a temporary canvas to process the mask
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = canvas.width
          tempCanvas.height = canvas.height
          const tempCtx = tempCanvas.getContext('2d')
          
          if (!tempCtx) return
          
          // Draw the mask image to temp canvas
          tempCtx.drawImage(img, 0, 0, canvas.width, canvas.height)
          
          // Get image data to process pixel by pixel
          const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          
          // Find the maximum alpha value in the mask
          let maxAlpha = 0
          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3]
            maxAlpha = Math.max(maxAlpha, alpha)
          }
          
          // Store this mask data for winner-takes-all processing
          allMaskData.push({
            region: region,
            imageData: imageData,
            maxAlpha: maxAlpha
          })
          
          // Debug: Check if all masks are identical
          const samplePixels = []
          for (let i = 0; i < Math.min(100, data.length); i += 4) {
            samplePixels.push({
              r: data[i],
              g: data[i + 1], 
              b: data[i + 2],
              a: data[i + 3]
            })
          }
          
          console.log(`🆕 NEW CODE: Stored mask data for ${region.class}:`, {
            maxAlpha: maxAlpha,
            totalPixels: data.length / 4,
            samplePixels: samplePixels.slice(0, 5) // First 5 pixels
          })
          
          // Additional debugging - show sample pixels separately
          console.log(`🆕 NEW CODE: Sample pixels for ${region.class}:`, samplePixels.slice(0, 3))
          
          // Check for identical masks (all pixels have same alpha)
          const uniqueAlphas = new Set()
          for (let i = 3; i < Math.min(1000, data.length); i += 4) {
            uniqueAlphas.add(data[i])
          }
          const isIdenticalMask = uniqueAlphas.size <= 2 // Only 1-2 unique alpha values
          
          if (isIdenticalMask) {
            console.warn(`⚠️ IDENTICAL MASK DETECTED for ${region.class}: Only ${uniqueAlphas.size} unique alpha values found`)
          }

          // Track loaded masks
          loadedCount++
          setLoadedMasks(prev => new Set([...Array.from(prev), index]))
          
          // If all masks are loaded, process them with winner-takes-all
          if (loadedCount === totalMasks) {
            console.log('🆕 NEW CODE: All masks loaded, applying winner-takes-all approach...')
            
            // Debug: Check if masks are identical
            if (allMaskData.length > 1) {
              const firstMask = allMaskData[0].imageData.data
              const secondMask = allMaskData[1].imageData.data
              let identicalPixels = 0
              for (let i = 0; i < Math.min(1000, firstMask.length); i += 4) {
                if (firstMask[i] === secondMask[i] && 
                    firstMask[i+1] === secondMask[i+1] && 
                    firstMask[i+2] === secondMask[i+2] && 
                    firstMask[i+3] === secondMask[i+3]) {
                  identicalPixels++
                }
              }
            console.log('🆕 NEW CODE: Mask comparison:', {
              totalCompared: Math.min(1000, firstMask.length) / 4,
              identicalPixels: identicalPixels,
              areMasksIdentical: identicalPixels > 900
            })
            
            // Additional debugging - show first few pixels of each mask
            console.log('🆕 NEW CODE: First mask sample pixels:', Array.from(firstMask.slice(0, 12)))
            console.log('🆕 NEW CODE: Second mask sample pixels:', Array.from(secondMask.slice(0, 12)))
            
            // Check if all masks are identical (API issue)
            const areAllMasksIdentical = identicalPixels > 900
            
            // Also check if we detected identical masks during loading
            const hasIdenticalMasks = allMaskData.some(mask => {
              const data = mask.imageData.data
              const uniqueAlphas = new Set()
              for (let i = 3; i < Math.min(1000, data.length); i += 4) {
                uniqueAlphas.add(data[i])
              }
              return uniqueAlphas.size <= 2
            })
            
             if (areAllMasksIdentical || hasIdenticalMasks) {
               console.warn('⚠️ Identical masks detected - using fallback rendering')
               
               // Instead of showing error, render a more informative visualization
               // Show the regions as colored areas based on their class names
               const uniqueClasses = new Set(regions.map(r => r.class))
               const classColors = Array.from(uniqueClasses).map((className, index) => ({
                 class: className,
                 color: regions.find(r => r.class === className)?.color || `hsl(${index * 40}, 70%, 50%)`
               }))
               
               // Render a more sophisticated visualization
               // Create a grid-based visualization showing detected classes
               const gridSize = Math.ceil(Math.sqrt(classColors.length))
               const cellWidth = canvas.width / gridSize
               const cellHeight = canvas.height / gridSize
               
               classColors.forEach((classInfo, index) => {
                 const region = regions.find(r => r.class === classInfo.class)
                 if (region) {
                   const row = Math.floor(index / gridSize)
                   const col = index % gridSize
                   const x = col * cellWidth
                   const y = row * cellHeight
                   
                   // Create a subtle colored overlay for each class
                   const hue = (index * 360) / classColors.length
                   ctx.fillStyle = `hsla(${hue}, 60%, 50%, 0.15)`
                   ctx.fillRect(x, y, cellWidth, cellHeight)
                   
                   // Add class label in the center of each cell
                   ctx.fillStyle = `hsl(${hue}, 70%, 30%)`
                   ctx.font = '12px Arial'
                   ctx.textAlign = 'center'
                   ctx.fillText(classInfo.class, x + cellWidth/2, y + cellHeight/2 - 5)
                   ctx.fillText(`${Math.round(region.area * 100)}%`, x + cellWidth/2, y + cellHeight/2 + 10)
                 }
               })
               
               // Add a subtle info message at the bottom
               ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
               ctx.font = '11px Arial'
               ctx.textAlign = 'center'
               ctx.fillText('Segmentation results (model may have limitations)', 
                 canvas.width / 2, canvas.height - 5)
               
               return // Exit early, don't render identical masks
             }
            
            // Check if we have only one mask (might also be problematic)
            if (allMaskData.length === 1) {
              console.warn('⚠️ Only one mask detected. This might indicate limited segmentation results.')
            }
            }
            
            // Create final canvas data
            const finalCanvasData = ctx.createImageData(canvas.width, canvas.height)
            
            // For each pixel, find the class with highest alpha
            let totalPixels = 0
            let coloredPixels = 0
            const classWins = new Map()
            
            for (let i = 0; i < finalCanvasData.data.length; i += 4) {
              totalPixels++
              let bestClass = null
              let bestAlpha = 0
              
              // Check each class for this pixel
              for (const maskData of allMaskData) {
                const alpha = maskData.imageData.data[i + 3]
                if (alpha > bestAlpha) {
                  bestAlpha = alpha
                  bestClass = maskData
                }
              }
              
              // If we found a winning class, set its color
              if (bestClass && bestAlpha > 0) {
                coloredPixels++
                const className = bestClass.region.class
                classWins.set(className, (classWins.get(className) || 0) + 1)
                
                const hex = bestClass.region.color.replace('#', '')
                const r = parseInt(hex.substr(0, 2), 16)
                const g = parseInt(hex.substr(2, 2), 16)
                const b = parseInt(hex.substr(4, 2), 16)
                
                finalCanvasData.data[i] = r     // Red
                finalCanvasData.data[i + 1] = g // Green
                finalCanvasData.data[i + 2] = b // Blue
                finalCanvasData.data[i + 3] = Math.min(255, bestAlpha * 0.8) // Semi-transparent
              }
            }
            
            console.log('🆕 NEW CODE: Winner-takes-all results:', {
              totalPixels: totalPixels,
              coloredPixels: coloredPixels,
              coverage: (coloredPixels / totalPixels * 100).toFixed(2) + '%',
              classWins: Object.fromEntries(classWins)
            })
            
            // Draw the final result
            ctx.putImageData(finalCanvasData, 0, 0)
            
            console.log('🆕 NEW CODE: Winner-takes-all rendering complete!')
            console.log('🆕 NEW CODE: Final canvas data length:', finalCanvasData.data.length)
            console.log('🆕 NEW CODE: Total pixels processed:', totalPixels)
            console.log('🆕 NEW CODE: Colored pixels:', coloredPixels)
            console.log('🆕 NEW CODE: Class wins:', Object.fromEntries(classWins))
          }
        }
        
        img.onerror = () => {
          console.warn('Failed to load mask for region:', region.class)
          // Fallback to bounding box if mask fails to load
          if (region.bbox) {
            ctx.globalAlpha = 0.3
            ctx.fillStyle = region.color
            ctx.fillRect(
              (region.bbox.x / imageWidth) * containerWidth,
              (region.bbox.y / imageHeight) * containerHeight,
              (region.bbox.width / imageWidth) * containerWidth,
              (region.bbox.height / imageHeight) * containerHeight
            )
            ctx.globalAlpha = 1
          }
        }
        
        img.src = `data:image/png;base64,${region.mask}`
      } catch (error) {
        console.warn('Failed to render mask for region:', region.class, error)
        // Fallback to bounding box
        if (region.bbox) {
          ctx.globalAlpha = 0.3
          ctx.fillStyle = region.color
          ctx.fillRect(
            (region.bbox.x / imageWidth) * containerWidth,
            (region.bbox.y / imageHeight) * containerHeight,
            (region.bbox.width / imageWidth) * containerWidth,
            (region.bbox.height / imageHeight) * containerHeight
          )
          ctx.globalAlpha = 1
        }
      }
    })
  }, [regions, imageWidth, imageHeight, containerWidth, containerHeight])

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={containerWidth}
        height={containerHeight}
        className="absolute inset-0 pointer-events-none"
        style={{
          imageRendering: 'pixelated', // For crisp pixel-level rendering
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />
      {/* Render pixel strips for each region */}
      {regions.map((region, index) => (
        region.pixelStrip && (
          <PixelStripRenderer
            key={`pixel-strip-${index}`}
            pixelStrip={region.pixelStrip}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            color={region.color}
            className="z-10"
          />
        )
      ))}
    </div>
  )
}