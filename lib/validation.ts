import { z } from 'zod';

// Image file validation
export const ImageFileSchema = z.object({
  type: z.string().refine(
    (type) => ['image/jpeg', 'image/png', 'image/webp'].includes(type),
    { message: 'Only JPEG, PNG, and WebP files are supported' }
  ),
  size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  name: z.string().min(1, 'File name is required')
});

// Video file validation
export const VideoFileSchema = z.object({
  type: z.string().refine(
    (type) => ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'].includes(type),
    { message: 'Only MP4, WebM, MOV, and AVI files are supported' }
  ),
  size: z.number().max(100 * 1024 * 1024, 'Video file size must be less than 100MB. Please compress your video or choose a shorter clip.'),
  name: z.string().min(1, 'File name is required')
});

// Combined media file validation
export const MediaFileSchema = z.union([ImageFileSchema, VideoFileSchema]);

// Bounding box schema
export const BoundingBoxSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(0),
  height: z.number().min(0)
});

// Detection result schema
export const DetectionSchema = z.object({
  class: z.string(),
  confidence: z.number().min(0).max(1),
  bbox: BoundingBoxSchema
});

// Classification result schema
export const ClassificationSchema = z.object({
  class: z.string(),
  score: z.number().min(0).max(1),
  confidence: z.enum(['high', 'medium', 'low', 'very_low'])
});

// Pixel strip data schema for segmentation visualization
export const PixelStripSchema = z.object({
  contourPoints: z.array(z.object({
    x: z.number(),
    y: z.number()
  })).optional(),
  centerLine: z.array(z.object({
    x: z.number(),
    y: z.number()
  })).optional(),
  boundaryPixels: z.array(z.object({
    x: z.number(),
    y: z.number(),
    intensity: z.number().min(0).max(1)
  })).optional(),
  dimensions: z.object({
    width: z.number().min(0),
    height: z.number().min(0)
  }).optional()
}).nullable().optional();

// Segmentation region schema
export const SegmentationRegionSchema = z.object({
  class: z.string(),
  area: z.number().min(0).max(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color'),
  mask: z.string().nullable().optional(), // Base64 mask data
  bbox: z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().min(0),
    height: z.number().min(0)
  }).nullable().optional(), // Bounding box for instance segmentation
  pixelStrip: PixelStripSchema // Pixel strip data for visualization
});

// Segmentation schema
export const SegmentationSchema = z.object({
  mask_url: z.string().optional(),
  regions: z.array(SegmentationRegionSchema)
});

// Image metadata schema
export const ImageMetadataSchema = z.object({
  width: z.number().min(1),
  height: z.number().min(1),
  format: z.string()
});

// CV Results schema
export const CVResultsSchema = z.object({
  labels: z.array(ClassificationSchema).optional(),
  detections: z.array(DetectionSchema).optional(),
  segmentation: SegmentationSchema.optional()
});

// Main CV Response schema
export const CVResponseSchema = z.object({
  task: z.enum(['detection', 'classification', 'segmentation', 'instance-segmentation', 'multi-type']),
  timestamp: z.string(),
  model_version: z.string(),
  results: CVResultsSchema,
  processing_time: z.number().min(0),
  image_metadata: ImageMetadataSchema
});

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

// Type exports
export type CVResponse = z.infer<typeof CVResponseSchema>;
export type CVResults = z.infer<typeof CVResultsSchema>;
export type Detection = z.infer<typeof DetectionSchema>;
export type Classification = z.infer<typeof ClassificationSchema>;
export type SegmentationRegion = z.infer<typeof SegmentationRegionSchema>;
export type ImageMetadata = z.infer<typeof ImageMetadataSchema>;
