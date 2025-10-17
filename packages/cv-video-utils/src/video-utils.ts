/**
 * Video utility functions for snapshot extraction and processing
 */

/**
 * Extract a snapshot from a video file at a specific timestamp
 * @param videoFile - The video file to extract snapshot from
 * @param timestamp - Time in seconds to extract snapshot (default: 0.5)
 * @returns Promise<File> - The extracted image as a File object
 */
export const extractVideoSnapshot = async (
  videoFile: File, 
  timestamp: number = 0.5
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    video.onloadedmetadata = () => {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Seek to the specified timestamp
      video.currentTime = Math.min(timestamp, video.duration - 0.1);
    };

    video.onseeked = () => {
      try {
        // Draw the current frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to extract video frame'));
            return;
          }
          
          // Create a File object from the blob
          const fileName = videoFile.name.replace(/\.[^/.]+$/, '_snapshot.jpg');
          const snapshotFile = new File([blob], fileName, { type: 'image/jpeg' });
          
          resolve(snapshotFile);
        }, 'image/jpeg', 0.9);
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => {
      reject(new Error('Failed to load video file'));
    };

    // Load the video file
    video.src = URL.createObjectURL(videoFile);
    video.load();
  });
};

/**
 * Get video duration in seconds
 * @param videoFile - The video file
 * @returns Promise<number> - Duration in seconds
 */
export const getVideoDuration = (videoFile: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    
    video.onloadedmetadata = () => {
      resolve(video.duration);
      URL.revokeObjectURL(video.src);
    };
    
    video.onerror = () => {
      reject(new Error('Failed to load video file'));
      URL.revokeObjectURL(video.src);
    };
    
    video.src = URL.createObjectURL(videoFile);
    video.load();
  });
};

/**
 * Check if a file is a video file
 * @param file - The file to check
 * @returns boolean - True if the file is a video
 */
export const isVideoFile = (file: File): boolean => {
  return file.type.startsWith('video/');
};

/**
 * Format file size in human readable format
 * @param bytes - File size in bytes
 * @returns string - Formatted file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
