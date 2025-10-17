# @lidvizion/cv-detection

Computer Vision Detection Component - Standalone detection processing for BaaS integration.

## Features

- 🎯 **Object Detection**: Process images with Hugging Face models
- 🔄 **Real-time Processing**: Async image processing with React Query
- 📊 **Multiple Tasks**: Support for detection, classification, and segmentation
- 🛠️ **BaaS Ready**: Perfect for Backend-as-a-Service integration
- 📱 **TypeScript**: Full TypeScript support with comprehensive types

## Installation

```bash
npm install @lidvizion/cv-detection
```

## Quick Start

### Basic Detection

```tsx
import { useCVDetection } from '@lidvizion/cv-detection';

function MyComponent() {
  const { processImage, isProcessing, error } = useCVDetection();

  const handleImageUpload = async (file: File) => {
    const result = await processImage(file);
    
    if (result.success) {
      console.log('Detections:', result.data?.results.detections);
    } else {
      console.error('Error:', result.error);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*" 
        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
      />
      {isProcessing && <p>Processing...</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

### BaaS Integration

```tsx
import { useModelDetection } from '@lidvizion/cv-detection';

function BaaSIntegration() {
  const { processImage, isProcessing } = useModelDetection({
    modelId: 'facebook/detr-resnet-50',
    threshold: 0.7,
    parameters: {
      threshold: 0.7,
      max_detections: 10
    }
  });

  const handleDetection = async (imageFile: File) => {
    const result = await processImage(imageFile);
    
    if (result.success) {
      // Send to your BaaS backend
      await fetch('/api/save-detection', {
        method: 'POST',
        body: JSON.stringify({
          detections: result.data?.results.detections,
          imageId: 'user-upload-123'
        })
      });
    }
  };

  return (
    <button 
      onClick={() => handleDetection(imageFile)}
      disabled={isProcessing}
    >
      {isProcessing ? 'Processing...' : 'Detect Objects'}
    </button>
  );
}
```

## API Reference

### `useCVDetection(selectedModel?)`

Hook for computer vision detection tasks.

**Parameters:**
- `selectedModel` (optional): ModelMetadata object with model configuration

**Returns:**
- `currentTask`: Current CV task type
- `switchTask`: Function to switch between tasks
- `processImage`: Function to process an image file
- `isProcessing`: Boolean indicating if processing is in progress
- `error`: Any error that occurred during processing

### `useModelDetection(config)`

Hook for processing images with a specific model configuration.

**Parameters:**
- `config`: DetectionConfig object with model and parameter configuration

**Returns:**
- `processImage`: Function to process an image file
- `isProcessing`: Boolean indicating if processing is in progress
- `error`: Any error that occurred during processing

## Types

```typescript
interface DetectionConfig {
  modelId: string;
  threshold?: number;
  topK?: number;
  parameters?: Record<string, any>;
}

interface DetectionResult {
  success: boolean;
  data?: CVResponse;
  error?: string;
  processingTime?: number;
}
```

## Environment Variables

```bash
NEXT_PUBLIC_HF_TOKEN=your_huggingface_token_here
```

## License

MIT
