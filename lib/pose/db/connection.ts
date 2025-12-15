import { MongoClient, Db, ServerApiVersion } from 'mongodb'

const uri = process.env.MONGODB_URI

let client: MongoClient | null = null
let clientPromise: Promise<MongoClient> | null = null

/**
 * Get MongoDB client singleton
 * Uses cached connection in development to handle HMR
 */
export async function getMongoClient(): Promise<MongoClient> {
    if (!uri) {
        throw new Error('MONGODB_URI environment variable is not set')
    }

    if (process.env.NODE_ENV === 'development') {
        // In development, use global variable for HMR compatibility
        const globalWithMongo = global as typeof globalThis & {
            _mongoClientPromise?: Promise<MongoClient>
        }

        if (!globalWithMongo._mongoClientPromise) {
            client = new MongoClient(uri, {
                serverApi: {
                    version: ServerApiVersion.v1,
                    strict: true,
                    deprecationErrors: true,
                },
            })
            globalWithMongo._mongoClientPromise = client.connect()
        }
        clientPromise = globalWithMongo._mongoClientPromise
    } else {
        // In production, create new connection
        if (!clientPromise) {
            client = new MongoClient(uri, {
                serverApi: {
                    version: ServerApiVersion.v1,
                    strict: true,
                    deprecationErrors: true,
                },
            })
            clientPromise = client.connect()
        }
    }

    return clientPromise
}

/**
 * Get the mediapose database
 */
export async function getDatabase(): Promise<Db> {
    const client = await getMongoClient()
    return client.db('mediapose')
}
