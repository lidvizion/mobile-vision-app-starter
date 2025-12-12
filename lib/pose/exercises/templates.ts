import type { Results, NormalizedLandmark } from '@mediapipe/pose';
import type { ExerciseAnalyzer, ExerciseState } from './types';

// MediaPipe landmark indices for reference
const LANDMARKS = {
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
};

// Configuration returned by API - simple parameters, no code
export interface ExerciseConfig {
    name: string;
    type: 'hinge' | 'squat' | 'push' | 'pull' | 'arm_raise';
    primary_angle: {
        point1: number; // landmark index
        point2: number; // vertex
        point3: number;
    };
    down_threshold: number; // angle when "down"
    up_threshold: number;   // angle when "up"
    use_left_side: boolean;
}

function getAngle(p1: NormalizedLandmark, p2: NormalizedLandmark, p3: NormalizedLandmark): number {
    const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

/**
 * ROBUST Template-based Exercise Runner
 * No AI-generated code execution - just pre-built, tested logic
 * The API only provides simple parameters that slot into this framework
 */
export class TemplateExerciseRunner implements ExerciseAnalyzer {
    private config: ExerciseConfig;
    private state: 'waiting' | 'up' | 'down' = 'waiting';
    private reps = 0;
    private feedback = 'Prepare to start';
    private currentAngle = 0;
    private frameCount = 0;
    private calibrationFrames: number[] = [];
    private isCalibrated = false;
    private dynamicUpThreshold = 0;
    private dynamicDownThreshold = 0;

    constructor(config: ExerciseConfig) {
        this.config = config;
    }

    reset() {
        this.state = 'waiting';
        this.reps = 0;
        this.feedback = 'Prepare to start';
        this.frameCount = 0;
        this.calibrationFrames = [];
        this.isCalibrated = false;
    }

    analyze(results: Results): ExerciseState {
        if (!results.poseLandmarks) {
            return { reps: this.reps, feedback: 'No pose detected', status: 'waiting' };
        }

        const landmarks = results.poseLandmarks;
        const { point1, point2, point3 } = this.config.primary_angle;

        // Safety check for landmarks
        if (!landmarks[point1] || !landmarks[point2] || !landmarks[point3]) {
            return {
                reps: this.reps,
                feedback: 'Missing keypoints',
                status: 'waiting',
                debug: { angle: 0 }
            };
        }

        this.currentAngle = getAngle(landmarks[point1], landmarks[point2], landmarks[point3]);
        this.frameCount++;

        // CALIBRATION PHASE: First 30 frames, determine starting position
        if (!this.isCalibrated && this.frameCount <= 30) {
            this.calibrationFrames.push(this.currentAngle);
            if (this.frameCount === 30) {
                this.calibrate();
            }
            return {
                reps: 0,
                feedback: `Calibrating... (${this.frameCount}/30)`,
                status: 'waiting',
                debug: { angle: Math.round(this.currentAngle) }
            };
        }

        // STATE MACHINE - using calibrated thresholds
        const { up, down } = this.getThresholds();

        if (this.state === 'waiting' || this.state === 'up') {
            // In UP position, waiting to go DOWN
            if (this.currentAngle < down) {
                this.state = 'down';
                this.feedback = 'Going down...';
            } else {
                this.feedback = 'In starting position';
                this.state = 'up';
            }
        } else if (this.state === 'down') {
            // In DOWN position, waiting to come back UP
            if (this.currentAngle > up) {
                this.state = 'up';
                this.reps++;
                this.feedback = `Rep ${this.reps} complete!`;
            } else {
                this.feedback = 'Hold...';
            }
        }

        return {
            reps: this.reps,
            feedback: this.feedback,
            status: 'active',
            debug: {
                angle: Math.round(this.currentAngle),
                state: this.state,
                up_threshold: Math.round(up),
                down_threshold: Math.round(down)
            }
        };
    }

    private calibrate() {
        const avgAngle = this.calibrationFrames.reduce((a, b) => a + b, 0) / this.calibrationFrames.length;

        // Auto-detect if starting HIGH (standing) or LOW (bent)
        // If avg angle > 140, assume standing (like squat/deadlift start)
        // If avg angle < 100, assume bent position

        if (avgAngle > 130) {
            // Starting from UP position (standing tall)
            this.dynamicUpThreshold = avgAngle - 15; // Don't need to fully return
            this.dynamicDownThreshold = avgAngle - 40; // Go down significantly
            this.state = 'up';
        } else {
            // Starting from DOWN position (bent over)
            this.dynamicDownThreshold = avgAngle + 15;
            this.dynamicUpThreshold = avgAngle + 40;
            this.state = 'down';
        }

        this.isCalibrated = true;
        console.log(`Calibrated: avg=${avgAngle.toFixed(1)}, up=${this.dynamicUpThreshold.toFixed(1)}, down=${this.dynamicDownThreshold.toFixed(1)}`);
    }

    private getThresholds() {
        if (this.isCalibrated) {
            return { up: this.dynamicUpThreshold, down: this.dynamicDownThreshold };
        }
        // Fallback to config thresholds
        return { up: this.config.up_threshold, down: this.config.down_threshold };
    }
}

// Pre-built configurations for common exercises
export const EXERCISE_TEMPLATES: Record<string, ExerciseConfig> = {
    deadlift: {
        name: 'Deadlift',
        type: 'hinge',
        primary_angle: {
            point1: LANDMARKS.LEFT_SHOULDER,
            point2: LANDMARKS.LEFT_HIP,
            point3: LANDMARKS.LEFT_KNEE,
        },
        down_threshold: 100,
        up_threshold: 150,
        use_left_side: true,
    },
    squat_template: {
        name: 'Squat',
        type: 'squat',
        primary_angle: {
            point1: LANDMARKS.LEFT_HIP,
            point2: LANDMARKS.LEFT_KNEE,
            point3: LANDMARKS.LEFT_ANKLE,
        },
        down_threshold: 90,
        up_threshold: 150,
        use_left_side: true,
    },
    pushup: {
        name: 'Push-Up',
        type: 'push',
        primary_angle: {
            point1: LANDMARKS.LEFT_SHOULDER,
            point2: LANDMARKS.LEFT_ELBOW,
            point3: LANDMARKS.LEFT_WRIST,
        },
        down_threshold: 90,
        up_threshold: 160,
        use_left_side: true,
    },
    jumping_jacks: {
        name: 'Jumping Jacks',
        type: 'arm_raise',
        primary_angle: {
            point1: LANDMARKS.LEFT_HIP,
            point2: LANDMARKS.LEFT_SHOULDER,
            point3: LANDMARKS.LEFT_ELBOW,
        },
        down_threshold: 30,
        up_threshold: 120,
        use_left_side: true,
    },
    bicep_curl: {
        name: 'Bicep Curl',
        type: 'pull',
        primary_angle: {
            point1: LANDMARKS.LEFT_SHOULDER,
            point2: LANDMARKS.LEFT_ELBOW,
            point3: LANDMARKS.LEFT_WRIST,
        },
        down_threshold: 50,
        up_threshold: 140,
        use_left_side: true,
    },
    kettlebell: {
        name: 'Kettlebell Swing',
        type: 'hinge',
        primary_angle: {
            point1: LANDMARKS.LEFT_SHOULDER,
            point2: LANDMARKS.LEFT_HIP,
            point3: LANDMARKS.LEFT_KNEE,
        },
        down_threshold: 90,
        up_threshold: 160,
        use_left_side: true,
    },
    long_cycle: {
        name: 'Long Cycle',
        type: 'hinge',
        primary_angle: {
            point1: LANDMARKS.LEFT_SHOULDER,
            point2: LANDMARKS.LEFT_HIP,
            point3: LANDMARKS.LEFT_KNEE,
        },
        down_threshold: 100,
        up_threshold: 170,
        use_left_side: true,
    },
    squat: {
        name: 'Squat',
        type: 'squat',
        primary_angle: {
            point1: LANDMARKS.LEFT_HIP,
            point2: LANDMARKS.LEFT_KNEE,
            point3: LANDMARKS.LEFT_ANKLE,
        },
        down_threshold: 90,
        up_threshold: 150,
        use_left_side: true,
    },
};

/**
 * Create a runner for a known exercise by name
 */
export function createTemplateRunner(exerciseName: string): TemplateExerciseRunner | null {
    const key = exerciseName.toLowerCase().replace(/\s+/g, '_');
    const config = EXERCISE_TEMPLATES[key];
    if (config) {
        return new TemplateExerciseRunner(config);
    }
    return null;
}
