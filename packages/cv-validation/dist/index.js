'use strict';

var zod = require('zod');

// Image file validation
var ImageFileSchema = zod.z.object({
    type: zod.z.string().refine(function (type) { return ['image/jpeg', 'image/png', 'image/webp'].includes(type); }, { message: 'Only JPEG, PNG, and WebP files are supported' }),
    size: zod.z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
    name: zod.z.string().min(1, 'File name is required')
});
// Video file validation
var VideoFileSchema = zod.z.object({
    type: zod.z.string().refine(function (type) { return ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'].includes(type); }, { message: 'Only MP4, WebM, MOV, and AVI files are supported' }),
    size: zod.z.number().max(100 * 1024 * 1024, 'File size must be less than 100MB'),
    name: zod.z.string().min(1, 'File name is required')
});
// Combined media file validation
var MediaFileSchema = zod.z.union([ImageFileSchema, VideoFileSchema]);
// Bounding box schema
var BoundingBoxSchema = zod.z.object({
    x: zod.z.number().min(0),
    y: zod.z.number().min(0),
    width: zod.z.number().min(0),
    height: zod.z.number().min(0)
});
// Detection result schema
var DetectionSchema = zod.z.object({
    class: zod.z.string(),
    confidence: zod.z.number().min(0).max(1),
    bbox: BoundingBoxSchema
});
// Classification result schema
var ClassificationSchema = zod.z.object({
    class: zod.z.string(),
    score: zod.z.number().min(0).max(1),
    confidence: zod.z.enum(['high', 'medium', 'low', 'very_low'])
});
// Segmentation region schema
var SegmentationRegionSchema = zod.z.object({
    class: zod.z.string(),
    area: zod.z.number().min(0).max(1),
    color: zod.z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color'),
    mask: zod.z.string().nullable().optional(), // Base64 mask data
    bbox: BoundingBoxSchema.nullable().optional() // Bounding box for instance segmentation
});
// Segmentation schema
var SegmentationSchema = zod.z.object({
    mask_url: zod.z.string().optional(),
    regions: zod.z.array(SegmentationRegionSchema)
});
// Image metadata schema
var ImageMetadataSchema = zod.z.object({
    width: zod.z.number().min(1),
    height: zod.z.number().min(1),
    format: zod.z.string()
});
// CV Results schema
var CVResultsSchema = zod.z.object({
    labels: zod.z.array(ClassificationSchema).optional(),
    detections: zod.z.array(DetectionSchema).optional(),
    segmentation: SegmentationSchema.optional()
});
// Main CV Response schema
var CVResponseSchema = zod.z.object({
    task: zod.z.enum(['detection', 'classification', 'segmentation', 'multi-type']),
    model_version: zod.z.string(),
    processing_time: zod.z.number().min(0),
    timestamp: zod.z.string(),
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
        if (error instanceof zod.z.ZodError) {
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
        if (error instanceof zod.z.ZodError) {
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
        if (error instanceof zod.z.ZodError) {
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
        if (error instanceof zod.z.ZodError) {
            return {
                isValid: false,
                error: "Validation failed: ".concat(error.issues.map(function (e) { return e.message; }).join(', '))
            };
        }
        return { isValid: false, error: 'Invalid response format' };
    }
};

exports.BoundingBoxSchema = BoundingBoxSchema;
exports.CVResponseSchema = CVResponseSchema;
exports.CVResultsSchema = CVResultsSchema;
exports.ClassificationSchema = ClassificationSchema;
exports.DetectionSchema = DetectionSchema;
exports.ImageFileSchema = ImageFileSchema;
exports.ImageMetadataSchema = ImageMetadataSchema;
exports.MediaFileSchema = MediaFileSchema;
exports.SegmentationRegionSchema = SegmentationRegionSchema;
exports.SegmentationSchema = SegmentationSchema;
exports.VideoFileSchema = VideoFileSchema;
exports.validateCVResponse = validateCVResponse;
exports.validateImageFile = validateImageFile;
exports.validateMediaFile = validateMediaFile;
exports.validateVideoFile = validateVideoFile;
//# sourceMappingURL=index.js.map
