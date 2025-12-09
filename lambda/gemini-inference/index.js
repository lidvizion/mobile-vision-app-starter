/**
 * Standalone Lambda Function for Gemini Vision Inference
 * Supports both API Gateway and Lambda Function URL events
 * 
 * ASYNC JOB PATTERN: If job_id is provided, writes results to MongoDB instead of returning
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MongoClient } = require('mongodb');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// MongoDB connection (cached)
let mongoClient = null;
let mongoPromise = null;

async function getMongoClient() {
  if (mongoClient) return mongoClient;
  
  if (!mongoPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI not configured');
    }
    
    mongoPromise = MongoClient.connect(uri, {
      serverApi: {
        version: require('mongodb').ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
  }
  
  mongoClient = await mongoPromise;
  return mongoClient;
}

async function updateJobInMongoDB(jobId, status, result, error, durationMs) {
  try {
    const client = await getMongoClient();
    const db = client.db('vision_sdk');
    const now = new Date().toISOString();
    
    const update = {
      status,
      updated_at: now,
      ...(status === 'processing' && {
        started_at: now,
      }),
      ...(status === 'completed' && {
        result,
        completed_at: now,
        ...(durationMs !== undefined && { duration_ms: durationMs }),
      }),
      ...(status === 'failed' && {
        error: error || 'Unknown error',
        completed_at: now,
      }),
    };
    
    await db.collection('inference_jobs').updateOne(
      { job_id: jobId },
      { $set: update }
    );
    
    console.log(`✅ Updated job ${jobId} in MongoDB: ${status}`);
  } catch (err) {
    console.error(`❌ Failed to update job ${jobId} in MongoDB:`, err.message);
    throw err;
  }
}

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

  const { job_id, image, prompt, model = 'gemini-2.5-flash-lite' } = body;
  const isAsyncJob = !!job_id;

  console.log('Request params:', { 
    job_id,
    isAsyncJob,
    model, 
    promptLength: prompt?.length, 
    hasImage: !!image 
  });

  // If async job, mark as processing when Lambda starts
  if (isAsyncJob) {
    await updateJobInMongoDB(job_id, 'processing', null, null, null);
  }

  if (!image) {
    if (isAsyncJob) {
      await updateJobInMongoDB(job_id, 'failed', null, 'Image is required', null);
    }
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Image is required' })
    };
  }

  if (!prompt) {
    if (isAsyncJob) {
      await updateJobInMongoDB(job_id, 'failed', null, 'Prompt is required', null);
    }
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Prompt is required' })
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not set');
    if (isAsyncJob) {
      await updateJobInMongoDB(job_id, 'failed', null, 'Server configuration error', null);
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server configuration error' })
    };
  }

  const startTime = Date.now();

  try {
    console.log('Initializing Gemini model:', model);
    const geminiModel = genAI.getGenerativeModel({ model });

    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const mimeType = image.includes(',') 
      ? image.split(',')[0].split(':')[1].split(';')[0]
      : 'image/jpeg';

    console.log('Calling Gemini API...');

    const result = await geminiModel.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ]);

    const durationMs = Date.now() - startTime;
    const duration = durationMs / 1000;
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

    // Prepare result data
    const resultData = parsedResponse.data?.detections || parsedResponse.detections || parsedResponse.data || parsedResponse;

    // If async job, write to MongoDB instead of returning
    if (isAsyncJob) {
      await updateJobInMongoDB(job_id, 'completed', resultData, null, durationMs);
      
      // Return minimal response for async jobs
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          job_id,
          message: 'Job completed. Results written to MongoDB.',
        })
      };
    }

    // Sync mode: return results directly
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
    const durationMs = Date.now() - startTime;
    console.error('Lambda Error:', error.message);
    
    // If async job, update MongoDB with error
    if (isAsyncJob) {
      await updateJobInMongoDB(job_id, 'failed', null, error.message, durationMs).catch(err => {
        console.error('Failed to update job status in MongoDB:', err);
      });
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        type: error.constructor.name,
        ...(isAsyncJob && { job_id }),
      })
    };
  }
};
