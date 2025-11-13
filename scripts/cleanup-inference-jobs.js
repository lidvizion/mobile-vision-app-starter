require('dotenv').config({ path: '.env.local' })
const { MongoClient } = require('mongodb')

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set')
  process.exit(1)
}

async function cleanupInferenceJobs() {
  const client = new MongoClient(MONGODB_URI)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB\n')
    
    const db = client.db('vision_sdk')
    
    // Clean up old roboflow_inference_jobs (older than 7 days)
    console.log('📊 Cleaning up old roboflow_inference_jobs...')
    const roboflowJobs = db.collection('roboflow_inference_jobs')
    const roboflowCount = await roboflowJobs.countDocuments()
    console.log(`   Current count: ${roboflowCount}`)
    
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    // Delete jobs older than 7 days
    const roboflowResult = await roboflowJobs.deleteMany({
      $or: [
        { created_at: { $lt: sevenDaysAgo.toISOString() } },
        { timestamp: { $lt: sevenDaysAgo.toISOString() } },
        { 'metadata.timestamp': { $lt: sevenDaysAgo.toISOString() } }
      ]
    })
    console.log(`   ✅ Deleted ${roboflowResult.deletedCount} old roboflow_inference_jobs`)
    
    // If still over limit, delete more (keep only last 50)
    const remainingRoboflow = await roboflowJobs.countDocuments()
    if (remainingRoboflow > 50) {
      const toDelete = remainingRoboflow - 50
      const oldestJobs = await roboflowJobs.find({})
        .sort({ created_at: 1, timestamp: 1, 'metadata.timestamp': 1 })
        .limit(toDelete)
        .toArray()
      
      const idsToDelete = oldestJobs.map(job => job._id)
      if (idsToDelete.length > 0) {
        const extraDelete = await roboflowJobs.deleteMany({ _id: { $in: idsToDelete } })
        console.log(`   ✅ Deleted ${extraDelete.deletedCount} additional roboflow_inference_jobs (keeping last 50)`)
      }
    }
    
    // Clean up old hf_inference_jobs (older than 7 days)
    console.log('\n📊 Cleaning up old hf_inference_jobs...')
    const hfJobs = db.collection('hf_inference_jobs')
    const hfCount = await hfJobs.countDocuments()
    console.log(`   Current count: ${hfCount}`)
    
    const hfResult = await hfJobs.deleteMany({
      $or: [
        { created_at: { $lt: sevenDaysAgo.toISOString() } },
        { timestamp: { $lt: sevenDaysAgo.toISOString() } },
        { 'metadata.timestamp': { $lt: sevenDaysAgo.toISOString() } }
      ]
    })
    console.log(`   ✅ Deleted ${hfResult.deletedCount} old hf_inference_jobs`)
    
    // If still over limit, delete more (keep only last 50)
    const remainingHf = await hfJobs.countDocuments()
    if (remainingHf > 50) {
      const toDelete = remainingHf - 50
      const oldestJobs = await hfJobs.find({})
        .sort({ created_at: 1, timestamp: 1, 'metadata.timestamp': 1 })
        .limit(toDelete)
        .toArray()
      
      const idsToDelete = oldestJobs.map(job => job._id)
      if (idsToDelete.length > 0) {
        const extraDelete = await hfJobs.deleteMany({ _id: { $in: idsToDelete } })
        console.log(`   ✅ Deleted ${extraDelete.deletedCount} additional hf_inference_jobs (keeping last 50)`)
      }
    }
    
    // Get updated stats
    console.log('\n📊 Updated Collection Statistics:')
    const roboflowStats = await db.command({ collStats: 'roboflow_inference_jobs' })
    const hfStats = await db.command({ collStats: 'hf_inference_jobs' })
    
    const roboflowSizeMB = ((roboflowStats.storageSize || 0) + (roboflowStats.totalIndexSize || 0)) / (1024 * 1024)
    const hfSizeMB = ((hfStats.storageSize || 0) + (hfStats.totalIndexSize || 0)) / (1024 * 1024)
    
    console.log(`   roboflow_inference_jobs: ${await roboflowJobs.countDocuments()} documents, ${roboflowSizeMB.toFixed(2)} MB`)
    console.log(`   hf_inference_jobs: ${await hfJobs.countDocuments()} documents, ${hfSizeMB.toFixed(2)} MB`)
    console.log(`   Total: ${(roboflowSizeMB + hfSizeMB).toFixed(2)} MB`)
    
    console.log('\n✅ Cleanup completed!')
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  } finally {
    await client.close()
    console.log('✅ MongoDB connection closed')
  }
}

cleanupInferenceJobs()
  .then(() => {
    console.log('\n🎉 All done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Cleanup failed:', error)
    process.exit(1)
  })

