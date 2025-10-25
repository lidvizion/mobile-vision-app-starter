const { spawn } = require('child_process');
const path = require('path');

async function testPythonAgent() {
  console.log('🧪 Testing Node.js -> Python integration...');
  
  const pythonScript = path.join(process.cwd(), 'roboflow_search_agent.py');
  console.log('Python script path:', pythonScript);
  
  const pythonProcess = spawn('python3', [pythonScript], {
    env: {
      ...process.env,
      SEARCH_KEYWORDS: 'basketball detection',
      MAX_MODELS: '1'
    }
  });

  let stdout = '';
  let stderr = '';

  pythonProcess.stdout.on('data', (data) => {
    stdout += data.toString();
    console.log(`Python stdout: ${data.toString()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    stderr += data.toString();
    console.error(`Python stderr: ${data.toString()}`);
  });

  // Wait for the process to complete
  const exitCode = await new Promise((resolve) => {
    pythonProcess.on('close', (code) => {
      resolve(code || 0);
    });
  });

  console.log(`\n📊 Python process exit code: ${exitCode}`);
  console.log(`📊 stdout length: ${stdout.length}`);
  console.log(`📊 stderr length: ${stderr.length}`);

  if (exitCode !== 0) {
    console.error(`❌ Python script failed with exit code ${exitCode}`);
    console.error(`stderr: ${stderr}`);
    return null;
  }

  // Try to parse the Python output
  try {
    // Look for the final JSON output (after "✅ Found X models:")
    const finalJsonMatch = stdout.match(/✅ Found \d+ models:\s*(\{[\s\S]*?\})\s*$/m);
    if (finalJsonMatch) {
      const modelData = JSON.parse(finalJsonMatch[1]);
      console.log('✅ Successfully extracted model data from Python script');
      console.log('Model data:', JSON.stringify(modelData, null, 2));
      return modelData;
    } else {
      console.log('⚠️ No final JSON found in Python output');
      console.log('Python output preview:', stdout.substring(0, 500));
      return null;
    }
  } catch (parseError) {
    console.error('❌ Failed to parse Python output:', parseError);
    console.log('Raw output:', stdout);
    return null;
  }
}

testPythonAgent().then(result => {
  if (result) {
    console.log('🎉 Node.js -> Python integration working!');
  process.exit(0);
  } else {
    console.log('❌ Node.js -> Python integration failed');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
