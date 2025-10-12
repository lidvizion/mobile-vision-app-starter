#!/usr/bin/env node

const { MongoClient } = require('mongodb');

async function checkModelCountDiscrepancy() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.log('❌ MONGODB_URI not found in environment variables');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('vision_sdk');
    
    console.log('\n🔍 Model Count Discrepancy Analysis:');
    console.log('='.repeat(60));
    
    // Check search_analytics to see how many models were fetched
    console.log('\n📁 search_analytics - Model Counts:');
    const analytics = await db.collection('search_analytics')
      .find({})
      .sort({ created_at: -1 })
      .limit(5)
      .toArray();
    
    analytics.forEach((doc, index) => {
      const date = new Date(doc.created_at).toLocaleString();
      console.log(`\n   ${index + 1}. Date: ${date}`);
      console.log(`      Total models: ${doc.total_models}`);
      console.log(`      Inference ready: ${doc.inference_ready_count}`);
      console.log(`      Non-inference: ${doc.non_inference_count}`);
      console.log(`      Sources: ${JSON.stringify(doc.sources)}`);
    });
    
    // Check model_recommendations to see how many were saved
    console.log('\n📁 model_recommendations - Saved Models:');
    const recommendations = await db.collection('model_recommendations')
      .find({})
      .sort({ created_at: -1 })
      .limit(5)
      .toArray();
    
    recommendations.forEach((doc, index) => {
      const date = new Date(doc.created_at).toLocaleString();
      console.log(`\n   ${index + 1}. Date: ${date}`);
      console.log(`      Models saved: ${doc.models.length}`);
      console.log(`      Query ID: ${doc.query_id}`);
      
      if (doc.models.length > 0) {
        console.log(`      First model: ${doc.models[0].name}`);
        console.log(`      Last model: ${doc.models[doc.models.length - 1].name}`);
      }
    });
    
    // Check if there's a limit being applied
    console.log('\n🔍 Checking for Model Limits:');
    
    // Look at the most recent recommendation
    if (recommendations.length > 0) {
      const latestRec = recommendations[0];
      const latestAnalytics = analytics[0];
      
      console.log(`\n   Latest Search Analytics:`);
      console.log(`      Total models found: ${latestAnalytics.total_models}`);
      
      console.log(`\n   Latest Model Recommendations:`);
      console.log(`      Models saved: ${latestRec.models.length}`);
      
      const discrepancy = latestAnalytics.total_models - latestRec.models.length;
      console.log(`\n   ⚠️  DISCREPANCY: ${discrepancy} models not saved!`);
      
      if (discrepancy > 0) {
        console.log(`\n   🔍 Possible causes:`);
        console.log(`      1. Frontend only saving first N models`);
        console.log(`      2. Backend limiting models in save-recommendations`);
        console.log(`      3. Filtering applied before saving`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkModelCountDiscrepancy();
