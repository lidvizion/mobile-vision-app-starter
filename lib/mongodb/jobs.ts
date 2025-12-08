import { getDatabase } from './connection'
import crypto from 'crypto'

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface InferenceJob {
  _id?: string
  job_id: string
  status: JobStatus
  model_id: string
  inputs: string // base64 image or URL
  parameters?: Record<string, any>
  task?: string
  user_id?: string
  query?: string
  result?: any // Inference results when completed
  error?: string // Error message if failed
  created_at: string
  updated_at: string
  started_at?: string // When Lambda started processing
  completed_at?: string // When Lambda finished processing
  duration_ms?: number // Processing duration in milliseconds
}

/**
 * Create a new inference job in MongoDB
 */
export async function createInferenceJob(params: {
  model_id: string
  inputs: string
  parameters?: Record<string, any>
  task?: string
  user_id?: string
  query?: string
}): Promise<string> {
  const db = await getDatabase()
  const jobId = `job-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  
  const job: InferenceJob = {
    job_id: jobId,
    status: 'pending',
    model_id: params.model_id,
    inputs: params.inputs,
    parameters: params.parameters,
    task: params.task,
    user_id: params.user_id || 'anonymous',
    query: params.query,
    created_at: now,
    updated_at: now,
  }
  
  await db.collection('inference_jobs').insertOne(job)
  console.log(`✅ Created inference job: ${jobId}`)
  
  return jobId
}

/**
 * Update job status to processing
 */
export async function markJobAsProcessing(jobId: string): Promise<void> {
  const db = await getDatabase()
  const now = new Date().toISOString()
  
  await db.collection('inference_jobs').updateOne(
    { job_id: jobId },
    {
      $set: {
        status: 'processing',
        started_at: now,
        updated_at: now,
      },
    }
  )
  
  console.log(`🔄 Marked job as processing: ${jobId}`)
}

/**
 * Update job with completed results
 */
export async function completeJob(
  jobId: string,
  result: any,
  durationMs?: number
): Promise<void> {
  const db = await getDatabase()
  const now = new Date().toISOString()
  
  await db.collection('inference_jobs').updateOne(
    { job_id: jobId },
    {
      $set: {
        status: 'completed',
        result: result,
        completed_at: now,
        updated_at: now,
        ...(durationMs !== undefined && { duration_ms: durationMs }),
      },
    }
  )
  
  console.log(`✅ Completed job: ${jobId} (duration: ${durationMs}ms)`)
}

/**
 * Mark job as failed
 */
export async function failJob(jobId: string, error: string): Promise<void> {
  const db = await getDatabase()
  const now = new Date().toISOString()
  
  await db.collection('inference_jobs').updateOne(
    { job_id: jobId },
    {
      $set: {
        status: 'failed',
        error: error,
        completed_at: now,
        updated_at: now,
      },
    }
  )
  
  console.log(`❌ Failed job: ${jobId} - ${error}`)
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<InferenceJob | null> {
  const db = await getDatabase()
  const job = await db.collection('inference_jobs').findOne({ job_id: jobId })
  
  return job as InferenceJob | null
}

