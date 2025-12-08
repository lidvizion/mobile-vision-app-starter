/**
 * Standalone Lambda Function for Gemini Vision Inference
 * Supports both API Gateway and Lambda Function URL events
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Lambda Handler
 */
exports.handler = async (event) => {
  console.log('=== Gemini Inference Lambda Started ===');
  
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle OPTIONS (both API Gateway and Function URL)
  const method = event.requestContext?.http?.method || event.httpMethod;
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Parse body
  let body;
  try {
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body || event;
    }
  } catch (e) {
    console.error('Failed to parse body:', e);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON body' })
    };
  }

  const { image, prompt, model = 'gemini-2.0-flash-exp' } = body;

  console.log('Request params:', { model, promptLength: prompt?.length, hasImage: !!image });

  if (!image) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Image is required' })
    };
  }

  if (!prompt) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Prompt is required' })
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not set');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server configuration error' })
    };
  }

  try {
    console.log('Initializing Gemini model:', model);
    const geminiModel = genAI.getGenerativeModel({ model });

    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const mimeType = image.includes(',') 
      ? image.split(',')[0].split(':')[1].split(';')[0]
      : 'image/jpeg';

    console.log('Calling Gemini API...');
    const startTime = Date.now();

    const result = await geminiModel.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ]);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`Gemini API responded in ${duration}s`);

    const text = result.response.text();
    console.log('Response length:', text.length);

    let parsedResponse;
    try {
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedResponse = JSON.parse(cleanText);
      console.log('Parsed successfully');
    } catch (parseError) {
      console.error('Parse error:', parseError.message);
      parsedResponse = { raw: text, detections: [] };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: parsedResponse,
        metadata: {
          model,
          duration: `${duration}s`,
          timestamp: new Date().toISOString(),
        },
      })
    };

  } catch (error) {
    console.error('Lambda Error:', error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        type: error.constructor.name,
      })
    };
  }
};
