# @lidvizion/cv-validation

Computer Vision Validation Schemas - Zod schemas and validation functions for CV data.

## Features

- 🔍 **Type Safety**: Full TypeScript support with Zod schemas
- ✅ **Validation**: Comprehensive validation for CV responses
- 📊 **File Validation**: Validate image and video files
- 🎯 **Multiple Tasks**: Support for detection, classification, and segmentation
- 🛠️ **Easy Integration**: Simple API for validation

## Installation

```bash
npm install @lidvizion/cv-validation
```

## Quick Start

### Validate CV Response

```tsx
import { validateCVResponse, CVResponse } from '@lidvizion/cv-validation';

function processAPIResponse(apiData: unknown): CVResponse | null {
  const validation = validateCVResponse(apiData);
  
  if (validation.isValid) {
    return validation.data;
  } else {
    console.error('Invalid CV response:', validation.error);
    return null;
  }
}
```

### Validate File Upload

```tsx
import { validateImageFile, validateVideoFile, validateMediaFile } from '@lidvizion/cv-validation';

function FileUploader() {
  const handleFileSelect = (file: File) => {
    // Validate any media file
    const mediaValidation = validateMediaFile(file);
    
    if (!mediaValidation.isValid) {
      alert(`Invalid file: ${mediaValidation.error}`);
      return;
    }

    // Check if it's a video
    if (mediaValidation.isVideo) {
      console.log('Processing video file');
    } else {
      console.log('Processing image file');
    }
  };

  return (
    <input 
      type="file" 
      accept="image/*,video/*" 
      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
    />
  );
}
```

### Use Schemas Directly

```tsx
import { 
  DetectionSchema, 
  ClassificationSchema, 
  CVResponseSchema 
} from '@lidvizion/cv-validation';

// Validate individual detection
const detection = DetectionSchema.parse({
  class: 'person',
  confidence: 0.95,
  bbox: { x: 100, y: 200, width: 150, height: 300 }
});

// Validate classification
const classification = ClassificationSchema.parse({
  class: 'cat',
  score: 0.87,
  confidence: 'high'
});
```

## API Reference

### Validation Functions

#### `validateCVResponse(data)`

Validate a complete CV response object.

**Parameters:**
- `data`: Unknown data to validate

**Returns:**
```typescript
{
  isValid: boolean;
  data?: CVResponse;
  error?: string;
}
```

#### `validateImageFile(file)`

Validate an image file.

**Parameters:**
- `file`: File object to validate

**Returns:**
```typescript
{
  isValid: boolean;
  error?: string;
}
```

#### `validateVideoFile(file)`

Validate a video file.

**Parameters:**
- `file`: File object to validate

**Returns:**
```typescript
{
  isValid: boolean;
  error?: string;
}
```

#### `validateMediaFile(file)`

Validate a media file (image or video).

**Parameters:**
- `file`: File object to validate

**Returns:**
```typescript
{
  isValid: boolean;
  error?: string;
  isVideo?: boolean;
}
```

### Schemas

#### `CVResponseSchema`

Main schema for CV responses.

```typescript
{
  task: 'detection' | 'classification' | 'segmentation' | 'multi-type';
  model_version: string;
  processing_time: number;
  timestamp: string;
  image_metadata: {
    width: number;
    height: number;
    format: string;
  };
  results: {
    labels?: Classification[];
    detections?: Detection[];
    segmentation?: Segmentation;
  };
}
```

#### `DetectionSchema`

Schema for object detection results.

```typescript
{
  class: string;
  confidence: number; // 0-1
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

#### `ClassificationSchema`

Schema for image classification results.

```typescript
{
  class: string;
  score: number; // 0-1
  confidence: 'high' | 'medium' | 'low' | 'very_low';
}
```

#### `SegmentationRegionSchema`

Schema for segmentation regions.

```typescript
{
  class: string;
  area: number; // 0-1
  color: string; // hex color
  mask?: string; // base64 mask data
  bbox?: BoundingBox; // for instance segmentation
}
```

### Types

All schemas export corresponding TypeScript types:

```typescript
import type { 
  CVResponse, 
  Detection, 
  Classification, 
  SegmentationRegion,
  ImageMetadata,
  BoundingBox 
} from '@lidvizion/cv-validation';
```

## File Validation Rules

### Image Files
- **Formats**: JPEG, PNG, WebP
- **Size Limit**: 10MB
- **Required Fields**: type, size, name

### Video Files
- **Formats**: MP4, WebM, MOV, AVI
- **Size Limit**: 100MB
- **Required Fields**: type, size, name

## Error Handling

```tsx
import { validateCVResponse } from '@lidvizion/cv-validation';

try {
  const validation = validateCVResponse(apiResponse);
  
  if (validation.isValid) {
    // Use validated data
    processResults(validation.data);
  } else {
    // Handle validation error
    showError(validation.error);
  }
} catch (error) {
  // Handle unexpected errors
  console.error('Validation failed:', error);
}
```

## License

MIT
