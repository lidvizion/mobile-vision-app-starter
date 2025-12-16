import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { MongoClient } from 'mongodb'

// Local files for testing
const LOCAL_CACHE_PATH = path.join(process.cwd(), 'exercise_configs_cache.json')
const CSV_PATH = path.join(process.cwd(), 'exercise_configs.csv')

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
 * Read local cache
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
 * Write to local cache
 */
function saveLocalCache(cache: Record<string, CachedConfig>): void {
    try {
        fs.writeFileSync(LOCAL_CACHE_PATH, JSON.stringify(cache, null, 2))
        console.log('💾 Saved to local cache:', LOCAL_CACHE_PATH)
    } catch (e) {
        console.warn('⚠️ Could not write local cache:', e)
    }
}

/**
 * Log to CSV (only called after SAVE, not on load - prevents duplicates!)
 */
function logToCSV(slug: string, displayName: string, source: string): void {
    try {
        const timestamp = new Date().toISOString()
        const row = `${timestamp},SAVED,${slug},${displayName},${source}\n`

        if (!fs.existsSync(CSV_PATH)) {
            fs.writeFileSync(CSV_PATH, 'timestamp,action,slug,display_name,source\n')
            console.log('📄 Created CSV:', CSV_PATH)
        }

        fs.appendFileSync(CSV_PATH, row)
        console.log('📝 CSV logged:', displayName)
    } catch (e) {
        console.warn('⚠️ CSV write error:', e)
    }
}

/**
 * POST /api/exercise-config
 * Save a new exercise config (MongoDB first, local cache fallback)
 * CSV is logged ONLY when saving NEW configs, not updates!
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { slug, displayName, config, source = 'gemini' } = body

        if (!slug || !displayName || !config) {
            return NextResponse.json(
                { success: false, error: 'slug, displayName, and config required' },
                { status: 400 }
            )
        }

        const normalizedSlug = slug.toLowerCase().replace(/\s+/g, '_')
        const now = new Date()
        console.log(`💾 Saving exercise config: ${normalizedSlug}`)

        let isNew = true

        // Try MongoDB first
        const collection = await getMongoCollection()
        if (collection) {
            // Check if exists
            const existing = await collection.findOne({ slug: normalizedSlug })
            isNew = !existing

            await collection.updateOne(
                { slug: normalizedSlug },
                {
                    $set: {
                        slug: normalizedSlug,
                        displayName,
                        config,
                        source,
                        updatedAt: now
                    },
                    $setOnInsert: {
                        createdAt: now,
                        usageCount: 0
                    }
                },
                { upsert: true }
            )
            console.log(`✅ Saved to MongoDB: ${normalizedSlug}`)
        } else {
            // Fallback to local cache
            const cache = getLocalCache()
            isNew = !cache[normalizedSlug]

            cache[normalizedSlug] = {
                slug: normalizedSlug,
                displayName,
                config,
                source,
                createdAt: now.toISOString()
            }

            saveLocalCache(cache)
        }

        // Only log to CSV for NEW configs (not updates) - prevents duplicates!
        if (isNew) {
            logToCSV(normalizedSlug, displayName, source)
        } else {
            console.log('ℹ️ Config updated (not new) - skipping CSV')
        }

        return NextResponse.json({
            success: true,
            slug: normalizedSlug,
            isNew,
            storage: collection ? 'mongodb' : 'local_cache'
        })

    } catch (error) {
        console.error('❌ POST error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to save' },
            { status: 500 }
        )
    }
}
