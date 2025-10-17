'use client';

import React, { useEffect, useRef } from 'react';
import { SegmentationRegion } from '@lidvizion/cv-validation';
import { SegmentationOverlayProps } from '../types';

export default function SegmentationOverlay({ 
  regions, 
  imageWidth, 
  imageHeight 
}: SegmentationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (regions && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Clear previous drawings
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Set canvas dimensions to match the image
      canvas.width = imageWidth;
      canvas.height = imageHeight;

      regions.forEach(region => {
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
  }, [regions, imageWidth, imageHeight]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
