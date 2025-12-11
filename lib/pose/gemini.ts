import type { ExerciseConfig } from './exercises/templates';

// Old interface kept for backward compatibility
export interface GeminiResponse {
    setup_logic: string;
    frame_logic: string;
    keypoints_needed: number[];
}

export interface BiomechanicsAnalysis {
    type: string;
    phases: string[];
    important_keypoints: string[];
    critical_angles: string[];
}

// NEW: Simple config that the robust template system uses
// No code generation - just parameters!
const CONFIG_PROMPT = `You are a biomechanics expert. For the exercise "{exerciseName}", provide configuration for a rep counter.

MediaPipe Pose landmark indices:
- 11: Left Shoulder, 12: Right Shoulder
- 13: Left Elbow, 14: Right Elbow  
- 15: Left Wrist, 16: Right Wrist
- 23: Left Hip, 24: Right Hip
- 25: Left Knee, 26: Right Knee
- 27: Left Ankle, 28: Right Ankle

Return JSON with these exact fields:
{
  "name": "Human readable name",
  "type": "hinge" | "squat" | "push" | "pull" | "arm_raise",
  "primary_angle": {
    "point1": 11,  // First landmark index (forms one ray of the angle)
    "point2": 23,  // Vertex landmark index (where angle is measured)
    "point3": 25   // Third landmark index (forms other ray of the angle)
  },
  "down_threshold": 100,  // Angle (degrees) when in "down" or contracted position
  "up_threshold": 150,    // Angle (degrees) when in "up" or extended position
  "use_left_side": true
}

RULES:
- For hinge movements (deadlift, hip hinge): measure shoulder-hip-knee angle
- For squats: measure hip-knee-ankle angle
- For push/pull (pushup, bicep curl): measure shoulder-elbow-wrist angle
- For arm raises: measure hip-shoulder-elbow angle
- down_threshold should be SMALLER than up_threshold for most exercises
- Choose angles that clearly distinguish the two positions

Return ONLY the JSON object, no markdown or explanation.`;

/**
 * NEW SIMPLIFIED API CALL
 * Returns simple config parameters, no code!
 * Uses Gemini 2.0 Flash
 */
export async function generateExerciseConfig(apiKey: string, exerciseName: string): Promise<ExerciseConfig> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [
                    { text: CONFIG_PROMPT.replace('{exerciseName}', exerciseName) }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1  // Low temperature for consistent outputs
            }
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API Error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    try {
        let config = JSON.parse(text);

        // Handle case where API returns an array
        if (Array.isArray(config)) {
            config = config[0];
        }

        // Validate the response has required fields
        if (!config.primary_angle || typeof config.down_threshold !== 'number') {
            throw new Error('Invalid config structure');
        }

        return config as ExerciseConfig;
    } catch (e) {
        console.error("Failed to parse Gemini config response", text);
        throw new Error("Invalid config received from Gemini");
    }
}

// ============ LEGACY FUNCTIONS (kept for backward compatibility) ============

export async function generateBiomechanicsAnalysis(apiKey: string, exerciseName: string): Promise<BiomechanicsAnalysis> {
    const ANALYSIS_SYSTEM_PROMPT = `You are a Biomechanics Lead. Your goal is to analyze the user's exercise request and break it down into biomechanical components.
Request: ${exerciseName}

Output JSON format:
{
  "type": "Hinge" | "Squat" | "Push" | "Pull" | "Rotation" | "Other",
  "phases": ["Eccentric", "Concentric"], 
  "important_keypoints": ["Left Shoulder", "Left Hip"],
  "critical_angles": ["Hip angle should start > 160", "Hip angle should go < 100 at bottom"]
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [
                    { text: ANALYSIS_SYSTEM_PROMPT }
                ]
            }],
            generationConfig: { responseMimeType: "application/json" }
        })
    });
    if (!response.ok) throw new Error("Analysis failed");
    const data = await response.json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
}

export async function generateExercisePlan(_apiKey: string, exerciseName: string, analysis: BiomechanicsAnalysis): Promise<string> {
    // Stub - not used in new system
    return `Plan for ${exerciseName}: ${analysis.type}`;
}

export async function generateExerciseLogic(
    _apiKey: string,
    _exerciseName: string,
    _planOrPreviousCode?: string,
    _feedback?: string
): Promise<GeminiResponse> {
    // Stub - not used in new system, returns minimal valid response
    return {
        setup_logic: "context.state = 'up';",
        frame_logic: "return { count: 0, feedback: 'Use template system instead', debug: {} };",
        keypoints_needed: [11, 23, 25]
    };
}
