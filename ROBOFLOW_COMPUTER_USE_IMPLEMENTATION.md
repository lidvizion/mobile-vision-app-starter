# Roboflow Universe Search with OpenAI Computer Use

## Overview

This implementation uses OpenAI Computer Use to browse Roboflow Universe and extract model information, since Roboflow Universe doesn't have a public search API. The Computer Use agent can actually navigate the website, search for models, and extract metadata.

## Implementation Details

### 1. API Endpoint: `/api/openai-computer-use`

**Purpose**: Use OpenAI Computer Use to browse Roboflow Universe and extract model information

**Request Format**:
```json
{
  "keywords": ["vehicle", "detection"],
  "task_type": "detection", 
  "max_models": 5
}
```

**Response Format**:
```json
{
  "success": true,
  "models": [
    {
      "name": "Vehicle Detection Model",
      "description": "Model for detecting vehicles in traffic",
      "model_url": "https://universe.roboflow.com/model-url",
      "author": "Roboflow Universe",
      "task_type": "detection",
      "classes": ["car", "truck", "bus"],
      "frameworks": ["Roboflow"],
      "platforms": ["web", "mobile"],
      "downloads": 1000,
      "tags": ["computer-use", "browsed", "openai", "detection"]
    }
  ],
  "search_query": "vehicle detection",
  "total_found": 1,
  "processing_time": 5000,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Integration with Model Search

The `searchRoboflowModels` function in `/api/model-search/route.ts` calls the Computer Use API:

```typescript
const computerUseResponse = await fetch('/api/openai-computer-use', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    keywords,
    task_type: taskType || 'detection',
    max_models: 5
  })
})
```

### 3. Computer Use Agent Implementation

The Computer Use agent:

1. **Navigates to Roboflow Universe**: `https://universe.roboflow.com`
2. **Searches for models** using the provided keywords
3. **Filters results** by task type (detection, classification, segmentation)
4. **Extracts model information**:
   - Model name and description
   - Model URL (direct link to model page)
   - Author/creator information
   - Task type and classes
   - Frameworks and platforms supported
   - Download counts and tags

### 4. Model Information Extraction

The `extractModelFromText` function parses the Computer Use response to extract:

- **Model Name**: Extracted from text patterns
- **Description**: Model description from the page
- **Model URL**: Direct links to model pages
- **Author**: Creator information
- **Task Type**: Detection, classification, segmentation
- **Classes**: Objects the model can detect
- **Metadata**: Frameworks, platforms, downloads, tags

### 5. Environment Variables Required

```bash
# OpenAI API Key for Computer Use
OPENAI_API_KEY=your_openai_api_key_here

# Roboflow API Key (for inference)
ROBOFLOW_API_KEY=KJWhVAnYok8rniIdzCbZ
```

### 6. Usage Example

```typescript
// Search for vehicle detection models
const response = await fetch('/api/model-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    keywords: ['vehicle', 'traffic', 'detection'],
    task_type: 'detection',
    limit: 10
  })
})

const data = await response.json()
// Returns both Hugging Face and Roboflow models
```

## Key Features

1. **Real Browser Navigation**: Uses OpenAI Computer Use to actually browse Roboflow Universe
2. **Intelligent Model Extraction**: Parses model information from web pages
3. **Task-Specific Filtering**: Filters models by task type (detection, classification, etc.)
4. **Metadata Preservation**: Extracts classes, frameworks, platforms, and other metadata
5. **Model URL Collection**: Saves direct model endpoints for inference
6. **Integration with Existing Flow**: Works seamlessly with the existing model search system

## Benefits Over API-Based Search

1. **No API Limitations**: Doesn't rely on Roboflow's public API limitations
2. **Real-Time Data**: Gets the most current model information
3. **Rich Metadata**: Extracts comprehensive model information
4. **Direct Model URLs**: Provides direct links to model pages
5. **Flexible Search**: Can search by any keywords or criteria

## Testing

Run the test script to verify the integration:

```bash
node test-computer-use.js
```

Make sure the development server is running:

```bash
npm run dev
```

## Notes

- The Computer Use agent simulates browser actions (clicking, typing, scrolling)
- Model information is extracted from the actual web pages
- The implementation includes safety guidelines to only browse Roboflow Universe
- Model endpoints are properly saved for inference usage
