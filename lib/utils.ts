import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString()
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

export function getTaskColor(task: string): string {
  const colors = {
    detection: 'bg-red-500',
    classification: 'bg-blue-500', 
    segmentation: 'bg-green-500',
    'multi-type': 'bg-purple-500'
  }
  return colors[task as keyof typeof colors] || 'bg-gray-500'
}

export function getTaskIcon(task: string): string {
  const icons = {
    detection: '🎯',
    classification: '🏷️',
    segmentation: '🎨',
    'multi-type': '🔄'
  }
  return icons[task as keyof typeof icons] || '❓'
}
