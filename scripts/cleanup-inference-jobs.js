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
    const inferenceJobs = db.collection('inference_jobs')
    
    // Get current counts by host
    const totalCount = await inferenceJobs.countDocuments()
    const roboflowCount = await inferenceJobs.countDocuments({ host: 'roboflow' })
    const huggingfaceCount = await inferenceJobs.countDocuments({ host: 'huggingface' })
    
    console.log('📊 Current inference_jobs statistics:')
    console.log(`   Total: ${totalCount}`)
    console.log(`   - roboflow: ${roboflowCount}`)
    console.log(`   - huggingface: ${huggingfaceCount}`)
    
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    // Clean up old inference jobs (older than 7 days) for all hosts
    console.log('\n📊 Cleaning up old inference_jobs (older than 7 days)...')
    const deleteResult = await inferenceJobs.deleteMany({
      $or: [
        { created_at: { $lt: sevenDaysAgo.toISOString() } },
        { timestamp: { $lt: sevenDaysAgo.toISOString() } },
        { 'metadata.timestamp': { $lt: sevenDaysAgo.toISOString() } }
      ]
    })
    console.log(`   ✅ Deleted ${deleteResult.deletedCount} old inference jobs`)
    
    // If still over limit, delete more (keep only last 50 per host)
    const remainingTotal = await inferenceJobs.countDocuments()
    if (remainingTotal > 100) {
      // Clean up roboflow jobs
      const remainingRoboflow = await inferenceJobs.countDocuments({ host: 'roboflow' })
      if (remainingRoboflow > 50) {
        const toDelete = remainingRoboflow - 50
        const oldestRoboflowJobs = await inferenceJobs.find({ host: 'roboflow' })
          .sort({ created_at: 1, timestamp: 1, 'metadata.timestamp': 1 })
          .limit(toDelete)
          .toArray()
        
        const idsToDelete = oldestRoboflowJobs.map(job => job._id)
        if (idsToDelete.length > 0) {
          const extraDelete = await inferenceJobs.deleteMany({ _id: { $in: idsToDelete } })
          console.log(`   ✅ Deleted ${extraDelete.deletedCount} additional roboflow jobs (keeping last 50)`)
        }
      }
      
      // Clean up huggingface jobs
      const remainingHf = await inferenceJobs.countDocuments({ host: 'huggingface' })
      if (remainingHf > 50) {
        const toDelete = remainingHf - 50
        const oldestHfJobs = await inferenceJobs.find({ host: 'huggingface' })
          .sort({ created_at: 1, timestamp: 1, 'metadata.timestamp': 1 })
          .limit(toDelete)
          .toArray()
        
        const idsToDelete = oldestHfJobs.map(job => job._id)
        if (idsToDelete.length > 0) {
          const extraDelete = await inferenceJobs.deleteMany({ _id: { $in: idsToDelete } })
          console.log(`   ✅ Deleted ${extraDelete.deletedCount} additional huggingface jobs (keeping last 50)`)
        }
      }
    }
    
    // Get updated stats
    console.log('\n📊 Updated Collection Statistics:')
    const stats = await db.command({ collStats: 'inference_jobs' })
    const sizeMB = ((stats.storageSize || 0) + (stats.totalIndexSize || 0)) / (1024 * 1024)
    
    const finalTotal = await inferenceJobs.countDocuments()
    const finalRoboflow = await inferenceJobs.countDocuments({ host: 'roboflow' })
    const finalHuggingface = await inferenceJobs.countDocuments({ host: 'huggingface' })
    
    console.log(`   inference_jobs: ${finalTotal} documents, ${sizeMB.toFixed(2)} MB`)
    console.log(`     - roboflow: ${finalRoboflow}`)
    console.log(`     - huggingface: ${finalHuggingface}`)
    
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

