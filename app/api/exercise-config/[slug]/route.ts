import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { MongoClient } from 'mongodb'

// Local JSON file for testing without MongoDB
const LOCAL_CACHE_PATH = path.join(process.cwd(), 'exercise_configs_cache.json')

interface CachedConfig {
    slug: string
    displayName: string
    config: any
    source: string
    createdAt: string
}

// MongoDB connection (lazy initialized)
let mongoClient: MongoClient | null = null

async function getMongoCollection() {
    const uri = process.env.MONGODB_URI
    if (!uri) return null

    try {
        if (!mongoClient) {
            mongoClient = new MongoClient(uri)
            await mongoClient.connect()
            console.log('✅ Connected to MongoDB')
        }
        return mongoClient.db('mediapose').collection('exercise_configs')
    } catch (e) {
        console.warn('⚠️ MongoDB connection failed:', e)
        return null
    }
}

/**
 * Read local cache (fallback when no MongoDB)
 */
function getLocalCache(): Record<string, CachedConfig> {
    try {
        if (fs.existsSync(LOCAL_CACHE_PATH)) {
            return JSON.parse(fs.readFileSync(LOCAL_CACHE_PATH, 'utf-8'))
        }
    } catch (e) {
        console.warn('⚠️ Could not read local cache:', e)
    }
    return {}
}

/**
 * GET /api/exercise-config/[slug]
 * Check if exercise config exists (MongoDB first, then local cache fallback)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { slug: string } }
) {
    const slug = params.slug.toLowerCase().replace(/\s+/g, '_')
    console.log(`🔍 Looking up: ${slug}`)

    // Try MongoDB first
    const collection = await getMongoCollection()
    if (collection) {
        const doc = await collection.findOne({ slug })
        if (doc) {
            console.log(`✅ Found in MongoDB: ${slug}`)
            // Increment usage count
            await collection.updateOne({ slug }, { $inc: { usageCount: 1 } })
            return NextResponse.json({
                found: true,
                config: doc.config,
                displayName: doc.displayName,
                source: doc.source
            })
        }
    }

    // Fallback to local cache
    const cache = getLocalCache()
    if (cache[slug]) {
        console.log(`✅ Found in local cache: ${slug}`)
        return NextResponse.json({
            found: true,
            config: cache[slug].config,
            displayName: cache[slug].displayName,
            source: cache[slug].source
        })
    }

    console.log(`📭 Not found: ${slug}`)
    return NextResponse.json({ found: false })
}
