import { MongoClient, Db, ServerApiVersion } from 'mongodb'

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MongoDB URI to .env.local')
}

const uri = process.env.MONGODB_URI
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
let clientPromise: Promise<MongoClient>

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

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise

export async function getDatabase(): Promise<Db> {
  try {
    const client = await clientPromise
    return client.db('vision_sdk')
  } catch (error) {
    console.error('⚠️ MongoDB connection failed:', error instanceof Error ? error.message : error)
    console.warn('Using mock database for development.')
    // Return a mock database for development
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
        })
      })
    } as any
  }
}
