/**
 * Example queries for the model search interface
 */
export const EXAMPLE_QUERIES = [
  "I want to detect trash in images from beach cleanups",
  "Identify basketball shots and player positions",
  "Detect vehicles in traffic footage",
  "Count people entering and leaving my store",
  "Detect defects on circuit boards in manufacturing",
  "Identify different types of plants and diseases"
]

/**
 * Task-specific example queries
 */
export const EXAMPLE_QUERIES_BY_TASK = {
  'detection': [
    "Detect PPE and safety equipment on construction sites",
    "Detect defects on circuit boards in manufacturing",
    "Count people entering and leaving my store",
    "Detect vehicles in traffic footage",
    "Detect trash in images from beach cleanups"
  ],
  'classification': [
    "Classify product quality as pass or fail",
    "Classify different types of plants and diseases",
    "Classify damage severity in insurance photos",
    "Classify inventory items by category",
    "Classify basketball shots and player positions"
  ],
  'segmentation': [
    "Segment building components in architectural images",
    "Segment road lanes and markings in traffic footage",
    "Segment people from background in photos",
    "Segment different materials in recycling images",
    "Segment organs and tissues in medical scans"
  ],
  'keypoint-detection': [
    "Detect human pose keypoints in fitness videos",
    "Track athlete movements and form analysis",
    "Detect hand gestures and sign language",
    "Analyze dance movements and choreography",
    "Detect facial keypoints for emotion recognition"
  ]
}