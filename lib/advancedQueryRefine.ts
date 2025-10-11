/**
 * Advanced Query Refinement
 * 
 * Uses a structured prompt to extract detailed CV task information from user input.
 * Can use OpenAI GPT-mini or local NLP for extraction.
 */

export interface AdvancedQueryRefineResult {
  task: string // "object detection", "semantic segmentation", etc.
  media_type: string // "image", "video", or "both"
  realtime: boolean
  input_constraints: {
    resolution: string
    fps: number | null
    streaming: boolean
  }
  output_type: string // "bounding boxes", "segmentation masks", etc.
  hardware_target: string // "cloud", "edge", "mobile", "unknown"
  priority: string // "accuracy", "speed", "cost", or "balanced"
  keywords: string[]
  summary: string
}

const SYSTEM_PROMPT = `You are a smart assistant that helps map a user's plain language request into structured information to search for computer vision models.

The user will describe a task related to images or video (e.g. "detect objects in a street camera feed," "analyze hand poses in real-time," etc). Your job is to output the following fields in **JSON** format:

{
  "task": string,                        // ONE of: "object detection", "semantic segmentation", "instance segmentation", "classification", "pose estimation", "OCR", "depth estimation", "tracking", "multi-modal", or "other"
  "media_type": string,                 // ONE of: "image", "video", or "both"
  "realtime": boolean,                  // True if the user implies or states real-time or low-latency needs
  "input_constraints": {
    "resolution": string,               // e.g. "1920x1080", "4K", "variable", or "unknown"
    "fps": number | null,               // Frames per second, if video; else null
    "streaming": boolean                // True if input is a continuous stream
  },
  "output_type": string,                // "bounding boxes", "segmentation masks", "class labels", "keypoints", "text", or "other"
  "hardware_target": string,            // "cloud", "edge", "mobile", "unknown"
  "priority": string,                   // "accuracy", "speed", "cost", or "balanced"
  "keywords": string[],                // List of search terms like: "YOLOv8", "real-time face detection", "SAM", "pose estimation API"
  "summary": string                    // One-line natural language summary of what the user is trying to do
}

ONLY return the JSON. Do not include explanations, markdown, or surrounding text.`

const EXAMPLE_INPUT = "I want to detect multiple types of trash in real-time from a drone feed, ideally using a lightweight model that can run on an edge device."

const EXAMPLE_OUTPUT = {
  "task": "object detection",
  "media_type": "video",
  "realtime": true,
  "input_constraints": {
    "resolution": "variable",
    "fps": 30,
    "streaming": true
  },
  "output_type": "bounding boxes",
  "hardware_target": "edge",
  "priority": "speed",
  "keywords": ["YOLOv8", "real-time trash detection", "edge inference", "video object detection"],
  "summary": "Detect trash objects in real-time from a drone video feed using an edge-deployable model."
}

/**
 * Refine user query using OpenAI or fallback to rule-based extraction
 */
export async function advancedQueryRefine(userInput: string): Promise<AdvancedQueryRefineResult> {
  const openaiKey = process.env.OPENAI_API_KEY
  
  if (!openaiKey) {
    throw new Error('❌ OPENAI_API_KEY is required. No fallback allowed. Please add a valid OpenAI API key to .env.local')
  }
  
  // Use OpenAI for advanced extraction (NO FALLBACK)
  try {
    console.log('🤖 Using OpenAI GPT-3.5-turbo for query refinement...')
    return await refineWithOpenAI(userInput, openaiKey)
  } catch (error) {
    console.error('❌ OpenAI refinement failed:', error)
    throw new Error(`OpenAI API Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your API key.`)
  }
}

/**
 * Use OpenAI GPT-3.5-turbo or GPT-4 for query refinement
 */
async function refineWithOpenAI(userInput: string, apiKey: string): Promise<AdvancedQueryRefineResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userInput }
      ],
      temperature: 0.3,
      max_tokens: 500
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content || '{}'
  
  return JSON.parse(content) as AdvancedQueryRefineResult
}

/**
 * Rule-based extraction (fallback when OpenAI is not available)
 */
function ruleBasedExtraction(userInput: string): AdvancedQueryRefineResult {
  const input = userInput.toLowerCase()
  
  // Detect task type
  let task = 'object detection' // default
  if (input.includes('segment') || input.includes('mask')) {
    task = input.includes('semantic') ? 'semantic segmentation' : 'instance segmentation'
  } else if (input.includes('classif') || input.includes('categor')) {
    task = 'classification'
  } else if (input.includes('pose') || input.includes('skeleton') || input.includes('keypoint')) {
    task = 'pose estimation'
  } else if (input.includes('ocr') || input.includes('text') || input.includes('read')) {
    task = 'OCR'
  } else if (input.includes('track')) {
    task = 'tracking'
  } else if (input.includes('depth') || input.includes('3d')) {
    task = 'depth estimation'
  }
  
  // Detect media type
  const media_type = input.includes('video') || input.includes('stream') || input.includes('camera feed')
    ? 'video'
    : input.includes('both') || input.includes('and video')
    ? 'both'
    : 'image'
  
  // Detect realtime requirement
  const realtime = input.includes('real-time') || input.includes('realtime') || 
                   input.includes('live') || input.includes('instant') ||
                   input.includes('fast') || input.includes('quick')
  
  // Detect hardware target
  let hardware_target = 'unknown'
  if (input.includes('edge') || input.includes('on-device')) {
    hardware_target = 'edge'
  } else if (input.includes('mobile') || input.includes('phone') || input.includes('android') || input.includes('ios')) {
    hardware_target = 'mobile'
  } else if (input.includes('cloud') || input.includes('server')) {
    hardware_target = 'cloud'
  }
  
  // Detect priority
  let priority = 'balanced'
  if (input.includes('accurate') || input.includes('precision') || input.includes('best')) {
    priority = 'accuracy'
  } else if (input.includes('fast') || input.includes('quick') || input.includes('speed') || input.includes('lightweight')) {
    priority = 'speed'
  } else if (input.includes('cheap') || input.includes('cost') || input.includes('free')) {
    priority = 'cost'
  }
  
  // Extract keywords
  const keywords: string[] = []
  
  // Add task-specific keywords
  if (task.includes('detection')) {
    keywords.push('YOLO', 'object detection')
    if (realtime) keywords.push('real-time detection')
  } else if (task.includes('segmentation')) {
    keywords.push('segmentation', 'SAM', 'Mask R-CNN')
  } else if (task.includes('classification')) {
    keywords.push('classification', 'ResNet', 'ViT')
  } else if (task.includes('pose')) {
    keywords.push('pose estimation', 'MediaPipe', 'OpenPose')
  }
  
  // Add hardware keywords
  if (hardware_target === 'mobile' || hardware_target === 'edge') {
    keywords.push('lightweight', 'mobile-optimized')
  }
  
  // Add domain-specific keywords from input
  const domainKeywords = userInput
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !['want', 'need', 'using', 'with', 'from', 'that', 'this'].includes(word))
    .slice(0, 5)
  
  keywords.push(...domainKeywords)
  
  // Detect resolution
  let resolution = 'unknown'
  if (input.includes('4k')) resolution = '4K'
  else if (input.includes('1080') || input.includes('hd')) resolution = '1920x1080'
  else if (input.includes('720')) resolution = '1280x720'
  else if (input.match(/\d{3,4}x\d{3,4}/)) resolution = input.match(/\d{3,4}x\d{3,4}/)?.[0] || 'unknown'
  
  // Detect FPS
  const fpsMatch = input.match(/(\d+)\s*fps/)
  const fps = fpsMatch ? parseInt(fpsMatch[1]) : (media_type === 'video' ? 30 : null)
  
  // Determine output type
  let output_type = 'bounding boxes'
  if (task.includes('segmentation')) output_type = 'segmentation masks'
  else if (task.includes('classification')) output_type = 'class labels'
  else if (task.includes('pose')) output_type = 'keypoints'
  else if (task.includes('OCR')) output_type = 'text'
  
  return {
    task,
    media_type,
    realtime,
    input_constraints: {
      resolution,
      fps,
      streaming: input.includes('stream') || input.includes('feed') || input.includes('camera')
    },
    output_type,
    hardware_target,
    priority,
    keywords: Array.from(new Set(keywords)), // Remove duplicates
    summary: userInput.trim()
  }
}

/**
 * Map advanced task to simple task_type for backward compatibility
 */
export function mapAdvancedTaskToSimple(advancedTask: string): string {
  const taskMap: Record<string, string> = {
    'object detection': 'detection',
    'semantic segmentation': 'segmentation',
    'instance segmentation': 'segmentation',
    'classification': 'classification',
    'pose estimation': 'detection',
    'OCR': 'detection',
    'depth estimation': 'segmentation',
    'tracking': 'detection',
    'multi-modal': 'detection'
  }
  return taskMap[advancedTask] || 'detection'
}

