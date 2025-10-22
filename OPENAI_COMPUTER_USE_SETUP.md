# OpenAI Computer Use Setup Guide

This guide explains how to set up OpenAI Computer Use for browsing Roboflow Universe and extracting model information.

## Overview

Since Roboflow Universe doesn't have a public search API, we use **OpenAI Computer Use** to actually browse the website and extract model information. This allows us to find real, up-to-date models from Roboflow Universe.

## Prerequisites

1. **OpenAI Account**: You need an OpenAI account with API access
2. **OpenAI API Key**: Required for Computer Use functionality
3. **Computer Use Access**: Computer Use is in beta and may require special access

## Setup Steps

### 1. Get OpenAI API Key

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Sign in with your OpenAI account
3. Create a new API key or use an existing one
4. Copy the API key

### 2. Configure Environment Variables

Add your OpenAI API key to your `.env.local` file:

```bash
# OpenAI API Key (SERVER-SIDE ONLY - Required for query refinement and Computer Use)
OPENAI_API_KEY=your_actual_openai_api_key_here
```

### 3. Verify Setup

Test the Computer Use integration:

```bash
curl -X POST http://localhost:3001/api/openai-computer-use \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["vehicle", "detection"], 
    "task_type": "detection", 
    "max_models": 3
  }'
```

## How It Works

### 1. **User Query Processing**
- User enters a query (e.g., "detect vehicles in traffic")
- Query is refined using OpenAI to extract keywords and task type
- Keywords are passed to the model search system

### 2. **OpenAI Computer Use Browsing**
- OpenAI Computer Use navigates to [Roboflow Universe](https://universe.roboflow.com)
- Uses the search functionality to find models matching the keywords
- Clicks on model pages to extract detailed information
- Returns structured model data including:
  - Model name and description
  - Model URL and inference endpoint
  - Author and task type
  - Classes, frameworks, and platforms
  - Download counts and tags

### 3. **Model Information Extraction**
- Computer Use extracts model metadata from the website
- Transforms the data into our standardized format
- Saves model endpoints for future inference
- Returns up to 5 relevant models

## API Endpoints

### `/api/openai-computer-use`

**Purpose**: Use OpenAI Computer Use to browse Roboflow Universe

**Request**:
```json
{
  "keywords": ["vehicle", "detection"],
  "task_type": "detection",
  "max_models": 5
}
```

**Response**:
```json
{
  "success": true,
  "models": [
    {
      "name": "Vehicle Detection Model",
      "description": "High-performance vehicle detection",
      "model_url": "https://universe.roboflow.com/...",
      "author": "Roboflow",
      "task_type": "detection",
      "classes": ["car", "truck", "bus"],
      "frameworks": ["Roboflow", "TFLite"],
      "platforms": ["web", "mobile"],
      "downloads": 1500,
      "tags": ["vehicle", "detection", "yolo"]
    }
  ],
  "search_query": "vehicle detection",
  "total_found": 3,
  "processing_time": 15000,
  "timestamp": "2025-01-21T10:30:00.000Z"
}
```

## Integration with Model Search

The OpenAI Computer Use is automatically integrated into the main model search:

1. **Unified Search**: `/api/model-search` calls both Hugging Face API and OpenAI Computer Use
2. **Parallel Processing**: Both searches run simultaneously for faster results
3. **Combined Results**: Results from both sources are merged and ranked
4. **Model Endpoints**: Roboflow model endpoints are saved for inference

## Computer Use Agent (CUA) Loop

The implementation follows the OpenAI Computer Use pattern:

### 1. **Initial Request**
```javascript
const response = await client.responses.create({
  model: "computer-use-preview",
  tools: [{
    type: "computer_use_preview",
    display_width: 1920,
    display_height: 1080,
    environment: "browser"
  }],
  // ... other parameters
})
```

### 2. **Action Execution Loop**
- Receive computer calls (click, type, scroll, etc.)
- Execute actions in the browser environment
- Capture screenshots after each action
- Send screenshots back to the model
- Continue until task completion

### 3. **Model Information Extraction**
- Parse reasoning and text outputs
- Extract model metadata from responses
- Transform to standardized format
- Return structured model information

## Safety and Security

### Computer Use Safety Guidelines

The OpenAI Computer Use implementation includes safety measures:

- **Controlled Browsing**: Only browses Roboflow Universe
- **No External Links**: Doesn't click on external links
- **No Downloads**: Doesn't download any files
- **Respectful Usage**: Follows website terms of service
- **Secure Environment**: Runs in a controlled environment

### Safety Checks

OpenAI Computer Use includes built-in safety checks:

- **Malicious Instruction Detection**: Detects adversarial content
- **Irrelevant Domain Detection**: Ensures relevant browsing
- **Sensitive Domain Detection**: Warns about sensitive sites

### Security Best Practices

1. **API Key Security**: Never expose the OpenAI API key to the client
2. **Rate Limiting**: Respect API rate limits
3. **Error Handling**: Graceful fallback if Computer Use fails
4. **Logging**: Comprehensive logging for debugging
5. **Human Oversight**: Monitor Computer Use actions

## Troubleshooting

### Common Issues

1. **Missing API Key**: Ensure `OPENAI_API_KEY` is set in `.env.local`
2. **API Quota**: Check your OpenAI API quota and billing
3. **Computer Use Access**: Verify you have access to Computer Use features
4. **Rate Limits**: Wait if you hit rate limits
5. **Model Availability**: Computer Use is in beta and may have limited availability

### Debug Logs

Check the console logs for detailed information:

```bash
# Check Computer Use logs
curl -X POST http://localhost:3001/api/openai-computer-use \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["test"], "task_type": "detection"}' \
  -v
```

## Cost Considerations

- **OpenAI API**: Charges per token for Computer Use
- **Computer Use**: More expensive than regular API calls
- **Efficiency**: Only use when needed (Roboflow search)
- **Caching**: Consider caching results to reduce costs

## Limitations

- **Beta Feature**: Computer Use is in beta and may be prone to errors
- **Rate Limits**: Constrained rate limits for the preview model
- **Browser Environment**: Optimized for browser-based tasks
- **Model Mistakes**: May make mistakes, especially in non-browser environments

## Next Steps

1. **Set up your OpenAI API key** following the steps above
2. **Test the integration** with the provided curl command
3. **Monitor usage** and costs in OpenAI dashboard
4. **Optimize queries** to reduce API calls

## Support

- **OpenAI Computer Use Docs**: [https://platform.openai.com/docs/guides/computer-use](https://platform.openai.com/docs/guides/computer-use)
- **OpenAI API Keys**: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Roboflow Universe**: [https://universe.roboflow.com](https://universe.roboflow.com)
