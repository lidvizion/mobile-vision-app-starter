# @lidvizion/cv-video-utils

Computer Vision Video Utilities - Video processing, snapshot extraction, and file validation.

## Features

- 🎥 **Video Processing**: Extract snapshots from video files
- 📏 **File Validation**: Validate video and image files
- 🎯 **Snapshot Extraction**: Get frames at specific timestamps
- 📊 **File Utilities**: Format file sizes and check file types
- 🛠️ **Browser Compatible**: Works in all modern browsers

## Installation

```bash
npm install @lidvizion/cv-video-utils
```

## Quick Start

### Extract Video Snapshot

```tsx
import { extractVideoSnapshot } from '@lidvizion/cv-video-utils';

function VideoProcessor() {
  const handleVideoUpload = async (videoFile: File) => {
    try {
      // Extract snapshot at 0.5 seconds
      const snapshot = await extractVideoSnapshot(videoFile, 0.5);
      
      // Use the snapshot for CV processing
      console.log('Snapshot extracted:', snapshot.name);
      
      // Convert to base64 for display
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result;
        // Display the snapshot
      };
      reader.readAsDataURL(snapshot);
      
    } catch (error) {
      console.error('Failed to extract snapshot:', error);
    }
  };

  return (
    <input 
      type="file" 
      accept="video/*" 
      onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
    />
  );
}
```

### File Validation

```tsx
import { validateMediaFile, isVideoFile, formatFileSize } from '@lidvizion/cv-video-utils';

function FileUploader() {
  const handleFileSelect = (file: File) => {
    // Validate the file
    const validation = validateMediaFile(file);
    
    if (!validation.isValid) {
      alert(`Invalid file: ${validation.error}`);
      return;
    }

    // Check if it's a video
    if (validation.isVideo) {
      console.log('Video file:', file.name, formatFileSize(file.size));
      // Process video
    } else {
      console.log('Image file:', file.name, formatFileSize(file.size));
      // Process image
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

### Get Video Duration

```tsx
import { getVideoDuration } from '@lidvizion/cv-video-utils';

function VideoInfo({ videoFile }: { videoFile: File }) {
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    getVideoDuration(videoFile)
      .then(setDuration)
      .catch(console.error);
  }, [videoFile]);

  return (
    <div>
      <p>Video: {videoFile.name}</p>
      {duration && <p>Duration: {duration.toFixed(2)} seconds</p>}
    </div>
  );
}
```

## API Reference

### `extractVideoSnapshot(videoFile, timestamp?)`

Extract a snapshot from a video file at a specific timestamp.

**Parameters:**
- `videoFile`: File object of the video
- `timestamp` (optional): Time in seconds to extract snapshot (default: 0.5)

**Returns:** Promise<File> - The extracted image as a File object

### `getVideoDuration(videoFile)`

Get the duration of a video file.

**Parameters:**
- `videoFile`: File object of the video

**Returns:** Promise<number> - Duration in seconds

### `isVideoFile(file)`

Check if a file is a video file.

**Parameters:**
- `file`: File object to check

**Returns:** boolean - True if the file is a video

### `formatFileSize(bytes)`

Format file size in human readable format.

**Parameters:**
- `bytes`: File size in bytes

**Returns:** string - Formatted file size (e.g., "1.5 MB")

### `validateMediaFile(file)`

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

## Supported Formats

### Video Formats
- MP4 (video/mp4)
- WebM (video/webm)
- QuickTime (video/quicktime)
- AVI (video/x-msvideo)

### File Size Limits
- Videos: Up to 100MB
- Images: Up to 10MB

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## License

MIT
