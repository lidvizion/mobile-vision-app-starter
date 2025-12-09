/**
 * Image utility functions for compression and resizing
 */

export interface ImageCompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  maxSizeKB?: number // Maximum file size in KB
}

/**
 * Compress and resize an image file to reduce its size
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<File> - The compressed image as a File object
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 0.85,
    maxSizeKB = 500 // Default max size: 500KB
  } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img
        const aspectRatio = width / height

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            width = maxWidth
            height = width / aspectRatio
          } else {
            height = maxHeight
            width = height * aspectRatio
          }
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)

        // Convert to blob with quality
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'))
              return
            }

            // Check if file size is acceptable
            const sizeKB = blob.size / 1024
            if (sizeKB <= maxSizeKB) {
              // Size is acceptable, create File object
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              })
              resolve(compressedFile)
            } else {
              // File is still too large, reduce quality further
              const newQuality = Math.max(0.5, quality - 0.1)
              canvas.toBlob(
                (recompressedBlob) => {
                  if (!recompressedBlob) {
                    reject(new Error('Failed to recompress image'))
                    return
                  }
                  const compressedFile = new File([recompressedBlob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  })
                  resolve(compressedFile)
                },
                'image/jpeg',
                newQuality
              )
            }
          },
          'image/jpeg',
          quality
        )
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    // Load the image
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Check if an image needs compression
 * @param file - The image file to check
 * @param maxSizeKB - Maximum file size in KB (default: 500KB)
 * @returns boolean - True if compression is needed
 */
export function needsCompression(file: File, maxSizeKB: number = 500): boolean {
  const sizeKB = file.size / 1024
  return sizeKB > maxSizeKB
}

/**
 * Get image file size in a human-readable format
 * @param file - The file to get size for
 * @returns string - Human-readable file size (e.g., "2.5 MB")
 */
export function getFileSizeString(file: File): string {
  const sizeKB = file.size / 1024
  if (sizeKB < 1024) {
    return `${sizeKB.toFixed(1)} KB`
  }
  const sizeMB = sizeKB / 1024
  return `${sizeMB.toFixed(2)} MB`
}

/**
 * Get base64 string size in a human-readable format
 * @param base64 - The base64 string to get size for
 * @returns string - Human-readable file size (e.g., "2.5 MB")
 */
export function getBase64SizeString(base64: string): string {
  // Base64 is approximately 33% larger than the original binary data
  // Estimate: base64.length * 3 / 4 gives approximate byte size
  const estimatedBytes = (base64.length * 3) / 4
  const sizeKB = estimatedBytes / 1024
  if (sizeKB < 1024) {
    return `${sizeKB.toFixed(1)} KB`
  }
  const sizeMB = sizeKB / 1024
  return `${sizeMB.toFixed(2)} MB`
}

export interface CompressionResult {
  compressedBase64: string
  wasCompressed: boolean
  originalSize: string
  compressedSize: string
  reductionPercent: number
}

/**
 * Compress image for Gemini API - targets ~50KB file size for optimal speed and accuracy
 * Uses progressive compression: starts moderate, gets more aggressive if needed
 * Returns base64 string with compression stats
 * @param file - The image file to compress
 * @returns Promise<CompressionResult> - Compression result with base64 and stats
 */
export async function compressImageForGemini(file: File): Promise<CompressionResult> {
  const originalSize = getFileSizeString(file)
  const originalSizeKB = file.size / 1024
  const targetSizeKB = 50 // Target ~50KB for optimal performance
  const maxSizeKB = 100 // Maximum acceptable size (100KB)
  
  // If already small (< 50KB), just convert to JPEG with minimal processing
  if (originalSizeKB < 50) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            if (!ctx) {
              reject(new Error('Failed to get canvas context'))
              return
            }

            canvas.width = img.width
            canvas.height = img.height
            ctx.drawImage(img, 0, 0, img.width, img.height)
            
            // Convert to JPEG with high quality since it's already small
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85)
            const compressedSize = getBase64SizeString(compressedBase64.split(',')[1])
            const compressedSizeKB = (compressedBase64.length * 3 / 4) / 1024
            const reductionPercent = originalSizeKB > 0 
              ? Math.round(((originalSizeKB - compressedSizeKB) / originalSizeKB) * 100)
              : 0
            
            resolve({
              compressedBase64,
              wasCompressed: false,
              originalSize,
              compressedSize,
              reductionPercent
            })
          } catch (error) {
            reject(error)
          }
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }
  
  // Progressive compression: try different settings until we hit target size
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          const originalWidth = img.width
          const originalHeight = img.height
          
          // Determine initial compression settings based on original file size
          let maxDimension: number
          let quality: number
          
          if (originalSizeKB > 1000) {
            // Very large files: aggressive compression
            maxDimension = 800
            quality = 0.75
          } else if (originalSizeKB > 500) {
            // Large files: moderate-aggressive
            maxDimension = 900
            quality = 0.78
          } else {
            // Medium files: moderate compression
            maxDimension = 1024
            quality = 0.80
          }
          
          // Calculate dimensions maintaining aspect ratio
          let width = originalWidth
          let height = originalHeight
          let wasCompressed = false
          
          if (width > height) {
            if (width > maxDimension) {
              wasCompressed = true
              height = (height * maxDimension) / width
              width = maxDimension
            }
          } else {
            if (height > maxDimension) {
              wasCompressed = true
              width = (width * maxDimension) / height
              height = maxDimension
            }
          }
          
          // If image is already small dimension-wise, still compress for file size
          if (!wasCompressed && originalSizeKB > 50) {
            wasCompressed = true
            // Resize to ensure we hit target file size
            if (width > 1024) {
              height = (height * 1024) / width
              width = 1024
            }
          }
          
          canvas.width = width
          canvas.height = height
          
          // High quality rendering for detection accuracy
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, width, height)
          
          // Convert to base64 with compression
          let compressedBase64 = canvas.toDataURL('image/jpeg', quality)
          let compressedSizeKB = (compressedBase64.length * 3 / 4) / 1024
          
          // If still too large, reduce quality further
          if (compressedSizeKB > maxSizeKB && quality > 0.70) {
            quality = Math.max(0.70, quality - 0.05)
            compressedBase64 = canvas.toDataURL('image/jpeg', quality)
            compressedSizeKB = (compressedBase64.length * 3 / 4) / 1024
          }
          
          // If still too large, reduce dimensions further
          if (compressedSizeKB > maxSizeKB && maxDimension > 800) {
            maxDimension = 800
            quality = 0.75
            
            if (originalWidth > originalHeight) {
              height = (originalHeight * maxDimension) / originalWidth
              width = maxDimension
            } else {
              width = (originalWidth * maxDimension) / originalHeight
              height = maxDimension
            }
            
            canvas.width = width
            canvas.height = height
            ctx.drawImage(img, 0, 0, width, height)
            compressedBase64 = canvas.toDataURL('image/jpeg', quality)
            compressedSizeKB = (compressedBase64.length * 3 / 4) / 1024
          }
          
          // Calculate final compression stats
          const compressedSize = getBase64SizeString(compressedBase64.split(',')[1])
          const reductionPercent = originalSizeKB > 0 
            ? Math.round(((originalSizeKB - compressedSizeKB) / originalSizeKB) * 100)
            : 0
          
          resolve({
            compressedBase64,
            wasCompressed: wasCompressed || originalSizeKB > 50,
            originalSize,
            compressedSize,
            reductionPercent
          })
        } catch (error) {
          reject(error)
        }
      }
      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }
      img.src = e.target?.result as string
    }
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    reader.readAsDataURL(file)
  })
}
