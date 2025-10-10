import { RoboflowProject, RoboflowModel, ModelMetadata } from '@/types/models'

const ROBOFLOW_API_KEY = process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY
const ROBOFLOW_WORKSPACE = process.env.NEXT_PUBLIC_ROBOFLOW_WORKSPACE

export async function searchRoboflowModels(query: string): Promise<ModelMetadata[]> {
  if (!ROBOFLOW_API_KEY) {
    console.warn('Roboflow API key not configured')
    return []
  }

  try {
    // Search workspace projects
    const projectsUrl = `https://api.roboflow.com/${ROBOFLOW_WORKSPACE}?api_key=${ROBOFLOW_API_KEY}`
    const response = await fetch(projectsUrl)
    
    if (!response.ok) {
      throw new Error(`Roboflow API error: ${response.statusText}`)
    }

    const data = await response.json()
    const projects: RoboflowProject[] = data.projects || []

    // Filter projects based on query
    const filteredProjects = projects.filter(project => 
      project.name.toLowerCase().includes(query.toLowerCase()) ||
      project.type.toLowerCase().includes(query.toLowerCase()) ||
      project.classes?.some(c => c.toLowerCase().includes(query.toLowerCase()))
    )

    // Convert to ModelMetadata format
    return filteredProjects.map(project => ({
      id: project.id,
      name: project.name,
      description: `${project.type} model with ${project.classes?.length || 0} classes`,
      source: 'roboflow' as const,
      task: mapRoboflowTypeToTask(project.type),
      imageUrl: project.public ? `https://app.roboflow.com/${ROBOFLOW_WORKSPACE}/${project.id}` : undefined,
      tags: project.classes || [],
      created: new Date(project.created * 1000).toISOString(),
      updated: new Date(project.updated * 1000).toISOString(),
    }))
  } catch (error) {
    console.error('Error fetching Roboflow models:', error)
    return []
  }
}

export async function getRoboflowModelDetails(projectId: string, version?: string): Promise<RoboflowModel | null> {
  if (!ROBOFLOW_API_KEY || !ROBOFLOW_WORKSPACE) {
    return null
  }

  try {
    const versionParam = version || '1'
    const url = `https://api.roboflow.com/${ROBOFLOW_WORKSPACE}/${projectId}/${versionParam}?api_key=${ROBOFLOW_API_KEY}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Roboflow API error: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching Roboflow model details:', error)
    return null
  }
}

function mapRoboflowTypeToTask(type: string): ModelMetadata['task'] {
  const lowerType = type.toLowerCase()
  if (lowerType.includes('object') || lowerType.includes('detection')) return 'detection'
  if (lowerType.includes('classification')) return 'classification'
  if (lowerType.includes('segment')) return 'segmentation'
  return 'other'
}

