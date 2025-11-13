# Python Roboflow Search Agent Setup

This guide sets up a Python-based Roboflow search agent using Gemini 2.5 Computer Use, following the official documentation.

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
# Install Python packages
pip install google-genai playwright

# Install Playwright browsers
playwright install chromium

# Make setup script executable
chmod +x setup_python_agent.sh
./setup_python_agent.sh
```

### 2. Set Environment Variables

Create a `.env` file with your Gemini API key:

```bash
echo "GEMINI_API_KEY=your_actual_gemini_api_key_here" > .env
```

### 3. Test the Setup

```bash
# Test Python environment
python test_python_agent.py

# Test the search agent directly
python roboflow_search_agent.py
```

### 4. Test via API

```bash
# Test the Node.js API that calls Python
curl -X POST http://localhost:3000/api/model-search \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["basketball detection"],
    "task_type": "detection",
    "limit": 1,
    "page": 1
  }'
```

## 📁 File Structure

```
├── roboflow_search_agent.py          # Main Python agent
├── test_python_agent.py              # Test script
├── requirements.txt                  # Python dependencies
├── setup_python_agent.sh            # Setup script
├── app/api/roboflow-python-search/   # Node.js API wrapper
└── PYTHON_AGENT_SETUP.md            # This guide
```

## 🔧 How It Works

### 1. **Python Agent** (`roboflow_search_agent.py`)
- Uses official Gemini Computer Use API
- Follows the exact documentation pattern
- Performs real browser automation with Playwright
- Extracts actual model data from Roboflow Universe

### 2. **Node.js Integration** (`app/api/model-search/route.ts`)
- Calls Python script via `spawn()`
- Parses JSON output from Python
- Converts to normalized model format
- Provides fallback if Python fails

### 3. **Browser Automation Flow**
1. Navigate to `https://universe.roboflow.com`
2. Search for specified keywords
3. Click on relevant projects
4. Access model pages
5. Extract model details (mAP, precision, recall, etc.)
6. Return structured JSON data

## 🎯 Key Features

- ✅ **Official Documentation Compliance**: Uses exact Gemini Computer Use patterns
- ✅ **Real Browser Automation**: Actually browses Roboflow Universe
- ✅ **Model Data Extraction**: Gets real metrics, tags, classes
- ✅ **Fallback Mechanism**: Graceful degradation if automation fails
- ✅ **Credit Usage**: Uses 10 credits for logged-in users as requested
- ✅ **Robust Error Handling**: Multiple fallback layers

## 🐛 Troubleshooting

### Common Issues

1. **Import Errors**
   ```bash
   pip install --upgrade google-genai playwright
   ```

2. **Playwright Browser Issues**
   ```bash
   playwright install chromium
   ```

3. **API Key Issues**
   ```bash
   # Check if GEMINI_API_KEY is set
   echo $GEMINI_API_KEY
   ```

4. **Python Path Issues**
   ```bash
   # Make sure python3 is available
   which python3
   ```

### Debug Mode

Run with verbose logging:

```bash
# Set debug environment
export DEBUG=1
python roboflow_search_agent.py
```

## 📊 Expected Output

The agent should return JSON like this:

```json
{
  "model_identifier": "basketball-detection-abc123/1",
  "model_name": "Basketball Detection Model",
  "model_url": "https://universe.roboflow.com/basketball-detection-abc123",
  "author": "Roboflow User",
  "mAP": "85.2%",
  "precision": "87.1%",
  "recall": "83.8%",
  "training_images": "250",
  "tags": ["object detection", "sports", "basketball"],
  "classes": ["ball", "player"],
  "description": "High-accuracy basketball detection model",
  "api_endpoint": "https://detect.roboflow.com/basketball-detection-abc123/1"
}
```

## 🔄 Integration with Node.js

The Node.js API automatically:
1. Calls the Python script
2. Parses the JSON output
3. Converts to normalized format
4. Combines with Hugging Face models
5. Returns paginated results

No changes needed to the frontend - it works with the existing API structure.
