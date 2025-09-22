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
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color')
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
