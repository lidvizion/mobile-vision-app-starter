import type { Results } from '@mediapipe/pose';
import type { ExerciseAnalyzer, ExerciseState } from './types';

export class KettlebellAnalyzer implements ExerciseAnalyzer {
    private stateL: 'down' | 'up' = 'down';
    private stateR: 'down' | 'up' = 'down';
    private reps: number = 0;
    private feedback: string = 'Start at bottom';

    analyze(results: Results): ExerciseState {
        if (!results.poseLandmarks) {
            return { reps: this.reps, feedback: 'No pose detected', status: 'waiting' };
        }

        const landmarks = results.poseLandmarks;

        // Left Side
        const ls = landmarks[11]; // Shoulder
        const lh = landmarks[23]; // Hip
        const lw = landmarks[15]; // Wrist

        // Right Side
        const rs = landmarks[12]; // Shoulder
        const rh = landmarks[24]; // Hip
        const rw = landmarks[16]; // Wrist

        // Left Arm Logic
        if (this.stateL === 'down') {
            // Check if went up (wrist above shoulder)
            if (lw.y < ls.y) {
                this.stateL = 'up';
                this.feedback = 'Left Up!';
            }
        } else if (this.stateL === 'up') {
            // Check if returned to bottom (wrist below hip)
            if (lw.y > lh.y) {
                this.stateL = 'down';
                this.reps++;
                this.feedback = 'Left Rep Complete!';
            }
        }

        // Right Arm Logic
        if (this.stateR === 'down') {
            // Check if went up (wrist above shoulder)
            if (rw.y < rs.y) {
                this.stateR = 'up';
                this.feedback = 'Right Up!';
            }
        } else if (this.stateR === 'up') {
            // Check if returned to bottom (wrist below hip)
            if (rw.y > rh.y) {
                this.stateR = 'down';
                this.reps++;
                this.feedback = 'Right Rep Complete!';
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
        this.stateL = 'down';
        this.stateR = 'down';
        this.feedback = 'Start at bottom';
    }
}
