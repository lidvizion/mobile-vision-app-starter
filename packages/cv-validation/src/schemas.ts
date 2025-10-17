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
  size: z.number().max(100 * 1024 * 1024, 'File size must be less than 100MB'),
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

// Segmentation region schema
export const SegmentationRegionSchema = z.object({
  class: z.string(),
  area: z.number().min(0).max(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color'),
  mask: z.string().nullable().optional(), // Base64 mask data
  bbox: BoundingBoxSchema.nullable().optional() // Bounding box for instance segmentation
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
  task: z.enum(['detection', 'classification', 'segmentation', 'multi-type']),
  model_version: z.string(),
  processing_time: z.number().min(0),
  timestamp: z.string(),
  image_metadata: ImageMetadataSchema,
  results: CVResultsSchema
});
