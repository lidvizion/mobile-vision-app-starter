'use client';

import React from 'react';
import { Detection } from '@lidvizion/cv-validation';
import { formatConfidence } from '../utils';
import { BoundingBoxProps } from '../types';

export default function BoundingBox({ 
  detection, 
  imageWidth, 
  imageHeight, 
  color = '#FF6B6B',
  showLabel = true,
  showConfidence = true
}: BoundingBoxProps) {
  return (
    <div className="absolute pointer-events-none">
      {/* Bounding box with enhanced styling */}
      <div
        className="absolute border-2 rounded shadow-lg"
        style={{
          borderColor: color,
          backgroundColor: `${color}15`,
          left: `${(detection.bbox.x / imageWidth) * 100}%`,
          top: `${(detection.bbox.y / imageHeight) * 100}%`,
          width: `${(detection.bbox.width / imageWidth) * 100}%`,
          height: `${(detection.bbox.height / imageHeight) * 100}%`,
        }}
      />
      
      {/* Corner indicators for better visibility */}
      <div
        className="absolute w-3 h-3 border-2 rounded-full"
        style={{
          borderColor: color,
          backgroundColor: color,
          left: `${(detection.bbox.x / imageWidth) * 100}%`,
          top: `${(detection.bbox.y / imageHeight) * 100}%`,
          transform: 'translate(-50%, -50%)'
        }}
      />
      <div
        className="absolute w-3 h-3 border-2 rounded-full"
        style={{
          borderColor: color,
          backgroundColor: color,
          left: `${((detection.bbox.x + detection.bbox.width) / imageWidth) * 100}%`,
          top: `${(detection.bbox.y / imageHeight) * 100}%`,
          transform: 'translate(-50%, -50%)'
        }}
      />
      <div
        className="absolute w-3 h-3 border-2 rounded-full"
        style={{
          borderColor: color,
          backgroundColor: color,
          left: `${(detection.bbox.x / imageWidth) * 100}%`,
          top: `${((detection.bbox.y + detection.bbox.height) / imageHeight) * 100}%`,
          transform: 'translate(-50%, -50%)'
        }}
      />
      <div
        className="absolute w-3 h-3 border-2 rounded-full"
        style={{
          borderColor: color,
          backgroundColor: color,
          left: `${((detection.bbox.x + detection.bbox.width) / imageWidth) * 100}%`,
          top: `${((detection.bbox.y + detection.bbox.height) / imageHeight) * 100}%`,
          transform: 'translate(-50%, -50%)'
        }}
      />
      
      {/* Enhanced label with better positioning */}
      {showLabel && (
        <div
          className="absolute text-white text-sm px-3 py-1 rounded-lg font-semibold shadow-lg border"
          style={{
            backgroundColor: color,
            borderColor: color,
            left: `${(detection.bbox.x / imageWidth) * 100}%`,
            top: `${((detection.bbox.y - 35) / imageHeight) * 100}%`,
            transform: 'translateX(-50%)',
            minWidth: 'max-content'
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="capitalize">{detection.class}</span>
            {showConfidence && (
              <span className="opacity-90 text-xs">({formatConfidence(detection.confidence)})</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
