#!/usr/bin/env node

const { MongoClient } = require('mongodb');

async function checkLatestData() {
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
    
    console.log('\n🔍 Latest Data in Collections:');
    console.log('='.repeat(60));
    
    // Check user_model_selection - latest 3 documents
    console.log('\n📁 user_model_selection (latest 3):');
    const latestSelections = await db.collection('user_model_selection')
      .find({})
      .sort({ selected_at: -1 })
      .limit(3)
      .toArray();
    
    latestSelections.forEach((doc, index) => {
      console.log(`\n   ${index + 1}. ${doc.model_name}`);
      console.log(`      Classes: ${JSON.stringify(doc.classes)}`);
      console.log(`      Source: ${doc.source}`);
      console.log(`      Selected: ${doc.selected_at}`);
    });
    
    // Check model_recommendations - latest document
    console.log('\n📁 model_recommendations (latest):');
    const latestRecommendations = await db.collection('model_recommendations')
      .find({})
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    
    if (latestRecommendations.length > 0) {
      const rec = latestRecommendations[0];
      console.log(`   Query ID: ${rec.query_id}`);
      console.log(`   Models count: ${rec.models.length}`);
      if (rec.models.length > 0) {
        console.log(`   First model classes: ${JSON.stringify(rec.models[0].classes)}`);
      }
    }
    
    // Check user_queries - latest document
    console.log('\n📁 user_queries (latest):');
    const latestQueries = await db.collection('user_queries')
      .find({})
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    
    if (latestQueries.length > 0) {
      const query = latestQueries[0];
      console.log(`   Query: ${query.query_text}`);
      console.log(`   Keywords: ${JSON.stringify(query.keywords)}`);
      console.log(`   Task: ${query.task_type}`);
    }
    
    // Check search_analytics - latest document
    console.log('\n📁 search_analytics (latest):');
    const latestAnalytics = await db.collection('search_analytics')
      .find({})
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    
    if (latestAnalytics.length > 0) {
      const analytics = latestAnalytics[0];
      console.log(`   Total models: ${analytics.total_models}`);
      console.log(`   Sources: ${JSON.stringify(analytics.sources)}`);
      console.log(`   Inference ready: ${analytics.inference_ready_count}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkLatestData();
