# 📱 Mobile Vision App Starter

Cross-platform mobile starter kit in React Native and Flutter for camera-based CV apps. Works with on-device models (TFLite, PyTorch Mobile) or remote APIs. Flexible task switching at runtime.

## 🚀 Key Capabilities

- **Camera capture + gallery upload** - Seamless image input from multiple sources
- **Real-time overlays** - Dynamic rendering of boxes, masks, and labels
- **Task switching** - Runtime switching between detection, classification, segmentation, and multi-mode
- **Secure upload + result history** - Persistent storage with authentication
- **Auth & theming support** - Customizable UI and user management
- **Slim SDK** - Easy integration with any backend

## 🎯 Ideal For

- Rapid mobile app prototyping
- React Native/Flutter devs targeting CV
- App teams needing hybrid local+remote inference
- Cross-platform computer vision applications

## 🖥️ Simulated Web Demo

This repository includes a Next.js web demo that simulates the mobile app experience:

- **Task selector** - Toggle between different CV tasks
- **Gallery of previous results** - Browse and view historical results
- **Dynamic overlay rendering** - See real-time visualizations

## 📋 Tasks Supported

| Task | Description | Output |
|------|-------------|---------|
| **Detection** | Object detection with bounding boxes | Bounding boxes, confidence scores |
| **Classification** | Image classification into categories | Labels, confidence scores |
| **Segmentation** | Image segmentation into regions | Masks, region polygons |

## 🛠️ Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/mobile-vision-app-starter.git
cd mobile-vision-app-starter

# Install dependencies
npm install

# Copy environment variables
cp env.example .env.local

# Start development server
npm run dev
```

### Environment Configuration

Create a `.env.local` file with your configuration:

```env
# API Configuration
NEXT_PUBLIC_LV_API_URL=https://api.landing-ai.com/v1
NEXT_PUBLIC_LV_API_KEY=your_api_key_here
NEXT_PUBLIC_MODEL_SLUG=your_model_slug_here
NEXT_PUBLIC_STORAGE_BUCKET=your_storage_bucket_here

# App Configuration
NEXT_PUBLIC_APP_NAME=Mobile Vision App Starter
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_DEFAULT_TASK=multi-type
```

## 📱 Mobile SDKs

### React Native SDK

```bash
cd sdk/react-native
npm install
```

**Features:**
- Camera capture with `react-native-vision-camera`
- On-device inference with TensorFlow Lite
- Image picker integration
- Real-time overlay rendering

### Flutter SDK

```bash
cd sdk/flutter
flutter pub get
```

**Features:**
- Camera integration with `camera` package
- Gallery upload with `image_picker`
- TFLite Flutter support
- HTTP API integration

### Backend SDK

```bash
cd sdk/backend
npm install
```

**Features:**
- Express.js API server
- File upload handling
- Authentication middleware
- Result storage and retrieval

## 🎨 UI Components

### Task Selector
- Visual task selection with icons
- Real-time task switching
- Task descriptions and capabilities

### Camera Preview
- Drag & drop image upload
- File selection interface
- Processing state indicators

### Overlay Renderer
- Bounding box visualization
- Segmentation mask overlay
- Confidence score labels
- Dynamic positioning

### Results History
- Thumbnail gallery
- Result metadata display
- Task type indicators
- Historical result viewing

## 🔧 API Integration

### Mock Data Structure

```json
{
  "task": "classification",
  "timestamp": "2024-01-15T10:30:00Z",
  "model_version": "v1.2.0",
  "results": {
    "labels": [
      {
        "class": "healthy_skin",
        "score": 0.82,
        "confidence": "high"
      }
    ],
    "detections": [
      {
        "class": "face",
        "confidence": 0.95,
        "bbox": {
          "x": 120,
          "y": 80,
          "width": 200,
          "height": 250
        }
      }
    ],
    "segmentation": {
      "mask_url": "/mock/mask.png",
      "regions": [
        {
          "class": "skin",
          "area": 0.75,
          "color": "#FFB6C1"
        }
      ]
    }
  },
  "processing_time": 1.2,
  "image_metadata": {
    "width": 640,
    "height": 480,
    "format": "jpeg"
  }
}
```

## 🏗️ Architecture

```
mobile-vision-app-starter/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page
├── components/            # React components
│   ├── TaskSelector.tsx   # Task selection UI
│   ├── CameraPreview.tsx  # Camera/upload interface
│   ├── OverlayRenderer.tsx # Overlay visualization
│   ├── ResultsDisplay.tsx # Results presentation
│   └── ResultHistory.tsx  # History management
├── hooks/                 # Custom React hooks
│   ├── useCVTask.ts       # CV task management
│   └── useResultHistory.ts # History state
├── lib/                   # Utility functions
│   └── utils.ts           # Helper functions
├── types/                 # TypeScript definitions
│   └── index.ts           # Type definitions
├── public/                # Static assets
│   ├── mock/              # Mock API responses
│   └── sample/            # Sample images
├── sdk/                   # Mobile SDKs
│   ├── react-native/      # React Native SDK
│   ├── flutter/           # Flutter SDK
│   └── backend/           # Backend SDK
└── app.json               # App manifest
```

## 🎯 Usage Examples

### Basic Task Switching

```typescript
import { useCVTask } from '@/hooks/useCVTask'

function MyComponent() {
  const { currentTask, switchTask, processImage } = useCVTask()
  
  const handleTaskChange = (task: CVTask) => {
    switchTask(task)
  }
  
  const handleImageUpload = async (file: File) => {
    const result = await processImage(file)
    console.log('CV Result:', result)
  }
}
```

### Overlay Rendering

```typescript
import OverlayRenderer from '@/components/OverlayRenderer'

function ImageWithOverlays({ detections, imageWidth, imageHeight }) {
  return (
    <div className="relative">
      <img src="/sample/image.jpg" alt="Processed" />
      <OverlayRenderer
        detections={detections}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        task="detection"
      />
    </div>
  )
}
```

## 🔒 Security Features

- Secure file upload handling
- API key management
- User authentication support
- Result data encryption
- CORS configuration

## 🎨 Theming

The app supports customizable theming through Tailwind CSS:

- Primary color scheme
- Dark/light mode support
- Custom component styling
- Responsive design

## 📊 Performance

- Optimized image processing
- Lazy loading of results
- Efficient overlay rendering
- Minimal bundle size

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@mobilevisionapp.com
- 💬 Discord: [Join our community](https://discord.gg/mobilevisionapp)
- 📖 Documentation: [docs.mobilevisionapp.com](https://docs.mobilevisionapp.com)
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/mobile-vision-app-starter/issues)

## 🙏 Acknowledgments

- TensorFlow Lite team for on-device inference
- React Native and Flutter communities
- Computer vision research community
- Open source contributors

---

