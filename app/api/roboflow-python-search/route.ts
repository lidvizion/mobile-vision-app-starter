import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

// Simple JSON parsing function for Python output
function parsePythonJson(stdout: string): any[] {
  try {
    // Try to parse as JSON directly first
    const parsed = JSON.parse(stdout)
    if (Array.isArray(parsed)) {
      return parsed
    }
    return [parsed]
  } catch (e) {
    // If direct parsing fails, try to extract JSON from the output
    const lines = stdout.split('\n')
    const jsonLines: string[] = []
    let inJson = false
    let braceCount = 0
    
    for (const line of lines) {
      if (line.includes('[') || line.includes('{')) {
        inJson = true
      }
      
      if (inJson) {
        jsonLines.push(line)
        braceCount += (line.match(/[\[\{]/g) || []).length
        braceCount -= (line.match(/[\]\}]/g) || []).length
        
        if (braceCount === 0 && (line.includes(']') || line.includes('}'))) {
          break
        }
      }
    }
    
    if (jsonLines.length > 0) {
      try {
        const jsonStr = jsonLines.join('\n')
        const parsed = JSON.parse(jsonStr)
        return Array.isArray(parsed) ? parsed : [parsed]
      } catch (e) {
        console.warn('Failed to parse JSON from Python output:', e)
        return []
      }
    }
    
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keywords, max_models = 4 } = body

    if (!keywords || !Array.isArray(keywords)) {
      return NextResponse.json(
        { error: 'Keywords array is required' },
        { status: 400 }
      )
    }

    console.log(`🤖 Starting Roboflow search for: ${keywords.join(' ')}`)

    const searchQuery = keywords.join(' ')
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python')
    const pythonScript = path.join(process.cwd(), 'roboflow_search_agent.py')
    
    console.log(`🐍 Python path: ${venvPython}`)
    console.log(`📜 Script path: ${pythonScript}`)

    const pythonProcess = spawn(venvPython, [pythonScript], {
      env: {
        ...process.env,
        SEARCH_KEYWORDS: searchQuery,
        MAX_PROJECTS: max_models.toString(),
        OUTPUT_JSON: 'true',  // 🔑 Key fix: Enable JSON stdout mode
        HEADLESS: 'true',
        // Ensure virtual environment is used
        VIRTUAL_ENV: path.join(process.cwd(), 'venv'),
        PATH: `${path.join(process.cwd(), 'venv', 'bin')}:${process.env.PATH}`
      },
      cwd: process.cwd()
    })

    let stdout = ''
    let stderr = ''

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    const exitCode = await new Promise<number>((resolve) => {
      pythonProcess.on('close', (code) => resolve(code ?? 0))
      
      // Add timeout to prevent hanging
      setTimeout(() => {
        pythonProcess.kill('SIGTERM')
        resolve(1) // Exit with error code
      }, 120000) // 30 second timeout
    })

    if (exitCode !== 0) {
      console.error(`❌ Python script exited with code ${exitCode}`)
      console.error('Stderr:', stderr)
      return NextResponse.json(
        { error: 'Search failed', details: stderr },
        { status: 500 }
      )
    }

    // Parse results using the robust JSON parser
    console.log('🔍 Raw Python output length:', stdout.length)
    console.log('🔍 Raw Python output preview:', stdout.slice(0, 500))
    
    const models = parsePythonJson(stdout)
    
    if (models.length === 0) {
      console.log('⚠️ No models found in Python output')
      console.log('Raw output:', stdout.slice(0, 500))
      return NextResponse.json({
        success: true,
        models: [],
        search_method: 'roboflow_agent',
        total_found: 0,
        message: 'No models found matching your search criteria'
      })
    }

    console.log(`✅ Found ${models.length} models using Roboflow search agent`)

    // Normalize models to ModelMetadata format
    const normalizedModels = models.map((model: any, index: number) => ({
      id: model.model_identifier || `roboflow-${Date.now()}-${index}`,
      name: model.project_title || model.model_name || 'Roboflow Model',
      source: 'roboflow' as const,
      description: model.description || `Roboflow model for ${searchQuery}`,
      modelUrl: model.url || model.model_url || 'https://universe.roboflow.com',
      task: model.project_type?.toLowerCase().replace(' ', '-') || 'object-detection',
      author: model.author || 'Roboflow Universe',
      downloads: 0,
      tags: model.tags || keywords,
      classes: model.classes || [],
      frameworks: ['Roboflow'],
      platforms: ['web', 'mobile'],
      supportsInference: true,
      inferenceEndpoint: model.api_endpoint || model.model_url,
      apiKey: process.env.ROBOFLOW_API_KEY,
      // Model metrics
      metrics: {
        mAP: parseFloat(model.mAP?.replace('%', '') || '0'),
        precision: parseFloat(model.precision?.replace('%', '') || '0'),
        recall: parseFloat(model.recall?.replace('%', '') || '0'),
      },
      // Training data info
      trainingImages: parseInt(model.training_images || '0'),
      modelId: model.model_identifier,
      // Model type information
      modelType: 'custom' as const,
      modelTypeInfo: {
        type: 'custom' as const,
        tier: 1 as const,
        displayLabel: 'Object Detection',
        description: 'Custom trained object detection model',
        taskType: 'object-detection' as const,
        displayFormat: {
          type: 'bounding-boxes' as const,
          requiresImage: true,
          requiresText: false,
          outputType: 'structured' as const,
          visualization: 'overlay' as const,
        }
      }
    }))

    return NextResponse.json({
      success: true,
      models: normalizedModels,
      search_method: 'roboflow_agent',
      total_found: normalizedModels.length
    })

  } catch (error) {
    console.error('❌ Roboflow search failed:', error)
    return NextResponse.json(
      { 
        error: 'Search failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}