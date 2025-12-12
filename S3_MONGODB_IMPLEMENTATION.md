# S3 + MongoDB Storage Implementation

## ✅ Current Implementation Status

### What's Implemented:

1. **MongoDB Storage** ✅
   - Connection: `lib/mongodb/connection.ts`
   - Jobs collection: `lib/mongodb/jobs.ts`
   - Save API: `app/api/save-inference-result/route.ts`
   - Saves: model_id, query, response, annotations, timestamps

2. **S3 Upload** ✅ (NEW)
   - Upload utility: `lib/s3/upload.ts`
   - Supports: images (base64), videos (buffer)
   - Automatic folder organization: `cv-results/images/` and `cv-results/videos/`
   - Public URLs generated after upload

3. **Enhanced MongoDB Schema** ✅ (UPDATED)
   - Stores S3 URLs instead of base64
   - Organized annotations by type (detections, classifications, segmentations, keypoints)
   - Includes model_provider, task_type, video_url support

### What Was Missing (Now Fixed):

1. ❌ **S3 Upload** → ✅ **Implemented**
2. ❌ **Base64 in MongoDB** → ✅ **Now stores S3 URLs**
3. ❌ **Organized annotations** → ✅ **Now organized by type**
4. ❌ **Video support** → ✅ **Now supports video URLs**

---

## 📋 MongoDB Schema

### Collection: `inference_jobs`

```typescript
{
  _id: ObjectId,
  job_id: string,                    // Unique job identifier
  host: string,                      // 'roboflow' | 'huggingface' | 'google' | 'curated'
  model_provider: string,            // Same as host (explicit provider)
  user_id: string,                   // 'anonymous' | user UUID
  model_id: string,                  // e.g., 'roboflow/YOLOv8-Basketball' or 'microsoft/resnet-50'
  query: string,                     // User's search query
  task_type: string,                 // 'detection' | 'classification' | 'segmentation' | 'keypoint-detection'
  image_url: string,                 // S3 URL (e.g., 'https://bucket.s3.amazonaws.com/cv-results/images/...')
  video_url?: string,                // S3 URL for videos (optional)
  inference_endpoint?: string,        // Roboflow endpoint URL (Roboflow only)
  response: Array<{                   // Backward compatibility
    label: string,
    score: number,
    box?: any,
    keypoints?: any,
    points?: any,
    mask?: any
  }>,
  annotations: {                      // Organized by type
    detections: Array<{...}>,
    classifications: Array<{...}>,
    segmentations: Array<{...}>,
    keypoint_detections: Array<{...}>
  },
  created_at: string,                 // ISO timestamp
  updated_at: string                  // ISO timestamp
}
```

---

## 🔧 Environment Variables Required

Add these to your `.env.local` or AWS Amplify environment variables:

```bash
# S3 Configuration
S3_BUCKET_NAME=your-s3-bucket-name
# OR use NEXT_PUBLIC_STORAGE_BUCKET (already in env.example)

# AWS Credentials
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1

# MongoDB (already configured)
MONGODB_URI=mongodb+srv://...
```

---

## 📦 Dependencies Added

```json
{
  "@aws-sdk/client-s3": "^3.700.0",
  "@aws-sdk/s3-request-presigner": "^3.700.0"
}
```

**Install with:**
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## 🔄 How It Works

### Flow:

1. **User uploads image/video** → Processed by `useCVTask` hook
2. **CV model inference** → Results returned as `CVResponse`
3. **Save to MongoDB**:
   - **If base64 provided**: Upload to S3 first → Get S3 URL
   - **If S3 URL provided**: Use directly
   - Save to MongoDB with S3 URL and organized annotations

### Code Path:

```
useCVTask.ts (processImage)
  ↓
/api/save-inference-result (POST)
  ↓
lib/s3/upload.ts (uploadBase64ToS3)
  ↓
S3 Bucket (cv-results/images/ or cv-results/videos/)
  ↓
MongoDB (inference_jobs collection)
```

---

## 📝 Files Modified/Created

### Created:
- ✅ `lib/s3/upload.ts` - S3 upload utilities

### Modified:
- ✅ `app/api/save-inference-result/route.ts` - Added S3 upload, enhanced schema
- ✅ `hooks/useCVTask.ts` - Pass file info and organized annotations
- ✅ `package.json` - Added AWS SDK dependencies
- ✅ `env.example` - Added S3 configuration

---

## 🧪 Testing

### Test S3 Upload:

1. Set environment variables:
   ```bash
   S3_BUCKET_NAME=your-bucket
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   AWS_REGION=us-east-1
   ```

2. Upload an image through the app
3. Check MongoDB:
   ```javascript
   db.inference_jobs.findOne({}, { sort: { created_at: -1 } })
   ```
4. Verify:
   - `image_url` is an S3 URL (not base64)
   - `annotations` are organized by type
   - `model_provider` and `task_type` are set

### Test MongoDB Storage:

```javascript
// Find recent inference jobs
db.inference_jobs.find({}).sort({ created_at: -1 }).limit(5)

// Find by model
db.inference_jobs.find({ model_id: "microsoft/resnet-50" })

// Find by task type
db.inference_jobs.find({ task_type: "detection" })

// Find by user
db.inference_jobs.find({ user_id: "anonymous" })
```

---

## ⚠️ Important Notes

1. **S3 Bucket Permissions**: Ensure your S3 bucket allows public-read or configure signed URLs
2. **Fallback**: If S3 upload fails, the system falls back to storing base64 (truncated)
3. **Cost**: S3 storage and MongoDB storage will incur costs based on usage
4. **Security**: AWS credentials should be server-side only (never expose to client)

---

## 🚀 Next Steps (Optional Enhancements)

1. **Signed URLs**: Use presigned URLs for private S3 objects
2. **CDN**: Add CloudFront in front of S3 for faster delivery
3. **Image Optimization**: Compress images before S3 upload
4. **Video Processing**: Process videos frame-by-frame and store results
5. **User Authentication**: Replace 'anonymous' with actual user IDs

