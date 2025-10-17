import { z } from 'zod';

// Image file validation
var ImageFileSchema = z.object({
    type: z.string().refine(function (type) { return ['image/jpeg', 'image/png', 'image/webp'].includes(type); }, { message: 'Only JPEG, PNG, and WebP files are supported' }),
    size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
    name: z.string().min(1, 'File name is required')
});
// Video file validation
var VideoFileSchema = z.object({
    type: z.string().refine(function (type) { return ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'].includes(type); }, { message: 'Only MP4, WebM, MOV, and AVI files are supported' }),
    size: z.number().max(100 * 1024 * 1024, 'File size must be less than 100MB'),
    name: z.string().min(1, 'File name is required')
});
// Combined media file validation
var MediaFileSchema = z.union([ImageFileSchema, VideoFileSchema]);
// Bounding box schema
var BoundingBoxSchema = z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().min(0),
    height: z.number().min(0)
});
// Detection result schema
var DetectionSchema = z.object({
    class: z.string(),
    confidence: z.number().min(0).max(1),
    bbox: BoundingBoxSchema
});
// Classification result schema
var ClassificationSchema = z.object({
    class: z.string(),
    score: z.number().min(0).max(1),
    confidence: z.enum(['high', 'medium', 'low', 'very_low'])
});
// Segmentation region schema
var SegmentationRegionSchema = z.object({
    class: z.string(),
    area: z.number().min(0).max(1),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color'),
    mask: z.string().nullable().optional(), // Base64 mask data
    bbox: BoundingBoxSchema.nullable().optional() // Bounding box for instance segmentation
});
// Segmentation schema
var SegmentationSchema = z.object({
    mask_url: z.string().optional(),
    regions: z.array(SegmentationRegionSchema)
});
// Image metadata schema
var ImageMetadataSchema = z.object({
    width: z.number().min(1),
    height: z.number().min(1),
    format: z.string()
});
// CV Results schema
var CVResultsSchema = z.object({
    labels: z.array(ClassificationSchema).optional(),
    detections: z.array(DetectionSchema).optional(),
    segmentation: SegmentationSchema.optional()
});
// Main CV Response schema
var CVResponseSchema = z.object({
    task: z.enum(['detection', 'classification', 'segmentation', 'multi-type']),
    model_version: z.string(),
    processing_time: z.number().min(0),
    timestamp: z.string(),
    image_metadata: ImageMetadataSchema,
    results: CVResultsSchema
});

// Validation functions
var validateImageFile = function (file) {
    try {
        ImageFileSchema.parse({
            type: file.type,
            size: file.size,
            name: file.name
        });
        return { isValid: true };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return { isValid: false, error: error.issues[0].message };
        }
        return { isValid: false, error: 'Invalid file format' };
    }
};
var validateVideoFile = function (file) {
    try {
        VideoFileSchema.parse({
            type: file.type,
            size: file.size,
            name: file.name
        });
        return { isValid: true };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return { isValid: false, error: error.issues[0].message };
        }
        return { isValid: false, error: 'Invalid file format' };
    }
};
var validateMediaFile = function (file) {
    try {
        MediaFileSchema.parse({
            type: file.type,
            size: file.size,
            name: file.name
        });
        // Determine if it's a video file
        var isVideo = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'].includes(file.type);
        return { isValid: true, isVideo: isVideo };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return { isValid: false, error: error.issues[0].message };
        }
        return { isValid: false, error: 'Invalid file format' };
    }
};
var validateCVResponse = function (data) {
    try {
        var validatedData = CVResponseSchema.parse(data);
        return { isValid: true, data: validatedData };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return {
                isValid: false,
                error: "Validation failed: ".concat(error.issues.map(function (e) { return e.message; }).join(', '))
            };
        }
        return { isValid: false, error: 'Invalid response format' };
    }
};

export { BoundingBoxSchema, CVResponseSchema, CVResultsSchema, ClassificationSchema, DetectionSchema, ImageFileSchema, ImageMetadataSchema, MediaFileSchema, SegmentationRegionSchema, SegmentationSchema, VideoFileSchema, validateCVResponse, validateImageFile, validateMediaFile, validateVideoFile };
//# sourceMappingURL=index.esm.js.map
