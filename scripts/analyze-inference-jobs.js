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
    
    // Analyze roboflow_inference_jobs
    console.log('📊 Analyzing roboflow_inference_jobs...\n')
    const roboflowJobs = db.collection('roboflow_inference_jobs')
    const roboflowDocs = await roboflowJobs.find({}).limit(5).toArray()
    
    if (roboflowDocs.length > 0) {
      console.log('Sample document structure:')
      console.log('Keys:', Object.keys(roboflowDocs[0]))
      console.log('\nSample document size estimate:')
      
      // Estimate size of each document
      for (let i = 0; i < Math.min(3, roboflowDocs.length); i++) {
        const doc = roboflowDocs[i]
        const docStr = JSON.stringify(doc)
        const sizeKB = Buffer.byteLength(docStr, 'utf8') / 1024
        console.log(`  Document ${i + 1}: ${sizeKB.toFixed(2)} KB`)
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
    
    // Get total count and check for large documents
    const totalRoboflow = await roboflowJobs.countDocuments()
    console.log(`\nTotal roboflow_inference_jobs: ${totalRoboflow}`)
    
    // Analyze hf_inference_jobs
    console.log('\n📊 Analyzing hf_inference_jobs...\n')
    const hfJobs = db.collection('hf_inference_jobs')
    const hfDocs = await hfJobs.find({}).limit(5).toArray()
    
    if (hfDocs.length > 0) {
      console.log('Sample document structure:')
      console.log('Keys:', Object.keys(hfDocs[0]))
      console.log('\nSample document size estimate:')
      
      for (let i = 0; i < Math.min(3, hfDocs.length); i++) {
        const doc = hfDocs[i]
        const docStr = JSON.stringify(doc)
        const sizeKB = Buffer.byteLength(docStr, 'utf8') / 1024
        console.log(`  Document ${i + 1}: ${sizeKB.toFixed(2)} KB`)
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
    
    const totalHf = await hfJobs.countDocuments()
    console.log(`\nTotal hf_inference_jobs: ${totalHf}`)
    
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

