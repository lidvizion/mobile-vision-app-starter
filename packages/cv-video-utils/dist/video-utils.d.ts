/**
 * Video utility functions for snapshot extraction and processing
 */
/**
 * Extract a snapshot from a video file at a specific timestamp
 * @param videoFile - The video file to extract snapshot from
 * @param timestamp - Time in seconds to extract snapshot (default: 0.5)
 * @returns Promise<File> - The extracted image as a File object
 */
export declare const extractVideoSnapshot: (videoFile: File, timestamp?: number) => Promise<File>;
/**
 * Get video duration in seconds
 * @param videoFile - The video file
 * @returns Promise<number> - Duration in seconds
 */
export declare const getVideoDuration: (videoFile: File) => Promise<number>;
/**
 * Check if a file is a video file
 * @param file - The file to check
 * @returns boolean - True if the file is a video
 */
export declare const isVideoFile: (file: File) => boolean;
/**
 * Format file size in human readable format
 * @param bytes - File size in bytes
 * @returns string - Formatted file size
 */
export declare const formatFileSize: (bytes: number) => string;
//# sourceMappingURL=video-utils.d.ts.map