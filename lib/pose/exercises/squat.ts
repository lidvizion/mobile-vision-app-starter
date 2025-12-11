import type { Results, NormalizedLandmark } from '@mediapipe/pose';
import type { ExerciseAnalyzer, ExerciseState } from './types';

export class SquatAnalyzer implements ExerciseAnalyzer {
    private state: 'up' | 'down' = 'up';
    private reps: number = 0;
    private feedback: string = 'Stand in frame';

    calculateAngle(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
        const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs(radians * 180.0 / Math.PI);
        if (angle > 180.0) angle = 360 - angle;
        return angle;
    }

    analyze(results: Results): ExerciseState {
        if (!results.poseLandmarks) {
            return { reps: this.reps, feedback: 'No pose detected', status: 'waiting' };
        }

        const landmarks = results.poseLandmarks;

        // Hip, Knee, Ankle indices (Left side: 23, 25, 27; Right side: 24, 26, 28)
        // We'll use left side for now, or average both
        const leftHip = landmarks[23];
        const leftKnee = landmarks[25];
        const leftAnkle = landmarks[27];

        // Check visibility
        if (leftHip.visibility && leftHip.visibility < 0.5 ||
            leftKnee.visibility && leftKnee.visibility < 0.5 ||
            leftAnkle.visibility && leftAnkle.visibility < 0.5) {
            return { reps: this.reps, feedback: 'Ensure full body is visible', status: 'waiting' };
        }

        const angle = this.calculateAngle(leftHip, leftKnee, leftAnkle);

        // State machine
        if (this.state === 'up') {
            if (angle < 90) { // Deep squat
                this.state = 'down';
                this.feedback = 'Good depth! Now up.';
            } else if (angle < 140) {
                this.feedback = 'Go lower...';
            } else {
                this.feedback = 'Ready for next rep';
            }
        } else if (this.state === 'down') {
            if (angle > 160) { // Standing up
                this.state = 'up';
                this.reps += 1;
                this.feedback = 'Rep complete!';
            } else {
                this.feedback = 'Push up!';
            }
        }

        return {
            reps: this.reps,
            feedback: this.feedback,
            status: 'active'
        };
    }

    reset() {
        this.reps = 0;
        this.state = 'up';
        this.feedback = 'Stand in frame';
    }
}
