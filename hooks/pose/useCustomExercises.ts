import { useState, useEffect } from 'react';
import type { GeminiResponse } from '@/lib/pose/gemini';

export interface CustomExercise {
    id: string;
    name: string;
    logic: GeminiResponse;
    createdAt: number;
}

const STORAGE_KEY = 'custom_exercises';

export function useCustomExercises() {
    const [exercises, setExercises] = useState<CustomExercise[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setExercises(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse stored exercises", e);
            }
        }
    }, []);

    const saveExercises = (newExercises: CustomExercise[]) => {
        setExercises(newExercises);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newExercises));
    };

    const addExercise = (name: string, logic: GeminiResponse) => {
        const newExercise: CustomExercise = {
            id: crypto.randomUUID(),
            name,
            logic,
            createdAt: Date.now(),
        };
        saveExercises([...exercises, newExercise]);
        return newExercise;
    };

    const updateExercise = (id: string, logic: GeminiResponse) => {
        const updated = exercises.map(ex =>
            ex.id === id ? { ...ex, logic } : ex
        );
        saveExercises(updated);
    };

    const deleteExercise = (id: string) => {
        const filtered = exercises.filter(ex => ex.id !== id);
        saveExercises(filtered);
    };

    const clearAllExercises = () => {
        setExercises([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    return {
        exercises,
        addExercise,
        updateExercise,
        deleteExercise,
        clearAllExercises
    };
}
