# @lidvizion/cv-display

Computer Vision Display Component - Standalone visualization for bounding boxes, segmentation, and results.

## Features

- 🎨 **Visual Overlays**: Beautiful bounding boxes and segmentation masks
- 📊 **Results Display**: Roboflow-style results with JSON/Classes toggle
- 🎯 **Modular Components**: Use individual components or the complete display
- 🎨 **Customizable**: Easy to style and integrate into any design system
- 📱 **Responsive**: Works on all screen sizes

## Installation

```bash
npm install @lidvizion/cv-display
```

## Quick Start

### Complete Results Display

```tsx
import { ResultsDisplay } from '@lidvizion/cv-display';

function MyApp() {
  const [cvResponse, setCvResponse] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  return (
    <ResultsDisplay 
      response={cvResponse}
      selectedImage={selectedImage}
      className="my-custom-class"
    />
  );
}
```

### Individual Bounding Boxes

```tsx
import { BoundingBox } from '@lidvizion/cv-display';

function ImageWithDetections({ image, detections }) {
  return (
    <div className="relative">
      <img src={image} alt="Processed" />
      {detections.map((detection, index) => (
        <BoundingBox
          key={index}
          detection={detection}
          imageWidth={800}
          imageHeight={600}
          color="#FF6B6B"
          showLabel={true}
          showConfidence={true}
        />
      ))}
    </div>
  );
}
```

### Segmentation Overlay

```tsx
import { SegmentationOverlay } from '@lidvizion/cv-display';

function ImageWithSegmentation({ image, segmentation }) {
  return (
    <div className="relative">
      <img src={image} alt="Processed" />
      <SegmentationOverlay
        regions={segmentation.regions}
        imageWidth={800}
        imageHeight={600}
      />
    </div>
  );
}
```

### Custom Overlay Renderer

```tsx
import { OverlayRenderer } from '@lidvizion/cv-display';

function CustomDisplay({ response, image }) {
  return (
    <div className="relative">
      <img src={image} alt="Processed" />
      <OverlayRenderer
        detections={response.results.detections}
        segmentation={response.results.segmentation?.regions}
        imageWidth={response.image_metadata.width}
        imageHeight={response.image_metadata.height}
        task={response.task}
      />
    </div>
  );
}
```

## API Reference

### `ResultsDisplay`

Complete results display component with Roboflow-style layout.

**Props:**
- `response`: CVResponse object with detection results
- `selectedImage`: Base64 or URL string of the processed image
- `className` (optional): Additional CSS classes

### `BoundingBox`

Individual bounding box component for custom layouts.

**Props:**
- `detection`: Detection object with class, confidence, and bbox
- `imageWidth`: Original image width in pixels
- `imageHeight`: Original image height in pixels
- `color` (optional): Hex color for the bounding box (default: #FF6B6B)
- `showLabel` (optional): Whether to show the class label (default: true)
- `showConfidence` (optional): Whether to show confidence score (default: true)

### `SegmentationOverlay`

Segmentation mask overlay component.

**Props:**
- `regions`: Array of segmentation regions
- `imageWidth`: Original image width in pixels
- `imageHeight`: Original image height in pixels

### `OverlayRenderer`

Combined overlay renderer that handles both detections and segmentation.

**Props:**
- `detections` (optional): Array of detection objects
- `segmentation` (optional): Array of segmentation regions
- `imageWidth`: Original image width in pixels
- `imageHeight`: Original image height in pixels
- `task`: CV task type ('detection', 'classification', 'segmentation', 'multi-type')

## Styling

The components use Tailwind CSS classes and can be customized with your own CSS:

```css
/* Custom bounding box colors */
.my-custom-bounding-box {
  border-color: #your-color;
  background-color: rgba(your-color, 0.1);
}

/* Custom results display */
.my-results-display {
  background: linear-gradient(135deg, #your-bg-1, #your-bg-2);
}
```

## Types

```typescript
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
```

## License

MIT
