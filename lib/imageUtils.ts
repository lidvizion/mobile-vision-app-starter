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

