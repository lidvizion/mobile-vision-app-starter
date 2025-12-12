import type { ExerciseConfig } from './exercises/templates';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface SavedExercise {
    _id?: string;
    id: string; // Client-side ID (uuid)
    name: string;
    type: string;
    config: ExerciseConfig;
}

export const api = {
    /**
     * Fetch all custom exercises from the backend
     */
    async getExercises(): Promise<SavedExercise[]> {
        try {
            const res = await fetch(`${API_BASE_URL}/exercises`);
            if (!res.ok) throw new Error('Failed to fetch exercises');
            return await res.json();
        } catch (error) {
            console.warn('API /exercises fetch failed, falling back to local storage', error);
            return [];
        }
    },

    /**
     * Save a new exercise configuration to the backend
     */
    async saveExercise(exercise: SavedExercise): Promise<SavedExercise> {
        try {
            const res = await fetch(`${API_BASE_URL}/exercises`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(exercise),
            });
            if (!res.ok) throw new Error('Failed to save exercise');
            return await res.json();
        } catch (error) {
            console.error('API save failed:', error);
            throw error;
        }
    },

    /**
     * Delete an exercise
     */
    async deleteExercise(id: string): Promise<void> {
        await fetch(`${API_BASE_URL}/exercises/${id}`, {
            method: 'DELETE',
        });
    }
};
