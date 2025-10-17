# Lid Vizion CV Packages

Modular, npm-ready packages for computer vision applications. Each package is designed to be used independently or together for complete CV workflows.

## Packages

### 🎯 [@lidvizion/cv-detection](./cv-detection/)
**Computer Vision Detection Component**
- Standalone detection processing for BaaS integration
- React hooks for image processing
- Hugging Face Inference API integration
- Support for detection, classification, and segmentation

### 🎨 [@lidvizion/cv-display](./cv-display/)
**Computer Vision Display Component**
- Beautiful bounding boxes and segmentation overlays
- Roboflow-style results display
- Modular components for custom layouts
- Responsive and customizable

### 🎥 [@lidvizion/cv-video-utils](./cv-video-utils/)
**Video Processing Utilities**
- Video snapshot extraction
- File validation for images and videos
- Browser-compatible video processing
- File size formatting and utilities

### ✅ [@lidvizion/cv-validation](./cv-validation/)
**Validation Schemas and Types**
- Zod schemas for CV data validation
- TypeScript types for all CV responses
- File validation functions
- Type-safe data handling

## Quick Start

### Install All Packages

```bash
npm install @lidvizion/cv-detection @lidvizion/cv-display @lidvizion/cv-video-utils @lidvizion/cv-validation
```

### Complete CV Workflow

```tsx
import { useCVDetection } from '@lidvizion/cv-detection';
import { ResultsDisplay } from '@lidvizion/cv-display';
import { extractVideoSnapshot, validateMediaFile } from '@lidvizion/cv-video-utils';
import { validateCVResponse } from '@lidvizion/cv-validation';

function CompleteCVApp() {
  const { processImage, isProcessing } = useCVDetection();
  const [response, setResponse] = useState(null);
  const [image, setImage] = useState(null);

  const handleFileUpload = async (file: File) => {
    // Validate file
    const validation = validateMediaFile(file);
    if (!validation.isValid) {
      alert(`Invalid file: ${validation.error}`);
      return;
    }

    let imageFile = file;

    // Handle video files
    if (validation.isVideo) {
      imageFile = await extractVideoSnapshot(file, 0.5);
    }

    // Process with CV
    const result = await processImage(imageFile);
    
    if (result.success) {
      setResponse(result.data);
      setImage(URL.createObjectURL(imageFile));
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*,video/*" 
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
      />
      
      {response && image && (
        <ResultsDisplay response={response} selectedImage={image} />
      )}
    </div>
  );
}
```

## BaaS Integration Example

```tsx
import { useModelDetection } from '@lidvizion/cv-detection';
import { BoundingBox } from '@lidvizion/cv-display';

function BaaSIntegration() {
  const { processImage } = useModelDetection({
    modelId: 'facebook/detr-resnet-50',
    threshold: 0.7
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
    <div>
      {/* Your custom UI */}
      <button onClick={() => handleDetection(imageFile)}>
        Detect Objects
      </button>
      
      {/* Display results */}
      {detections.map((detection, index) => (
        <BoundingBox
          key={index}
          detection={detection}
          imageWidth={800}
          imageHeight={600}
        />
      ))}
    </div>
  );
}
```

## Development

### Build All Packages

```bash
npm run build:packages
```

### Test All Packages

```bash
npm run test:packages
```

### Publish to NPM

```bash
npm run publish:packages
```

## Environment Variables

```bash
NEXT_PUBLIC_HF_TOKEN=your_huggingface_token_here
```

## License

MIT

## Support

- 📧 Email: info@lidvizion.com
- 🐛 Issues: [GitHub Issues](https://github.com/lidvizion/mobile-vision-app-starter/issues)
- 📖 Docs: [Documentation](https://docs.lidvizion.com)
