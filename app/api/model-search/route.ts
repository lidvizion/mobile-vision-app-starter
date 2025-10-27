import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Extend globalThis to include our cache
declare global {
  var searchCache: Map<string, any[]> | undefined
}

/**
 * Fetch model description from Hugging Face README.md
 */
async function fetchModelDescription(modelId: string): Promise<string | null> {
  try {
    const readmeUrl = `https://huggingface.co/${modelId}/raw/main/README.md`
    const response = await fetch(readmeUrl)
    
    if (!response.ok) {
      return null
    }
    
    const readmeContent = await response.text()
    
    // Extract description from README
    // Look for content after the YAML front matter (---)
    const lines = readmeContent.split('\n')
    let inYamlFrontMatter = false
    let description = ''
    let foundMeaningfulContent = false
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // Check for YAML front matter boundaries
      if (line.trim() === '---') {
        inYamlFrontMatter = !inYamlFrontMatter
        continue
      }
      
      // Skip YAML front matter
      if (inYamlFrontMatter) {
        continue
      }
      
      // Skip empty lines at the start
      if (line.trim() === '') {
        continue
      }
      
      // Skip markdown headers, images, and other formatting
      if (line.startsWith('#') || 
          line.startsWith('![') || 
          line.startsWith('|') ||
          line.startsWith('```') ||
          line.startsWith('<!--') ||
          line.trim() === '') {
        continue
      }
      
      // Look for meaningful content (not just HTML comments or boilerplate)
      const cleanLine = line.trim()
      if (cleanLine.length > 20 && 
          !cleanLine.toLowerCase().includes('this model card has been generated') &&
          !cleanLine.toLowerCase().includes('provide a quick summary') &&
          !cleanLine.toLowerCase().includes('model-index') &&
          !cleanLine.toLowerCase().includes('metrics:') &&
          !cleanLine.startsWith('<!--')) {
        description = cleanLine
        foundMeaningfulContent = true
        break
      }
    }
    
    // If no meaningful content found, try to get a better description
    if (!foundMeaningfulContent) {
      // Look for any paragraph that might contain useful info
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.length > 30 && 
            line.includes(' ') && // Contains spaces (likely a sentence)
            !line.startsWith('#') &&
            !line.startsWith('!') &&
            !line.startsWith('|') &&
            !line.startsWith('```') &&
            !line.startsWith('<!--') &&
            !line.toLowerCase().includes('model-index') &&
            !line.toLowerCase().includes('metrics:')) {
          description = line
          break
        }
      }
    }
    
    // Clean up the description
    if (description) {
      // Remove HTML comments first
      description = description
        .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
        .replace(/\*([^*]+)\*/g, '$1') // Remove italic
        .replace(/`([^`]+)`/g, '$1') // Remove code formatting
        .replace(/^[^\w]*/, '') // Remove leading non-word characters
        .trim()
      
      // Only return if it's a reasonable length and meaningful content
      if (description.length > 10 && description.length < 200 && 
          !description.toLowerCase().includes('model-index') &&
          !description.toLowerCase().includes('metrics:') &&
          !description.toLowerCase().includes('this model card has been generated') &&
          !description.toLowerCase().includes('provide a quick summary')) {
        return description
      }
    }
    
    return null
  } catch (error) {
    console.warn(`Failed to fetch description for ${modelId}:`, error)
    return null
  }
}

/**
 * Fetch descriptions for multiple models in parallel
 */
async function fetchMultipleModelDescriptions(modelIds: string[]): Promise<Record<string, string | null>> {
  const results = await Promise.all(
    modelIds.map(async (modelId) => ({
      modelId,
      description: await fetchModelDescription(modelId)
    }))
  )
  
  return results.reduce((acc, { modelId, description }) => {
    acc[modelId] = description
    return acc
  }, {} as Record<string, string | null>)
}

/**
 * Determine model type based on classes and pipeline tag
 */
function determineModelType(model: any, classes?: string[]): {
  type: 'custom' | 'generative' | 'unspecified'
  tier: 1 | 2 | 3
  displayLabel: string
  description: string
  taskType: 'object-detection' | 'classification' | 'segmentation' | 'captioning' | 'qa' | 'embedding' | 'general'
  displayFormat: {
    type: 'bounding-boxes' | 'labels' | 'masks' | 'text' | 'embeddings' | 'general'
    requiresImage: boolean
    requiresText: boolean
    outputType: 'structured' | 'text' | 'numerical'
    visualization: 'overlay' | 'sidebar' | 'modal' | 'inline'
  }
} {
  const pipelineTag = model.pipeline_tag?.toLowerCase() || ''
  
  // Tier 1: Custom/Task-specific CV models with explicit classes
  if (classes && classes.length > 0 && classes[0] !== 'LABEL_0') {
    // Determine specific task type based on pipeline tag and model name
    let taskType: 'object-detection' | 'classification' | 'segmentation' | 'captioning' | 'qa' | 'embedding' | 'general' = 'general'
            let displayFormat: {
              type: 'bounding-boxes' | 'labels' | 'masks' | 'text' | 'embeddings' | 'general'
              requiresImage: boolean
              requiresText: boolean
              outputType: 'structured' | 'text' | 'numerical'
              visualization: 'overlay' | 'sidebar' | 'modal' | 'inline'
            } = {
              type: 'general',
              requiresImage: true,
              requiresText: false,
              outputType: 'structured',
              visualization: 'sidebar'
            }
    
    // Check model name and description for task type clues
    const modelName = model.name?.toLowerCase() || ''
    const modelDescription = model.description?.toLowerCase() || ''
    const combinedText = `${pipelineTag} ${modelName} ${modelDescription}`
    
    if (combinedText.includes('object-detection') || 
        combinedText.includes('detection') || 
        combinedText.includes('yolo') || 
        combinedText.includes('detr') ||
        combinedText.includes('faster-rcnn') ||
        combinedText.includes('retinanet') ||
        combinedText.includes('bounding') ||
        combinedText.includes('bbox')) {
      taskType = 'object-detection'
      displayFormat.type = 'bounding-boxes'
      displayFormat.visualization = 'overlay'
    } else if (combinedText.includes('classification') || 
               combinedText.includes('image-classification') ||
               combinedText.includes('classify') ||
               combinedText.includes('resnet') ||
               combinedText.includes('vit') ||
               combinedText.includes('efficientnet')) {
      taskType = 'classification'
      displayFormat.type = 'labels'
    } else if (combinedText.includes('segmentation') || 
               combinedText.includes('mask') ||
               combinedText.includes('deeplab') ||
               combinedText.includes('unet') ||
               combinedText.includes('mask-rcnn')) {
      taskType = 'segmentation'
      displayFormat.type = 'masks'
      displayFormat.visualization = 'overlay'
    }
    
    return {
      type: 'custom',
      tier: 1,
      displayLabel: 'Custom Model',
      description: `Detects ${classes.length} specific classes: ${classes.slice(0, 3).join(', ')}${classes.length > 3 ? '...' : ''}`,
      taskType,
      displayFormat
    }
  }
  
  // Tier 2: Generative vision-language models
  const modelName = model.name?.toLowerCase() || ''
  const modelDescription = model.description?.toLowerCase() || ''
  const combinedText = `${pipelineTag} ${modelName} ${modelDescription}`
  
  const generativeTags = ['image-to-text', 'multimodal', 'text-generation', 'visual-question-answering', 'image-captioning']
  const generativeKeywords = ['blip', 'llava', 'llama', 'phi', 'qwen', 'instruct', 'caption', 'captioning', 'vision-language', 'vlm', 'vision-language-model']
  
  if (generativeTags.some(tag => pipelineTag.includes(tag)) || 
      generativeKeywords.some(keyword => combinedText.includes(keyword))) {
    let taskType: 'captioning' | 'qa' | 'general' = 'general'
    let displayFormat: {
      type: 'bounding-boxes' | 'labels' | 'masks' | 'text' | 'embeddings' | 'general'
      requiresImage: boolean
      requiresText: boolean
      outputType: 'structured' | 'text' | 'numerical'
      visualization: 'overlay' | 'sidebar' | 'modal' | 'inline'
    } = {
      type: 'text',
      requiresImage: true,
      requiresText: false,
      outputType: 'text',
      visualization: 'modal'
    }
    
    if (combinedText.includes('captioning') || 
        combinedText.includes('image-to-text') || 
        combinedText.includes('caption') ||
        combinedText.includes('blip')) {
      taskType = 'captioning'
      displayFormat.visualization = 'sidebar'
    } else if (combinedText.includes('question-answering') || 
               combinedText.includes('qa') ||
               combinedText.includes('instruct')) {
      taskType = 'qa'
      displayFormat.requiresText = true
    }
    
    return {
      type: 'generative',
      tier: 2,
      displayLabel: 'Generative Vision',
      description: 'Returns free-text descriptions and answers about images',
      taskType,
      displayFormat
    }
  }
  
  // Tier 3: Unspecified/Legacy models
  return {
    type: 'unspecified',
    tier: 3,
    displayLabel: 'Vision Model',
    description: 'No predefined labels — responses vary by prompt',
    taskType: 'general',
    displayFormat: {
      type: 'general',
      requiresImage: true,
      requiresText: false,
      outputType: 'text',
      visualization: 'modal'
    }
  }
}

/**
 * Calculate enhanced relevance score with model type consideration
 */
function calculateEnhancedRelevance(model: any, keywords: string[], classes?: string[]): number {
  const modelTypeInfo = determineModelType(model, classes)
  let baseScore = 0
  
  // HIGHEST PRIORITY: Known working models (verified to work with Inference API)
  if (model.isKnownWorking) {
    baseScore += 500 // Massive boost to ensure these appear first
  }
  
  // Base keyword relevance
  const modelText = `${model.name} ${model.description} ${model.tags?.join(' ') || ''}`.toLowerCase()
  const keywordMatches = keywords.filter(keyword => 
    modelText.includes(keyword.toLowerCase())
  ).length
  baseScore += keywordMatches * 20
  
  // Tier-based scoring
  switch (modelTypeInfo.tier) {
    case 1: // Custom models with classes
      baseScore += 100
      // Bonus for class keyword matches
      if (classes) {
        const classMatches = keywords.filter(keyword =>
          classes.some(cls => cls.toLowerCase().includes(keyword.toLowerCase()))
        ).length
        baseScore += classMatches * 30
      }
      break
    case 2: // Generative models
      baseScore += 50
      break
    case 3: // Unspecified models
      baseScore += 10
      break
  }
  
  // Downloads bonus (logarithmic to prevent huge models from dominating)
  baseScore += Math.log(model.downloads + 1) * 5
  
  // Bonus for models from trusted organizations (more likely to work)
  if (model.id?.startsWith('microsoft/') || 
      model.id?.startsWith('google/') || 
      model.id?.startsWith('facebook/') ||
      model.id?.startsWith('openai/')) {
    baseScore += 100
  }
  
  return baseScore
}

/**
 * Map Hugging Face pipeline tags to specific task types
 */
function mapPipelineTagToTaskType(pipelineTag: string): string {
  const taskTypeMap: { [key: string]: string } = {
    'image-classification': 'Image Classification',
    'object-detection': 'Object Detection',
    'image-segmentation': 'Image Segmentation',
    'image-to-image': 'Image to Image',
    'text-to-image': 'Text to Image',
    'image-to-text': 'Image to Text',
    'depth-estimation': 'Depth Estimation',
    'image-to-video': 'Image to Video',
    'zero-shot-image-classification': 'Zero-Shot Image Classification',
    'mask-generation': 'Mask Generation',
    'zero-shot-object-detection': 'Zero-Shot Object Detection',
    'image-feature-extraction': 'Image Feature Extraction',
    'keypoint-detection': 'Keypoint Detection',
    'video-classification': 'Video Classification',
    'text-to-video': 'Text to Video',
    'image-to-3d': 'Image to 3D',
    'text-to-3d': 'Text to 3D'
  }
  
  return taskTypeMap[pipelineTag] || 'Object Detection'
}

/**
 * Calculate keyword relevance score for a model
 */
function calculateKeywordRelevance(model: NormalizedModel, keywords: string[]): number {
  let score = 0
  const modelText = `${model.name} ${model.description} ${(model.tags || []).join(' ')}`.toLowerCase()
  
  keywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase()
    
    // Exact keyword match in model name (highest score)
    if (model.name.toLowerCase().includes(lowerKeyword)) {
      score += 200
    }
    
    // Keyword match in description
    if (model.description.toLowerCase().includes(lowerKeyword)) {
      score += 100
    }
    
    // Keyword match in tags
    if (model.tags?.some(tag => tag.toLowerCase().includes(lowerKeyword))) {
      score += 150
    }
    
    // Partial keyword match (word boundary)
    const regex = new RegExp(`\\b${lowerKeyword}`, 'i')
    if (regex.test(modelText)) {
      score += 50
    }
  })
  
  return score
}

/**
 * /api/model-search
 * Purpose: Search Roboflow Universe and Hugging Face for pre-trained models
 * Returns normalized model results from both sources
 */

interface ModelSearchRequest {
  keywords: string[]
  task_type?: string
  limit?: number
  page?: number  // Page number for pagination (1-based)
}

interface NormalizedModel {
  id: string
  name: string
  source: 'roboflow' | 'huggingface'
  description: string
  url: string
  modelUrl: string
  image?: string
  thumbnail?: string
  metrics?: {
    mAP?: number
    accuracy?: number
    precision?: number
    recall?: number
    FPS?: number
    modelSize?: string
  }
  task: string
  author: string
  downloads: number
  views?: number
  likes?: number
  stars?: number
  tags?: string[]
  classes?: string[]
  updatedAt?: string
  lastUpdated?: string
  trainingImages?: number
  modelId?: string
  frameworks: string[]
  platforms: string[]
  supportsInference?: boolean
  inferenceEndpoint?: string
  inferenceStatus?: string
  isKnownWorking?: boolean // Flag for verified working models
  // Enhanced model type information
  modelType?: 'custom' | 'generative' | 'unspecified'
  modelTypeInfo?: {
    type: 'custom' | 'generative' | 'unspecified'
    tier: 1 | 2 | 3
    displayLabel: string
    description: string
    taskType: 'object-detection' | 'classification' | 'segmentation' | 'captioning' | 'qa' | 'embedding' | 'general'
    displayFormat: {
      type: 'bounding-boxes' | 'labels' | 'masks' | 'text' | 'embeddings' | 'general'
      requiresImage: boolean
      requiresText: boolean
      outputType: 'structured' | 'text' | 'numerical'
      visualization: 'overlay' | 'sidebar' | 'modal' | 'inline'
    }
  }
}

import { spawn } from "child_process";
import path from "path";

async function searchRoboflowModelsPython(keywords: string[], taskType: string): Promise<any[]> {
  try {
    console.log(`🐍 Starting Roboflow Python search for: ${keywords.join(" ")}`);

    const searchQuery = keywords.join(" ");
    const venvPython = path.join(process.cwd(), "venv", "bin", "python");
    const pythonScript = path.join(process.cwd(), "roboflow_search_agent.py");
    
    const pythonProcess = spawn(venvPython, [pythonScript], {
      env: {
        ...process.env,
        SEARCH_KEYWORDS: searchQuery,
        MAX_PROJECTS: "4",
        OUTPUT_JSON: 'true',  // 🔑 Key fix: Enable JSON stdout mode
        HEADLESS: 'true',
        // Ensure virtual environment is used
        VIRTUAL_ENV: path.join(process.cwd(), 'venv'),
        PATH: `${path.join(process.cwd(), 'venv', 'bin')}:${process.env.PATH}`
      },
      cwd: process.cwd()  // 🔑 CRITICAL: Set working directory
    });

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => (stdout += data.toString()));
    pythonProcess.stderr.on("data", (data) => (stderr += data.toString()));

    const exitCode = await new Promise<number>((resolve) => {
      pythonProcess.on("close", (code) => resolve(code ?? 0));
    });

    if (exitCode !== 0) {
      console.error(`❌ Python script exited with code ${exitCode}`);
      console.error(stderr);
      return [];
    }

    // ---------------- Robust JSON extraction ----------------
    // Look for first "[" and last "]" to extract JSON array
    const jsonStart = stdout.indexOf("[");
    const jsonEnd = stdout.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) {
      console.warn("⚠️ No JSON array found in Python stdout, checking stderr as fallback");
      // Fallback: try stderr
      const errJsonStart = stderr.indexOf("[");
      const errJsonEnd = stderr.lastIndexOf("]");
      if (errJsonStart === -1 || errJsonEnd === -1) {
        console.error("❌ No JSON found in Python output at all");
        console.log("Python stdout preview:", stdout.slice(0, 500));
        console.log("Python stderr preview:", stderr.slice(0, 500));
        return [];
      }
      return parsePythonJson(stderr.slice(errJsonStart, errJsonEnd + 1), keywords, searchQuery, taskType);
    }

    return parsePythonJson(stdout.slice(jsonStart, jsonEnd + 1), keywords, searchQuery, taskType);

  } catch (error) {
    console.error("❌ Python Roboflow search failed:", error);
    return [];
  }
}

// ---------------- Helper function to normalize JSON ----------------
function parsePythonJson(jsonString: string, keywords: string[], searchQuery: string, taskType: string) {
  try {
    // First, try to parse as-is
    const modelData = JSON.parse(jsonString);
    console.log(`✅ Parsed ${modelData.length} models from Python output`);

    return modelData.map((model: any, index: number) => {
      // Extract better name from URL if project_title is generic
      let modelName = model.project_title || model.model_name || "Roboflow Model";
      if (modelName === "Models" || modelName === "N/A" || !modelName) {
        const url = model.url || model.model_url || "";
        const urlMatch = url.match(/\/universe\.roboflow\.com\/[^\/]+\/([^\/]+)\//);
        if (urlMatch && urlMatch[1]) {
          modelName = urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        }
      }
      
      return {
        id: model.model_identifier || `roboflow-${Date.now()}-${index}`,
        name: modelName,
      source: "roboflow",
          description: model.description || `Roboflow model for ${searchQuery}`,
        url: model.url || model.model_url || "https://universe.roboflow.com",
        modelUrl: model.url || model.model_url || "https://universe.roboflow.com",
          task: taskType,
      author: model.author || "Roboflow Universe",
          downloads: 0,
          tags: model.tags || keywords,
          classes: model.classes || [],
      frameworks: ["Roboflow"],
      platforms: ["web", "mobile"],
          supportsInference: true,
          inferenceEndpoint: model.api_endpoint || model.model_url,
        apiKey: typeof process !== 'undefined' && process.env ? process.env.ROBOFLOW_API_KEY : undefined,
          isKnownWorking: true,
          mAP: model.mAP,
          precision: model.precision,
          recall: model.recall,
      trainingImages: model.training_images,
      };
    });
  } catch (e) {
    console.error("❌ Failed to parse Python JSON:", e);
    console.log("Raw JSON string preview:", jsonString.slice(0, 500));
    
    // Try to repair incomplete JSON by extracting complete objects 
    try {
      console.log("🔧 Attempting to repair incomplete JSON...");
      
      // Find all complete JSON objects in the string
      const objectMatches = jsonString.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
      if (objectMatches && objectMatches.length > 0) {
        const validModels = [];
        
        for (const objectStr of objectMatches) {
          try {
            const model = JSON.parse(objectStr);
            // Only include if it has required fields
            if (model.model_identifier || model.model_name) {
              validModels.push(model);
            }
          } catch (objError) {
            console.log("⚠️ Skipping invalid object:", objError);
          }
        }
        
        if (validModels.length > 0) {
          console.log(`✅ Repaired JSON: extracted ${validModels.length} valid models`);
          
          return validModels.map((model: any, index: number) => ({
            id: model.model_identifier || `roboflow-${Date.now()}-${index}`,
            name: model.model_name || model.project_title || "Roboflow Model",
            source: "roboflow",
            description: model.description || `Roboflow model for ${searchQuery}`,
            url: model.model_url || model.url || "https://universe.roboflow.com",
            modelUrl: model.model_url || model.url || "https://universe.roboflow.com",
            task: taskType,
            author: model.author || "Roboflow Universe",
            downloads: 0,
            tags: model.tags || keywords,
            classes: model.classes || [],
            frameworks: ["Roboflow"],
            platforms: ["web", "mobile"],
            supportsInference: true,
            inferenceEndpoint: model.api_endpoint || model.model_url,
            apiKey: typeof process !== 'undefined' && process.env ? process.env.ROBOFLOW_API_KEY : undefined,
            isKnownWorking: true,
            mAP: model.mAP,
            precision: model.precision,
            recall: model.recall,
            trainingImages: model.training_images,
          }));
        }
      }
      
      console.log("❌ Could not repair JSON - no valid objects found");
      return [];

    } catch (repairError) {
      console.error("❌ JSON repair also failed:", repairError);
    return [];
    }
  }
}

/**
 * Filter out models that we know have failed in the past
 */
async function filterOutKnownFailedModels(models: any[]): Promise<any[]> {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()
    
    // Get list of models that have failed recently (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const failedModels = await db.collection('validated_models')
      .find({ 
        validated: false, 
        works: false,
        checked_at: { $gte: thirtyDaysAgo }
      })
      .project({ model_id: 1 })
      .toArray()
    
    const failedModelIds = new Set(failedModels.map(m => m.model_id))
    
    const filteredModels = models.filter(model => !failedModelIds.has(model.id))
    
    if (failedModelIds.size > 0) {
      console.log(`🚫 Filtered out ${failedModelIds.size} known failed models`)
    }
    
    return filteredModels
  } catch (error) {
    console.error('Error filtering failed models:', error)
    return models // Return original list if filtering fails
  }
}

/**
 * Prioritize models that we know are working from our database
 */
async function addTrustedModels(models: any[], keywords: string[]): Promise<any[]> {
  try {
    // Check if search is detection-related
    const searchText = keywords.join(' ').toLowerCase()
    const isDetectionSearch = searchText.includes('detection') || 
                             searchText.includes('detect') ||
                             searchText.includes('object') ||
                             searchText.includes('classification') ||
                             searchText.includes('recognition') ||
                             searchText.includes('bounding') ||
                             searchText.includes('localization') ||
                             searchText.includes('vehicles') ||
                             searchText.includes('traffic') ||
                             searchText.includes('basketball') ||
                             searchText.includes('sports')
    
    // Always include trusted models for any search
    console.log(`🔍 Search text: "${searchText}", isDetectionSearch: ${isDetectionSearch}`)
    
    // Trusted organization models - prioritize detection models for detection searches
    const trustedModels = isDetectionSearch ? [
      // Detection models first for detection searches
      {
        id: 'facebook/detr-resnet-50',
        downloads: 5000000,
        inference: true,
        library_name: 'transformers',
        pipeline_tag: 'object-detection',
        description: 'Facebook DETR - state-of-the-art object detection model',
        tags: ['facebook', 'detr', 'object-detection', 'detection']
      },
      {
        id: 'facebook/detr-resnet-101',
        downloads: 2000000,
        inference: true,
        library_name: 'transformers',
        pipeline_tag: 'object-detection',
        description: 'Facebook DETR ResNet-101 - high accuracy object detection',
        tags: ['facebook', 'detr', 'object-detection', 'detection']
      },
      {
        id: 'microsoft/table-transformer-detection',
        downloads: 1946640,
        inference: true,
        library_name: 'transformers',
        pipeline_tag: 'object-detection',
        description: 'Microsoft Table Transformer - specialized object detection model',
        tags: ['microsoft', 'object-detection', 'table', 'detection']
      },
      // Classification models as fallback
      {
        id: 'microsoft/resnet-50',
        downloads: 10000000,
        inference: true,
        library_name: 'transformers',
        pipeline_tag: 'image-classification',
        description: 'Microsoft ResNet-50 - excellent for object detection and classification',
        tags: ['microsoft', 'resnet', 'image-classification', 'object-detection']
      }
    ] : [
      // Classification models first for non-detection searches
      {
        id: 'microsoft/resnet-50',
        downloads: 10000000,
        inference: true,
        library_name: 'transformers',
        pipeline_tag: 'image-classification',
        description: 'Microsoft ResNet-50 - excellent for object detection and classification',
        tags: ['microsoft', 'resnet', 'image-classification', 'object-detection']
      },
      {
        id: 'facebook/detr-resnet-50',
        downloads: 5000000,
        inference: true,
        library_name: 'transformers',
        pipeline_tag: 'object-detection',
        description: 'Facebook DETR - state-of-the-art object detection model',
        tags: ['facebook', 'detr', 'object-detection', 'detection']
      }
    ]
    
    // Add trusted models that aren't already in the list
    const existingIds = new Set(models.map(m => m.id))
    const newTrustedModels = trustedModels.filter(m => !existingIds.has(m.id))
    
    if (newTrustedModels.length > 0) {
      console.log(`✅ Added ${newTrustedModels.length} trusted organization models`)
      return [...models, ...newTrustedModels]
    }
    
    return models
  } catch (error) {
    console.error('Error adding trusted models:', error)
    return models
  }
}

async function prioritizeKnownWorkingModels(models: any[]): Promise<any[]> {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()
    
    // Get list of models that are confirmed working (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const workingModels = await db.collection('validated_models')
      .find({ 
        validated: true, 
        works: true,
        workingDate: { $gte: thirtyDaysAgo }
      })
      .project({ model_id: 1, workingDate: 1 })
      .toArray()
    
    const workingModelIds = new Set(workingModels.map(m => m.model_id))
    
    // Sort: Working models first, then by original order
    const sortedModels = models.sort((a, b) => {
      const aIsWorking = workingModelIds.has(a.id)
      const bIsWorking = workingModelIds.has(b.id)
      
      if (aIsWorking && !bIsWorking) return -1
      if (!aIsWorking && bIsWorking) return 1
      return 0 // Keep original order for same type
    })
    
    if (workingModelIds.size > 0) {
      console.log(`✅ Prioritized ${workingModelIds.size} known working models`)
    }
    
    return sortedModels
  } catch (error) {
    console.error('Error prioritizing working models:', error)
    return models // Return original list if prioritization fails
  }
}

/**
 * Search Hugging Face Hub
 * 
 * Endpoint: GET https://huggingface.co/api/models?search=<query>
 * Example: curl -H "Authorization: Bearer $HF_TOKEN" \
 *   "https://huggingface.co/api/models?search=object-detection"
 * 
 * Response:
 * [
 *   {
 *     "id": "roboflow/YOLOv8-Object-Detection",
 *     "pipeline_tag": "object-detection",
 *     "private": false,
 *     "downloads": 1452,
 *     "likes": 22,
 *     "inference": true,
 *     "tags": ["vision", "yolo", "object-detection"]
 *   }
 * ]
 */

/**
 * Apply domain-specific model selection to avoid inappropriate model choices
 */
function applyDomainSpecificSelection(models: any[], keywords: string[], taskType?: string): any[] {
  // Define domain-specific model patterns to avoid
  const domainSpecificModels = {
    medical: ['optic', 'disc', 'cup', 'retina', 'eye', 'medical', 'clinical'],
    automotive: ['car', 'vehicle', 'traffic', 'road', 'street', 'driving'],
    general: ['general', 'generic', 'universal', 'multi', 'any']
  }
  
  // Determine the domain from keywords
  const keywordText = keywords.join(' ').toLowerCase()
  let detectedDomain = 'general'
  
  // Check for medical domain indicators
  const medicalIndicators = domainSpecificModels.medical.some(term => keywordText.includes(term))
  const automotiveIndicators = domainSpecificModels.automotive.some(term => keywordText.includes(term))
  
  if (medicalIndicators && !automotiveIndicators) {
    detectedDomain = 'medical'
  } else if (automotiveIndicators && !medicalIndicators) {
    detectedDomain = 'automotive'
  } else {
    detectedDomain = 'general'
  }
  
  // Filter out domain-specific models that don't match the detected domain
  return models.filter(model => {
    const modelId = model.id.toLowerCase()
    const modelDescription = (model.description || '').toLowerCase()
    const modelText = `${modelId} ${modelDescription}`
    
    // If we detected a specific domain, prioritize general models over domain-specific ones
    if (detectedDomain === 'automotive' && domainSpecificModels.medical.some(term => modelText.includes(term))) {
      return false // Exclude medical models for automotive queries
    }
    
    if (detectedDomain === 'medical' && domainSpecificModels.automotive.some(term => modelText.includes(term))) {
      return false // Exclude automotive models for medical queries
    }
    
    // For general queries, prefer general-purpose models over domain-specific ones
    if (detectedDomain === 'general') {
      const isMedicalSpecific = domainSpecificModels.medical.some(term => modelText.includes(term))
      const isAutomotiveSpecific = domainSpecificModels.automotive.some(term => modelText.includes(term))
      
      // Exclude highly specific medical models for general queries
      if (isMedicalSpecific && (modelText.includes('optic') || modelText.includes('disc') || modelText.includes('cup'))) {
        return false
      }
      
      // Exclude highly specific automotive models for general queries  
      if (isAutomotiveSpecific && (modelText.includes('traffic') || modelText.includes('vehicle'))) {
        return false
      }
    }
    
    return true
  })
}
async function searchHFModels(
  keywords: string[], 
  taskType?: string,
  filterForInference: boolean = true
): Promise<NormalizedModel[]> {
  try {
    // Build search query with up to 3 keywords for better results
    const searchQuery = keywords.slice(0, 3).join('+')
    
    // Use filter parameter for better API-level filtering
    let url = `https://huggingface.co/api/models?search=${encodeURIComponent(searchQuery)}&sort=downloads&limit=500`
    
    // Add pipeline_tag filter if we have a specific task type
    const cvPipelineTags = [
      'image-classification',
      'object-detection',
      'image-segmentation',
      'image-to-text',
      'zero-shot-image-classification',
      'zero-shot-object-detection',
      'depth-estimation',
      'image-feature-extraction',
      'mask-generation',
      'video-classification'
    ]
    
    console.log(`🔍 HF Search:`, {
      keywords,
      searchQuery,
      taskType,
      url
    })
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }
    
    const apiKey = process.env.HUGGINGFACE_API_KEY
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    console.log('🔍 Searching Hugging Face models:', searchQuery)
    const response = await fetch(url, { headers })
    
    if (!response.ok) {
      console.error('❌ HF API error:', response.status, response.statusText)
      return []
    }

    const data = await response.json()
    
    if (!Array.isArray(data)) {
      console.error('Unexpected HF API response format')
      return []
    }

    console.log(`✅ Found ${data.length} total models on Hugging Face`)

    // Log sample for debugging
    const sampleModels = data.slice(0, 5).map(m => ({
      id: m.id,
      downloads: m.downloads,
      pipeline_tag: m.pipeline_tag,
      library_name: m.library_name
    }))
    console.log(`📊 Sample models:`, sampleModels)

    // Known failed models to exclude
    const knownFailedModels = [
      'asadimtiazmalik/my_traffic_dataset_model',
      'rohansaraswat/TrafficSignsDetection',
      'taufeeq28/vehicles',
      'Charansaiponnada/blip-traffic-rr',
      'Charansaiponnada/blip-indian-traffic-captioning',
      'Charansaiponnada/vijayawada-traffic-accessibility-v2-fixed',
      'dima806/traffic_sign_detection',
      'josephlyr/detr-resnet-50_finetuned_road_traffic'
    ]

    // Critical models that should NEVER be filtered out
    const criticalModels = [
      'microsoft/resnet-50',
      'microsoft/resnet-18', 
      'microsoft/resnet-152',
      'google/vit-base-patch16-224',
      'google/vit-large-patch16-224',
      'facebook/detr-resnet-50',
      'facebook/detr-resnet-101',
      'microsoft/beit-base-patch16-224',
      'microsoft/beit-large-patch16-224',
      'facebook/convnext-tiny-224',
      'facebook/convnext-base-224',
      'openai/clip-vit-base-patch32',
      'openai/clip-vit-large-patch14'
    ]

    console.log(`🔍 Starting filtering on ${data.length} models...`)

    const filteredData = data.filter((model: any) => {
      const modelId = model.id.toLowerCase()
      const modelName = (model.name || '').toLowerCase()
      const modelDescription = (model.description || '').toLowerCase()
      const pipelineTag = model.pipeline_tag
      const tagsArray = model.tags || []
      
      // ✅ KEYWORD RELEVANCE FILTERING - Prioritize models matching search query
      const searchKeywords = keywords.map(k => k.toLowerCase())
      const hasRelevantKeywords = searchKeywords.some(keyword => 
        modelId.includes(keyword) || 
        modelName.includes(keyword) ||
        modelDescription.includes(keyword) ||
        tagsArray.some((tag: string) => tag.toLowerCase().includes(keyword))
      )
      
      // If model doesn't match search keywords and is not critical/trusted, lower priority
      const trustedOrgs = ['microsoft/', 'facebook/', 'meta/', 'google/', 'openai/', 'nvidia/', 'huggingface/']
      const isRelevantToSearch = hasRelevantKeywords || 
                                 criticalModels.includes(model.id) ||
                                 trustedOrgs.some(org => model.id.toLowerCase().startsWith(org))
      
      // ✅ ALWAYS INCLUDE CRITICAL MODELS - NO MATTER WHAT
      if (criticalModels.includes(model.id)) {
        console.log(`✓ Keeping critical model: ${model.id}`)
        return true
      }
      
        // ✅ EXCLUDE KNOWN FAILED MODELS
        if (knownFailedModels.includes(model.id)) {
          return false
        }
        
      // ✅ EXCLUDE INAPPROPRIATE CONTENT
      const inappropriateTerms = ['nsfw', 'porn', 'adult', 'explicit', 'sexual', 'nude']
      if (inappropriateTerms.some(term => modelId.includes(term))) {
          return false
        }
        
      // ✅ TEXT AND SPEECH MODEL EXCLUSIONS - Only if explicitly text/speech
      const textSpeechPipelineTags = [
        'text-classification',
        'token-classification',
        'question-answering',
        'text-generation',
        'text2text-generation',
        'fill-mask',
        'summarization',
        'translation',
        'conversational',
        'text-to-speech',
        'automatic-speech-recognition',
        'audio-classification',
        'audio-to-audio',
        'voice-activity-detection'
      ]
      
      // Only exclude if pipeline tag is explicitly text/speech
      if (textSpeechPipelineTags.includes(pipelineTag)) {
          return false
        }
        
      // Text/speech patterns - but ONLY if NO vision indicators present
      const textSpeechPatterns = [
        'bert', 'gpt-2', 'gpt2', 't5-', 'roberta', 'distilbert', 'xlm-roberta',
        'deberta', 'bart-', 'pegasus', 'marian', 'mbart', 'blenderbot',
        'whisper', 'wav2vec', 'hubert', 'opt-', 'bloom-', 'llama'
      ]
      
      // Vision indicators that override text model exclusion
      const visionIndicators = [
        'vision', 'visual', 'image', 'vit', 'clip', 'resnet', 'detr',
        'swin', 'deit', 'beit', 'convnext', 'yolo', 'detection', 'segmentation'
      ]
      
      const hasVisionIndicator = visionIndicators.some(indicator => 
        modelId.includes(indicator) || 
        modelName.includes(indicator) ||
        modelDescription.includes(indicator) ||
        tagsArray.some((tag: string) => tag.toLowerCase().includes(indicator))
      )
      
      // Only exclude text/speech models if they DON'T have vision indicators
      if (!hasVisionIndicator) {
        const isTextSpeechByName = textSpeechPatterns.some(pattern => 
          modelId.includes(pattern)
        )
        
        if (isTextSpeechByName) {
          return false
        }
      }
      
      // ✅ COMPUTER VISION MODEL IDENTIFICATION - VERY RELAXED
      const cvPipelineTags = [
        'image-classification',
        'object-detection',
        'image-segmentation',
        'image-to-text',
        'zero-shot-image-classification',
        'zero-shot-object-detection',
        'depth-estimation',
        'image-feature-extraction',
        'mask-generation',
        'video-classification',
        'unconditional-image-generation',
        'image-to-image',
        'unknown' // Include unknown pipeline tags - might be CV models
      ]
      
      const hasCVPipelineTag = cvPipelineTags.includes(pipelineTag)
      
      // CV architecture keywords - expanded list
      const cvArchitectures = [
        'resnet', 'vit', 'detr', 'yolo', 'efficientnet', 'mobilenet',
        'inception', 'densenet', 'swin', 'convnext', 'deit', 'beit',
        'segformer', 'maskformer', 'mask2former', 'clip', 'dino',
        'detectron', 'rcnn', 'retinanet', 'squeezenet', 'alexnet',
        'vgg', 'googlenet', 'shufflenet', 'nasnet', 'resnext',
        'efficientnetv2', 'regnet', 'tresnet', 'poolformer'
      ]
      
      // CV task keywords - expanded
      const cvTaskKeywords = [
        'detection', 'detect', 'classify', 'classification', 'segment', 'segmentation',
        'vision', 'visual', 'image', 'photo', 'picture', 'depth',
        'pose', 'keypoint', 'face', 'object', 'scene', 'recognition',
        'recognition', 'localization', 'tracking', 'counting', 'estimation'
      ]
      
      // Check tags for CV indicators
      const hasCVTag = tagsArray.some((tag: string) => {
        const tagLower = tag.toLowerCase()
        return cvArchitectures.some(arch => tagLower.includes(arch)) ||
               cvTaskKeywords.some(keyword => tagLower.includes(keyword)) ||
               tagLower.includes('image') ||
               tagLower.includes('vision') ||
               tagLower.includes('detection') ||
               tagLower.includes('classification')
      })
      
      const hasCVArchitecture = cvArchitectures.some(arch => modelId.includes(arch))
      const hasCVTaskKeyword = cvTaskKeywords.some(keyword => 
        modelId.includes(keyword) || 
        modelDescription.includes(keyword) ||
        modelName.includes(keyword)
      )
      
      // Check if model is computer vision related - VERY PERMISSIVE
      const isComputerVisionModel = hasCVPipelineTag || 
                                    hasCVArchitecture || 
                                    hasCVTaskKeyword ||
                                    hasCVTag ||
                                    hasVisionIndicator
      
      // If not CV and not from a trusted org, exclude
      const isTrustedOrg = trustedOrgs.some(org => model.id.toLowerCase().startsWith(org))
      
      if (!isComputerVisionModel && !isTrustedOrg) {
          return false
        }
        
      // ✅ PRIORITIZE RELEVANT MODELS - If model doesn't match search keywords and is not critical/trusted, 
      // give it lower priority by filtering it out unless it's very high quality
      if (!isRelevantToSearch && !isTrustedOrg) {
        // Only keep non-relevant models if they have very high downloads (popular) or are high quality
        const highDownloads = (model.downloads || 0) > 1000 
        const highLikes = (model.likes || 0) > 5 
        const hasInference = Boolean(model.inference || (model.pipeline_tag && model.pipeline_tag !== 'unknown'))
        
        if (!highDownloads && !highLikes && !hasInference) {
          return false
        }
      }
        
      // ✅ NO LIBRARY VALIDATION - Accept all libraries for CV models
      // This allows models with 'unknown' library_name to pass through
      
      // ✅ NO QUALITY FILTERS - Accept all models that made it this far
      // Let popularity/downloads determine ranking, not filtering
      
      return true
      })
    
    console.log(`📊 After filtering: ${filteredData.length} models remaining`)
    
    // Sort by quality indicators - but keep critical models highly ranked
    const sortedData = filteredData.sort((a: any, b: any) => {
      // Get search keywords and trusted orgs for sorting
      const searchKeywords = keywords.map(k => k.toLowerCase())
      const trustedOrgs = ['microsoft/', 'facebook/', 'meta/', 'google/', 'huggingface/', 'openai/', 'nvidia/']
      // Priority 0: Critical models always come first
      const aIsCritical = criticalModels.includes(a.id)
      const bIsCritical = criticalModels.includes(b.id)
      
      if (aIsCritical && !bIsCritical) return -1
      if (!aIsCritical && bIsCritical) return 1
      
      // Priority 1: Relevance to search query
      const aIsRelevant = searchKeywords.some(keyword => 
        a.id.toLowerCase().includes(keyword) || 
        (a.name || '').toLowerCase().includes(keyword) ||
        (a.description || '').toLowerCase().includes(keyword) ||
        (a.tags || []).some((tag: string) => tag.toLowerCase().includes(keyword))
      )
      const bIsRelevant = searchKeywords.some(keyword => 
        b.id.toLowerCase().includes(keyword) || 
        (b.name || '').toLowerCase().includes(keyword) ||
        (b.description || '').toLowerCase().includes(keyword) ||
        (b.tags || []).some((tag: string) => tag.toLowerCase().includes(keyword))
      )
      
      if (aIsRelevant && !bIsRelevant) return -1
      if (!aIsRelevant && bIsRelevant) return 1
      
      // Priority 2: Trusted organizations
      const aIsTrusted = trustedOrgs.some(org => a.id.toLowerCase().startsWith(org))
      const bIsTrusted = trustedOrgs.some(org => b.id.toLowerCase().startsWith(org))
        
      if (aIsTrusted && !bIsTrusted) return -1
      if (!aIsTrusted && bIsTrusted) return 1
        
      // Priority 3: Downloads (main sorting)
      const downloadDiff = (b.downloads || 0) - (a.downloads || 0)
      if (downloadDiff !== 0) return downloadDiff
      
      // Priority 3: Has inference endpoint or known pipeline tag
      const aHasInference = Boolean(a.inference || (a.pipeline_tag && a.pipeline_tag !== 'unknown'))
      const bHasInference = Boolean(b.inference || (b.pipeline_tag && b.pipeline_tag !== 'unknown'))
      
      if (aHasInference && !bHasInference) return -1
      if (!aHasInference && bHasInference) return 1
      
      // Priority 4: Likes
      return (b.likes || 0) - (a.likes || 0)
    })
    
    console.log(`✅ Final result: ${sortedData.length} validated CV models`)
    
    // Log top models
    const topModels = sortedData.slice(0, 10).map(m => ({
      id: m.id,
      downloads: m.downloads,
      pipeline_tag: m.pipeline_tag,
      library: m.library_name
    }))
    console.log(`🏆 Top 10 models:`, topModels)
    
    return sortedData.map((model: any) => {
        const modelName = model.id.split('/').pop() || model.id
        const author = model.id.split('/')[0] || 'Unknown'
      const pipelineTag = model.pipeline_tag || 'image-classification'
        
      let cleanDescription = model.description || modelName
        cleanDescription = cleanDescription.replace(/\s+/g, ' ').trim()
        
      // Check inference support - be more lenient
      const hasTransformersLib = model.library_name === 'transformers'
      const hasEndpointsCompatible = (model.tags || []).includes('endpoints_compatible')
      const hasKnownCVPipeline = ['image-classification', 'object-detection', 'image-segmentation', 
        'image-to-text', 'zero-shot-image-classification', 
        'zero-shot-object-detection'].includes(pipelineTag)
      
      // Support inference if it has transformers + known CV pipeline, OR if it's a critical model
      const supportsInference = criticalModels.includes(model.id) ||
        (hasTransformersLib && hasKnownCVPipeline) ||
        (hasTransformersLib && hasEndpointsCompatible) ||
        Boolean(model.inference)
        
        return {
          id: model.id,
          name: modelName,
          source: 'huggingface' as const,
        description: cleanDescription,
          url: `https://huggingface.co/${model.id}`,
          modelUrl: `https://huggingface.co/${model.id}`,
          thumbnail: `https://huggingface.co/${model.id}/resolve/main/thumbnail.jpg`,
          task: mapHFTaskToStandard(pipelineTag),
          author: author,
          downloads: model.downloads || 0,
          likes: model.likes || 0,
          tags: model.tags || [],
        frameworks: [model.library_name].filter(Boolean),
          platforms: [],
          supportsInference,
        inferenceEndpoint: supportsInference 
          ? `https://api-inference.huggingface.co/models/${model.id}`
          : undefined,
        pipelineTag: pipelineTag,
        libraryName: model.library_name
        }
      })

  } catch (error) {
    console.error('Hugging Face search error:', error)
    return []
  }
}


/**
 * Fetch individual model details to check inference support
 * This makes an additional API call per model but gives accurate inference status
 */
async function fetchModelDetails(modelId: string): Promise<{ inferenceStatus: string | null }> {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(`https://huggingface.co/api/models/${modelId}`, { headers })
    
    if (!response.ok) {
      return { inferenceStatus: null }
    }

    const data = await response.json()
    
    return {
      inferenceStatus: data.inference || null
    }
  } catch (error) {
    console.error(`Error fetching details for ${modelId}:`, error)
    return { inferenceStatus: null }
  }
}



function mapHFTaskToStandard(pipelineTag: string): string {
  const taskMap: Record<string, string> = {
    'object-detection': 'detection',
    'image-classification': 'classification',
    'image-segmentation': 'segmentation',
    'zero-shot-image-classification': 'classification',
    'zero-shot-object-detection': 'detection'
  }
  return taskMap[pipelineTag] || 'detection'
}

function detectFrameworks(tags: string[]): string[] {
  const frameworks = new Set<string>()
  const frameworkMap: Record<string, string> = {
    'pytorch': 'PyTorch',
    'tensorflow': 'TensorFlow',
    'onnx': 'ONNX',
    'jax': 'JAX'
  }
  
  tags.forEach(tag => {
    const tagLower = tag.toLowerCase()
    Object.entries(frameworkMap).forEach(([key, value]) => {
      if (tagLower.includes(key)) {
        frameworks.add(value)
      }
    })
  })
  
  return Array.from(frameworks)
}


/**
 * Check if search results are cached in MongoDB
 */
async function checkSearchCache(cacheKey: string): Promise<any | null> {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()
    
    // Check if cache exists and is less than 1 hour old
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const cached = await db.collection('search_cache').findOne({
      cache_key: cacheKey,
      created_at: { $gte: oneHourAgo }
    })
    
    if (cached) {
      return cached.results
    }
    
    return null
  } catch (error) {
    console.error('Cache check error:', error)
    return null
  }
}

/**
 * Save search results to MongoDB cache
 */
async function saveSearchCache(cacheKey: string, results: any): Promise<void> {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()
    
    await db.collection('search_cache').updateOne(
      { cache_key: cacheKey },
      {
        $set: {
          cache_key: cacheKey,
          results: results,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      },
      { upsert: true }
    )
    
    console.log('✅ Search results cached in MongoDB:', cacheKey)
  } catch (error) {
    console.error('Cache save error:', error)
    // Don't fail the request if caching fails
  }
}


/**
 * Save ALL search results (including non-inference models) to MongoDB for analytics
 */
async function saveSearchAnalytics(queryId: string, analyticsData: any): Promise<void> {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()
    
    await db.collection('search_analytics').insertOne({
      query_id: queryId,
      total_models: analyticsData.total_found,
      inference_ready_count: analyticsData.inference_ready,
      non_inference_count: analyticsData.non_inference,
      all_models: analyticsData.models, // Save ALL models (including inference: null)
      sources: analyticsData.sources,
      keywords: analyticsData.keywords || [], // Include search keywords
      task_type: analyticsData.task_type || null, // Include task type
      created_at: analyticsData.timestamp
    })
    
    console.log(`📊 Saved ${analyticsData.total_found} models to analytics (${analyticsData.inference_ready} inference-ready, ${analyticsData.non_inference} non-inference)`)
  } catch (error) {
    console.error('Analytics save error:', error)
  }
}

/**
 * Background validation function (runs in parallel, doesn't block user)
 */
async function validateModelsInBackground(models: any[]): Promise<void> {
  console.log(`🧪 Background validation starting for ${models.length} models...`)
  
  const { markModelAsValidated } = await import('@/lib/mongodb/validatedModels')
  
  // Validate models in parallel (like the optimized Python script)
  const validationPromises = models.map(async (model) => {
    try {
      const modelId = model.id
      const taskType = model.task || model.pipeline_tag || 'unknown'
      
      // Quick warmup precheck
      const headResponse = await fetch(`https://router.huggingface.co/hf-inference/models/${modelId}`, {
        method: 'HEAD',
        headers: { 'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}` },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      
      if (!headResponse.ok) {
        // Endpoint not available
        await markModelAsValidated(modelId, false, `Endpoint not available (${headResponse.status})`)
        return
      }
      
      // Try actual inference
      const testInputs = getTestInputForTask(taskType)
      const response = await fetch(`https://router.huggingface.co/hf-inference/models/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testInputs),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      })
      
      if (response.ok) {
        const result = await response.json()
        await markModelAsValidated(modelId, true, result, {
          task_type: taskType,
          downloads: model.downloads,
          likes: model.likes,
          tags: model.tags,
          hosted: true,
          warm: false,
          inferenceStatus: 'hosted'
        })
        console.log(`✅ Background validated: ${modelId}`)
      } else {
        const errorText = await response.text()
        await markModelAsValidated(modelId, false, errorText)
        console.log(`❌ Background failed: ${modelId} (${response.status})`)
      }
      
    } catch (error) {
      console.error(`❌ Background validation error for ${model.id}:`, error)
      await markModelAsValidated(model.id, false, (error as Error).message)
    }
  })
  
  // Wait for all validations to complete
  await Promise.allSettled(validationPromises)
  console.log(`🧪 Background validation completed for ${models.length} models`)
}

/**
 * Get test input for task type
 */
function getTestInputForTask(taskType: string): any {
  const testInputs = {
    'image-classification': {
      inputs: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      parameters: { top_k: 5 }
    },
    'object-detection': {
      inputs: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      parameters: { threshold: 0.5 }
    },
    'fill-mask': {
      inputs: 'The capital of France is [MASK].',
      parameters: {}
    },
    'feature-extraction': {
      inputs: 'This is a sample text for feature extraction.',
      parameters: {}
    },
    'text-generation': {
      inputs: 'The future of AI is',
      parameters: { max_length: 50 }
    }
  }
  
  return testInputs[taskType as keyof typeof testInputs] || testInputs['image-classification']
}

/**
 * Check if a model is a Computer Vision model based on pipeline_tag and other indicators
 */
function isComputerVisionModel(model: any): boolean {
  const pipelineTag = model.pipeline_tag?.toLowerCase() || ''
  const tags = (model.tags || []).map((t: string) => t.toLowerCase())
  const description = (model.description || '').toLowerCase()
  
  // Computer Vision pipeline tags
  const cvPipelineTags = [
    'image-classification', 'object-detection', 'image-segmentation',
    'image-to-image', 'text-to-image', 'image-to-text', 'depth-estimation',
    'image-to-video', 'zero-shot-image-classification', 'mask-generation',
    'zero-shot-object-detection', 'image-feature-extraction', 'keypoint-detection',
    'video-classification', 'text-to-video', 'image-to-3d', 'text-to-3d',
    'image-text-to-text' // Include multimodal vision-language models
  ]
  
  // Computer Vision related tags and keywords
  const cvKeywords = [
    'vision', 'image', 'video', 'object', 'detection', 'classification',
    'segmentation', 'yolo', 'detr', 'resnet', 'mobilenet', 'efficientnet',
    'swin', 'vit', 'clip', 'dalle', 'stable-diffusion', 'controlnet'
  ]
  
  // Check pipeline tag
  if (cvPipelineTags.includes(pipelineTag)) {
    return true
  }
  
  // Check tags and description for CV keywords
  const hasCVKeywords = cvKeywords.some(keyword => 
    tags.includes(keyword) || description.includes(keyword)
  )
  
  return hasCVKeywords
}

/**
 * Check if a model matches search keywords (for relevance)
 */
function matchesSearchKeywords(model: any, keywords: string[]): boolean {
  const modelId = model.id.toLowerCase()
  const modelName = (model.model_name || '').toLowerCase()
  const description = (model.description || '').toLowerCase()
  const tags = (model.tags || []).map((t: string) => t.toLowerCase())
  
  // Check if any keyword appears in model metadata
  return keywords.some(keyword => {
    const lowerKeyword = keyword.toLowerCase()
    return modelId.includes(lowerKeyword) || 
           modelName.includes(lowerKeyword) || 
           description.includes(lowerKeyword) || 
           tags.some((tag: string) => tag.includes(lowerKeyword))
  })
}

/**
 * Save model recommendations to MongoDB (matches existing structure from save-model-selection)
 */
async function saveModelRecommendations(queryId: string, models: NormalizedModel[], keywords: string[], taskType?: string): Promise<void> {
  try {
    const { getDatabase } = await import('@/lib/mongodb/connection')
    const db = await getDatabase()
    
    // Map models to match the existing structure expected by save-model-selection
    const modelsWithClasses = models.map(model => ({
      name: model.name,
      source: model.source === 'huggingface' ? 'Hugging Face' : 'Roboflow',
      task: model.task,
      url: model.modelUrl,
      selected: false, // Will be updated when user selects a model
      classes: model.classes || undefined,
      // Additional metadata for analytics
      downloads: model.downloads,
      likes: model.likes || 0,
      tags: model.tags || [],
      supportsInference: model.supportsInference,
      inferenceStatus: model.inferenceStatus,
      isKnownWorking: model.isKnownWorking
    }))
    
    // Use the same structure as expected by save-model-selection API
    const recommendationRecord = {
      recommendation_id: `uuid-modelrec-${Date.now()}`,
      query_id: queryId,
      query_text: keywords.join(' '),
      keywords: keywords,
      task_type: taskType || 'detection',
      models: modelsWithClasses,
      created_at: new Date().toISOString()
    }
    
    await db.collection('model_recommendations').insertOne(recommendationRecord)
    console.log(`✅ Saved ${modelsWithClasses.length} model recommendations to MongoDB`)
    
  } catch (error) {
    console.error('❌ Failed to save model recommendations:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keywords, task_type, limit = 20, page = 1 } = body as ModelSearchRequest
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords array is required' },
        { status: 400 }
      )
    }
    
    console.log(`🔍 Model search request:`, { keywords, task_type, limit, page })
    
    // Generate unique query ID for tracking
    const queryId = `uuid-query-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    
    // Create a cache key based on search parameters (no time window for simplicity)
    const cacheKey = `search-${keywords.join('-')}-${task_type}`
    
    console.log(`🔑 Cache key: ${cacheKey}`)
    
    let allModels: any[] = []
    
    // Check if we should search or use cached results
    const shouldSearch = page === 1 // Only search on first page
    const searchKeywords = keywords.join(' ')
    
    if (shouldSearch) {
      console.log(`🔍 First page - performing full search for: ${searchKeywords}`)
    
    // Search both Hugging Face and Roboflow models
    // Note: Roboflow search now uses embedded browser modal in frontend
    const [huggingFaceModels, roboflowModels] = await Promise.allSettled([
      searchHFModels(keywords, task_type, true),
      // Search Roboflow models using Python script
      searchRoboflowModelsPython(keywords, task_type || 'object-detection')
    ])
    
    const hfModels = huggingFaceModels.status === 'fulfilled' ? huggingFaceModels.value : []
    const rfModels = roboflowModels.status === 'fulfilled' ? roboflowModels.value : []
    
    console.log(`📊 Found ${hfModels.length} Hugging Face models`)
    console.log(`📊 Found ${rfModels.length} Roboflow models`)
    
    // Debug: Show first few models before filtering
    if (hfModels.length > 0) {
      console.log(`🔍 Sample HF models before filtering:`, hfModels.slice(0, 3).map((m: any) => ({
        id: m.id,
        pipeline_tag: m.pipeline_tag || 'unknown',
        library_name: m.library_name || 'unknown',
        inference: m.inference || false,
        tags: m.tags || []
      })))
    }
    
    // Debug Roboflow search status
    if (roboflowModels.status === 'rejected') {
      console.error('❌ Roboflow search failed:', roboflowModels.reason)
    } else {
      console.log(`✅ Roboflow search succeeded with ${rfModels.length} models`)
    }
    
    // Combine and prioritize Roboflow models (they're more specific and valuable)
      allModels = [...rfModels, ...hfModels]
    console.log(`🔍 Total models before pagination: ${allModels.length} (HF: ${hfModels.length}, RF: ${rfModels.length})`)
      
      // Store in cache for subsequent pages (in a real implementation, use Redis or similar)
      // For now, we'll store in memory - in production, use proper caching
      if (!globalThis.searchCache) {
        globalThis.searchCache = new Map()
      }
      globalThis.searchCache.set(cacheKey, allModels)
      
      // Clean up old cache entries (keep only last 10 searches)
      if (globalThis.searchCache && globalThis.searchCache.size > 10) {
        const keysToDelete: string[] = []
        let count = 0
        globalThis.searchCache.forEach((value, key) => {
          if (count < globalThis.searchCache!.size - 10) {
            keysToDelete.push(key)
          }
          count++
        })
        keysToDelete.forEach(key => globalThis.searchCache!.delete(key))
      }
      
      console.log(`💾 Cached ${allModels.length} models for future pagination`)
      
    } else {
      console.log(`📄 Page ${page} - using cached results for: ${searchKeywords}`)
      
      // Use cached results for pagination
      if (!globalThis.searchCache) {
        globalThis.searchCache = new Map()
      }
      
      console.log(`🔍 Looking for cache key: ${cacheKey}`)
      console.log(`📊 Available cache keys:`, Array.from(globalThis.searchCache.keys()))
      console.log(`🔍 Cache size: ${globalThis.searchCache.size}`)
      
      // Clear old cache entries with old format (temporary fix)
      const oldKeys = Array.from(globalThis.searchCache.keys()).filter(key => key.includes('-') && /\d+$/.test(key))
      if (oldKeys.length > 0) {
        console.log(`🧹 Clearing ${oldKeys.length} old cache entries:`, oldKeys)
        oldKeys.forEach(key => globalThis.searchCache!.delete(key))
      }
      
      // Also clear all cache if we have old format keys (nuclear option)
      if (Array.from(globalThis.searchCache.keys()).some(key => /\d+$/.test(key))) {
        console.log(`🧹 Nuclear option: clearing all cache due to old format keys`)
        globalThis.searchCache.clear()
      }
      
      allModels = globalThis.searchCache.get(cacheKey) || []
      
      if (allModels.length === 0) {
        console.log(`⚠️ No cached results found, falling back to search`)
        // Fallback to search if cache miss
        const [huggingFaceModels, roboflowModels] = await Promise.allSettled([
          searchHFModels(keywords, task_type, true),
          // Search Roboflow models using Python script
          searchRoboflowModelsPython(keywords, task_type || 'object-detection')
        ])
        
        const hfModels = huggingFaceModels.status === 'fulfilled' ? huggingFaceModels.value : []
        const rfModels = roboflowModels.status === 'fulfilled' ? roboflowModels.value : []
        allModels = [...rfModels, ...hfModels]
      }
      
      console.log(`📊 Using ${allModels.length} cached models for pagination`)
    }
    
    // Apply pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedModels = allModels.slice(startIndex, endIndex)
    console.log(`📄 Paginated models: ${paginatedModels.length} (start: ${startIndex}, end: ${endIndex})`)
    
    // Save model recommendations to MongoDB (background task)
    if (paginatedModels.length > 0) {
      saveModelRecommendations(queryId, paginatedModels, keywords, task_type).catch(err => 
        console.error('Background recommendation save error:', err)
      )
    }
    
    // Save search analytics
    try {
      const { getDatabase } = await import('@/lib/mongodb/connection')
      const db = await getDatabase()
      
      const searchRecord = {
        query_id: queryId,
        user_id: 'anonymous', // TODO: Get from auth when available 
        query_text: keywords.join(' '),
        keywords: keywords,
        task_type: task_type || 'detection',
        total_results: allModels.length,
        returned_results: paginatedModels.length,
        page: page,
        limit: limit,
        created_at: new Date().toISOString()
      }
      
      await db.collection('search_cache').insertOne(searchRecord)
      console.log(`✅ Saved search analytics to MongoDB`)
      
    } catch (error) {
      console.error('Search analytics save error:', error)
    }
    
    return NextResponse.json({
      success: true,
      models: paginatedModels,
      pagination: {
        page,
        limit,
        total: allModels.length,
        totalPages: Math.ceil(allModels.length / limit),
        hasNextPage: endIndex < allModels.length,
        hasPrevPage: page > 1
      },
      queryId,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error) {
    console.error('❌ Model search error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

