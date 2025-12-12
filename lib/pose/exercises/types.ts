import type { Results } from '@mediapipe/pose';

export interface ExerciseState {
    reps: number;
    feedback: string;
    state?: string;
    status: 'waiting' | 'active' | 'complete';
    debug?: Record<string, number | string>;
}

export interface ExerciseAnalyzer {
    analyze: (results: Results) => ExerciseState;
    reset: () => void;
}
