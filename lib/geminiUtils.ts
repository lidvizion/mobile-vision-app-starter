/**
 * Shared utility functions for Gemini inference
 * Used by both /api/run-inference and /api/gemini-inference
 */

export function generatePrompt(task: string, customPrompt?: string): string {
  if (customPrompt) return customPrompt;

  switch (task) {
    case 'object-detection':
      return `Analyze this image and detect all objects. For each object found, provide:
1. The object label/class name
2. A confidence score (0-1)
3. The bounding box coordinates as [x_min, y_min, x_max, y_max] normalized to 0-1 range

Return the results as a JSON array with this exact format:
[
  {
    "label": "object_name",
    "score": 0.95,
    "box": {
      "xmin": 0.1,
      "ymin": 0.2,
      "xmax": 0.5,
      "ymax": 0.8
    }
  }
]

IMPORTANT: Return ONLY the JSON array, no additional text or markdown formatting.`;
    
    case 'classification':
    case 'image-classification':
      return `Classify this image. Identify the main subject or category.
Return the results as a JSON array with this exact format:
[
  {
    "label": "category_name",
    "score": 0.95
  }
]

Provide top 5 most likely categories.
IMPORTANT: Return ONLY the JSON array, no additional text or markdown formatting.`;
    
    case 'segmentation':
    case 'instance-segmentation':
      return `Analyze this image and identify all distinct objects/instances for segmentation.
For each instance, provide:
1. The object label
2. A confidence score
3. A description of the object's location

Return as JSON array:
[
  {
    "label": "object_name",
    "score": 0.95,
    "mask": "description of object location and boundaries"
  }
]

IMPORTANT: Return ONLY the JSON array, no additional text or markdown formatting.`;
    
    default:
      return `Analyze this image and provide detailed information about what you see. 
Return the results as a JSON array with detected objects and their properties.`;
  }
}

