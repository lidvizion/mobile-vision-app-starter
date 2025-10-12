#!/usr/bin/env node

const { MongoClient } = require('mongodb');

async function checkClassesTimeline() {
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
    
    console.log('\n📅 Classes Field Timeline Analysis:');
    console.log('='.repeat(60));
    
    // Check user_model_selection - show timeline of classes field
    console.log('\n📁 user_model_selection - Classes Field Timeline:');
    const selections = await db.collection('user_model_selection')
      .find({})
      .sort({ selected_at: 1 }) // Sort by oldest first
      .toArray();
    
    selections.forEach((doc, index) => {
      const hasClasses = doc.classes !== undefined;
      const classesStr = hasClasses ? JSON.stringify(doc.classes) : 'MISSING';
      const date = new Date(doc.selected_at).toLocaleString();
      
      console.log(`\n   ${index + 1}. ${doc.model_name}`);
      console.log(`      Date: ${date}`);
      console.log(`      Classes: ${classesStr}`);
      console.log(`      Source: ${doc.source}`);
    });
    
    // Check model_recommendations - show if models have classes
    console.log('\n📁 model_recommendations - Models with Classes:');
    const recommendations = await db.collection('model_recommendations')
      .find({})
      .sort({ created_at: -1 }) // Latest first
      .limit(3)
      .toArray();
    
    recommendations.forEach((doc, index) => {
      console.log(`\n   ${index + 1}. Query ID: ${doc.query_id}`);
      console.log(`      Created: ${new Date(doc.created_at).toLocaleString()}`);
      console.log(`      Models count: ${doc.models.length}`);
      
      if (doc.models.length > 0) {
        const modelsWithClasses = doc.models.filter(m => m.classes !== undefined);
        const modelsWithoutClasses = doc.models.filter(m => m.classes === undefined);
        
        console.log(`      Models with classes: ${modelsWithClasses.length}`);
        console.log(`      Models without classes: ${modelsWithoutClasses.length}`);
        
        if (modelsWithClasses.length > 0) {
          console.log(`      Example with classes: ${JSON.stringify(modelsWithClasses[0].classes)}`);
        }
        if (modelsWithoutClasses.length > 0) {
          console.log(`      Example without classes: ${modelsWithoutClasses[0].name} (no classes field)`);
        }
      }
    });
    
    // Summary
    console.log('\n📊 Summary:');
    const totalSelections = selections.length;
    const selectionsWithClasses = selections.filter(d => d.classes !== undefined).length;
    const selectionsWithoutClasses = totalSelections - selectionsWithClasses;
    
    console.log(`   user_model_selection: ${selectionsWithClasses}/${totalSelections} have classes field`);
    console.log(`   Missing classes: ${selectionsWithoutClasses} documents (older format)`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkClassesTimeline();
