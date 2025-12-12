import type { Results, NormalizedLandmark } from '@mediapipe/pose';
import type { ExerciseAnalyzer, ExerciseState } from './types';

interface DynamicContext {
    state: any;
    reps: number;
    feedback: string;
}

export class DynamicExerciseRunner implements ExerciseAnalyzer {
    private context: DynamicContext = {
        state: {},
        reps: 0,
        feedback: 'Prepare to start'
    };

    private setupFn: Function | null = null;
    private frameFn: Function | null = null;
    private keypointsNeeded: number[] = [];
    private logicJson: { setup_logic: string, frame_logic: string, keypoints_needed: number[] };

    constructor(
        logicJson: { setup_logic: string, frame_logic: string, keypoints_needed: number[] }
    ) {
        this.logicJson = logicJson;
        this.keypointsNeeded = logicJson.keypoints_needed || [];
        this.compile();
    }

    private compile() {
        try {
            // Setup Logic
            // Prompt instruction: "context.state = 'up'; ..."
            // We pass 'context' (which contains state) and 'utils'.
            this.setupFn = new Function('context', 'utils', `
                const { getAngle, getVelocity, isVertical } = utils;
                try {
                    ${this.logicJson.setup_logic};
                } catch(e) {
                    console.error("Setup Logic Runtime Error:", e);
                }
            `);

            // Frame Logic
            // Prompt instruction: "Use 'context.state' to read/write state... Return { count: ... }"
            console.log("Compiling Frame Logic:", this.logicJson.frame_logic);

            this.frameFn = new Function('context', 'landmarks', 'utils', `
                const { getAngle, getVelocity, isVertical } = utils;
                try {
                    ${this.logicJson.frame_logic}
                } catch(e) {
                    console.error("Frame Logic Runtime Error:", e);
                    return { feedback: "Logic Error: " + e.message, debug: { error: e.message } };
                }
            `);

            this.reset();
        } catch (e) {
            console.error("Compilation Error:", e);
            this.context.feedback = "Logic Compilation Failed";
        }
    }

    reset() {
        this.context.reps = 0;
        this.context.feedback = 'Prepare to start';
        this.context.state = {}; // Reset state container

        if (this.setupFn) {
            try {
                const utils = this.getUtils();
                // Pass the full context object. The code uses 'context.state'.
                this.setupFn(this.context, utils);
            } catch (e) {
                console.error("Setup Execution Error:", e);
            }
        }
    }

    analyze(results: Results): ExerciseState {
        if (!results.poseLandmarks) {
            return { reps: this.context.reps, feedback: 'No pose detected', status: 'waiting' };
        }

        if (!this.frameFn) {
            return { reps: this.context.reps, feedback: 'Logic not loaded', status: 'waiting' };
        }

        let debugInfo = {};

        try {
            const utils = this.getUtils();
            // Pass 'this.context' as the 'context' argument
            const output = this.frameFn(this.context, results.poseLandmarks, utils);

            if (output) {
                if (typeof output.count === 'number') {
                    // Logic returns 1 for a completed rep, or accumulative. 
                    // Prompt says "Return { count: 0 or 1 ... }".
                    // If 1, we increment.
                    if (output.count === 1) this.context.reps += 1;
                }

                if (output.feedback) {
                    this.context.feedback = output.feedback;
                }

                // logic might mutate context.state directly, or return new state.
                // If it returns state, we update it.
                if (output.state !== undefined) {
                    this.context.state = output.state;
                }

                if (output.debug) {
                    debugInfo = output.debug;
                }
            }

        } catch (e) {
            console.error("Analysis Execution Error:", e);
        }

        return {
            reps: this.context.reps,
            feedback: this.context.feedback,
            status: 'active',
            debug: debugInfo
        };
    }

    private getUtils() {
        return {
            getAngle: (p1: NormalizedLandmark, p2: NormalizedLandmark, p3: NormalizedLandmark) => {
                const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
                let angle = Math.abs(radians * 180.0 / Math.PI);
                if (angle > 180.0) angle = 360 - angle;
                return angle;
            },
            getVelocity: () => 0, // Placeholder
            isVertical: (p1: NormalizedLandmark, p2: NormalizedLandmark) => {
                return Math.abs(p1.x - p2.x) < 0.1;
            }
        };
    }

    public getKeypointsNeeded() {
        return this.keypointsNeeded;
    }
}
