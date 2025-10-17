import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Target, Tag, Palette, BarChart3 } from 'lucide-react';

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format timestamp to readable string
 */
export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Format confidence score to percentage
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Get task icon component
 */
export function getTaskIcon(task: string) {
  const icons = {
    detection: Target,
    classification: Tag,
    segmentation: Palette,
    'multi-type': BarChart3
  };
  return icons[task as keyof typeof icons] || BarChart3;
}

/**
 * Get task color classes
 */
export function getTaskColor(task: string) {
  const colors = {
    detection: 'bg-red-50 text-red-700 border-red-200',
    classification: 'bg-blue-50 text-blue-700 border-blue-200',
    segmentation: 'bg-green-50 text-green-700 border-green-200',
    'multi-type': 'bg-purple-50 text-purple-700 border-purple-200'
  };
  return colors[task as keyof typeof colors] || 'bg-gray-50 text-gray-700 border-gray-200';
}
