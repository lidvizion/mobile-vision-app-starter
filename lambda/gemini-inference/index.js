const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * AWS Lambda handler for Gemini inference
 * Accepts POST requests with { image (base64), prompt, model }
 * Returns parsed bounding box detections
 */
exports.handler = async (event) => {
  const startTime = Date.now();
  const requestId = `gemini_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://cv.lidvizion.ai',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Parse request body
    let body;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: {
            type: 'invalid_request',
            message: 'Invalid JSON in request body',
            retryable: false
          },
          requestId,
          timestamp: new Date().toISOString()
        })
      };
    }

    const { image, prompt, model } = body;

    // Validate required fields
    if (!image) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: {
            type: 'invalid_request',
            message: 'image (base64) is required',
            retryable: false
          },
          requestId,
          timestamp: new Date().toISOString()
        })
      };
    }

    // Validate API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: {
            type: 'configuration_error',
            message: 'Gemini API key not configured',
            retryable: false
          },
          requestId,
          timestamp: new Date().toISOString()
        })
      };
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = model || 'gemini-3-pro-preview';
    const geminiModel = genAI.getGenerativeModel({ model: modelName });

    // Convert base64 to proper format for Gemini
    let imageData;
    let mimeType = 'image/jpeg';

    if (image.startsWith('data:')) {
      // Extract mime type and base64 data
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        imageData = matches[2];
      } else {
        throw new Error('Invalid base64 image format');
      }
    } else {
      // Assume it's raw base64
      imageData = image;
    }

    // Determine task and create appropriate prompt
    const task = body.task || 'object-detection';
    let inferencePrompt = prompt || '';

    if (!inferencePrompt) {
      switch (task) {
        case 'object-detection':
          inferencePrompt = `Analyze this image and detect all objects. For each object found, provide:
1. The object label/class name
2. A confidence score (0-1)
3. The bounding box coordinates as [x_min, y_min, x_max, y_max] normalized to 0-1 range

Return the results as a JSON array with this exact format:
[
  {
    "label": "object_name",
    "score": 0.95,
    "box": {
      "xmin": 0.1,
      "ymin": 0.2,
      "xmax": 0.5,
      "ymax": 0.8
    }
  }
]

IMPORTANT: Return ONLY the JSON array, no additional text or markdown formatting.`;
          break;

        case 'classification':
        case 'image-classification':
          inferencePrompt = `Classify this image. Identify the main subject or category.
Return the results as a JSON array with this exact format:
[
  {
    "label": "category_name",
    "score": 0.95
  }
]

Provide top 5 most likely categories.
IMPORTANT: Return ONLY the JSON array, no additional text or markdown formatting.`;
          break;

        case 'segmentation':
        case 'instance-segmentation':
          inferencePrompt = `Analyze this image and identify all distinct objects/instances for segmentation.
For each instance, provide:
1. The object label
2. A confidence score
3. A description of the object's location

Return as JSON array:
[
  {
    "label": "object_name",
    "score": 0.95,
    "mask": "description of object location and boundaries"
  }
]

IMPORTANT: Return ONLY the JSON array, no additional text or markdown formatting.`;
          break;

        default:
          inferencePrompt = `Analyze this image and provide detailed information about what you see. 
Return the results as a JSON array with detected objects and their properties.`;
      }
    }

    // Call Gemini API
    const result = await geminiModel.generateContent([
      inferencePrompt,
      {
        inlineData: {
          data: imageData,
          mimeType: mimeType
        }
      }
    ]);

    const response = result.response;
    const text = response.text();

    // Parse JSON response
    let results = [];
    try {
      // Remove markdown code blocks if present
      let cleanText = text.trim();
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      results = JSON.parse(cleanText);

      // Ensure it's an array
      if (!Array.isArray(results)) {
        results = [results];
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON, returning raw text:', parseError);
      // If parsing fails, create a simple result structure
      results = [{
        label: 'analysis',
        description: text,
        score: 1.0
      }];
    }

    // Filter results by confidence threshold
    const CONFIDENCE_THRESHOLD = 0.3;
    results = results.filter((result) => {
      const score = result.score || result.confidence || 0;
      return score >= CONFIDENCE_THRESHOLD;
    });

    const duration = Date.now() - startTime;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        model_id: modelName,
        results,
        requestId,
        timestamp: new Date().toISOString(),
        duration
      })
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('Gemini inference failed:', {
      requestId,
      duration,
      error: error.message,
      stack: error.stack
    });

    // Try to get model from body if available
    let modelName = 'gemini-3-pro-preview';
    try {
      const errorBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      modelName = errorBody?.model || modelName;
    } catch (e) {
      // Ignore parse errors
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        model_id: modelName,
        error: {
          type: 'inference_error',
          message: error.message || 'Gemini inference failed',
          retryable: true
        },
        requestId,
        timestamp: new Date().toISOString(),
        duration
      })
    };
  }
};

