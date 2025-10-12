#!/usr/bin/env node

const { MongoClient } = require('mongodb');

async function checkAllCollections() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.log('❌ MONGODB_URI not found in environment variables');
    console.log('Please set MONGODB_URI in your .env.local file');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('vision_sdk');
    const collections = [
      'hf_inference_jobs',
      'model_recommendations', 
      'search_analytics',
      'search_cache',
      'user_model_selection',
      'user_queries'
    ];
    
    console.log('\n📊 MongoDB Collections Status:');
    console.log('='.repeat(50));
    
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        const sampleDoc = await collection.findOne();
        
        console.log(`\n📁 ${collectionName}:`);
        console.log(`   Count: ${count} documents`);
        
        if (count > 0 && sampleDoc) {
          console.log(`   Sample document keys: ${Object.keys(sampleDoc).join(', ')}`);
          
          // Show specific fields for important collections
          if (collectionName === 'user_queries' && sampleDoc.keywords) {
            console.log(`   Latest keywords: ${JSON.stringify(sampleDoc.keywords)}`);
          }
          
          if (collectionName === 'model_recommendations' && sampleDoc.models) {
            console.log(`   Models count: ${sampleDoc.models.length}`);
            if (sampleDoc.models[0] && sampleDoc.models[0].classes) {
              console.log(`   First model classes: ${JSON.stringify(sampleDoc.models[0].classes)}`);
            }
          }
          
          if (collectionName === 'user_model_selection' && sampleDoc.classes) {
            console.log(`   Latest selection classes: ${JSON.stringify(sampleDoc.classes)}`);
          }
          
          if (collectionName === 'search_analytics') {
            console.log(`   Sources: ${JSON.stringify(sampleDoc.sources)}`);
            console.log(`   Model count: ${sampleDoc.model_count}`);
          }
        } else {
          console.log(`   Status: Empty collection`);
        }
        
      } catch (error) {
        console.log(`   Error: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Collection check completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkAllCollections();
