'use client';

import React, { useEffect, useRef } from 'react';
import { Detection, SegmentationRegion } from '@lidvizion/cv-validation';
import { formatConfidence } from '../utils';
import { OverlayRendererProps } from '../types';

export default function OverlayRenderer({ 
  detections, 
  segmentation, 
  imageWidth, 
  imageHeight, 
  task 
}: OverlayRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (task === 'segmentation' && segmentation && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Clear previous drawings
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Set canvas dimensions to match the image
      canvas.width = imageWidth;
      canvas.height = imageHeight;

      segmentation.forEach(region => {
        if (region.mask) {
          const img = new Image();
          img.onload = () => {
            // Draw the mask image onto the canvas
            context.drawImage(img, 0, 0, imageWidth, imageHeight);

            // Apply color overlay
            context.globalCompositeOperation = 'source-atop';
            context.fillStyle = `${region.color}80`; // 50% opacity
            context.fillRect(0, 0, imageWidth, imageHeight);
            context.globalCompositeOperation = 'source-over'; // Reset to default

            // Draw bounding box if available for instance segmentation
            if (region.bbox) {
              context.strokeStyle = region.color;
              context.lineWidth = 2;
              context.strokeRect(region.bbox.x, region.bbox.y, region.bbox.width, region.bbox.height);

              // Draw label
              context.fillStyle = region.color;
              const fontSize = 14;
              context.font = `${fontSize}px sans-serif`;
              const text = `${region.class} (${Math.round(region.area * 100)}%)`;
              const textWidth = context.measureText(text).width;
              const textPadding = 5;
              const textX = region.bbox.x;
              const textY = region.bbox.y - textPadding - fontSize;

              context.fillRect(textX, textY, textWidth + 2 * textPadding, fontSize + 2 * textPadding);
              context.fillStyle = 'white';
              context.fillText(text, textX + textPadding, region.bbox.y - textPadding);
            }
          };
          img.src = `data:image/png;base64,${region.mask}`;
        }
      });
    }
  }, [segmentation, imageWidth, imageHeight, task]);

  // Show detection overlays if we have detections, regardless of task type
  if (detections && detections.length > 0) {
    return (
      <div className="absolute inset-0 pointer-events-none">
        {detections.map((detection, index) => {
          // Generate a unique color for each detection
          const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
          const color = colors[index % colors.length];
          
          return (
            <div key={index} className="animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
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
                  <span className="opacity-90 text-xs">({formatConfidence(detection.confidence)})</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (task === 'segmentation' && segmentation && segmentation.length > 0) {
    return (
      <div className="absolute inset-0 pointer-events-none">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
    );
  }

  return null;
}
