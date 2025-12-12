import { Schema, model, models } from 'mongoose';

/**
 * Exercise Template Schema
 * Stores the configuration for AI-generated or custom exercises.
 * 
 * Target Collection: 'exercises'
 */

export interface IExerciseTemplate {
    name: string;
    type: string; // 'repetition' | 'static' | 'duration'
    description?: string;

    // The core configuration used by the TemplateExerciseRunner
    config: {
        primary_angle: {
            point1: number;
            point2: number;
            point3: number;
        };
        down_threshold: number;
        up_threshold: number;
        use_left_side: boolean;
    };

    // Metadata
    isPublic: boolean;
    createdBy?: string; // User ID if applicable
    createdAt: Date;
    updatedAt: Date;
}

const ExerciseTemplateSchema = new Schema<IExerciseTemplate>({
    name: { type: String, required: true },
    type: { type: String, required: true, default: 'repetition' },
    description: { type: String },

    config: {
        primary_angle: {
            point1: { type: Number, required: true },
            point2: { type: Number, required: true },
            point3: { type: Number, required: true },
        },
        down_threshold: { type: Number, required: true },
        up_threshold: { type: Number, required: true },
        use_left_side: { type: Boolean, default: false },
    },

    isPublic: { type: Boolean, default: false },
    createdBy: { type: String },
}, {
    timestamps: true,
});

// Prevent model recompilation in Next.js / serverless environments
export const ExerciseModel = models.Exercise || model<IExerciseTemplate>('Exercise', ExerciseTemplateSchema);
