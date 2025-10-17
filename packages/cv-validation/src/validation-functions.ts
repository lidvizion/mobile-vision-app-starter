import { z } from 'zod';
import { 
  ImageFileSchema, 
  VideoFileSchema, 
  MediaFileSchema, 
  CVResponseSchema 
} from './schemas';

// Validation functions
export const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
  try {
    ImageFileSchema.parse({
      type: file.type,
      size: file.size,
      name: file.name
    });
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.issues[0].message };
    }
    return { isValid: false, error: 'Invalid file format' };
  }
};

export const validateVideoFile = (file: File): { isValid: boolean; error?: string } => {
  try {
    VideoFileSchema.parse({
      type: file.type,
      size: file.size,
      name: file.name
    });
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.issues[0].message };
    }
    return { isValid: false, error: 'Invalid file format' };
  }
};

export const validateMediaFile = (file: File): { isValid: boolean; error?: string; isVideo?: boolean } => {
  try {
    MediaFileSchema.parse({
      type: file.type,
      size: file.size,
      name: file.name
    });
    
    // Determine if it's a video file
    const isVideo = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'].includes(file.type);
    
    return { isValid: true, isVideo };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.issues[0].message };
    }
    return { isValid: false, error: 'Invalid file format' };
  }
};

export const validateCVResponse = (data: unknown): { isValid: boolean; data?: any; error?: string } => {
  try {
    const validatedData = CVResponseSchema.parse(data);
    return { isValid: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        isValid: false, 
        error: `Validation failed: ${error.issues.map(e => e.message).join(', ')}` 
      };
    }
    return { isValid: false, error: 'Invalid response format' };
  }
};
