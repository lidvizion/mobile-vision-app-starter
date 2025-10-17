# 🚀 LidVizion CV Packages - Usage Examples

This document demonstrates how to use the modularized LidVizion CV packages in your own projects.

## 📦 Available Packages

### 1. `@lidvizion/cv-detection` - Detection Processing
### 2. `@lidvizion/cv-display` - Results Visualization  
### 3. `@lidvizion/cv-validation` - File Validation
### 4. `@lidvizion/cv-video-utils` - Video Processing

---

## 🎯 **Use Case 1: BaaS Integration - Detection Only**

**Scenario**: You have a BaaS platform and want to add computer vision detection capabilities.

```bash
npm install @lidvizion/cv-detection @lidvizion/cv-validation
```

```typescript
// your-baas-service.ts
import { useCVTask, transformHFToCVResponse } from '@lidvizion/cv-detection';
import { validateMediaFile } from '@lidvizion/cv-validation';

export class BaaSCVService {
  async processImage(imageFile: File, modelId: string) {
    // 1. Validate the file
    const validation = validateMediaFile(imageFile);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // 2. Process with CV detection
    const response = await useCVTask({
      modelId,
      imageFile,
      onSuccess: (result) => {
        console.log('Detection completed:', result);
        return result;
      }
    });

    return response;
  }
}

// Usage in your BaaS API
app.post('/api/detect', async (req, res) => {
  const cvService = new BaaSCVService();
  const result = await cvService.processImage(req.file, 'facebook/detr-resnet-50');
  res.json(result);
});
```

---

## 🎨 **Use Case 2: Frontend Display Only**

**Scenario**: You have detection results from your BaaS and want to display them.

```bash
npm install @lidvizion/cv-display
```

```tsx
// MyApp.tsx
import React from 'react';
import { OverlayRenderer, ResultsDisplay } from '@lidvizion/cv-display';

interface MyAppProps {
  detectionResults: any;
  imageUrl: string;
}

export function MyApp({ detectionResults, imageUrl }: MyAppProps) {
  return (
    <div className="cv-results">
      {/* Display results with overlays */}
      <div className="relative">
        <img src={imageUrl} alt="Analysis" />
        <OverlayRenderer
          detections={detectionResults.detections}
          imageWidth={800}
          imageHeight={600}
          task="detection"
        />
      </div>
      
      {/* Show detailed results */}
      <ResultsDisplay
        response={detectionResults}
        selectedImage={imageUrl}
      />
    </div>
  );
}
```

---

## 🎥 **Use Case 3: Video Processing**

**Scenario**: You want to process videos and extract snapshots.

```bash
npm install @lidvizion/cv-video-utils @lidvizion/cv-validation
```

```typescript
// video-processor.ts
import { extractVideoSnapshot, formatFileSize } from '@lidvizion/cv-video-utils';
import { validateMediaFile } from '@lidvizion/cv-validation';

export class VideoProcessor {
  async processVideo(videoFile: File) {
    // 1. Validate video file
    const validation = validateMediaFile(videoFile);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // 2. Extract snapshot at 0.5 seconds
    const snapshot = await extractVideoSnapshot(videoFile, 0.5);
    
    // 3. Get video info
    const fileSize = formatFileSize(videoFile.size);
    
    return {
      snapshot,
      originalSize: fileSize,
      snapshotName: snapshot.name
    };
  }
}
```

---

## 🔄 **Use Case 4: Complete Integration**

**Scenario**: Full-stack application with detection and display.

```bash
npm install @lidvizion/cv-detection @lidvizion/cv-display @lidvizion/cv-validation @lidvizion/cv-video-utils
```

```tsx
// CompleteCVApp.tsx
import React, { useState } from 'react';
import { useCVTask } from '@lidvizion/cv-detection';
import { OverlayRenderer, ResultsDisplay } from '@lidvizion/cv-display';
import { validateMediaFile } from '@lidvizion/cv-validation';
import { extractVideoSnapshot } from '@lidvizion/cv-video-utils';

export function CompleteCVApp() {
  const [selectedModel, setSelectedModel] = useState('facebook/detr-resnet-50');
  const [results, setResults] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  
  const { processImage, isProcessing } = useCVTask(selectedModel);

  const handleFileUpload = async (file: File) => {
    try {
      // Validate file
      const validation = validateMediaFile(file);
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }

      let fileToProcess = file;
      
      // Handle video files
      if (validation.isVideo) {
        fileToProcess = await extractVideoSnapshot(file, 0.5);
      }

      // Process with CV
      const response = await processImage(fileToProcess);
      setResults(response);
      
      // Set image URL for display
      const reader = new FileReader();
      reader.onload = (e) => setImageUrl(e.target.result);
      reader.readAsDataURL(fileToProcess);
      
    } catch (error) {
      console.error('Processing failed:', error);
    }
  };

  return (
    <div className="cv-app">
      <input 
        type="file" 
        accept="image/*,video/*"
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
      />
      
      {isProcessing && <div>Processing...</div>}
      
      {results && imageUrl && (
        <div className="results">
          <div className="relative">
            <img src={imageUrl} alt="Analysis" />
            <OverlayRenderer
              detections={results.detections}
              imageWidth={800}
              imageHeight={600}
              task={results.task}
            />
          </div>
          
          <ResultsDisplay
            response={results}
            selectedImage={imageUrl}
          />
        </div>
      )}
    </div>
  );
}
```

---

## 🏗️ **Use Case 5: Custom BaaS Workflow**

**Scenario**: You want to create a custom workflow in your BaaS platform.

```typescript
// custom-workflow.ts
import { useCVTask, ModelMetadata } from '@lidvizion/cv-detection';
import { validateMediaFile } from '@lidvizion/cv-validation';

export class CustomCVWorkflow {
  private models: ModelMetadata[] = [
    { id: 'facebook/detr-resnet-50', name: 'DETR ResNet-50', task: 'detection' },
    { id: 'microsoft/resnet-50', name: 'ResNet-50', task: 'classification' }
  ];

  async runWorkflow(input: {
    file: File;
    workflowType: 'detection' | 'classification';
    customParams?: any;
  }) {
    // 1. Validate input
    const validation = validateMediaFile(input.file);
    if (!validation.isValid) {
      throw new Error(`Invalid file: ${validation.error}`);
    }

    // 2. Select appropriate model
    const model = this.models.find(m => m.task === input.workflowType);
    if (!model) {
      throw new Error(`No model found for ${input.workflowType}`);
    }

    // 3. Process with CV
    const { processImage } = useCVTask(model);
    const result = await processImage(input.file);

    // 4. Apply custom business logic
    const processedResult = this.applyBusinessLogic(result, input.customParams);

    return {
      workflowId: this.generateWorkflowId(),
      model: model.name,
      result: processedResult,
      timestamp: new Date().toISOString()
    };
  }

  private applyBusinessLogic(result: any, params?: any) {
    // Your custom business logic here
    return {
      ...result,
      customField: params?.customValue || 'default'
    };
  }

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

## 📱 **Use Case 6: React Native Integration**

**Scenario**: Mobile app with camera capture and CV processing.

```bash
npm install @lidvizion/cv-detection @lidvizion/cv-display
```

```tsx
// MobileCVScreen.tsx
import React, { useState } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { useCVTask } from '@lidvizion/cv-detection';
import { OverlayRenderer } from '@lidvizion/cv-display';

export function MobileCVScreen() {
  const [capturedImage, setCapturedImage] = useState(null);
  const [results, setResults] = useState(null);
  
  const { processImage, isProcessing } = useCVTask('facebook/detr-resnet-50');

  const handleCameraCapture = async (imageUri: string) => {
    try {
      // Convert image URI to File object
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const file = new File([blob], 'captured.jpg', { type: 'image/jpeg' });

      // Process with CV
      const result = await processImage(file);
      setResults(result);
      setCapturedImage(imageUri);
    } catch (error) {
      console.error('Processing failed:', error);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity onPress={() => handleCameraCapture('camera://capture')}>
        <Text>Capture Image</Text>
      </TouchableOpacity>
      
      {capturedImage && (
        <View style={{ position: 'relative' }}>
          <Image source={{ uri: capturedImage }} style={{ width: 300, height: 300 }} />
          {results && (
            <OverlayRenderer
              detections={results.detections}
              imageWidth={300}
              imageHeight={300}
              task="detection"
            />
          )}
        </View>
      )}
      
      {isProcessing && <Text>Processing...</Text>}
    </View>
  );
}
```

---

## 🔧 **Package Configuration**

### TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  }
}
```

### Build Configuration
```json
// package.json
{
  "dependencies": {
    "@lidvizion/cv-detection": "^1.0.0",
    "@lidvizion/cv-display": "^1.0.0",
    "@lidvizion/cv-validation": "^1.0.0",
    "@lidvizion/cv-video-utils": "^1.0.0"
  }
}
```

---

## 🚀 **Publishing to NPM**

When ready to publish:

```bash
# Build all packages
npm run build --workspaces

# Publish to NPM
cd packages/cv-detection && npm publish
cd packages/cv-display && npm publish
cd packages/cv-validation && npm publish
cd packages/cv-video-utils && npm publish
```

---

## ✅ **Verification Checklist**

- [ ] All packages build successfully
- [ ] TypeScript declarations are generated
- [ ] ES modules and CommonJS outputs work
- [ ] Cross-package dependencies resolve correctly
- [ ] Components render without errors
- [ ] Hooks work in different frameworks
- [ ] Validation functions work with various file types
- [ ] Video utilities handle different formats
- [ ] Error handling is comprehensive
- [ ] Documentation is complete

This modular approach allows developers to use only the components they need, making integration into existing projects seamless and efficient! 🎉
