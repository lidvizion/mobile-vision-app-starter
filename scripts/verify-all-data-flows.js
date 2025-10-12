#!/usr/bin/env node

const { MongoClient } = require('mongodb');

async function verifyAllDataFlows() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.log('❌ MONGODB_URI not found in environment variables');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('vision_sdk');
    
    console.log('🔍 COMPREHENSIVE DATA FLOW VERIFICATION');
    console.log('='.repeat(70));
    
    // 1. Check search_analytics
    console.log('\n📊 1. SEARCH ANALYTICS (search_analytics)');
    console.log('-'.repeat(70));
    const latestAnalytics = await db.collection('search_analytics')
      .find({})
      .sort({ created_at: -1 })
      .limit(3)
      .toArray();
    
    console.log(`   Total records: ${await db.collection('search_analytics').countDocuments()}`);
    console.log(`   Latest 3 searches:`);
    latestAnalytics.forEach((doc, i) => {
      console.log(`\n   ${i + 1}. Created: ${new Date(doc.created_at).toLocaleString()}`);
      console.log(`      Query ID: ${doc.query_id}`);
      console.log(`      Total models: ${doc.total_models}`);
      console.log(`      Inference ready: ${doc.inference_ready_count}`);
      console.log(`      Keywords: ${doc.keywords?.join(', ') || 'N/A'}`);
      console.log(`      Sources: ${JSON.stringify(doc.sources)}`);
    });
    
    // 2. Check model_recommendations
    console.log('\n\n📦 2. MODEL RECOMMENDATIONS (model_recommendations)');
    console.log('-'.repeat(70));
    const latestRecommendations = await db.collection('model_recommendations')
      .find({})
      .sort({ created_at: -1 })
      .limit(3)
      .toArray();
    
    console.log(`   Total records: ${await db.collection('model_recommendations').countDocuments()}`);
    console.log(`   Latest 3 recommendation sets:`);
    latestRecommendations.forEach((doc, i) => {
      const modelsWithClasses = doc.models.filter(m => m.classes && m.classes.length > 0).length;
      const modelsWithoutClasses = doc.models.filter(m => !m.classes || m.classes.length === 0).length;
      
      console.log(`\n   ${i + 1}. Created: ${new Date(doc.created_at).toLocaleString()}`);
      console.log(`      Query ID: ${doc.query_id}`);
      console.log(`      Total models: ${doc.models.length}`);
      console.log(`      Models with classes: ${modelsWithClasses}`);
      console.log(`      Models without/null classes: ${modelsWithoutClasses}`);
      
      if (doc.models.length > 0) {
        const sampleModel = doc.models[0];
        console.log(`      Sample model: ${sampleModel.name}`);
        console.log(`      - Source: ${sampleModel.source}`);
        console.log(`      - Classes: ${sampleModel.classes ? `[${sampleModel.classes.slice(0, 3).join(', ')}...]` : 'null'}`);
        console.log(`      - Task: ${sampleModel.task}`);
      }
    });
    
    // 3. Check user_queries
    console.log('\n\n💬 3. USER QUERIES (user_queries)');
    console.log('-'.repeat(70));
    const latestQueries = await db.collection('user_queries')
      .find({})
      .sort({ timestamp: -1 })
      .limit(3)
      .toArray();
    
    console.log(`   Total records: ${await db.collection('user_queries').countDocuments()}`);
    console.log(`   Latest 3 queries:`);
    latestQueries.forEach((doc, i) => {
      console.log(`\n   ${i + 1}. Time: ${new Date(doc.timestamp).toLocaleString()}`);
      console.log(`      Query ID: ${doc.query_id}`);
      console.log(`      Query: "${doc.query}"`);
      console.log(`      Keywords: ${doc.keywords?.join(', ') || 'N/A'}`);
      console.log(`      Task: ${doc.task_type || 'N/A'}`);
    });
    
    // 4. Check user_model_selection
    console.log('\n\n🎯 4. USER MODEL SELECTIONS (user_model_selection)');
    console.log('-'.repeat(70));
    const latestSelections = await db.collection('user_model_selection')
      .find({})
      .sort({ selected_at: -1 })
      .limit(5)
      .toArray();
    
    console.log(`   Total records: ${await db.collection('user_model_selection').countDocuments()}`);
    console.log(`   Latest 5 selections:`);
    latestSelections.forEach((doc, i) => {
      console.log(`\n   ${i + 1}. Selected: ${new Date(doc.selected_at).toLocaleString()}`);
      console.log(`      Model: ${doc.model_name}`);
      console.log(`      Source: ${doc.source}`);
      console.log(`      Query ID: ${doc.query_id}`);
      console.log(`      Classes: ${doc.classes ? `[${doc.classes.slice(0, 5).join(', ')}${doc.classes.length > 5 ? '...' : ''}]` : 'null'}`);
    });
    
    // 5. Check search_cache
    console.log('\n\n💾 5. SEARCH CACHE (search_cache)');
    console.log('-'.repeat(70));
    const cacheCount = await db.collection('search_cache').countDocuments();
    const latestCache = await db.collection('search_cache')
      .find({})
      .sort({ timestamp: -1 })
      .limit(3)
      .toArray();
    
    console.log(`   Total cached searches: ${cacheCount}`);
    console.log(`   Latest 3 cached results:`);
    latestCache.forEach((doc, i) => {
      console.log(`\n   ${i + 1}. Cached: ${new Date(doc.timestamp).toLocaleString()}`);
      console.log(`      Cache key: ${doc.cache_key.substring(0, 50)}...`);
      console.log(`      Models in cache: ${doc.data?.models?.length || 0}`);
      console.log(`      TTL expires: ${doc.ttl ? new Date(doc.ttl).toLocaleString() : 'N/A'}`);
    });
    
    // 6. Check hf_inference_jobs
    console.log('\n\n🤖 6. INFERENCE JOBS (hf_inference_jobs)');
    console.log('-'.repeat(70));
    const inferenceCount = await db.collection('hf_inference_jobs').countDocuments();
    const latestInference = await db.collection('hf_inference_jobs')
      .find({})
      .sort({ created_at: -1 })
      .limit(3)
      .toArray();
    
    console.log(`   Total inference jobs: ${inferenceCount}`);
    if (inferenceCount > 0) {
      console.log(`   Latest 3 inference jobs:`);
      latestInference.forEach((doc, i) => {
        console.log(`\n   ${i + 1}. Created: ${new Date(doc.created_at).toLocaleString()}`);
        console.log(`      Job ID: ${doc.job_id}`);
        console.log(`      Model: ${doc.model_id}`);
        console.log(`      Status: ${doc.status}`);
      });
    } else {
      console.log(`   ℹ️  No inference jobs yet (normal if no inferences have been run)`);
    }
    
    // 7. Summary and Health Check
    console.log('\n\n📋 7. DATA FLOW HEALTH SUMMARY');
    console.log('='.repeat(70));
    
    const collections = {
      'search_analytics': await db.collection('search_analytics').countDocuments(),
      'model_recommendations': await db.collection('model_recommendations').countDocuments(),
      'user_queries': await db.collection('user_queries').countDocuments(),
      'user_model_selection': await db.collection('user_model_selection').countDocuments(),
      'search_cache': await db.collection('search_cache').countDocuments(),
      'hf_inference_jobs': await db.collection('hf_inference_jobs').countDocuments()
    };
    
    console.log('\n   Collection Document Counts:');
    Object.entries(collections).forEach(([name, count]) => {
      const status = count > 0 ? '✅' : '⚠️';
      console.log(`   ${status} ${name.padEnd(25)} ${count} documents`);
    });
    
    // Check data consistency
    console.log('\n   Data Consistency Checks:');
    
    const latestSearch = latestAnalytics[0];
    const matchingRecommendation = latestRecommendations.find(r => r.query_id === latestSearch.query_id);
    
    if (matchingRecommendation) {
      const analyticsInference = latestSearch.inference_ready_count;
      const recommendationCount = matchingRecommendation.models.length;
      
      if (analyticsInference === recommendationCount) {
        console.log(`   ✅ Analytics (${analyticsInference}) matches recommendations (${recommendationCount})`);
      } else {
        console.log(`   ⚠️  Analytics (${analyticsInference}) ≠ recommendations (${recommendationCount})`);
      }
    }
    
    // Check classes field presence in recent data
    const recentRecsWithClasses = latestRecommendations
      .filter(r => r.models.some(m => m.classes && m.classes.length > 0))
      .length;
    
    const recentSelectionsWithClasses = latestSelections
      .filter(s => s.classes !== undefined)
      .length;
    
    console.log(`   ✅ Recent recommendations with classes: ${recentRecsWithClasses}/${latestRecommendations.length}`);
    console.log(`   ✅ Recent selections with classes field: ${recentSelectionsWithClasses}/${latestSelections.length}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ VERIFICATION COMPLETE\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

verifyAllDataFlows();
