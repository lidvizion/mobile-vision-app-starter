const OPENAI_API_KEY = process.env.OPENAI_API_KEY

export async function enhanceSearchQuery(query: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured')
    return query
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a computer vision expert. Given a user search query for CV models, enhance it by adding relevant technical terms, synonyms, and related concepts. Return only the enhanced query string without explanation.',
          },
          {
            role: 'user',
            content: `Enhance this search query for computer vision models: "${query}"`,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content?.trim() || query
  } catch (error) {
    console.error('Error enhancing search query:', error)
    return query
  }
}

export async function categorizeModel(modelName: string, modelDescription: string): Promise<{
  task: string
  framework?: string
  useCases: string[]
}> {
  if (!OPENAI_API_KEY) {
    return {
      task: 'unknown',
      useCases: [],
    }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a computer vision expert. Analyze the model and return a JSON object with: task (detection/classification/segmentation/other), framework (tensorflow/pytorch/onnx/etc), and useCases (array of practical applications).',
          },
          {
            role: 'user',
            content: `Model: ${modelName}\nDescription: ${modelDescription}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const result = JSON.parse(data.choices[0]?.message?.content || '{}')
    return result
  } catch (error) {
    console.error('Error categorizing model:', error)
    return {
      task: 'unknown',
      useCases: [],
    }
  }
}

