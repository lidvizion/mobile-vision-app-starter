import { ExtractedKeywords } from '@/types/models'

// CV tasks and their synonyms
const CV_TASKS = {
  detection: ['detect', 'find', 'locate', 'identify', 'spot', 'recognize'],
  classification: ['classify', 'categorize', 'label', 'identify', 'recognize'],
  segmentation: ['segment', 'separate', 'isolate', 'mask', 'outline'],
  counting: ['count', 'tally', 'number', 'quantify'],
  tracking: ['track', 'follow', 'monitor']
}

// Common CV domains
const CV_DOMAINS = {
  retail: ['store', 'shop', 'retail', 'customer', 'shopping'],
  manufacturing: ['factory', 'production', 'assembly', 'defect', 'quality'],
  agriculture: ['farm', 'crop', 'plant', 'livestock'],
  healthcare: ['medical', 'patient', 'xray', 'scan'],
  security: ['security', 'surveillance', 'intrusion'],
  automotive: ['car', 'vehicle', 'traffic', 'road']
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'my', 'your', 'their', 'this', 'that', 'what', 'want', 'need', 'building'
])

export function extractKeywords(query: string): ExtractedKeywords {
  const lowercaseQuery = query.toLowerCase()
  const words = lowercaseQuery
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
  
  // Extract actions and tasks
  const actions: string[] = []
  const tasks: string[] = []
  
  Object.entries(CV_TASKS).forEach(([task, synonyms]) => {
    synonyms.forEach(synonym => {
      if (lowercaseQuery.includes(synonym)) {
        actions.push(synonym)
        if (!tasks.includes(task)) {
          tasks.push(task)
        }
      }
    })
  })
  
  // Extract domain
  let domain: string | null = null
  Object.entries(CV_DOMAINS).forEach(([domainName, keywords]) => {
    keywords.forEach(keyword => {
      if (lowercaseQuery.includes(keyword) && !domain) {
        domain = domainName
      }
    })
  })
  
  // Extract objects (nouns)
  const objects = words
    .filter(word => !STOP_WORDS.has(word))
    .filter(word => !actions.includes(word))
    .filter((word, index, self) => self.indexOf(word) === index)
  
  // Combine all keywords
  const keywordSet = new Set([...actions, ...objects, ...(domain ? [domain] : [])])
  const allKeywords = Array.from(keywordSet)
  
  return {
    objects,
    actions,
    tasks,
    domain,
    allKeywords
  }
}

export const EXAMPLE_QUERIES = [
  "I want to detect trash in images from beach cleanups",
  "Identify basketball shots and player positions",
  "Detect vehicles in traffic footage",
  "Count people entering and leaving my store",
  "Detect defects on circuit boards in manufacturing",
  "Identify different types of plants and diseases"
]

