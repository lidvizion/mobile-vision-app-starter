import { MongoClient, Db, ServerApiVersion } from 'mongodb'

// Don't throw error during build time - only at runtime
// This allows the build to complete even if MONGODB_URI is not set
const uri = process.env.MONGODB_URI

if (!uri && typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  // Only warn in development, not during build
  console.warn('⚠️ MONGODB_URI environment variable is not set. MongoDB features will be unavailable.')
}
const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
  retryWrites: true,
  // Node.js 24 SSL compatibility fixes
  tls: true,
  tlsAllowInvalidCertificates: false,
  tlsAllowInvalidHostnames: false
}

let client: MongoClient
let clientPromise: Promise<MongoClient> | null = null

// Only create connection if URI is available
if (uri) {
  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    let globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>
      _mongoUri?: string
    }

    // Always create new connection in development to avoid caching issues
    if (!globalWithMongo._mongoClientPromise || globalWithMongo._mongoUri !== uri) {
      console.log('🔄 Creating new MongoDB connection with URI:', uri)
      client = new MongoClient(uri, options)
      globalWithMongo._mongoClientPromise = client.connect()
      globalWithMongo._mongoUri = uri
    }
    clientPromise = globalWithMongo._mongoClientPromise
  } else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri, options)
    clientPromise = client.connect()
  }
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise

let isConnected = false

export async function getDatabase(): Promise<Db> {
  // If no URI is set, return mock database (allows build to succeed)
  if (!uri || !clientPromise) {
    if (!isConnected) {
      console.error('🔴 CRITICAL: MongoDB URI not configured!')
      console.error('🔴 MONGODB_URI env var:', process.env.MONGODB_URI ? 'SET (length: ' + process.env.MONGODB_URI.length + ')' : 'NOT SET')
      console.error('🔴 Using mock database - all queries will return empty results')
      console.error('🔴 FIX: Set MONGODB_URI in AWS Amplify environment variables')
      isConnected = true // Prevent repeated error logs
    }
    return getMockDatabase()
  }

  try {
    const client = await clientPromise
    if (!isConnected) {
      console.log('✅ MongoDB connection successful')
      console.log('✅ Using database: vision_sdk')
      isConnected = true
    }
    return client.db('vision_sdk')
  } catch (error) {
    console.error('🔴 MongoDB connection failed:', error instanceof Error ? error.message : error)
    console.error('🔴 Connection error details:', error)
    console.error('🔴 Using mock database as fallback - all queries will return empty results')
    return getMockDatabase()
  }
}

function getMockDatabase(): Db {
  return {
    collection: (name: string) => ({
      insertOne: async (doc: any) => {
        console.log(`📝 [Mock] Inserted document into ${name}:`, doc._id || doc.query_id || doc.job_id)
        return { insertedId: doc._id || 'mock-id' }
      },
      updateOne: async (filter: any, update: any) => {
        console.log(`📝 [Mock] Updated document in ${name}`)
        return { modifiedCount: 1 }
      },
      findOne: async (query: any) => {
        console.log(`📝 [Mock] FindOne query in ${name}:`, query)
        return null // No cached results in mock
      },
      find: (query: any) => ({
        sort: (sort: any) => ({
          limit: (limit: number) => ({
            toArray: async () => []
          })
        }),
        limit: (limit: number) => ({
          toArray: async () => []
        }),
        toArray: async () => []
      }),
      listCollections: () => ({
        toArray: async () => []
      }),
      countDocuments: async (query?: any) => 0,
      deleteMany: async (query: any) => ({ deletedCount: 0 }),
      deleteOne: async (query: any) => ({ deletedCount: 0 }),
      createIndex: async (keys: any, options?: any) => 'mock-index',
      aggregate: (pipeline: any[]) => ({
        toArray: async () => []
      })
    })
  } as any
}
