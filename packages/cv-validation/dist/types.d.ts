import { z } from 'zod';
import { CVResponseSchema, CVResultsSchema, DetectionSchema, ClassificationSchema, SegmentationRegionSchema, ImageMetadataSchema, BoundingBoxSchema } from './schemas';
export type CVResponse = z.infer<typeof CVResponseSchema>;
export type CVResults = z.infer<typeof CVResultsSchema>;
export type Detection = z.infer<typeof DetectionSchema>;
export type Classification = z.infer<typeof ClassificationSchema>;
export type SegmentationRegion = z.infer<typeof SegmentationRegionSchema>;
export type ImageMetadata = z.infer<typeof ImageMetadataSchema>;
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;
export * from './schemas';
//# sourceMappingURL=types.d.ts.map