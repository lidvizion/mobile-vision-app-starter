import { NextRequest, NextResponse } from 'next/server'

/**
 * Test MongoDB connection and query
 * GET /api/db-test
 */
export async function GET(request: NextRequest) {
    try {
        const { getDatabase } = await import('@/lib/mongodb/connection')
        const { searchValidatedModels } = await import('@/lib/mongodb/validatedModels')

        const db = await getDatabase()

        // Test 1: Check if we can connect
        const collections = await db.listCollections().toArray()

        // Test 2: Count documents in validated_models
        const validatedModelsCount = await db.collection('validated_models').countDocuments()

        // Test 3: Try to search for models
        const searchResults = await searchValidatedModels(['basketball'], undefined, 10)

        // Test 4: Get a sample model
        const sampleModel = await db.collection('validated_models').findOne({})

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            tests: {
                connection: {
                    status: 'SUCCESS',
                    collections: collections.map(c => c.name)
                },
                validatedModelsCollection: {
                    exists: collections.some(c => c.name === 'validated_models'),
                    documentCount: validatedModelsCount
                },
                searchFunction: {
                    resultsCount: searchResults.length,
                    sampleResult: searchResults[0] ? {
                        model_id: searchResults[0].model_id,
                        name: searchResults[0].name,
                        task_type: searchResults[0].task_type
                    } : null
                },
                sampleDocument: sampleModel ? {
                    model_id: sampleModel.model_id,
                    name: sampleModel.name,
                    hasClasses: !!sampleModel.classes
                } : null
            }
        })
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
        }, { status: 500 })
    }
}
