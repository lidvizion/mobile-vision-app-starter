import type { Results } from '@mediapipe/pose';
import type { ExerciseAnalyzer, ExerciseState } from './types';

export class LongCycleAnalyzer implements ExerciseAnalyzer {
    private state: 'down' | 'up' = 'down';
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

        // Check visibility
        if (lw.visibility && lw.visibility < 0.5 || rw.visibility && rw.visibility < 0.5) {
            return { reps: this.reps, feedback: 'Ensure both hands are visible', status: 'waiting' };
        }

        // Logic: Both hands must move together
        const leftUp = lw.y < ls.y;
        const rightUp = rw.y < rs.y;
        const leftDown = lw.y > lh.y;
        const rightDown = rw.y > rh.y;

        if (this.state === 'down') {
            // Check if both went up
            if (leftUp && rightUp) {
                this.state = 'up';
                this.feedback = 'Up! Hold...';
            } else if (leftUp || rightUp) {
                this.feedback = 'Lift both hands!';
            }
        } else if (this.state === 'up') {
            // Check if both returned to bottom
            if (leftDown && rightDown) {
                this.state = 'down';
                this.reps++;
                this.feedback = 'Rep Complete!';
            } else if (leftDown || rightDown) {
                this.feedback = 'Bring both down!';
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
        this.state = 'down';
        this.feedback = 'Start at bottom';
    }
}
