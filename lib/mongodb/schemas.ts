/**
 * MongoDB Schema Definitions
 * Collections: user_queries, model_recommendations, user_model_selection, inference_results
 */

// ============================================
// 1. USER_QUERIES COLLECTION
// ============================================

export interface UserQuery {
  _id: string // uuid-query-789
  user_id: string // uuid-123
  query_text: string // Original user query
  keywords: string[] // Extracted keywords
  task_type: string // detection, classification, segmentation
  created_at: string // ISO 8601 timestamp
}

/**
 * Example:
 * {
 *   "_id": "uuid-query-789",
 *   "user_id": "uuid-123",
 *   "query_text": "I want to detect basketball shots and players",
 *   "keywords": ["basketball", "player", "rim", "ball", "shot"],
 *   "task_type": "detection",
 *   "created_at": "2025-10-10T12:00:00Z"
 * }
 */

/**
 * MongoDB Indexes for user_queries:
 * 
 * db.user_queries.createIndex({ _id: 1 }, { unique: true })
 * db.user_queries.createIndex({ user_id: 1, created_at: -1 })
 * db.user_queries.createIndex({ keywords: 1 })
 * db.user_queries.createIndex({ task_type: 1 })
 * db.user_queries.createIndex({ created_at: -1 })
 */

// ============================================
// 2. MODEL_RECOMMENDATIONS COLLECTION
// ============================================

export interface ModelRecommendation {
  _id: string // uuid-modelrec-001
  query_id: string // Reference to user_queries._id
  models: Array<{
    name: string
    model_id?: string // Full model ID (e.g., Falconsai/nsfw_image_detection)
    source: 'Roboflow' | 'Hugging Face'
    task: string
    classes?: string[] // Expected output classes/labels (e.g., ["normal", "nsfw"])
    metrics: {
      mAP?: number
      accuracy?: number
      FPS?: number
      modelSize?: string
    }
    url: string
    selected: boolean
  }>
  created_at: string // ISO 8601 timestamp
}

/**
 * Example:
 * {
 *   "_id": "uuid-modelrec-001",
 *   "query_id": "uuid-query-789",
 *   "models": [
 *     {
 *       "name": "nsfw_image_detection",
 *       "model_id": "Falconsai/nsfw_image_detection",
 *       "source": "Hugging Face",
 *       "task": "classification",
 *       "classes": ["normal", "nsfw"],
 *       "metrics": { "accuracy": 0.95 },
 *       "url": "https://huggingface.co/Falconsai/nsfw_image_detection",
 *       "selected": false
 *     }
 *   ],
 *   "created_at": "2025-10-10T12:01:00Z"
 * }
 */

/**
 * MongoDB Indexes for model_recommendations:
 * 
 * db.model_recommendations.createIndex({ _id: 1 }, { unique: true })
 * db.model_recommendations.createIndex({ query_id: 1 })
 * db.model_recommendations.createIndex({ created_at: -1 })
 * db.model_recommendations.createIndex({ "models.name": 1 })
 * db.model_recommendations.createIndex({ "models.source": 1 })
 * 
 * // Compound indexes for performance optimization
 * db.model_recommendations.createIndex({ "models.task": 1, "models.source": 1, created_at: -1 })
 * db.model_recommendations.createIndex({ query_id: 1, created_at: -1 })
 */

// ============================================
// 3. USER_MODEL_SELECTION COLLECTION
// ============================================

export interface UserModelSelection {
  _id: string // uuid-select-222
  user_id: string // uuid-123
  query_id: string // Reference to user_queries._id
  model_name: string // Name of selected model
  source: 'Roboflow' | 'Hugging Face'
  selected_at: string // ISO 8601 timestamp
}

/**
 * Example:
 * {
 *   "_id": "uuid-select-222",
 *   "user_id": "uuid-123",
 *   "query_id": "uuid-query-789",
 *   "model_name": "Basketball-Detection-YOLOv8",
 *   "source": "Roboflow",
 *   "selected_at": "2025-10-10T12:02:00Z"
 * }
 */

/**
 * MongoDB Indexes for user_model_selection:
 * 
 * db.user_model_selection.createIndex({ _id: 1 }, { unique: true })
 * db.user_model_selection.createIndex({ user_id: 1, selected_at: -1 })
 * db.user_model_selection.createIndex({ query_id: 1 })
 * db.user_model_selection.createIndex({ model_name: 1 })
 * db.user_model_selection.createIndex({ source: 1 })
 * db.user_model_selection.createIndex({ selected_at: -1 })
 */


// ============================================
// 4. HF_INFERENCE_JOBS COLLECTION (for inference caching)
// ============================================

export interface HFInferenceJob {
  _id: string // uuid-job-123
  user_id: string // uuid-xyz
  model_id: string // roboflow/YOLOv8-Basketball-Detection
  query: string // basketball player shot detection
  image_url: string // https://lidvizion-signed-url.s3.amazonaws.com/sample.jpg
  response: Array<{
    label: string
    score: number
    box?: {
      xmin: number
      ymin: number
      xmax: number
      ymax: number
    }
  }>
  created_at: string // ISO 8601 timestamp
}

/**
 * Example:
 * {
 *   "_id": "uuid-job-123",
 *   "user_id": "uuid-xyz",
 *   "model_id": "roboflow/YOLOv8-Basketball-Detection",
 *   "query": "basketball player shot detection",
 *   "image_url": "https://lidvizion-signed-url.s3.amazonaws.com/sample.jpg",
 *   "response": [
 *     {"label": "basketball_player", "score": 0.97},
 *     {"label": "ball", "score": 0.92}
 *   ],
 *   "created_at": "2025-10-10T17:00:00Z"
 * }
 */

/**
 * MongoDB Indexes for hf_inference_jobs:
 * 
 * db.hf_inference_jobs.createIndex({ _id: 1 }, { unique: true })
 * db.hf_inference_jobs.createIndex({ user_id: 1, created_at: -1 })
 * db.hf_inference_jobs.createIndex({ model_id: 1 })
 * db.hf_inference_jobs.createIndex({ query: 1 })
 * db.hf_inference_jobs.createIndex({ created_at: -1 })
 * 
 * // Compound index for cache lookups
 * db.hf_inference_jobs.createIndex({ model_id: 1, image_url: 1 })
 */

// ============================================
// MONGODB CONNECTION EXAMPLE
// ============================================

/**
 * Example MongoDB connection setup:
 * 
 * import { MongoClient } from 'mongodb'
 * 
 * let cachedClient: MongoClient | null = null
 * 
 * export async function connectToDatabase() {
 *   if (cachedClient) {
 *     return cachedClient
 *   }
 * 
 *   const client = new MongoClient(process.env.MONGODB_URI!)
 *   await client.connect()
 *   cachedClient = client
 *   
 *   return client
 * }
 * 
 * export async function getDatabase() {
 *   const client = await connectToDatabase()
 *   return client.db(process.env.MONGODB_DB_NAME || 'vision_sdk')
 * }
 * 
 * // Usage in API routes:
 * const db = await getDatabase()
 * await db.collection('user_queries').insertOne(queryRecord)
 */

// ============================================
// ANALYTICS QUERIES
// ============================================

/**
 * Example analytics queries with new schema:
 * 
 * // 1. Get conversion rate (queries → selections)
 * const totalQueries = await db.collection('user_queries').countDocuments()
 * const totalSelections = await db.collection('user_model_selection').countDocuments()
 * const conversionRate = (totalSelections / totalQueries) * 100
 * 
 * // 2. Get most popular models
 * const popularModels = await db.collection('user_model_selection').aggregate([
 *   { $group: { _id: '$model_name', count: { $sum: 1 }, source: { $first: '$source' } } },
 *   { $sort: { count: -1 } },
 *   { $limit: 10 }
 * ]).toArray()
 * 
 * // 3. Get search trends over time
 * const trends = await db.collection('user_queries').aggregate([
 *   {
 *     $group: {
 *       _id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$created_at' } } },
 *       count: { $sum: 1 }
 *     }
 *   },
 *   { $sort: { _id: 1 } }
 * ]).toArray()
 * 
 * // 4. Get task type distribution
 * const taskDistribution = await db.collection('user_queries').aggregate([
 *   { $group: { _id: '$task_type', count: { $sum: 1 } } },
 *   { $sort: { count: -1 } }
 * ]).toArray()
 * 
 * // 5. Get user's query history with selections
 * const userHistory = await db.collection('user_queries').aggregate([
 *   { $match: { user_id: 'uuid-123' } },
 *   {
 *     $lookup: {
 *       from: 'user_model_selection',
 *       localField: '_id',
 *       foreignField: 'query_id',
 *       as: 'selection'
 *     }
 *   },
 *   { $sort: { created_at: -1 } }
 * ]).toArray()
 * 
 * // 6. Get model recommendations with selection status
 * const recommendations = await db.collection('model_recommendations').findOne({ query_id: 'uuid-query-789' })
 */

