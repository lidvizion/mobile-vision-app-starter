require('dotenv').config({ path: '.env.local' })
const { MongoClient } = require('mongodb')

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set')
  process.exit(1)
}

async function analyzeInferenceJobs() {
  const client = new MongoClient(MONGODB_URI)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB\n')
    
    const db = client.db('vision_sdk')
    
    // Analyze inference_jobs by host
    console.log('📊 Analyzing inference_jobs...\n')
    const inferenceJobs = db.collection('inference_jobs')
    
    // Get counts by host
    const totalJobs = await inferenceJobs.countDocuments()
    const roboflowCount = await inferenceJobs.countDocuments({ host: 'roboflow' })
    const huggingfaceCount = await inferenceJobs.countDocuments({ host: 'huggingface' })
    const otherHosts = await inferenceJobs.distinct('host')
    
    console.log(`Total inference_jobs: ${totalJobs}`)
    console.log(`  - roboflow: ${roboflowCount}`)
    console.log(`  - huggingface: ${huggingfaceCount}`)
    if (otherHosts.length > 2) {
      console.log(`  - Other hosts: ${otherHosts.filter(h => h !== 'roboflow' && h !== 'huggingface').join(', ')}`)
    }
    
    // Analyze sample documents
    const sampleDocs = await inferenceJobs.find({}).limit(5).toArray()
    
    if (sampleDocs.length > 0) {
      console.log('\nSample document structure:')
      console.log('Keys:', Object.keys(sampleDocs[0]))
      console.log('\nSample document size estimate:')
      
      for (let i = 0; i < Math.min(3, sampleDocs.length); i++) {
        const doc = sampleDocs[i]
        const docStr = JSON.stringify(doc)
        const sizeKB = Buffer.byteLength(docStr, 'utf8') / 1024
        console.log(`  Document ${i + 1} (host: ${doc.host || 'unknown'}): ${sizeKB.toFixed(2)} KB`)
        console.log(`    Keys: ${Object.keys(doc).join(', ')}`)
        if (doc.response) {
          const responseStr = JSON.stringify(doc.response)
          const responseSizeKB = Buffer.byteLength(responseStr, 'utf8') / 1024
          console.log(`    Response size: ${responseSizeKB.toFixed(2)} KB`)
        }
        if (doc.image_data || doc.image) {
          console.log(`    Contains image data: YES`)
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await client.close()
    console.log('\n✅ MongoDB connection closed')
  }
}

analyzeInferenceJobs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed:', error)
    process.exit(1)
  })

