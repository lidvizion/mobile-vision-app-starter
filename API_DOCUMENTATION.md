# 🚀 Backend API Documentation

## Overview
This document describes the backend API routes for the Vision SDK model discovery and selection flow.

---

## 📍 API Endpoints

### 1. `/api/query-refine` - Query Refinement

**Purpose**: Refine user's natural language input into optimized search keywords

**Method**: `POST`

**Request Body**:
```json
{
  "query": "I want to detect basketball players and shots",
  "userId": "uuid-123" // Optional
}
```

**Response**:
```json
{
  "use_case": "basketball-player-shots",
  "keywords": ["basketball", "player", "shots", "detect"],
  "task_type": "detection",
  "query_id": "query_1234567890_abc123",
  "refined_query": "basketball player shots detect"
}
```

**Features**:
- ✅ Extracts keywords using NLP
- ✅ Identifies task type (detection/classification/segmentation)
- ✅ Generates unique query ID
- ✅ Saves to MongoDB (when connected)
- ✅ Optional OpenAI GPT-mini integration for enhanced refinement

**Example cURL**:
```bash
curl -X POST http://localhost:3000/api/query-refine \
  -H "Content-Type: application/json" \
  -d '{"query": "I want to detect basketball players and shots"}'
```

---

### 2. `/api/model-search` - Model Search

**Purpose**: Search both Roboflow Universe and Hugging Face Hub for relevant models

**Method**: `POST`

**Request Body**:
```json
{
  "keywords": ["basketball", "player", "detection"],
  "task_type": "detection", // Optional
  "limit": 20 // Optional, default: 20
}
```

**Response**:
```json
{
  "models": [
    {
      "name": "Basketball-Detection-YOLOv8",
      "source": "Roboflow",
      "description": "Detects players, ball, and rim in basketball videos",
      "url": "https://universe.roboflow.com/demo/basketball-detection",
      "image": "https://roboflow.com/models/basketball.png",
      "metrics": {
        "mAP": 0.85,
        "FPS": 30,
        "modelSize": "Medium"
      },
      "task": "detection",
      "author": "demo",
      "downloads": 15234,
      "frameworks": ["Roboflow", "TFLite", "ONNX"],
      "platforms": ["mobile", "web", "edge"]
    }
  ],
  "total": 47,
  "sources": {
    "roboflow": 23,
    "huggingface": 24
  }
}
```

**Features**:
- ✅ Parallel search of Roboflow + Hugging Face
- ✅ Normalized response format
- ✅ Smart sorting by relevance and popularity
- ✅ Task-specific filtering
- ✅ Metrics included (mAP, FPS, model size)

**API Queries Used**:

**Roboflow**:
```
GET https://api.roboflow.com/universe/search?query=basketball&type=object-detection&limit=10&api_key=YOUR_KEY
```

**Hugging Face**:
```
GET https://huggingface.co/api/models?search=basketball+object-detection&filter=computer-vision&sort=downloads&limit=10
```

**Example cURL**:
```bash
curl -X POST http://localhost:3000/api/model-search \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["basketball", "player"], "task_type": "detection", "limit": 10}'
```

---

### 3. `/api/save-model-selection` - Save Model Selection

**Purpose**: Save user's selected model for analytics and future reference

**Method**: `POST`

**Request Body**:
```json
{
  "user_id": "uuid-123",
  "query_id": "query_1234567890_abc123",
  "model": {
    "name": "Basketball-Detection-YOLOv8",
    "source": "Roboflow",
    "url": "https://universe.roboflow.com/demo/basketball-detection",
    "task": "detection",
    "description": "Detects players, ball, and rim"
  },
  "session_id": "session_xyz" // Optional
}
```

**Response**:
```json
{
  "status": "success",
  "selection_id": "selection_1234567890_xyz789",
  "redirect": "/setup?model=basketball-detection-yolov8",
  "message": "Model selection saved successfully"
}
```

**Features**:
- ✅ Saves selection to MongoDB
- ✅ Updates user_queries status to 'completed'
- ✅ Generates unique selection ID
- ✅ Returns redirect URL for next step
- ✅ Links selection to original query

**Method**: `GET` (Retrieve Selections)

**Query Parameters**:
- `user_id`: Get all selections for a user
- `query_id`: Get selection for specific query

**Response**:
```json
{
  "selections": [
    {
      "selection_id": "selection_123",
      "model": { ... },
      "timestamp": "2024-01-01T10:00:00Z"
    }
  ],
  "count": 5
}
```

**Example cURL (POST)**:
```bash
curl -X POST http://localhost:3000/api/save-model-selection \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "uuid-123",
    "query_id": "query_abc",
    "model": {
      "name": "Basketball Detection",
      "source": "Roboflow",
      "url": "https://universe.roboflow.com/model"
    }
  }'
```

**Example cURL (GET)**:
```bash
curl "http://localhost:3000/api/save-model-selection?user_id=uuid-123"
```

---

### 4. `/api/search-models` - Legacy Endpoint (Deprecated)

This endpoint is being replaced by `/api/model-search`. It will continue to work but uses the older format.

---

## 🗄️ MongoDB Collections

### 1. `user_queries`

Stores all user search queries and their metadata.

**Schema**:
```typescript
{
  query_id: string (unique)
  user_id: string
  session_id?: string
  original_query: string
  refined_query: string
  keywords: string[]
  task_type: 'detection' | 'classification' | 'segmentation'
  use_case: string
  status: 'pending' | 'searching' | 'completed' | 'abandoned'
  selected_model?: string
  timestamp: Date
  completed_at?: Date
  user_agent?: string
  ip_address?: string
}
```

**Indexes**:
```javascript
db.user_queries.createIndex({ query_id: 1 }, { unique: true })
db.user_queries.createIndex({ user_id: 1, timestamp: -1 })
db.user_queries.createIndex({ status: 1, timestamp: -1 })
db.user_queries.createIndex({ keywords: 1 })
```

---

### 2. `model_selections`

Stores user's model selections.

**Schema**:
```typescript
{
  selection_id: string (unique)
  user_id: string
  query_id: string
  model: {
    name: string
    source: 'Roboflow' | 'Hugging Face'
    url: string
    task: string
  }
  timestamp: Date
  status: 'selected' | 'deployed' | 'active'
}
```

**Indexes**:
```javascript
db.model_selections.createIndex({ selection_id: 1 }, { unique: true })
db.model_selections.createIndex({ user_id: 1, timestamp: -1 })
db.model_selections.createIndex({ query_id: 1 })
db.model_selections.createIndex({ "model.name": 1 })
```

---

### 3. `search_analytics`

Aggregated analytics data.

**Schema**:
```typescript
{
  date: Date
  period: 'daily' | 'weekly' | 'monthly'
  total_searches: number
  successful_searches: number
  top_queries: Array<{ query, count, success_rate }>
  top_models: Array<{ model_name, source, count }>
  task_distribution: { detection, classification, segmentation }
}
```

---

## 🔐 Environment Variables

Add to `.env.local`:

```bash
# Required for model search
NEXT_PUBLIC_ROBOFLOW_API_KEY=your_roboflow_api_key
NEXT_PUBLIC_HUGGINGFACE_API_KEY=your_huggingface_token

# Optional for enhanced query refinement
OPENAI_API_KEY=your_openai_api_key

# MongoDB (for production)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=vision_sdk
```

---

## 🔄 Complete Flow

```
1. User enters query
   ↓
2. POST /api/query-refine
   → Extracts keywords
   → Saves to user_queries
   → Returns query_id + keywords
   ↓
3. POST /api/model-search
   → Searches Roboflow + Hugging Face
   → Returns normalized results
   ↓
4. User selects model
   ↓
5. POST /api/save-model-selection
   → Saves to model_selections
   → Updates user_queries status
   → Returns redirect URL
```

---

## 📊 Analytics Queries

### Get Conversion Rate
```javascript
const totalSearches = await db.collection('user_queries').countDocuments()
const completed = await db.collection('user_queries').countDocuments({ status: 'completed' })
const conversionRate = (completed / totalSearches) * 100
```

### Get Most Popular Models
```javascript
const popularModels = await db.collection('model_selections').aggregate([
  { $group: { _id: '$model.name', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 10 }
]).toArray()
```

### Get Search Trends
```javascript
const trends = await db.collection('user_queries').aggregate([
  {
    $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
      count: { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } }
]).toArray()
```

---

## 🧪 Testing

### Test Query Refine
```bash
curl -X POST http://localhost:3000/api/query-refine \
  -H "Content-Type: application/json" \
  -d '{"query": "I want to detect trash in beach cleanup images"}'
```

### Test Model Search
```bash
curl -X POST http://localhost:3000/api/model-search \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["trash", "detection"], "task_type": "detection"}'
```

### Test Save Selection
```bash
curl -X POST http://localhost:3000/api/save-model-selection \
  -H "Content-Type: application/json" \
  -d '{
    "query_id": "query_123",
    "model": {
      "name": "Trash Detection",
      "source": "Roboflow",
      "url": "https://universe.roboflow.com/model"
    }
  }'
```

---

## 🚀 Production Deployment

### MongoDB Setup
1. Install MongoDB: `npm install mongodb`
2. Set `MONGODB_URI` in environment
3. Uncomment MongoDB code in API routes
4. Create indexes (see schemas)

### OpenAI Integration (Optional)
1. Add `OPENAI_API_KEY` to environment
2. Install: `npm install openai`
3. Uncomment OpenAI code in `/api/query-refine`

---

## 📝 Notes

- All endpoints return JSON
- Errors return `{ error: string, details?: string }`
- IDs are prefixed (`query_`, `selection_`)
- Timestamps are ISO 8601 format
- MongoDB operations are currently stubbed (console.log)
- Ready for MongoDB integration when needed

---

**API Version**: 1.0.0  
**Last Updated**: 2024

