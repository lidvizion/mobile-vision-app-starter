import * as react_jsx_runtime from 'react/jsx-runtime';
import { Detection, SegmentationRegion, CVResponse } from '@lidvizion/cv-validation';
export { BoundingBox, CVResponse, CVResults, Classification, Detection, ImageMetadata, SegmentationRegion } from '@lidvizion/cv-validation';
import * as lucide_react from 'lucide-react';
import { ClassValue } from 'clsx';

interface OverlayRendererProps {
    detections?: Detection[];
    segmentation?: SegmentationRegion[];
    imageWidth: number;
    imageHeight: number;
    task: string;
}
interface ResultsDisplayProps {
    response: CVResponse | null;
    selectedImage: string | null;
    className?: string;
}
interface BoundingBoxProps {
    detection: Detection;
    imageWidth: number;
    imageHeight: number;
    color?: string;
    showLabel?: boolean;
    showConfidence?: boolean;
}
interface SegmentationOverlayProps {
    regions: SegmentationRegion[];
    imageWidth: number;
    imageHeight: number;
}

declare function OverlayRenderer({ detections, segmentation, imageWidth, imageHeight, task }: OverlayRendererProps): react_jsx_runtime.JSX.Element | null;

declare function ResultsDisplay({ response, selectedImage, className }: ResultsDisplayProps): react_jsx_runtime.JSX.Element;

declare function BoundingBox({ detection, imageWidth, imageHeight, color, showLabel, showConfidence }: BoundingBoxProps): react_jsx_runtime.JSX.Element;

declare function SegmentationOverlay({ regions, imageWidth, imageHeight }: SegmentationOverlayProps): react_jsx_runtime.JSX.Element;

/**
 * Utility function to merge Tailwind CSS classes
 */
declare function cn(...inputs: ClassValue[]): string;
/**
 * Format timestamp to readable string
 */
declare function formatTimestamp(timestamp: string): string;
/**
 * Format confidence score to percentage
 */
declare function formatConfidence(confidence: number): string;
/**
 * Get task icon component
 */
declare function getTaskIcon(task: string): lucide_react.LucideIcon;
/**
 * Get task color classes
 */
declare function getTaskColor(task: string): string;

export { BoundingBox as BoundingBoxComponent, OverlayRenderer, ResultsDisplay, SegmentationOverlay, cn, formatConfidence, formatTimestamp, getTaskColor, getTaskIcon };
export type { BoundingBoxProps, OverlayRendererProps, ResultsDisplayProps, SegmentationOverlayProps };
